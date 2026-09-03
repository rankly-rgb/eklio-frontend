"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClinicianProfileCompleteness } from "@/lib/tenancy/clinician-profile";

/*
 * The clinician brief's rail/sheet pair — same breakpoint split as
 * components/brief/preview-rail.tsx / preview-sheet.tsx (420px fixed rail
 * above 1024px, a collapsible bottom sheet below), but showing the
 * completeness score instead of a rendered brand mock: this flow has no
 * visual site preview to repaint, so the equivalent "your answers, live" is
 * the score and what's still missing, updating on the same PATCH round-trip.
 */

const FIELD_LABELS: Record<string, string> = {
  credentials: "Credentials",
  licensed_states: "Licensed states",
  modalities: "Modalities",
  populations: "Who you work with",
  philosophy_quote: "Your philosophy",
  supervisor: "Supervisor",
  outside_the_room: "Outside the room",
  personality_note: "A personal note",
  session_rate: "Session rate",
  booking_url: "Booking link",
  photo: "Photo on file",
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function CompletenessBody({
  completeness,
}: {
  completeness: ClinicianProfileCompleteness | null;
}) {
  if (!completeness) {
    return <Skeleton className="h-[160px] w-full" radius="var(--radius-card)" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <MonoLabel tracking="16">Profile complete</MonoLabel>
        <MonoLabel tracking="16" tone={completeness.score === 100 ? "accent" : "ink-2"}>
          {`${completeness.score}%`}
        </MonoLabel>
      </div>
      {completeness.isStale ? (
        <p className="border-l border-accent pl-3 text-helper leading-prose text-ink">
          This profile hasn't been touched in a while — worth a look even if it's complete.
        </p>
      ) : null}
      {completeness.blockingMissing.length > 0 ? (
        <div className="flex flex-col gap-2">
          <MonoLabel tracking="14" tone="ink-3">
            Still needed
          </MonoLabel>
          <ul className="flex flex-col gap-1 text-ui text-ink-2">
            {completeness.blockingMissing.map((field) => (
              <li key={field} className="flex gap-2">
                <span aria-hidden="true">—</span>
                <span>{fieldLabel(field)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-ui text-ink-2">Everything a bio page needs is here.</p>
      )}
    </div>
  );
}

export function CompletenessRail({
  completeness,
}: {
  completeness: ClinicianProfileCompleteness | null;
}) {
  return (
    <aside
      aria-label="Your profile's completeness"
      className="w-rail flex-none border-l border-line p-[44px_48px_0_40px] max-lg:hidden"
    >
      <CompletenessBody completeness={completeness} />
    </aside>
  );
}

export function CompletenessSheet({
  completeness,
}: {
  completeness: ClinicianProfileCompleteness | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 box-border overflow-hidden rounded-t-[20px] border-t border-line bg-bg px-5 pt-3 lg:hidden ${
        expanded ? "top-0 overflow-y-auto rounded-t-none pb-10" : "h-[148px]"
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Hide completeness" : "Show completeness"}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-col items-stretch"
      >
        <span className="flex justify-center">
          <span className="h-[3px] w-11 rounded-pill bg-line" />
        </span>
        <MonoLabel tracking="16" className="mt-3 block text-left">
          {completeness ? `${completeness.score}% complete` : "Completeness"}
        </MonoLabel>
      </button>
      <div className={`mt-3 ${expanded ? "" : "pointer-events-none"}`}>
        <CompletenessBody completeness={completeness} />
      </div>
    </div>
  );
}
