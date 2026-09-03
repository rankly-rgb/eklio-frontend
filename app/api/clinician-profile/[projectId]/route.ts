import type { NextRequest } from "next/server";
import {
  authenticate,
  badRequest,
  json,
  notFound,
  readJson,
  serverError,
} from "@/lib/api/handler";
import {
  clinicianBriefPatchSchema,
  patchClinicianBrief,
} from "@/lib/data/clinician-brief";
import {
  getClinicianProfileByProject,
  getClinicianProfileCompleteness,
} from "@/lib/tenancy/clinician-profile";

/*
 * The clinician profile for one project. `[projectId]` because
 * clinician_profiles.project_id is unique — same idiom as `/api/briefs/[id]`
 * being project_briefs.project_id, no separate profiles-by-id route.
 *
 * PATCH returns the profile's completeness in the same round-trip (the same
 * "one round-trip" property the brief's autosave already has) so the
 * flow's review screen and rail never make a second request to learn the
 * score changed.
 *
 * No explicit ownership check beyond RLS: clinician_profiles' own SELECT/
 * UPDATE policies already scope this to the profile's own member or the
 * active org owner — the same office-manager-fills-it-in workflow this
 * route exists to serve. A profile this session cannot read comes back
 * as `null`, which reads here as not found.
 */

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/clinician-profile/[projectId]">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { projectId } = await ctx.params;
  const { supabase } = auth.session;

  const profile = await getClinicianProfileByProject(supabase, { projectId });
  if (!profile.ok) return serverError("GET /api/clinician-profile", profile.error);
  if (!profile.data) return notFound();

  const completeness = await getClinicianProfileCompleteness(supabase, {
    profileId: profile.data.id,
  });
  if (!completeness.ok) {
    return serverError("GET /api/clinician-profile", completeness.error);
  }

  return json({ profile: profile.data, completeness: completeness.data });
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/clinician-profile/[projectId]">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { projectId } = await ctx.params;
  const { supabase } = auth.session;

  const body = await readJson(request);
  const parsed = clinicianBriefPatchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues[0]?.message ?? "That change couldn't be saved."
    );
  }

  const profile = await getClinicianProfileByProject(supabase, { projectId });
  if (!profile.ok) return serverError("PATCH /api/clinician-profile", profile.error);
  if (!profile.data) return notFound();

  const outcome = await patchClinicianBrief(supabase, profile.data.id, parsed.data);
  if (!outcome.ok) return badRequest(outcome.error);

  const completeness = await getClinicianProfileCompleteness(supabase, {
    profileId: profile.data.id,
  });
  if (!completeness.ok) {
    return serverError("PATCH /api/clinician-profile", completeness.error);
  }

  return json({ completeness: completeness.data });
}
