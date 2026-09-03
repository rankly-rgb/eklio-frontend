import type { NextRequest } from "next/server";
import { authenticate, notFound, serverError } from "@/lib/api/handler";
import { loadOwnedOrganization } from "@/lib/data/organization";
import { getOrganizationSetupSheetRows, buildSetupSheetsCsv } from "@/lib/tenancy/clinician-sheet";

/*
 * The practice-level CSV, one row per clinician — for an office manager
 * working through a batch. Hand-written CSV (lib/tenancy/clinician-sheet.ts),
 * no library, same house style as lib/kit/pdf.ts's hand-rolled PDF writer.
 */
export async function GET(_request: NextRequest) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { supabase, userId } = auth.session;

  const org = await loadOwnedOrganization(supabase, userId);
  if (!org) return notFound();

  const rows = await getOrganizationSetupSheetRows(supabase, { organizationId: org.id });
  if (!rows.ok) return serverError("GET /api/practice/sheets/csv", rows.error);

  const csv = buildSetupSheetsCsv(rows.data);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="clinician-setup-sheets.csv"',
      "cache-control": "no-store",
    },
  });
}
