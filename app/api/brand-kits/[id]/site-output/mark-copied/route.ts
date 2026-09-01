import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/handler";
import { siteOutputMarkCopied } from "@/lib/site/rpc";
import { siteResponse } from "@/lib/site/respond";
import { track } from "@/lib/analytics";

/*
 * POST /api/brand-kits/[id]/site-output/mark-copied → site_output_mark_copied
 *
 * C'est ce qui EFFACE la bannière de péremption : l'appel avance
 * `last_copied_spec_version` sur `spec_version`, et l'enveloppe renvoyée porte
 * `diff.stale = false`.
 *
 * L'etag bouge avec — il couvre `last_copied_spec_version` depuis la migration
 * `20260829116000`. Avant elle, un client qui relisait après la copie recevait
 * un 304 et gardait la bannière à l'écran. Une seconde copie redondante, elle,
 * ne bouge rien : le no-op reste un no-op.
 */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/site-output/mark-copied">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const result = await siteOutputMarkCopied(auth.session.supabase, id);
  if (!result.ok) return siteResponse(result);

  track("site_output_copied", {
    brandKitId: id,
    kind: result.data.output.kind,
    target: result.data.spec.target,
  });

  return siteResponse(result, { etag: result.data.etag });
}
