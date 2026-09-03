import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  getOrganizationEntitlement,
  isSeatAllowanceExceeded,
} from "@/lib/tenancy/entitlement";

const ORG_ID = "22222222-2222-4222-8222-222222222222";

function stub(response: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: response, error });
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}

describe("getOrganizationEntitlement", () => {
  it("maps the jsonb envelope into a camelCase shape", async () => {
    const { rpc, client } = stub({
      tier: "practice_seats",
      seat_count: 3,
      seat_allowance: 10,
      capabilities: {
        charter: true,
        clinician_profiles: true,
        grid: true,
        setup_sheets: true,
      },
    });

    const result = await getOrganizationEntitlement(client, { organizationId: ORG_ID });

    expect(rpc).toHaveBeenCalledWith("organization_entitlement", {
      p_organization_id: ORG_ID,
    });
    expect(result.ok && result.data).toEqual({
      tier: "practice_seats",
      seatCount: 3,
      seatAllowance: 10,
      capabilities: {
        charter: true,
        clinicianProfiles: true,
        grid: true,
        setupSheets: true,
      },
    });
  });
});

describe("isSeatAllowanceExceeded", () => {
  it("recognizes the named error", () => {
    expect(
      isSeatAllowanceExceeded({
        message: "create_org_invite: seat_allowance_exceeded — 10 of 10 seats used",
      })
    ).toBe(true);
  });

  it("does not match an unrelated error", () => {
    expect(isSeatAllowanceExceeded({ message: "create_org_invite: is not an active owner" })).toBe(
      false
    );
  });
});
