import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { authenticate, badRequest, generationErrorResponse, readJson, serverError } from "@/lib/api/handler";
import { getAnthropicClient } from "@/lib/ai/client";
import { contentResponse } from "@/lib/content/respond";
import { loadBrandKit } from "@/lib/data/brand-kit";
import {
  contentMonthKey,
  getContentCheckin,
  getContentItem,
  getContentPreferences,
} from "@/lib/data/content";
import { applyWrite, beginWrite, releaseWrite, suggestedTopicSchema } from "@/lib/data/on-demand";
import { runOnDemandWrite, toTopicRequest, writeAction } from "@/lib/content/generate/on-demand";
import { syncCostUsd } from "@/lib/content/generate/copy-batch";
import { ethicsRulesFor } from "@/lib/content/generate/ethics-rules";

/*
 * POST /api/content-items/[id]/write — « Write it ».
 *
 * ⚠ LE SEUL ENDROIT OÙ UN APPEL DE MODÈLE PART À LA DEMANDE, et il suit
 * exactement l'ordre du chemin mensuel :
 *
 *   réserver le crédit  →  appeler  →  valider  →  écrire et régler
 *                                   ↘  échouer  →  relâcher
 *
 * ⚠ ET LA RÉSERVATION EST AVANT L'APPEL, PAS APRÈS. Après, un quota épuisé se
 * découvrirait une fois les jetons dépensés — c'est-à-dire qu'Eklio aurait
 * payé pour un post qu'elle n'a pas le droit d'avoir.
 *
 * ⚠ L'IDEMPOTENCE EST EN BASE. `begin_on_demand_write` porte une clef unique
 * sur (post, idempotency_key) : deux clics, deux onglets ou une requête
 * rejouée réservent une fois et écrivent une fois. Un bouton désactivé ne
 * couvre que le premier des trois.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  /** La clef que le client génère pour CETTE intention. 8 à 128 caractères. */
  idempotencyKey: z.string().min(8).max(128),
  format: z.enum(["single", "carousel"]).default("single"),
  /** Le sujet choisi parmi les suggestions, tel qu'il a été proposé. */
  topic: suggestedTopicSchema.nullable().default(null),
  /** Son idée, quand elle n'a pas pris de sujet. */
  idea: z.string().trim().min(3).max(280).nullable().default(null),
  /** Autorise l'écrasement de ce qu'elle a déjà écrit sur ce post. */
  overwrite: z.boolean().default(false),
});

