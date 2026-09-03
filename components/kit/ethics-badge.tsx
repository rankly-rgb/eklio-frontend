"use client";

import { useState } from "react";
import type { EthicsCheck } from "@/lib/brand/shapes";

/*
 * The BOARD-SAFE COPY badge (Lot 7) — was a static pill, now clickable and
 * names which of the six real `ethics_rules` ran, and which (if any) this
 * kit's own generated copy was flagged against and rewritten past
 * (`brand_kits.ethics_check`, written by the pipeline's `enforceEthics`).
 * Reads the real persisted verdict — never re-derives one client-side.
 */

type RuleLabel = { id: string; label: string; description: string };

export function EthicsBadge({
  ethicsCheck,
  ethicsRules,
}: {
  ethicsCheck: EthicsCheck | null;
  ethicsRules: RuleLabel[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex-none rounded-pill border border-line px-3 py-1.5 font-mono text-mono uppercase tracking-mono-12 text-ink-2 hover:bg-card"
      >
        Board-safe copy
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-10 mt-2 w-[340px] rounded-card border border-line bg-bg p-4 shadow-preview">
          <p className="text-meta leading-body text-ink-2">
            Every word Eklio drafts for you is checked against these six rules before you ever see it.
          </p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {ethicsRules.map((rule) => {
              const flags = ethicsCheck?.flagged.filter((f) => f.rule_id === rule.id) ?? [];
              return (
                <li key={rule.id} className="text-meta leading-body">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 flex-none rounded-full ${
                        flags.length > 0 ? "bg-[var(--danger)]" : "bg-ink-3"
                      }`}
                    />
                    <span className="text-ink">{rule.label}</span>
                  </div>
                  {flags.length > 0 ? (
                    <p className="ml-3.5 mt-0.5 text-ink-2">
                      Caught and rewritten — this draft originally said &ldquo;{flags[0].excerpt}&rdquo;
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {ethicsRules.length === 0 ? (
            <p className="mt-2 text-meta text-ink-2">Rule details weren&rsquo;t available just now.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
