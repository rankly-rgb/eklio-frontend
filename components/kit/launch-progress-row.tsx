"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { ChevronGlyph } from "@/components/ui/glyphs";
import { LaunchChecklist, type LaunchStepContext } from "@/components/checklist/launch-checklist";
import type { LaunchProgress } from "@/lib/data/checklist";

/*
 * The compact progress row on the kit page (Lot 6) — collapsed to a bar and
 * an "X of 7" by default, expands in place to the same `LaunchChecklist`
 * home's card renders. One shared brain, two chromes: home's card is always
 * open (it has the room and nothing else on that slot); this row starts
 * closed, because the kit page already has six sections' worth to scroll
 * through and a launch checklist isn't why she's here.
 */
export function LaunchProgressRow({
  brandKitId,
  progress,
  context,
}: {
  brandKitId: string;
  progress: LaunchProgress;
  context: LaunchStepContext;
}) {
  const [open, setOpen] = useState(false);

  if (progress.total === 0) return null;
  const allResolved = progress.resolvedCount === progress.total;

  if (allResolved) {
    return (
      <div className="mt-6 flex items-center gap-4 rounded-card border border-line p-[16px_20px]">
        <MonoLabel tracking="16" className="flex-none">
          Your first week
        </MonoLabel>
        <p className="min-w-0 flex-1 text-ui text-ink-2">
          Your brand is live in seven places.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-card border border-line p-[16px_20px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-4"
      >
        <MonoLabel tracking="16" className="flex-none">
          Your first week
        </MonoLabel>
        <div className="h-0.5 flex-1 overflow-hidden rounded-pill bg-line">
          <div
            className="h-0.5 bg-accent transition-[width] duration-[var(--dur-select)]"
            style={{ width: `${(progress.resolvedCount / progress.total) * 100}%` }}
          />
        </div>
        <MonoLabel tracking="14" className="flex-none">
          {`${progress.resolvedCount} of ${progress.total}`}
        </MonoLabel>
        <span
          className={`block flex-none p-1 transition-transform duration-[var(--dur-select)] ${open ? "rotate-180" : ""}`}
        >
          <ChevronGlyph color="var(--ink-3)" />
        </span>
      </button>

      {open ? (
        <div className="mt-5">
          <LaunchChecklist brandKitId={brandKitId} initial={progress} context={context} />
        </div>
      ) : null}
    </div>
  );
}
