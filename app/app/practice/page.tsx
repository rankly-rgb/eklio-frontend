import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isPracticeUiEnabled } from "@/lib/tenancy/flags";
import { loadOwnedOrganization } from "@/lib/data/organization";
import { getOrganizationProfileHealth } from "@/lib/tenancy/clinician-profile";
import { ButtonLink } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * Lot D2 — the owner-only practice dashboard. 404s when practice_ui_enabled
 * is off (lot D1). Every account owns exactly one organization
 * (lib/data/organization.ts), so this route needs no separate "are you an
 * owner" check beyond that lookup succeeding.
 */
export default async function PracticeDashboardPage() {
  const admin = createAdminClient();
  if (!(await isPracticeUiEnabled(admin))) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/practice");

  const org = await loadOwnedOrganization(supabase, user.id);
  if (!org) notFound();

  const health = await getOrganizationProfileHealth(supabase, {
    organizationId: org.id,
  });
  const rows = health.ok ? health.data : [];

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)] max-md:pt-10">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:items-stretch">
        <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
          {org.name}
        </h1>
        <ButtonLink href="/app/practice/invite" variant="primary" className="flex-none">
          Invite a clinician
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 max-w-[560px] text-body text-ink-2">
          No clinicians yet. Invite one to get started — they'll fill in their
          own profile once they accept.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {rows.map((row) => (
            <li
              key={row.profileId}
              className="box-border flex items-center justify-between gap-6 rounded-card border border-line p-[20px_24px] max-md:flex-col max-md:items-stretch max-md:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-card-title font-medium tracking-card-title text-ink">
                  {row.fullName || "Unnamed profile"}
                </p>
                <p className="mt-1 text-ui text-ink-2">
                  {row.status === "supervised_intern"
                    ? "Supervised intern"
                    : row.status === "associate"
                      ? "Associate"
                      : "Licensed"}
                  {row.isStale ? " — hasn't been touched in a while" : ""}
                </p>
                {row.blockingMissing.length > 0 ? (
                  <p className="mt-1 text-helper text-ink-2">
                    Still needed: {row.blockingMissing.join(", ")}
                  </p>
                ) : null}
              </div>
              <MonoLabel
                tracking="16"
                tone={row.score === 100 ? "accent" : "ink-2"}
                className="flex-none"
              >
                {`${row.score}%`}
              </MonoLabel>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
