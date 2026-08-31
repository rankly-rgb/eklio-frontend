import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  authenticate,
  badRequest,
  json,
  notFound,
  readJson,
  serverError,
} from "@/lib/api/handler";
import { loadBrief, writeBriefData, writeUspOptions } from "@/lib/data/brief";
import { readCatalog } from "@/lib/catalog/read";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { generateUspOptions, partialMessageFor } from "@/lib/generation/usp-options";
import { computeScopeKey } from "@/lib/generation/scope-key";
import { computeHowYouWorkInputsHash } from "@/lib/generation/how-you-work-hash";
import { uspOptionsSchema } from "@/lib/generation/how-you-work-shapes";

/*
 * POST /api/briefs/[id]/usp-options — §2.5.
 *
 * OWNERSHIP D'ABORD, SERVICE-ROLE ENSUITE (contrat §9.6, verbatim) :
 * `loadBrief` avec le client de SESSION vérifie que `id` appartient à
 * `auth.session.userId` avant tout appel service-role. `id` ne part JAMAIS
 * vers `createAdminClient()` sans être passé par cette vérification d'abord.
 */

const bodySchema = z.object({ regenerate: z.boolean().optional() });

const REGENERATE_LIMIT = 2;
const RATE_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/briefs/[id]/usp-options">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse((await readJson(request)) ?? {});
  const regenerate = parsed.success ? (parsed.data.regenerate ?? false) : false;

  const bundle = await loadBrief(auth.session.supabase, id, auth.session.userId);
  if (!bundle) return notFound();

  const currentHash = computeHowYouWorkInputsHash(bundle.brief);
  const hashStale = bundle.data.usp_options_inputs_hash !== currentHash;

  /*
   * Un lot déjà là, sa hache correspond ENCORE à l'étape 4 telle qu'elle est
   * maintenant, et rien ne demande d'en écrire un autre : le renvoyer coûte
   * zéro appel modèle, zéro RPC. Une hache qui NE correspond plus (elle a
   * édité l'étape 4 depuis) tombe dans le même chemin qu'une génération
   * jamais faite — une vraie régénération a lieu, mais SANS consommer une
   * des deux reprises manuelles : ce n'est pas elle qui a demandé « trois de
   * plus », c'est le système qui rattrape son propre retard (correction
   * demandée, même doctrine que `tone_cards_inputs_hash`).
   */
  if (!regenerate) {
    const existing = uspOptionsSchema.safeParse(bundle.brief.usp_options);
    if (existing.success && !hashStale) {
      return json({ ok: true, options: existing.data, partial: false, stale: false });
    }
  }

  if (regenerate) {
    const used = bundle.data.usp_regenerate_count ?? 0;
    if (used >= REGENERATE_LIMIT) {
      return badRequest(
        "You've used both extra rounds on this one. Edit a statement directly, or revisit \"How you work\" for a third."
      );
    }
  }

  const limitKey = `usp-options:${auth.session.userId}`;
  const verdict = rateLimit(limitKey, RATE_LIMIT);
  if (!verdict.allowed) {
    return json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const catalog = await readCatalog(auth.session.supabase);
  const scopeKey = computeScopeKey(
    bundle.brief.specialty_ids,
    bundle.brief.state,
    catalog.specialties
  );
  if (!scopeKey) {
    return badRequest("Pick at least one specialty before generating positioning.");
  }

  try {
    const admin = createAdminClient();
    const result = await generateUspOptions(bundle, catalog, admin, scopeKey);

    // Le compteur de reprises ne monte que sur une reprise EXPLICITE — une
    // régénération automatique parce que la hache est périmée n'en coûte
    // aucune, régénération PARTIELLE comprise : elle a quand même dépensé
    // l'appel.
    const nextData = regenerate
      ? { ...bundle.data, usp_regenerate_count: (bundle.data.usp_regenerate_count ?? 0) + 1 }
      : bundle.data;

    if (result.partial) {
      // Le CHECK de la base exige EXACTEMENT trois éléments ou `null` (§9.5) :
      // un lot incomplet ne peut pas s'écrire — la hache ne bouge donc pas
      // non plus, pour que la prochaine visite retente plutôt que de
      // rouvrir un lot à moitié vrai comme s'il était à jour.
      if (regenerate) {
        const write = await writeBriefData(auth.session.supabase, id, nextData);
        if (!write.ok) return serverError("POST /api/briefs/usp-options", write.detail);
      }
      return json({
        ok: true,
        options: result.options,
        partial: true,
        message: partialMessageFor(result.options.length),
      });
    }

    const write = await writeUspOptions(auth.session.supabase, id, result.options, {
      ...nextData,
      usp_options_inputs_hash: currentHash,
    });
    if (!write.ok) return serverError("POST /api/briefs/usp-options", write.detail);

    return json({ ok: true, options: result.options, partial: false, stale: hashStale });
  } catch (error) {
    return serverError("POST /api/briefs/usp-options", error);
  }
}
