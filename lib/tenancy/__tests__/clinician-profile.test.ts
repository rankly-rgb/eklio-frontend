import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  getClinicianProfileByProject,
  updateClinicianProfile,
  setClinicianLicensedStates,
  setClinicianModalities,
  setClinicianPopulations,
  getClinicianProfileCompleteness,
  getOrganizationProfileHealth,
  getClinicianEffectiveSupervisor,
} from "@/lib/tenancy/clinician-profile";

const PROFILE_ID = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

function fakeClient(overrides: Record<string, unknown>) {
  return overrides as unknown as SupabaseClient<Database>;
}

describe("getClinicianProfileByProject", () => {
  it("returns null (not an error) when no profile row exists yet", async () => {
    const from = vi.fn().mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    });
    const result = await getClinicianProfileByProject(fakeClient({ from }), {
      projectId: PROJECT_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });

  it("returns the row when one exists", async () => {
    const row = { id: PROFILE_ID, full_name: "Jane Doe" };
    const from = vi.fn().mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: row, error: null }),
        }),
      }),
    });
    const result = await getClinicianProfileByProject(fakeClient({ from }), {
      projectId: PROJECT_ID,
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toEqual(row);
  });
});

describe("updateClinicianProfile", () => {
  it("maps camelCase patch keys onto snake_case columns", async () => {
    const update = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const from = vi.fn().mockReturnValue({ update });

    await updateClinicianProfile(fakeClient({ from }), {
      profileId: PROFILE_ID,
      patch: { fullName: "Jane Doe", rateIsPublic: true },
    });

    expect(update).toHaveBeenCalledWith({
      full_name: "Jane Doe",
      rate_is_public: true,
    });
  });
});

describe("setClinicianLicensedStates", () => {
  it("deletes the existing set then inserts the new one", async () => {
    const del = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ delete: del, insert });

    const result = await setClinicianLicensedStates(fakeClient({ from }), {
      profileId: PROFILE_ID,
      stateCodes: ["OR", "WA"],
    });

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith([
      { profile_id: PROFILE_ID, state_code: "OR" },
      { profile_id: PROFILE_ID, state_code: "WA" },
    ]);
  });

  it("skips the insert for an empty set — clearing is a valid state", async () => {
    const del = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const insert = vi.fn();
    const from = vi.fn().mockReturnValue({ delete: del, insert });

    const result = await setClinicianLicensedStates(fakeClient({ from }), {
      profileId: PROFILE_ID,
      stateCodes: [],
    });

    expect(result.ok).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("setClinicianModalities", () => {
  it("inserts modality_id and prominence together", async () => {
    const del = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ delete: del, insert });

    await setClinicianModalities(fakeClient({ from }), {
      profileId: PROFILE_ID,
      modalities: [{ modalityId: "emdr", prominence: "lead_with_it" }],
    });

    expect(insert).toHaveBeenCalledWith([
      { profile_id: PROFILE_ID, modality_id: "emdr", prominence: "lead_with_it" },
    ]);
  });
});

describe("setClinicianPopulations", () => {
  it("inserts population_id rows", async () => {
    const del = vi.fn().mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ delete: del, insert });

    await setClinicianPopulations(fakeClient({ from }), {
      profileId: PROFILE_ID,
      populationIds: ["couples"],
    });

    expect(insert).toHaveBeenCalledWith([
      { profile_id: PROFILE_ID, population_id: "couples" },
    ]);
  });
});

describe("getClinicianProfileCompleteness", () => {
  it("converts the jsonb snake_case result into a camelCase shape", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        score: 80,
        blocking_missing: ["credentials"],
        non_blocking_missing: [],
        is_stale: false,
      },
      error: null,
    });

    const result = await getClinicianProfileCompleteness(fakeClient({ rpc }), {
      profileId: PROFILE_ID,
    });

    expect(rpc).toHaveBeenCalledWith("clinician_profile_completeness", {
      p_profile_id: PROFILE_ID,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        score: 80,
        blockingMissing: ["credentials"],
        nonBlockingMissing: [],
        isStale: false,
      },
    });
  });
});

describe("getOrganizationProfileHealth", () => {
  it("maps every row's snake_case fields to camelCase", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          profile_id: PROFILE_ID,
          member_id: "m1",
          full_name: "Jane Doe",
          status: "licensed",
          score: 100,
          blocking_missing: [],
          is_stale: false,
        },
      ],
      error: null,
    });

    const result = await getOrganizationProfileHealth(fakeClient({ rpc }), {
      organizationId: ORG_ID,
    });

    expect(rpc).toHaveBeenCalledWith("organization_profile_health", {
      p_organization_id: ORG_ID,
    });
    expect(result.ok && result.data[0]).toEqual({
      profileId: PROFILE_ID,
      memberId: "m1",
      fullName: "Jane Doe",
      status: "licensed",
      score: 100,
      blockingMissing: [],
      isStale: false,
    });
  });
});

describe("getClinicianEffectiveSupervisor", () => {
  it("passes through null (no supervisor set anywhere) as a valid result", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await getClinicianEffectiveSupervisor(fakeClient({ rpc }), {
      profileId: PROFILE_ID,
    });
    expect(result).toEqual({ ok: true, data: null });
  });
});
