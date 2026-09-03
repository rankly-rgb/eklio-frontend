import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { TenancyRpcResult } from "@/lib/tenancy/rpc";

/*
 * clinician_profiles and its three join tables (clinician_licensed_states,
 * clinician_modalities, clinician_populations — 20260903130500) carry no
 * SECURITY DEFINER RPC of their own: they are plain RLS-scoped tables, read
 * and written with the ordinary anon-key client from lib/supabase/server.ts,
 * the same as project_briefs already is. lib/tenancy/rpc.ts's
 * TenancyRpcResult is reused here for the same reason it is there: a
 * uniform ok/error shape whether the underlying call is a table operation
 * or an RPC.
 *
 * The three join tables are always written as a REPLACE of the whole set
 * for a profile (delete then insert), never a diff — a clinician's brief
 * screen for "licensed states" submits the complete list every time, so
 * there is nothing to reconcile client-side.
 */

type Client = SupabaseClient<Database>;

const uuid = z.string().uuid();

export const clinicianStatusSchema = z.enum([
  "licensed",
  "associate",
  "supervised_intern",
]);

export const clinicianProfilePatchSchema = z
  .object({
    fullName: z.string().min(1),
    credentials: z.string().nullable(),
    status: clinicianStatusSchema,
    supervisorName: z.string().nullable(),
    philosophyQuote: z.string().nullable(),
    outsideTheRoom: z.string().nullable(),
    personalityNote: z.string().nullable(),
    sessionRateCents: z.number().int().positive().nullable(),
    rateIsPublic: z.boolean(),
    acceptingClients: z.boolean(),
    photoProvided: z.boolean(),
    bookingUrl: z.string().url().nullable(),
  })
  .partial();

export type ClinicianProfilePatch = z.infer<typeof clinicianProfilePatchSchema>;

const patchToRow: Record<keyof ClinicianProfilePatch, string> = {
  fullName: "full_name",
  credentials: "credentials",
  status: "status",
  supervisorName: "supervisor_name",
  philosophyQuote: "philosophy_quote",
  outsideTheRoom: "outside_the_room",
  personalityNote: "personality_note",
  sessionRateCents: "session_rate_cents",
  rateIsPublic: "rate_is_public",
  acceptingClients: "accepting_clients",
  photoProvided: "photo_provided",
  bookingUrl: "booking_url",
};

type ClinicianProfileUpdateRow =
  Database["public"]["Tables"]["clinician_profiles"]["Update"];

function toRow(patch: ClinicianProfilePatch): ClinicianProfileUpdateRow {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    row[patchToRow[key as keyof ClinicianProfilePatch]] = value;
  }
  return row as ClinicianProfileUpdateRow;
}

export type ClinicianProfileRow =
  Database["public"]["Tables"]["clinician_profiles"]["Row"];

/**
 * The seat's profile for one project, or null if none exists yet (a seat
 * with no profile row is a valid, in-progress state — the owner's seat-add
 * pre-fills a project, not necessarily a profile).
 */
export async function getClinicianProfileByProject(
  supabase: Client,
  input: { projectId: string }
): Promise<TenancyRpcResult<ClinicianProfileRow | null>> {
  const { projectId } = z.object({ projectId: uuid }).parse(input);

  const { data, error } = await supabase
    .from("clinician_profiles")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) return { ok: false, error };
  return { ok: true, data: data ?? null };
}

export async function updateClinicianProfile(
  supabase: Client,
  input: { profileId: string; patch: ClinicianProfilePatch }
): Promise<TenancyRpcResult<null>> {
  const parsed = z
    .object({ profileId: uuid, patch: clinicianProfilePatchSchema })
    .parse(input);

  const { error } = await supabase
    .from("clinician_profiles")
    .update(toRow(parsed.patch))
    .eq("id", parsed.profileId);

  if (error) return { ok: false, error };
  return { ok: true, data: null };
}

/* ── licensed states, modalities, populations — replace-the-set ─────────── */

export async function getClinicianJoinRows(
  supabase: Client,
  input: { profileId: string }
): Promise<
  TenancyRpcResult<{
    stateCodes: string[];
    modalities: { modalityId: string; prominence: string | null }[];
    populationIds: string[];
  }>
> {
  const { profileId } = z.object({ profileId: uuid }).parse(input);

  const [states, modalities, populations] = await Promise.all([
    supabase
      .from("clinician_licensed_states")
      .select("state_code")
      .eq("profile_id", profileId),
    supabase
      .from("clinician_modalities")
      .select("modality_id, prominence")
      .eq("profile_id", profileId),
    supabase
      .from("clinician_populations")
      .select("population_id")
      .eq("profile_id", profileId),
  ]);

  if (states.error) return { ok: false, error: states.error };
  if (modalities.error) return { ok: false, error: modalities.error };
  if (populations.error) return { ok: false, error: populations.error };

  return {
    ok: true,
    data: {
      stateCodes: states.data.map((r) => r.state_code),
      modalities: modalities.data.map((r) => ({
        modalityId: r.modality_id,
        prominence: r.prominence,
      })),
      populationIds: populations.data.map((r) => r.population_id),
    },
  };
}

