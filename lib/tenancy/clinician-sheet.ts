import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { TenancyRpcResult } from "@/lib/tenancy/rpc";

type Client = SupabaseClient<Database>;

const uuid = z.string().uuid();

/* ── lot F: the per-clinician setup sheet ────────────────────────────────
 *
 * Reuses lib/kit/pdf.ts's renderMarkdownPdf(title, markdown) for the PDF —
 * the existing markdown-to-PDF exporter, shape-agnostic, already used by
 * app/api/brand-kits/[id]/site-output/pdf/route.ts. No second PDF engine
 * here; renderSetupSheetMarkdown() below only assembles the markdown
 * string that function takes as input.
 */

const stepSchema = z.object({
  number: z.number(),
  title: z.string(),
  value: z.string(),
  warning: z.string().optional(),
  builder_hint: z.string(),
});

const setupSheetSchema = z.object({
  kind: z.literal("clinician_setup_sheet"),
  profile_id: uuid,
  full_name: z.string(),
  slug: z.string(),
  blocking: z.array(z.string()),
  steps: z.array(stepSchema),
});

export type ClinicianSetupSheetStep = z.infer<typeof stepSchema>;
export type ClinicianSetupSheet = {
  profileId: string;
  fullName: string;
  slug: string;
  blocking: string[];
  steps: ClinicianSetupSheetStep[];
};

export async function getClinicianSetupSheet(
  supabase: Client,
  input: { profileId: string }
): Promise<TenancyRpcResult<ClinicianSetupSheet>> {
  const { profileId } = z.object({ profileId: uuid }).parse(input);

  const { data, error } = await supabase.rpc("clinician_setup_sheet", {
    p_profile_id: profileId,
  });
  if (error) return { ok: false, error };

  const parsed = setupSheetSchema.parse(data);
  return {
    ok: true,
    data: {
      profileId: parsed.profile_id,
      fullName: parsed.full_name,
      slug: parsed.slug,
      blocking: parsed.blocking,
      steps: parsed.steps,
    },
  };
}

/**
 * The same sheet, as markdown — for lib/kit/pdf.ts's renderMarkdownPdf and
 * for a plain-text copy affordance. Blocking items, if any, come first as
 * a callout; every step becomes a heading plus its value, with its
 * warning (if any) as a blockquote and its builder_hint as a trailing
 * note — the same "numbered steps a human follows" shape
 * site_spec_output_render gives the solo kit's setup sheet, assembled
 * here in TypeScript since this sheet's source (clinician_setup_sheet) is
 * SECURITY INVOKER JSON, not a second SQL renderer.
 */
export function renderSetupSheetMarkdown(sheet: ClinicianSetupSheet): string {
  const lines: string[] = [];

  if (sheet.blocking.length > 0) {
    lines.push(`> Still needed before this is ready to publish: ${sheet.blocking.join(", ")}`);
    lines.push("");
  }

  for (const step of sheet.steps) {
    lines.push(`## ${step.number}. ${step.title}`);
    lines.push("");
    lines.push(step.value);
    if (step.warning) {
      lines.push("");
      lines.push(`> ${step.warning}`);
    }
    lines.push("");
    lines.push(`_${step.builder_hint}_`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

/* ── lot F: practice-level CSV, one row per clinician ──────────────────── */

const setupSheetRowSchema = z.object({
  profile_id: uuid,
  full_name: z.string(),
  slug: z.string(),
  credentials: z.string().nullable(),
  status: z.string(),
  states: z.string().nullable(),
  modalities: z.string().nullable(),
  populations: z.string().nullable(),
  rate_public: z.string().nullable(),
  booking_url: z.string().nullable(),
  photo_ready: z.boolean(),
  blocking: z.array(z.string()),
});

export type SetupSheetRow = z.infer<typeof setupSheetRowSchema>;

export async function getOrganizationSetupSheetRows(
  supabase: Client,
  input: { organizationId: string }
): Promise<TenancyRpcResult<SetupSheetRow[]>> {
  const { organizationId } = z.object({ organizationId: uuid }).parse(input);

  const { data, error } = await supabase.rpc("organization_setup_sheet_rows", {
    p_organization_id: organizationId,
  });
  if (error) return { ok: false, error };

  return { ok: true, data: (data ?? []).map((row) => setupSheetRowSchema.parse(row)) };
}

const CSV_HEADER = [
  "Name",
  "Slug",
  "Credentials",
  "Status",
  "Licensed states",
  "Modalities",
  "Populations",
  "Rate",
  "Booking link",
  "Photo on file",
  "Still needed",
];

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Hand-written, no library — same house style as lib/kit/pdf.ts's
 * hand-rolled PDF writer (a dependency for a format this simple was
 * rejected there for the same reason it would be here).
 */
export function buildSetupSheetsCsv(rows: SetupSheetRow[]): string {
  const lines = [CSV_HEADER.map(csvField).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.full_name,
        row.slug,
        row.credentials ?? "",
        row.status,
        row.states ?? "",
        row.modalities ?? "",
        row.populations ?? "",
        row.rate_public ?? "",
        row.booking_url ?? "",
        row.photo_ready ? "Yes" : "No",
        row.blocking.join("; "),
      ]
        .map(csvField)
        .join(",")
    );
  }

  return lines.join("\r\n") + "\r\n";
}

/* ── lot G: the grid, with proposed titles/slugs ─────────────────────── */

const gridProposalRowSchema = z.object({
  grid: z.enum(["modality_state", "modality_population"]),
  modality_id: z.string(),
  axis_id: z.string(),
  clinician_count: z.number(),
  proposed_title: z.string(),
  proposed_slug: z.string(),
  has_page: z.boolean(),
});

export type SeoGridProposalRow = z.infer<typeof gridProposalRowSchema>;

export async function getOrganizationSeoGridProposals(
  supabase: Client,
  input: { organizationId: string }
): Promise<TenancyRpcResult<SeoGridProposalRow[]>> {
  const { organizationId } = z.object({ organizationId: uuid }).parse(input);

  const { data, error } = await supabase.rpc("organization_seo_grid_proposals", {
    p_organization_id: organizationId,
  });
  if (error) return { ok: false, error };

  return { ok: true, data: (data ?? []).map((row) => gridProposalRowSchema.parse(row)) };
}
