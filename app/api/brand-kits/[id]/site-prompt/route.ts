import type { NextRequest } from "next/server";
import { authenticate, badRequest, json, notFound } from "@/lib/api/handler";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { SITE_PROMPT_TARGETS, buildSitePrompt } from "@/lib/kit/site-prompt";
import { track } from "@/lib/analytics";

/*
 * GET /api/brand-kits/[id]/site-prompt?target=squarespace
 *
 * Le prompt est COMPOSÉ à la lecture, à partir de la direction retenue : c'est
 * une projection déterministe du kit, pas une génération. Le stocker figerait
 * le prompt d'un praticien qui change de direction après coup.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/site-prompt">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const target = request.nextUrl.searchParams.get("target") ?? "squarespace";

  if (!SITE_PROMPT_TARGETS.some((entry) => entry.id === target)) {
    return badRequest("Pick one of the supported website builders.");
  }

  const kit = await loadBrandKit(auth.session.supabase, id, auth.session.userId);
  if (!kit) return notFound();
  if (!kit.selectedDirection) {
    return badRequest("Choose a direction before copying the site prompt.");
  }

  track("site_prompt_copied", { brandKitId: id, target });

  return json({
    target,
    prompt: buildSitePrompt(kit, target as (typeof SITE_PROMPT_TARGETS)[number]["id"]),
  });
}
