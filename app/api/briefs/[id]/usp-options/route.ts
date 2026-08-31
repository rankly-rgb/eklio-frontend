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
import { loadBrief, writeUspOptions } from "@/lib/data/brief";
import { readCatalog } from "@/lib/catalog/read";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { generateUspOptions, partialMessageFor } from "@/lib/generation/usp-options";
import { computeScopeKey } from "@/lib/generation/scope-key";
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

  // Un lot déjà là, et rien ne demande d'en écrire un autre : le renvoyer
  // coûte zéro appel modèle, zéro RPC.
  if (!regenerate) {
    const existing = uspOptionsSchema.safeParse(bundle.brief.usp_options);
    if (existing.success) {
      return json({ ok: true, options: existing.data, partial: false });
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

    if (regenerate) {
      const nextData = {
        ...bundle.data,
        usp_regenerate_count: (bundle.data.usp_regenerate_count ?? 0) + 1,
      };
      await auth.session.supabase
        .from("project_briefs")
        .update({ data: nextData, updated_at: new Date().toISOString() })
        .eq("project_id", id);
    }

    if (result.partial) {
      // Le CHECK de la base exige EXACTEMENT trois éléments ou `null` (§9.5) :
      // un lot incomplet ne peut pas s'écrire. Il part au client tel quel,
      // sans persister — la prochaine visite regénère plutôt que de rouvrir
      // un lot à moitié vrai.
      return json({
        ok: true,
        options: result.options,
        partial: true,
        message: partialMessageFor(result.options.length),
      });
    }

    const write = await writeUspOptions(auth.session.supabase, id, result.options);
    if (!write.ok) return serverError("POST /api/briefs/usp-options", write.detail);

    return json({ ok: true, options: result.options, partial: false });
  } catch (error) {
    return serverError("POST /api/briefs/usp-options", error);
  }
}
