import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHeaderContext } from "@/lib/app/header-context";
import { siteSpecGet } from "@/lib/site/rpc";
import { parseEmailState } from "@/lib/email/state";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { SettingsView } from "@/components/settings/settings-view";

/*
 * /app/settings — practice details (as they feed the signature and the
 * handoff note), email preferences, and the existing account actions.
 * Nothing new invented: practice details are site_specs.practice_details +
 * hero.cta_target_url, patched through the site-spec route that already
 * exists; email preference is the existing unsubscribe mechanism
 * (lib/email/state.ts), given an authenticated toggle instead of only a
 * one-way emailed link.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/app/settings");

  const header = await loadHeaderContext(supabase, user.id, user.email);

  const spec = header.brandKitId
    ? await siteSpecGet(supabase, header.brandKitId)
    : null;

  const practiceDetails = spec?.ok ? spec.data.spec.practice_details : null;
  const bookingUrl = spec?.ok ? spec.data.spec.hero.cta_target_url : null;
  const emailState = parseEmailState(user.user_metadata);

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-[var(--gutter)] py-10 max-md:px-[var(--gutter-sm)]">
      <Breadcrumb items={[{ label: "Home", href: "/app" }, { label: "Settings" }]} />

      <div>
        <h1 className="font-display text-h1 leading-title text-ink">Settings</h1>
      </div>

      <SettingsView
        brandKitId={header.brandKitId}
        practiceDetails={practiceDetails}
        bookingUrl={bookingUrl}
        email={user.email ?? ""}
        subscribed={!emailState.unsubscribed}
      />
    </main>
  );
}
