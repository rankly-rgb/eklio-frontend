import type { NextRequest } from "next/server";
import { json, notFound, serverError } from "@/lib/api/handler";
import { loadBrief, writeToneCards } from "@/lib/data/brief";
import { readCatalog } from "@/lib/catalog/read";
import { generateToneCards } from "@/lib/generation/tone-cards";
import { computeHowYouWorkInputsHash } from "@/lib/generation/how-you-work-hash";
import { toneCardsSchema } from "@/lib/generation/how-you-work-shapes";
import { resolveBriefCaller } from "@/lib/anon/session";
import { consumeAnonSpend, noBriefResponse } from "@/lib/anon/spend";

/*
 * POST /api/briefs/[id]/tone-cards — §2.2.
 *
 * IDEMPOTENT à dessein : le client appelle cette route à CHAQUE entrée sur
 * l'étape 5, sans garder trace lui-même de ce qui a déjà été généré. C'est le
 * serveur qui décide, en comparant `tone_cards_inputs_hash`, s'il y a
 * réellement quelque chose à faire — la même donnée que le §2.2 demande de
 * vérifier, mais vérifiée ici plutôt que dupliquée côté client.
 *
 * ⚠ ANONYME AUSSI, DEPUIS QUE LE BRIEF TOURNE SANS COMPTE. Cette route
 * appelait `authenticate()`, ce qui la rendait deux fois fausse : l'étape 5
 * répondait 401 à une visiteuse parfaitement légitime, et l'appel modèle
 * qu'elle porte échappait au plafond posé sur `generate`. Les deux se
 * réparent au même endroit — `resolveBriefCaller` décide QUI demande, la base
 * décide ce que ça donne le droit de lire.
 */

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/briefs/[id]/tone-cards">
) {
  const caller = await resolveBriefCaller();
  if (caller.kind === "none") return noBriefResponse();

  const { id } = await ctx.params;
  const bundle = await loadBrief(caller.supabase, id, caller.userId);
  if (!bundle) return notFound();

  const catalog = await readCatalog(caller.supabase);
  const currentHash = computeHowYouWorkInputsHash(bundle.brief);

  const existing = toneCardsSchema.safeParse(bundle.brief.tone_cards);
  if (existing.success && bundle.brief.tone_cards_inputs_hash === currentHash) {
    return json({ ok: true, tone_cards: existing.data, generated: true });
  }

  /*
   * ⚠ LE PLAFOND ICI, ET PAS PLUS HAUT. Au-dessus de la lecture du cache, il
   * ferait payer une visiteuse qui ne fait que revenir sur l'étape 5 — la
   * route est appelée à chaque entrée. À partir d'ici, un appel modèle va
   * vraiment avoir lieu, donc il se compte.
   */
  if (caller.kind === "anon") {
    const refusal = await consumeAnonSpend("assist", request);
    if (refusal) return refusal;
  }

  try {
    const result = await generateToneCards(bundle, catalog);

    if (!result.ok) {
      return json({
        ok: true,
        fallback: true,
        message:
          "These are our standard openings — we couldn't write custom ones just now.",
      });
    }

    const write = await writeToneCards(
      caller.supabase,
      id,
      result.cards,
      currentHash
    );
    if (!write.ok) return serverError("POST /api/briefs/tone-cards", write.detail);

    return json({ ok: true, tone_cards: result.cards, generated: true });
  } catch (error) {
    return serverError("POST /api/briefs/tone-cards", error);
  }
}
