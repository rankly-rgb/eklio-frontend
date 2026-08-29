import type { NextRequest } from "next/server";
import { authenticate, badRequest, readJson } from "@/lib/api/handler";
import { siteSpecGet, siteSpecPatch } from "@/lib/site/rpc";
import { ifNoneMatch, notModified, siteResponse } from "@/lib/site/respond";
import { patchAreas, sanitizePatch } from "@/lib/site/patch";
import { track } from "@/lib/analytics";

/*
 * GET  /api/brand-kits/[id]/site-spec   → site_spec_get
 * PATCH /api/brand-kits/[id]/site-spec  → site_spec_patch
 *
 * Les deux forwardent le JWT de l'appelante : le client vient de
 * `authenticate()`, donc clé anon + cookies de session. Jamais `service_role`,
 * où `auth.uid()` vaut NULL et où l'appel répond `unauthenticated` (§1).
 *
 * L'enveloppe est renvoyée TELLE QUELLE. La route ne compose rien, ne
 * recalcule rien, ne retire rien.
 */

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/site-spec">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const result = await siteSpecGet(auth.session.supabase, id);
  if (!result.ok) return siteResponse(result);

  /*
   * L'etag couvre désormais CINQ entrées, dont `last_copied_spec_version` et
   * une empreinte de catalogue (§1). Un 304 est donc sûr : il ne peut plus
   * laisser la bannière de péremption à l'écran après la copie qui l'efface.
   */
  const etag = result.data.etag;
  if (ifNoneMatch(request) === etag) return notModified(etag);

  return siteResponse(result, { etag });
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/site-spec">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = await readJson(request);

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return badRequest("The update must be a JSON object.");
  }

  // Garde de composant, pas validation : la base refuserait une variante
  // dérivée avec `unknown_field`, mais sur un contrôle qui n'existe pas.
  const patch = sanitizePatch(body as object);
  const result = await siteSpecPatch(auth.session.supabase, id, patch);
  if (!result.ok) return siteResponse(result);

  for (const area of patchAreas(patch)) {
    track("site_spec_edited", { brandKitId: id, area });
  }
  if ("extra_instructions" in patch) {
    track("extra_instructions_used", { brandKitId: id });
  }

  return siteResponse(result, { etag: result.data.etag });
}
