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
import { loadBrief } from "@/lib/data/brief";
import { createAdminClient } from "@/lib/supabase/server";
import { track } from "@/lib/analytics";
import { computeScopeKey } from "@/lib/generation/scope-key";
import { readCatalog } from "@/lib/catalog/read";
import { uspOptionsSchema } from "@/lib/generation/how-you-work-shapes";

/*
 * POST /api/briefs/[id]/usp-confirm — §2.4.
 *
 * « This warns, it never gates — same doctrine as the contrast warnings in
 * the site editor. » Un premier appel VÉRIFIE sans écrire ; une collision
 * répond sans toucher la base. `keepMine: true` (posé par le bouton
 * « Keep mine ») force l'écriture malgré la collision — c'est TOUJOURS son
 * choix qui gagne, jamais la vérification.
 *
 * Même doctrine d'ownership que les deux routes précédentes : `loadBrief`
 * avec le client de session avant tout appel service-role.
 */

const bodySchema = z.object({
  selected_usp_id: z.string(),
  statement: z.string().trim().min(1).max(200),
  keepMine: z.boolean().optional(),
});

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/briefs/[id]/usp-confirm">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("That positioning doesn't look complete yet.");
  const { selected_usp_id, statement, keepMine } = parsed.data;

  const bundle = await loadBrief(auth.session.supabase, id, auth.session.userId);
  if (!bundle) return notFound();

  const options = uspOptionsSchema.safeParse(bundle.brief.usp_options);
  const chosen = options.success
    ? options.data.find((entry) => entry.id === selected_usp_id)
    : null;
  if (!chosen) {
    return badRequest("Pick one of the three positioning options first.");
  }

  const catalog = await readCatalog(auth.session.supabase);
  const scopeKey = computeScopeKey(
    bundle.brief.specialty_ids,
    bundle.brief.state,
    catalog.specialties
  );
  if (!scopeKey) return badRequest("Pick at least one specialty first.");

  try {
    const admin = createAdminClient();

    if (!keepMine) {
      const { data, error } = await admin.rpc("usp_check_distinct", {
        p_scope_key: scopeKey,
        p_statement: statement,
        p_exclude_brief: id,
      });
      if (error) return serverError("POST /api/briefs/usp-confirm", error);

      const verdict = data as { distinct: boolean; best_similarity: number };
      if (!verdict.distinct) {
        track("usp_collision_warned", { brief_id: id });
        // `conflicting_statement` ne part JAMAIS au client (§9.10) — les
        // deux autres options déjà générées servent d'alternative sûre.
        const alternatives = options.success
          ? options.data
              .filter((entry) => entry.id !== selected_usp_id)
              .map((entry) => ({ id: entry.id, statement: entry.statement }))
          : [];
        return json({ ok: true, collision: true, alternatives });
      }
    } else {
      track("usp_collision_kept", { brief_id: id });
    }

    const { error: patchError } = await auth.session.supabase
      .from("project_briefs")
      .update({
        selected_usp_id,
        usp_statement: statement,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", id);
    if (patchError) return serverError("POST /api/briefs/usp-confirm", patchError);

    const { error: fingerprintError } = await admin.rpc("usp_fingerprint_confirm", {
      p_brief_id: id,
      p_statement: statement,
    });
    if (fingerprintError) {
      return serverError("POST /api/briefs/usp-confirm", fingerprintError);
    }

    track(statement.trim() === chosen.statement.trim() ? "usp_selected" : "usp_edited", {
      brief_id: id,
      angle: chosen.angle,
    });

    return json({ ok: true, collision: false });
  } catch (error) {
    return serverError("POST /api/briefs/usp-confirm", error);
  }
}
