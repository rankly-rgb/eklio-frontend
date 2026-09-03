import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  getClinicianJoinRows,
  getClinicianProfileByProject,
  setClinicianLicensedStates,
  setClinicianModalities,
  setClinicianPopulations,
  updateClinicianProfile,
  clinicianProfilePatchSchema,
  type ClinicianProfilePatch,
} from "@/lib/tenancy/clinician-profile";
import type { ClinicianStepDraft } from "@/lib/tenancy/clinician-brief/flow";

type Client = SupabaseClient<Database>;

export type ClinicianBriefBundle = {
  profileId: string;
  organizationId: string;
  projectId: string;
  practiceName: string;
  hasOrgDefaultSupervisor: boolean;
  draft: ClinicianStepDraft;
};

/**
 * The current user's own active membership — preferring a "clinician" row
 * (the B2B scenario this feature targets: joined someone else's practice)
 * over her own auto-created owner org, since a user can hold both. A user
 * with only the auto-created owner org resolves to that one.
 *
 * ⚠ Does NOT read organization_members.project_id. That column's own
 * comment (20260903100000_organizations_and_members.sql) says it is "set
 * by the app flow, not by accept_org_invite" — but organization_members'
 * own UPDATE policy is owner-only (organization_members_update_owner), so
 * a clinician cannot set it on her own row, and nothing in this session's
 * four lots adds a path that could. The actually-writable link a clinician
 * CAN self-provision is a `projects` row with her own user_id and the
 * target organization_id: `projects_insert_own` only checks
 * `user_id = auth.uid()`, unconstrained by organization — see
 * getOrCreateOwnProject() below.
 */
async function loadOwnMembership(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("role", { ascending: true }); // "clinician" < "owner" alphabetically

  if (error || !data || data.length === 0) return null;
  return data.find((m) => m.role === "clinician") ?? data[0];
}

/**
 * The user's own project within one organization, creating it on first
 * visit if none exists yet — self-service, since `projects_insert_own`
 * only requires `user_id = auth.uid()`.
 */
export async function getOrCreateOwnProject(
  supabase: Client,
  input: { userId: string; organizationId: string }
): Promise<{ id: string } | null> {
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", input.userId)
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("projects")
    .insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      name: "My profile",
    })
    .select("id")
    .single();
  if (error || !created) return null;
  return created;
}

/**
 * Loads (creating on first visit) the current user's own clinician profile
 * and its join rows. Returns null when the user has no organization
 * membership — should not happen for a real account (handle_new_user
 * always creates one), but a missing precondition reads as "nothing to
 * show" here, not an error.
 */
export async function loadClinicianBrief(
  supabase: Client,
  userId: string
): Promise<ClinicianBriefBundle | null> {
  const membership = await loadOwnMembership(supabase, userId);
  if (!membership) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, default_supervisor_name")
    .eq("id", membership.organization_id)
    .maybeSingle();
  if (!org) return null;

  const project = await getOrCreateOwnProject(supabase, {
    userId,
    organizationId: org.id,
  });
  if (!project) return null;

  const existing = await getClinicianProfileByProject(supabase, {
    projectId: project.id,
  });
  if (!existing.ok) return null;

  let profile = existing.data;
  if (!profile) {
    const { data: created, error } = await supabase
      .from("clinician_profiles")
      .insert({
        organization_id: org.id,
        project_id: project.id,
        member_id: membership.id,
        full_name: "",
        status: "licensed",
      })
      .select("*")
      .single();
    if (error || !created) return null;
    profile = created;
  }

  const joins = await getClinicianJoinRows(supabase, { profileId: profile.id });
  if (!joins.ok) return null;

  const draft: ClinicianStepDraft = {
    fullName: profile.full_name,
    credentials: profile.credentials,
    status: profile.status as ClinicianStepDraft["status"],
    supervisorName: profile.supervisor_name,
    stateCodes: joins.data.stateCodes,
    modalities: joins.data.modalities,
    populationIds: joins.data.populationIds,
    philosophyQuote: profile.philosophy_quote,
    outsideTheRoom: profile.outside_the_room,
    personalityNote: profile.personality_note,
    sessionRateCents: profile.session_rate_cents,
    rateIsPublic: profile.rate_is_public,
    bookingUrl: profile.booking_url,
    photoProvided: profile.photo_provided,
    acceptingClients: profile.accepting_clients,
  };

  return {
    profileId: profile.id,
    organizationId: org.id,
    projectId: project.id,
    practiceName: org.name,
    hasOrgDefaultSupervisor: Boolean(org.default_supervisor_name?.trim()),
    draft,
  };
}

/*
 * The PATCH body: any subset of the scalar clinician_profiles fields, plus
 * the three join-table sets — each, when present, REPLACES the whole set
 * for that profile (see lib/tenancy/clinician-profile.ts). A single call
 * can touch both a scalar field and a join set (the identity screen never
 * needs to, but nothing stops it).
 */
export const clinicianBriefPatchSchema = z.object({
  profile: clinicianProfilePatchSchema.optional(),
  stateCodes: z.array(z.string().length(2)).optional(),
  modalities: z
    .array(
      z.object({
        modalityId: z.string().min(1),
        prominence: z.string().nullable(),
      })
    )
    .optional(),
  populationIds: z.array(z.string().min(1)).optional(),
});

export type ClinicianBriefPatch = z.infer<typeof clinicianBriefPatchSchema>;

export async function patchClinicianBrief(
  supabase: Client,
  profileId: string,
  patch: ClinicianBriefPatch
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (patch.profile && Object.keys(patch.profile).length > 0) {
    const result = await updateClinicianProfile(supabase, {
      profileId,
      patch: patch.profile as ClinicianProfilePatch,
    });
    if (!result.ok) return { ok: false, error: result.error.message };
  }

  if (patch.stateCodes) {
    const result = await setClinicianLicensedStates(supabase, {
      profileId,
      stateCodes: patch.stateCodes,
    });
    if (!result.ok) return { ok: false, error: result.error.message };
  }

  if (patch.modalities) {
    const result = await setClinicianModalities(supabase, {
      profileId,
      modalities: patch.modalities,
    });
    if (!result.ok) return { ok: false, error: result.error.message };
  }

  if (patch.populationIds) {
    const result = await setClinicianPopulations(supabase, {
      profileId,
      populationIds: patch.populationIds,
    });
    if (!result.ok) return { ok: false, error: result.error.message };
  }

  return { ok: true };
}

/* ── reference data: us_states, population_cards, modality_cards/prominence ── */

export type ClinicianCatalog = {
  states: { code: string; name: string }[];
  populations: { id: string; label: string; fullName: string }[];
  modalities: { id: string; label: string; fullName: string }[];
  prominenceOptions: { id: string; label: string }[];
};

export async function loadClinicianCatalog(
  supabase: Client
): Promise<ClinicianCatalog> {
  const [states, populations, modalities, prominence] = await Promise.all([
    supabase.from("us_states").select("code, name").order("name"),
    supabase
      .from("population_cards")
      .select("id, label, full_name")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("modality_cards")
      .select("id, label, full_name")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("modality_prominence_options")
      .select("id, label")
      .eq("active", true)
      .order("sort_order"),
  ]);

  return {
    states: states.data ?? [],
    populations: (populations.data ?? []).map((p) => ({
      id: p.id,
      label: p.label,
      fullName: p.full_name,
    })),
    modalities: (modalities.data ?? []).map((m) => ({
      id: m.id,
      label: m.label,
      fullName: m.full_name,
    })),
    prominenceOptions: prominence.data ?? [],
  };
}
