import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { applyCharterToProject, setFieldSources } from "@/lib/tenancy/charter";

function stub(response: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: response, error });
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}

function lastCall(rpc: ReturnType<typeof stub>["rpc"]) {
  return rpc.mock.calls[rpc.mock.calls.length - 1];
}

const SITE_SPEC_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

describe("setFieldSources", () => {
  it("envoie p_site_spec_id et p_sources", async () => {
    const { rpc, client } = stub(null);
    await setFieldSources(client, {
      siteSpecId: SITE_SPEC_ID,
      sources: { primary_hex: "generated" },
    });

    expect(lastCall(rpc)).toEqual([
      "set_field_sources",
      { p_site_spec_id: SITE_SPEC_ID, p_sources: { primary_hex: "generated" } },
    ]);
  });

  it("rend data: null au succès", async () => {
    const { client } = stub(null);
    const result = await setFieldSources(client, {
      siteSpecId: SITE_SPEC_ID,
      sources: {},
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });

  it("remonte le refus owner-only tel quel — pas d'enveloppe à déballer", async () => {
    const { client } = stub(null, {
      message: "set_field_sources: only the active org owner may set or change an inherited field source",
    });
    const result = await setFieldSources(client, {
      siteSpecId: SITE_SPEC_ID,
      sources: { primary_hex: "inherited" },
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain("only the active org owner");
  });
});

describe("applyCharterToProject", () => {
  it("envoie p_organization_id et p_project_id", async () => {
    const { rpc, client } = stub(null);
    await applyCharterToProject(client, {
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
    });

    expect(lastCall(rpc)).toEqual([
      "apply_charter_to_project",
      { p_organization_id: ORG_ID, p_project_id: PROJECT_ID },
    ]);
  });

  it("rend data: null au succès", async () => {
    const { client } = stub(null);
    const result = await applyCharterToProject(client, {
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });

  it("remonte 'no charter kit' tel quel", async () => {
    const { client } = stub(null, {
      message: "apply_charter_to_project: organization has no charter kit",
    });
    const result = await applyCharterToProject(client, {
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain("no charter kit");
  });

  it("rejette une entrée mal formée avant l'appel réseau", async () => {
    const { rpc, client } = stub(null);
    await expect(
      applyCharterToProject(client, { organizationId: "not-a-uuid", projectId: PROJECT_ID })
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
