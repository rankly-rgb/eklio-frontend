import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isPracticeUiEnabled } from "@/lib/tenancy/flags";
import { loadOwnedOrganization } from "@/lib/data/organization";
import { InviteForm } from "@/components/practice/invite-form";

/*
 * Lot D3 — owner-only invite screen. 404s when practice_ui_enabled is off.
 */
export default async function PracticeInvitePage() {
  const admin = createAdminClient();
  if (!(await isPracticeUiEnabled(admin))) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/practice/invite");

  const org = await loadOwnedOrganization(supabase, user.id);
  if (!org) notFound();

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)] max-md:pt-10">
      <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
        Invite a clinician
      </h1>
      <p className="mt-3 max-w-[560px] text-body text-ink-2">
        We don't send the email — you do. Copy the link below and send it
        yourself, however you'd normally reach {org.name}'s new hire.
      </p>
      <div className="mt-8 max-w-brief">
        <InviteForm />
      </div>
    </main>
  );
}