export async function setClinicianLicensedStates(
  supabase: Client,
  input: { profileId: string; stateCodes: string[] }
): Promise<TenancyRpcResult<null>> {
  const parsed = z
    .object({ profileId: uuid, stateCodes: z.array(z.string().length(2)) })
    .parse(input);

  const del = await supabase
    .from("clinician_licensed_states")
    .delete()
    .eq("profile_id", parsed.profileId);
  if (del.error) return { ok: false, error: del.error };

  if (parsed.stateCodes.length === 0) return { ok: true, data: null };

  const ins = await supabase.from("clinician_licensed_states").insert(
    parsed.stateCodes.map((state_code) => ({
      profile_id: parsed.profileId,
      state_code,
    }))
  );
  if (ins.error) return { ok: false, error: ins.error };
  return { ok: true, data: null };
}

export async function setClinicianModalities(
  supabase: Client,
  input: {
    profileId: string;
    modalities: { modalityId: string; prominence: string | null }[];
  }
): Promise<TenancyRpcResult<null>> {
  const parsed = z
    .object({
      profileId: uuid,
      modalities: z.array(
        z.object({
          modalityId: z.string().min(1),
          prominence: z.string().nullable(),
        })
      ),
    })
    .parse(input);

  const del = await supabase
    .from("clinician_modalities")
    .delete()
    .eq("profile_id", parsed.profileId);
  if (del.error) return { ok: false, error: del.error };

  if (parsed.modalities.length === 0) return { ok: true, data: null };

  const ins = await supabase.from("clinician_modalities").insert(
    parsed.modalities.map((m) => ({
      profile_id: parsed.profileId,
      modality_id: m.modalityId,
      prominence: m.prominence,
    }))
  );
  if (ins.error) return { ok: false, error: ins.error };
  return { ok: true, data: null };
}

export async function setClinicianPopulations(
  supabase: Client,
  input: { profileId: string; populationIds: string[] }
): Promise<TenancyRpcResult<null>> {
  const parsed = z
    .object({ profileId: uuid, populationIds: z.array(z.string().min(1)) })
    .parse(input);

  const del = await supabase
    .from("clinician_populations")
    .delete()
    .eq("profile_id", parsed.profileId);
  if (del.error) return { ok: false, error: del.error };

  if (parsed.populationIds.length === 0) return { ok: true, data: null };

  const ins = await supabase.from("clinician_populations").insert(
    parsed.populationIds.map((population_id) => ({
      profile_id: parsed.profileId,
      population_id,
    }))
  );
  if (ins.error) return { ok: false, error: ins.error };
  return { ok: true, data: null };
}

/* ── completeness / health / effective supervisor RPCs ──────────────────── */

const completenessResult = z.object({
  score: z.number(),
  blocking_missing: z.array(z.string()),
  non_blocking_missing: z.array(z.string()),
  is_stale: z.boolean(),
});

export type ClinicianProfileCompleteness = {
  score: number;
  blockingMissing: string[];
  nonBlockingMissing: string[];
  isStale: boolean;
};

export async function getClinicianProfileCompleteness(
  supabase: Client,
  input: { profileId: string }
): Promise<TenancyRpcResult<ClinicianProfileCompleteness>> {
  const { profileId } = z.object({ profileId: uuid }).parse(input);

  const { data, error } = await supabase.rpc("clinician_profile_completeness", {
    p_profile_id: profileId,
  });
  if (error) return { ok: false, error };

  const parsed = completenessResult.parse(data);
  return {
    ok: true,
    data: {
      score: parsed.score,
      blockingMissing: parsed.blocking_missing,
      nonBlockingMissing: parsed.non_blocking_missing,
      isStale: parsed.is_stale,
    },
  };
}

export type OrganizationProfileHealthRow = {
  profileId: string;
  memberId: string;
  fullName: string;
  status: string;
  score: number;
  blockingMissing: string[];
  isStale: boolean;
};

export async function getOrganizationProfileHealth(
  supabase: Client,
  input: { organizationId: string }
): Promise<TenancyRpcResult<OrganizationProfileHealthRow[]>> {
  const { organizationId } = z.object({ organizationId: uuid }).parse(input);

  const { data, error } = await supabase.rpc("organization_profile_health", {
    p_organization_id: organizationId,
  });
  if (error) return { ok: false, error };

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      profileId: row.profile_id,
      memberId: row.member_id,
      fullName: row.full_name,
      status: row.status,
      score: row.score,
      blockingMissing: Array.isArray(row.blocking_missing)
        ? (row.blocking_missing as string[])
        : [],
      isStale: row.is_stale,
    })),
  };
}

export async function getClinicianEffectiveSupervisor(
  supabase: Client,
  input: { profileId: string }
): Promise<TenancyRpcResult<string | null>> {
  const { profileId } = z.object({ profileId: uuid }).parse(input);

  const { data, error } = await supabase.rpc("clinician_effective_supervisor", {
    p_profile_id: profileId,
  });
  if (error) return { ok: false, error };
  return { ok: true, data: data ?? null };
}
