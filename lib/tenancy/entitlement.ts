import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { TenancyRpcResult } from "@/lib/tenancy/rpc";

type Client = SupabaseClient<Database>;

const uuid = z.string().uuid();

const entitlementSchema = z.object({
  tier: z.string(),
  seat_count: z.number(),
  seat_allowance: z.number(),
  capabilities: z.object({
    charter: z.boolean(),
    clinician_profiles: z.boolean(),
    grid: z.boolean(),
    setup_sheets: z.boolean(),
  }),
});

export type OrganizationEntitlement = {
  tier: string;
  seatCount: number;
  seatAllowance: number;
  capabilities: {
    charter: boolean;
    clinicianProfiles: boolean;
    grid: boolean;
    setupSheets: boolean;
  };
};

/**
 * Read-only mirror of organization_entitlement() (lot H) — the single
 * chokepoint lives in that SQL function (create_org_invite,
 * provision_clinician_project); this wrapper exists only so the UI can
 * show a seat count/plan state, never to re-derive the decision itself.
 */
export async function getOrganizationEntitlement(
  supabase: Client,
  input: { organizationId: string }
): Promise<TenancyRpcResult<OrganizationEntitlement>> {
  const { organizationId } = z.object({ organizationId: uuid }).parse(input);

  const { data, error } = await supabase.rpc("organization_entitlement", {
    p_organization_id: organizationId,
  });
  if (error) return { ok: false, error };

  const parsed = entitlementSchema.parse(data);
  return {
    ok: true,
    data: {
      tier: parsed.tier,
      seatCount: parsed.seat_count,
      seatAllowance: parsed.seat_allowance,
      capabilities: {
        charter: parsed.capabilities.charter,
        clinicianProfiles: parsed.capabilities.clinician_profiles,
        grid: parsed.capabilities.grid,
        setupSheets: parsed.capabilities.setup_sheets,
      },
    },
  };
}

/**
 * True when an RPC error is the named seat_allowance_exceeded refusal
 * (create_org_invite / provision_clinician_project) — lets a caller show
 * a specific, readable message instead of the raw Postgres error text.
 */
export function isSeatAllowanceExceeded(error: { message: string }): boolean {
  return error.message.includes("seat_allowance_exceeded");
}
