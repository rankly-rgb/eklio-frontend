import { CopyBlockRow } from "@/components/site/copy-chip";
import { ButtonLink } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import type { ClinicianSetupSheet } from "@/lib/tenancy/clinician-sheet";

/*
 * Lot F — the numbered sheet an office manager works through pasting into
 * Squarespace/SimplePractice, one field at a time, each with a copy
 * button (components/site/copy-chip.tsx — the same primitive the solo
 * kit's own site-output panel uses, not a new one).
 */
export function SetupSheetView({
  sheet,
  memberId,
}: {
  sheet: ClinicianSetupSheet;
  memberId: string;
}) {
  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)] max-md:pt-10">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:items-stretch">
        <div>
          <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
            {sheet.fullName || "Setup sheet"}
          </h1>
          <MonoLabel tracking="16" className="mt-2 block">
            {sheet.slug}
          </MonoLabel>
        </div>
        <ButtonLink
          href={`/api/practice/${memberId}/sheet/pdf`}
          variant="secondary"
          className="flex-none"
        >
          Download PDF
        </ButtonLink>
      </div>

      {sheet.blocking.length > 0 ? (
        <p className="mt-6 max-w-[560px] border-l border-accent pl-3 text-helper leading-prose text-ink">
          Still needed before this is ready to publish: {sheet.blocking.join(", ")}
        </p>
      ) : null}

      <div className="mt-8 flex max-w-brief flex-col gap-1 rounded-card border border-line">
        {sheet.steps.map((step) => (
          <div key={step.number} className="border-b border-line px-2 last:border-b-0">
            <CopyBlockRow label={`${step.number}. ${step.title}`} text={step.value} />
            {step.warning ? (
              <p className="border-l border-accent px-2 pb-3 pl-3 text-helper leading-prose text-ink">
                {step.warning}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
