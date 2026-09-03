import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isPracticeUiEnabled } from "@/lib/tenancy/flags";
import { getClinicianSetupSheet } from "@/lib/tenancy/clinician-sheet";
import { SetupSheetView } from "@/components/practice/setup-sheet-view";

/*
 * Lot F — owner or the clinician herself (clinician_profiles' own RLS,
 * unchanged: can_access_project(project_id) is owner-or-self). Flag-gated
 * like every other lot D/F/G route.
 */
export default async function ClinicianSetupSheetPage({
  params,
}: PageProps<"/app/practice/[memberId]/sheet">) {
  const { memberId } = await params;

  const admin = createAdminClient();
  if (!(await isPracticeUiEnabled(admin))) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/practice/${memberId}/sheet`)}`);

  const { data: profile } = await supabase
    .from("clinician_profiles")
    .select("id")
    .eq("member_id", memberId)
    .maybeSingle();
  if (!profile) notFound();

  const sheet = await getClinicianSetupSheet(supabase, { profileId: profile.id });
  if (!sheet.ok) notFound();

  return <SetupSheetView sheet={sheet.data} memberId={memberId} />;
}
