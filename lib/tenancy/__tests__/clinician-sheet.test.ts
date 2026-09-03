import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  getClinicianSetupSheet,
  renderSetupSheetMarkdown,
  getOrganizationSetupSheetRows,
  buildSetupSheetsCsv,
  getOrganizationSeoGridProposals,
  type ClinicianSetupSheet,
  type SetupSheetRow,
} from "@/lib/tenancy/clinician-sheet";

const PROFILE_ID = "44444444-4444-4444-8444-444444444444";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

function stub(response: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: response, error });
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}

describe("getClinicianSetupSheet", () => {
  it("maps the jsonb envelope into a camelCase shape", async () => {
    const { rpc, client } = stub({
      kind: "clinician_setup_sheet",
      profile_id: PROFILE_ID,
      full_name: "Jane Doe",
      slug: "jane-doe",
      blocking: ["credentials"],
      steps: [
        { number: 1, title: "Page title", value: "Jane Doe | Willow", builder_hint: "SEO title" },
      ],
    });

    const result = await getClinicianSetupSheet(client, { profileId: PROFILE_ID });

    expect(rpc).toHaveBeenCalledWith("clinician_setup_sheet", { p_profile_id: PROFILE_ID });
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toEqual({
      profileId: PROFILE_ID,
      fullName: "Jane Doe",
      slug: "jane-doe",
      blocking: ["credentials"],
      steps: [
        { number: 1, title: "Page title", value: "Jane Doe | Willow", builder_hint: "SEO title" },
      ],
    });
  });
});

describe("renderSetupSheetMarkdown", () => {
  const base: ClinicianSetupSheet = {
    profileId: PROFILE_ID,
    fullName: "Jane Doe",
    slug: "jane-doe",
    blocking: [],
    steps: [
      { number: 1, title: "Page title", value: "Jane Doe | Willow", builder_hint: "SEO title" },
      {
        number: 2,
        title: "URL slug",
        value: "jane-doe",
        warning: "Use this exact slug.",
        builder_hint: "URL settings",
      },
    ],
  };

  it("renders every step as a numbered heading with its value", () => {
    const md = renderSetupSheetMarkdown(base);
    expect(md).toContain("## 1. Page title");
    expect(md).toContain("Jane Doe | Willow");
    expect(md).toContain("## 2. URL slug");
  });

  it("renders a step's warning as a blockquote", () => {
    const md = renderSetupSheetMarkdown(base);
    expect(md).toContain("> Use this exact slug.");
  });

  it("puts blocking items in a callout at the top when present", () => {
    const md = renderSetupSheetMarkdown({ ...base, blocking: ["credentials", "philosophy_quote"] });
    expect(md.indexOf("credentials")).toBeLessThan(md.indexOf("## 1."));
  });

  it("omits the blocking callout when nothing is missing", () => {
    const md = renderSetupSheetMarkdown(base);
    expect(md).not.toContain("Still needed");
  });
});

describe("getOrganizationSetupSheetRows", () => {
  it("passes p_organization_id and returns the rows as-is", async () => {
    const row = {
      profile_id: PROFILE_ID,
      full_name: "Jane Doe",
      slug: "jane-doe",
      credentials: "LPC",
      status: "licensed",
      states: "Oregon",
      modalities: "EMDR",
      populations: "Couples",
      rate_public: "$150.00",
      booking_url: "https://example.com",
      photo_ready: true,
      blocking: [],
    };
    const { rpc, client } = stub([row]);

    const result = await getOrganizationSetupSheetRows(client, { organizationId: ORG_ID });

    expect(rpc).toHaveBeenCalledWith("organization_setup_sheet_rows", {
      p_organization_id: ORG_ID,
    });
    expect(result.ok && result.data).toEqual([row]);
  });
});

describe("buildSetupSheetsCsv", () => {
  const rows: SetupSheetRow[] = [
    {
      profile_id: PROFILE_ID,
      full_name: "Jane Doe",
      slug: "jane-doe",
      credentials: "LPC",
      status: "licensed",
      states: "Oregon, Washington",
      modalities: "EMDR",
      populations: "Couples",
      rate_public: "$150.00",
      booking_url: "https://example.com",
      photo_ready: true,
      blocking: [],
    },
  ];

  it("has a header row naming every field", () => {
    const csv = buildSetupSheetsCsv([]);
    expect(csv.split("\r\n")[0]).toBe(
      "Name,Slug,Credentials,Status,Licensed states,Modalities,Populations,Rate,Booking link,Photo on file,Still needed"
    );
  });

  it("quotes a field containing a comma", () => {
    const csv = buildSetupSheetsCsv(rows);
    expect(csv).toContain('"Oregon, Washington"');
  });

  it("renders photo_ready as Yes/No", () => {
    const csv = buildSetupSheetsCsv(rows);
    expect(csv).toContain(",Yes,");
  });

  it("joins blocking items with a semicolon", () => {
    const csv = buildSetupSheetsCsv([{ ...rows[0], blocking: ["credentials", "philosophy_quote"] }]);
    expect(csv).toContain("credentials; philosophy_quote");
  });
});

describe("getOrganizationSeoGridProposals", () => {
  it("passes p_organization_id and returns the rows as-is", async () => {
    const row = {
      grid: "modality_state" as const,
      modality_id: "emdr",
      axis_id: "OR",
      clinician_count: 2,
      proposed_title: "EMDR Therapy in Oregon | Willow Practice",
      proposed_slug: "emdr-oregon",
      has_page: false,
    };
    const { rpc, client } = stub([row]);

    const result = await getOrganizationSeoGridProposals(client, { organizationId: ORG_ID });

    expect(rpc).toHaveBeenCalledWith("organization_seo_grid_proposals", {
      p_organization_id: ORG_ID,
    });
    expect(result.ok && result.data).toEqual([row]);
  });
});
