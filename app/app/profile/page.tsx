import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isPracticeUiEnabled } from "@/lib/tenancy/flags";
import { loadClinicianBrief, loadClinicianCatalog } from "@/lib/data/clinician-brief";
import { getClinicianProfileCompleteness } from "@/lib/tenancy/clinician-profile";
import { ClinicianFlow } from "@/components/clinician/clinician-flow";

/*
 * Lot D5 — a clinician's own 7-question profile brief. 404s when
 * practice_ui_enabled is off (lot D1), same as every other lot D route.
 */
export default async function ClinicianProfilePage() {
  const admin = createAdminClient();
  if (!(await isPracticeUiEnabled(admin))) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/profile");

  const bundle = await loadClinicianBrief(supabase, user.id);
  if (!bundle) notFound();

  const [catalog, completeness] = await Promise.all([
    loadClinicianCatalog(supabase),
    getClinicianProfileCompleteness(supabase, { profileId: bundle.profileId }),
  ]);

  return (
    <ClinicianFlow
      projectId={bundle.projectId}
      catalog={catalog}
      practiceName={bundle.practiceName}
      hasOrgDefaultSupervisor={bundle.hasOrgDefaultSupervisor}
      initialDraft={bundle.draft}
      initialCompleteness={completeness.ok ? completeness.data : null}
    />
  );
}