export async function POST(request: Request, ctx: RouteContext<"/api/content-items/[id]/write">) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) {
    return badRequest(body.error.issues[0]?.message ?? "That request could not be read.");
  }
  if (!body.data.topic && !body.data.idea) {
    return badRequest("Pick one of the suggestions, or tell Eklio your own idea.");
  }

  const supabase = auth.session.supabase;

  try {
    const existing = await getContentItem(supabase, id);
    if (!existing.ok) return contentResponse(existing);
    const item = existing.data;

    /*
     * ⚠ CE QU'ELLE A ÉCRIT N'EST JAMAIS ÉCRASÉ SANS SON ACCORD. On le dit
     * AVANT de réserver quoi que ce soit : découvrir ce refus après avoir
     * dépensé un crédit serait le pire ordre possible.
     */
    const hasHerWords =
      (item.caption ?? "").trim() !== "" || (item.title ?? "").trim() !== "";
    if (hasHerWords && !body.data.overwrite) {
      return Response.json(
        {
          error: "You have already written something here. Writing over it would replace your words.",
          code: "would_overwrite",
        },
        { status: 409 }
      );
    }

    const kit = await loadBrandKit(supabase, item.brand_kit_id, auth.session.userId);
    if (!kit) return Response.json({ error: "No such post.", code: "not_found" }, { status: 404 });

    /*
     * ⚠ LE CLIENT EST CONSTRUIT AVANT LA RÉSERVATION. Une clef absente doit
     * répondre « pas activé » sans avoir touché au journal de crédits : sinon
     * un environnement non configuré consommerait le quota de la cliente à
     * chaque clic.
     */
    const anthropic = getAnthropicClient();

    const begun = await beginWrite(supabase, id, body.data.idempotencyKey);
    if (!begun.ok) return contentResponse(begun);

    const action = writeAction(begun.data);
    if (action === "already_written") {
      // Déjà écrit par la même intention : on rend le post tel qu'il est.
      return contentResponse(await getContentItem(supabase, id));
    }
    if (action === "not_reserved") {
      /*
       * Rien n'est tenu, donc rien ne sera écrit. Le dire plutôt que de rendre
       * le post inchangé : un écran qui ne bouge pas après un clic se relit
       * comme une panne muette.
       */
      return Response.json(
        {
          error: "That attempt did not finish. Try it again — nothing was charged.",
          code: "not_reserved",
        },
        { status: 409 }
      );
    }

    /*
     * ⚠ SA DATE, SINON CELLE DE SA CRÉATION. Le crédit est réservé sur CE
     * mois-là : un post de janvier rouvert en septembre ne doit pas piocher
     * dans le quota de septembre, et l'écran qui affiche « 9 left » lit le
     * même mois que la réservation.
     */
    const month = contentMonthKey(new Date(item.scheduled_for ?? item.created_at));
    const [preferences, checkin] = await Promise.all([
      getContentPreferences(supabase, item.brand_kit_id),
      getContentCheckin(supabase, item.brand_kit_id, month),
    ]);

    const brand = {
      practiceName: kit.practiceName ?? "this practice",
      voice: kit.selectedDirection?.name ?? "warm, plain, unhurried",
      offLimits: preferences?.off_limits ?? "",
      ethicsRules: await ethicsRulesFor(supabase),
    };

    const req = toTopicRequest({
      topic: body.data.topic,
      idea: body.data.idea,
      format: body.data.format,
      checkin: [checkin?.sessions_theme, checkin?.happening].filter(Boolean).join(" · "),
      existingTitle: item.title,
      existingCaption: item.caption,
    });

    const written = await runOnDemandWrite(
      { create: (params) => anthropic.messages.create(params) },
      { brand, request: req }
    );

    if (!written.ok) {
      /*
       * ⚠ LE CRÉDIT REVIENT. Rien n'a été produit : ni carte, ni légende. Le
       * journal garde la réservation ET sa libération — c'est un fait qui
       * s'est produit — mais le SOLDE est inchangé.
       */
      await releaseWrite(supabase, begun.data.write_id);
      return Response.json(
        {
          error: refusalMessage(written.reason),
          code: written.reason ?? "generation_failed",
        },
        { status: 422 }
      );
    }

    const applied = await applyWrite(supabase, {
      writeId: begun.data.write_id,
      title: written.title ?? null,
      caption: written.caption ?? null,
      onImageText: written.onImageText ?? null,
      altText: written.altText ?? null,
      composeArchetype: written.archetypeKey,
      payload: written.payload,
      rationale: written.rationale ?? null,
      topicId: body.data.topic?.id ?? null,
      /*
       * ⚠ CE QUE L'APPEL A COÛTÉ, ET IL VALAIT `null` JUSQU'ICI. `written`
       * porte son `usage` — même quand la sortie a été rejetée et relancée —
       * et `apply_on_demand_write` accepte `p_cost_usd` depuis le premier
       * jour. Entre les deux, cette ligne jetait le chiffre : le ledger
       * comptait le crédit et perdait l'argent, et le premier rendu réel
       * l'a découvert en essayant d'y lire une dépense.
       */
      costUsd: syncCostUsd(written.usage),
    });
    if (!applied.ok) {
      /*
       * ⚠ L'ÉCRITURE PEUT ÊTRE REFUSÉE PAR LA BASE APRÈS UN APPEL RÉUSSI :
       * la garde déontologique tourne sur le payload au moment de l'UPDATE.
       * Le crédit revient, et le message dit ce que la base a dit — c'est la
       * seule formulation qui ne soit pas une devinette.
       */
      await releaseWrite(supabase, begun.data.write_id);
      return contentResponse(applied);
    }

    return contentResponse(await getContentItem(supabase, id));
  } catch (error) {
    if (error instanceof Anthropic.APIError || (error as Error)?.name === "AnthropicNotConfiguredError") {
      return generationErrorResponse("POST /api/content-items/[id]/write", error);
    }
    return serverError("POST /api/content-items/[id]/write", error);
  }
}

/**
 * Ce qu'on lui dit quand la génération n'a pas abouti.
 *
 * ⚠ AUCUN REFUS SEC, ET AUCUN JARGON. « payload_shape » ne veut rien dire
 * pour elle ; ce qu'elle a besoin de savoir est si ça vaut la peine de
 * réessayer et avec quoi.
 */
function refusalMessage(reason: string | undefined): string {
  switch (reason) {
    case "over_budget":
      return "That came out too long for a card. Try it again, or say the idea in fewer words.";
    case "payload_shape":
    case "not_json":
    case "missing_fields":
      return "That did not come together. Try it again — nothing was charged.";
    case "caption_too_long":
    case "alt_text_too_long":
      return "The caption came back too long. Try it again.";
    default:
      return "That did not come together. Try it again — nothing was charged.";
  }
}
