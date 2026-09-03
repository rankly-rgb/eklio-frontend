import type { NextRequest } from "next/server";
import { authenticate, notFound, serverError } from "@/lib/api/handler";
import { getClinicianSetupSheet, renderSetupSheetMarkdown } from "@/lib/tenancy/clinician-sheet";
import { renderMarkdownPdf } from "@/lib/kit/pdf";

/*
 * Reuses lib/kit/pdf.ts's renderMarkdownPdf(title, markdown) — the same
 * exporter app/api/brand-kits/[id]/site-output/pdf/route.ts already uses.
 * No second PDF engine: this route only assembles the markdown
 * (renderSetupSheetMarkdown) and the title.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/practice/[memberId]/sheet/pdf">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { memberId } = await ctx.params;
  const { supabase } = auth.session;

  const { data: profile, error: profileError } = await supabase
    .from("clinician_profiles")
    .select("id, full_name")
    .eq("member_id", memberId)
    .maybeSingle();
  if (profileError) return serverError("GET /api/practice/[memberId]/sheet/pdf", profileError);
  if (!profile) return notFound();

  const sheet = await getClinicianSetupSheet(supabase, { profileId: profile.id });
  if (!sheet.ok) return serverError("GET /api/practice/[memberId]/sheet/pdf", sheet.error);

  const markdown = renderSetupSheetMarkdown(sheet.data);
  const pdf = renderMarkdownPdf(`${sheet.data.fullName || "Setup sheet"} — setup sheet`, markdown);

  return new Response(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${sheet.data.slug || "setup-sheet"}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
