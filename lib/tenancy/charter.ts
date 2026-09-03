import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { TenancyRpcResult } from "@/lib/tenancy/rpc";

/*
 * Wrappers for the two lot-B RPCs that move field_sources and the fields it
 * describes: `set_field_sources` (changes provenance only) and
 * `apply_charter_to_project` (copies the charter kit's identity onto a
 * project, marking every copied field inherited). Same conventions as
 * `lib/tenancy/rpc.ts`: the client is always the session client, errors are
 * the raw PostgrestError from a `raise exception` in the RPC, not an
 * envelope to unwrap.
 */

type Client = SupabaseClient<Database>;

const uuid = z.string().uuid();

/* ── set_field_sources ─────────────────────────────────────────────────── */

const setFieldSourcesInput = z.object({
  siteSpecId: uuid,
  sources: z.record(z.string(), z.string()),
});

export type SetFieldSourcesInput = z.infer<typeof setFieldSourcesInput>;

/**
 * Replaces field_sources wholesale on a site_specs row. Owner-only when the
 * change sets, lifts, or reassigns an "inherited" entry — enforced in
 * `set_field_sources` itself; this wrapper does not duplicate that check.
 */
export async function setFieldSources(
  supabase: Client,
  input: SetFieldSourcesInput
): Promise<TenancyRpcResult<null>> {
  const parsed = setFieldSourcesInput.parse(input);

  const { error } = await supabase.rpc("set_field_sources", {
    p_site_spec_id: parsed.siteSpecId,
    p_sources: parsed.sources,
  });

  if (error) return { ok: false, error };
  return { ok: true, data: null };
}

/* ── apply_charter_to_project ──────────────────────────────────────────── */

const applyCharterInput = z.object({
  organizationId: uuid,
  projectId: uuid,
});

export type ApplyCharterInput = z.infer<typeof applyCharterInput>;

/**
 * Owner-only. Copies the six colour roles, the typography pair and
 * font_display_fallback from the organization's charter kit onto the target
 * project's site_specs, marking each copied field inherited. Idempotent —
 * safe to call again after the charter changes, or just to confirm a
 * clinician's project is up to date with it.
 */
export async function applyCharterToProject(
  supabase: Client,
  input: ApplyCharterInput
): Promise<TenancyRpcResult<null>> {
  const parsed = applyCharterInput.parse(input);

  const { error } = await supabase.rpc("apply_charter_to_project", {
    p_organization_id: parsed.organizationId,
    p_project_id: parsed.projectId,
  });

  if (error) return { ok: false, error };
  return { ok: true, data: null };
}
