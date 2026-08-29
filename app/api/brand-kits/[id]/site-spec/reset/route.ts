import type { NextRequest } from "next/server";
import { authenticate, readJson } from "@/lib/api/handler";
import { siteSpecReset } from "@/lib/site/rpc";
import { siteResponse } from "@/lib/site/respond";
import { track } from "@/lib/analytics";

/*
 * POST /api/brand-kits/[id]/site-spec/reset → site_spec_reset
 *
 * La portée n'est PAS validée ici : `invalid_scope` est un code du contrat,
 * avec un message écrit pour être affiché (« Reset all, colors, typography,
 * copy or structure. »). Le doubler côté route donnerait deux messages pour
 * une seule erreur, et le nôtre vieillirait le jour où une portée s'ajoute.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/site-spec/reset">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = (await readJson(request)) as { scope?: unknown } | null;
  const scope = typeof body?.scope === "string" ? body.scope : "all";

  const result = await siteSpecReset(auth.session.supabase, id, scope);
  if (!result.ok) return siteResponse(result);

  track("site_spec_reset", { brandKitId: id, scope });
  return siteResponse(result, { etag: result.data.etag });
}
