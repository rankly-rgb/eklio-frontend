import type { NextRequest } from "next/server";
import { authenticate, badRequest } from "@/lib/api/handler";
import { siteOutputGet } from "@/lib/site/rpc";
import { siteResponse } from "@/lib/site/respond";
import { isOutputFormat, isSiteTarget } from "@/lib/site/types";

/*
 * GET /api/brand-kits/[id]/site-output?target=…&format=… → site_output_get
 *
 * La SEULE des huit entrées qui ne renvoie pas l'enveloppe : la sortie seule.
 * L'éditeur n'en a presque jamais besoin — un patch et un changement de cible
 * rapportent déjà `output` regénéré. Elle sert au téléchargement, qui demande
 * `md` ou `txt`.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/site-output">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const target = request.nextUrl.searchParams.get("target") ?? "";
  const format = request.nextUrl.searchParams.get("format") ?? "json";

  if (!isSiteTarget(target)) {
    return badRequest("Pick one of the supported website builders.");
  }
  if (!isOutputFormat(format)) {
    return badRequest("Ask for json, md or txt.");
  }

  return siteResponse(await siteOutputGet(auth.session.supabase, id, target, format));
}
