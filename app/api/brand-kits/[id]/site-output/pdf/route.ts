import type { NextRequest } from "next/server";
import { authenticate, badRequest } from "@/lib/api/handler";
import { siteOutputGet } from "@/lib/site/rpc";
import { siteResponse } from "@/lib/site/respond";
import { isSiteTarget } from "@/lib/site/types";
import { renderMarkdownPdf } from "@/lib/kit/pdf";
import { track } from "@/lib/analytics";

/*
 * GET /api/brand-kits/[id]/site-output/pdf?target=squarespace
 *
 * La feuille d'installation, imprimable. La SOURCE est `site_output_get(…,
 * 'md')` : la même sortie que celle qu'on copie, dans son format markdown. On
 * ne recompose rien — `output` est une fonction pure du spec, et le §8 du
 * contrat interdit de la réécrire côté client.
 *
 * `mark-copied` n'est PAS appelé ici : le client le fait après avoir déclenché
 * le téléchargement, pour n'avoir qu'un seul endroit où l'enveloppe revient et
 * où la bannière s'efface.
 */
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/site-output/pdf">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const target = request.nextUrl.searchParams.get("target") ?? "";
  if (!isSiteTarget(target)) {
    return badRequest("Pick one of the supported website builders.");
  }

  const result = await siteOutputGet(auth.session.supabase, id, target, "md");
  if (!result.ok) return siteResponse(result);

  // `format=md` renvoie une chaîne. Un objet ici voudrait dire que la base a
  // ignoré le format : mieux vaut le dire que d'imprimer du JSON.
  const markdown =
    typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2);

  track("setup_sheet_downloaded", { brandKitId: id, target });

  const pdf = renderMarkdownPdf(`Your site setup — ${target}`, markdown);
  return new Response(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="site-setup-${target}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
