import type { NextRequest } from "next/server";
import { authenticate, readJson } from "@/lib/api/handler";
import { siteSpecFixContrast } from "@/lib/site/rpc";
import { siteResponse } from "@/lib/site/respond";
import { track } from "@/lib/analytics";

/*
 * POST /api/brand-kits/[id]/site-spec/fix-contrast → site_spec_fix_contrast
 *
 * On envoie un `pair_id`, JAMAIS un hex : la base recalcule la suggestion
 * contre le spec tel qu'il est au moment de l'appel. Un hex venu du client
 * serait celui d'avant l'écriture précédente.
 *
 * `no_fix_needed` remonte en 409 (cf. `lib/site/rpc.ts`). Ce n'est pas une
 * erreur causée par l'utilisatrice : la paire passait déjà. Le client en fait
 * un no-op.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/site-spec/fix-contrast">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = (await readJson(request)) as { pair_id?: unknown } | null;
  const pairId = typeof body?.pair_id === "string" ? body.pair_id : "";

  const result = await siteSpecFixContrast(auth.session.supabase, id, pairId);
  if (!result.ok) return siteResponse(result);

  track("contrast_fix_applied", {
    brandKitId: id,
    pairId,
    // L'état APRÈS coup, pas celui de la paire cliquée : un correctif déplace
    // un jeton, et toute paire qui le partage bouge avec lui.
    passesAa: result.data.contrast.passes_aa,
  });
  return siteResponse(result, { etag: result.data.etag });
}
