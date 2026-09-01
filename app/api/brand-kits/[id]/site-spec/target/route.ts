import type { NextRequest } from "next/server";
import { authenticate, readJson } from "@/lib/api/handler";
import { siteSpecSetTarget } from "@/lib/site/rpc";
import { siteResponse } from "@/lib/site/respond";
import { track } from "@/lib/analytics";

/*
 * POST /api/brand-kits/[id]/site-spec/target → site_spec_set_target
 *
 * Changer de constructeur REGÉNÈRE la sortie et la renvoie dans le même
 * appel : l'enveloppe complète revient, `output` compris. Le panneau de sortie
 * n'a donc aucune relecture à faire — c'est ce qui fait que les instructions
 * se réécrivent sous les yeux, sans clignoter.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/site-spec/target">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = (await readJson(request)) as { target?: unknown } | null;
  const target = typeof body?.target === "string" ? body.target : "";

  const result = await siteSpecSetTarget(auth.session.supabase, id, target);
  if (!result.ok) return siteResponse(result);

  track("builder_target_changed", { brandKitId: id, target });
  return siteResponse(result, { etag: result.data.etag });
}
