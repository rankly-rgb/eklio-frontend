import { notFound, redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isPracticeUiEnabled } from "@/lib/tenancy/flags";
import { loadOwnedOrganization } from "@/lib/data/organization";
import { getOrganizationSeoGridProposals } from "@/lib/tenancy/clinician-sheet";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * Lot G — the grid, rendered. Owner-only, flag-gated. Proposals only — no
 * page is generated or written anywhere from here.
 */
export default async function PracticeGridPage() {
  const admin = createAdminClient();
  if (!(await isPracticeUiEnabled(admin))) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/practice/grid");

  const org = await loadOwnedOrganization(supabase, user.id);
  if (!org) notFound();

  const proposals = await getOrganizationSeoGridProposals(supabase, {
    organizationId: org.id,
  });
  const rows = proposals.ok ? proposals.data : [];
  const byState = rows.filter((r) => r.grid === "modality_state");
  const byPopulation = rows.filter((r) => r.grid === "modality_population");

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)] max-md:pt-10">
      <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
        Where you show up
      </h1>
      <p className="mt-3 max-w-[560px] text-body text-ink-2">
        Every modality your clinicians practice, crossed with where they're
        licensed and who they work with. A work queue, not a report — nothing
        here is a page yet.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 max-w-[560px] text-body text-ink-2">
          Nothing to show yet. Once clinicians have added licensed states,
          modalities, and populations to their profiles, the combinations
          they cover will show up here.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          <GridTable title="Modality × licensed state" rows={byState} axisLabel="State" />
          <GridTable
            title="Modality × who they work with"
            rows={byPopulation}
            axisLabel="Population"
          />
        </div>
      )}
    </main>
  );
}

function GridTable({
  title,
  rows,
  axisLabel,
}: {
  title: string;
  rows: {
    modality_id: string;
    axis_id: string;
    clinician_count: number;
    proposed_title: string;
    proposed_slug: string;
    has_page: boolean;
  }[];
  axisLabel: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section>
      <MonoLabel tracking="16" as="h2" className="block">
        {title}
      </MonoLabel>
      <div className="mt-4 overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[640px] border-collapse text-ui">
          <thead>
            <tr className="border-b border-line text-left text-ink-2">
              <th className="px-4 py-3 font-normal">Modality</th>
              <th className="px-4 py-3 font-normal">{axisLabel}</th>
              <th className="px-4 py-3 font-normal">Clinicians</th>
              <th className="px-4 py-3 font-normal">Proposed title</th>
              <th className="px-4 py-3 font-normal">Slug</th>
              <th className="px-4 py-3 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.modality_id}-${row.axis_id}`} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3 text-ink">{row.modality_id}</td>
                <td className="px-4 py-3 text-ink">{row.axis_id}</td>
                <td className="px-4 py-3 text-ink">{row.clinician_count}</td>
                <td className="px-4 py-3 text-ink-2">{row.proposed_title}</td>
                <td className="px-4 py-3">
                  <MonoLabel tracking="hex" tone="ink-2">
                    {row.proposed_slug}
                  </MonoLabel>
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {row.has_page ? "Built" : "Not built yet"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
