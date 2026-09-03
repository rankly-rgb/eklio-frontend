"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { ChevronGlyph } from "@/components/ui/glyphs";
import { ButtonLink } from "@/components/ui/button";
import { CopyBlockRow } from "@/components/site/copy-chip";
import {
  emailSignatureText,
  personalStatement,
  shortBio,
  type PracticeDetails,
} from "@/lib/kit/launch-copy";
import type { LaunchProgress, LaunchStep, LaunchStepKey } from "@/lib/data/checklist";

/*
 * "Your first week" — the seven-step launch checklist, shared between the
 * primary card on home (`components/home/checklist-card.tsx`) and the
 * compact row on the kit page (`components/kit/launch-progress-row.tsx`).
 * One implementation of the list, the expand/collapse, the optimistic
 * Mark done / Skip for now write, and the per-step detail — the two call
 * sites differ only in chrome.
 *
 * The toggle is OPTIMISTIC, same rule as the rest of this product's small
 * writes: the click must answer instantly, and a failure rolls back and
 * says so rather than leaving a silent mismatch with the server.
 */

export type LaunchStepContext = {
  practiceName: string | null;
  practitionerLine: string | null;
  aboutExcerpt: string | null;
  practiceDetails: PracticeDetails | null;
  bookingUrl: string | null;
  /** Where "Your assets" lives from wherever this checklist is rendered. */
  assetsHref: string;
  /** Where the site editor lives from wherever this checklist is rendered. */
  siteHref: string;
};

export function LaunchChecklist({
  brandKitId,
  initial,
  context,
}: {
  brandKitId: string;
  initial: LaunchProgress;
  context: LaunchStepContext;
}) {
  const [items, setItems] = useState(initial.items);
  const [expanded, setExpanded] = useState<LaunchStepKey | null>(null);
  const [pending, setPending] = useState<LaunchStepKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = items.length;
  const resolved = items.filter((item) => item.status !== "todo").length;

  if (total === 0) return null;

  if (resolved === total) {
    return (
      <p className="text-ui leading-body text-ink">
        Your brand is live in seven places.
      </p>
    );
  }

  async function setStatus(key: LaunchStepKey, status: LaunchStep["status"]) {
    const previous = items.find((item) => item.key === key)?.status ?? "todo";
    setError(null);
    setPending(key);
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, status } : item))
    );

    try {
      const response = await fetch(`/api/checklist/${brandKitId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, status }),
      });
      if (!response.ok) throw new Error("write failed");
    } catch {
      setItems((current) =>
        current.map((item) => (item.key === key ? { ...item, status: previous } : item))
      );
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <div className="h-0.5 flex-1 overflow-hidden rounded-pill bg-line">
          <div
            className="h-0.5 bg-accent transition-[width] duration-[var(--dur-select)]"
            style={{ width: `${(resolved / total) * 100}%` }}
          />
        </div>
        <MonoLabel tracking="14" className="flex-none">
          {`${resolved} of ${total}`}
        </MonoLabel>
      </div>

      <ul className="flex flex-col">
        {items.map((item) => {
          const isOpen = expanded === item.key;
          const isPending = pending === item.key;

          return (
            <li key={item.key} className="border-b border-line last:border-b-0">
              <div className="flex items-center gap-3 py-3">
                <StatusDot status={item.status} />
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : item.key)}
                  aria-expanded={isOpen}
                  className="flex min-w-0 flex-1 items-center text-left"
                >
                  <span
                    className={`truncate text-ui leading-body ${
                      item.status === "done"
                        ? "text-ink-3 line-through decoration-[var(--ink-3)]"
                        : item.status === "skipped"
                          ? "text-ink-3"
                          : "text-ink"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : item.key)}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  className="flex-none p-1"
                >
                  <span
                    className={`block transition-transform duration-[var(--dur-select)] ${isOpen ? "rotate-180" : ""}`}
                  >
                    <ChevronGlyph color="var(--ink-3)" />
                  </span>
                </button>
              </div>

              {isOpen ? (
                <div className="flex flex-col gap-3 pb-4 pl-[23px]">
                  {item.description ? (
                    <p className="text-helper leading-prose text-ink-2">
                      {item.description}
                    </p>
                  ) : null}

                  <StepDetail step={item.key} context={context} />

                  <div className="flex items-center gap-5">
                    {item.status === "done" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => void setStatus(item.key, "todo")}
                        className="text-meta text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4 disabled:opacity-40"
                      >
                        Mark not done
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => void setStatus(item.key, "done")}
                        className="text-meta text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4 disabled:opacity-40"
                      >
                        Mark done
                      </button>
                    )}
                    {item.status === "skipped" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => void setStatus(item.key, "todo")}
                        className="text-meta text-ink-3 hover:text-ink-2 disabled:opacity-40"
                      >
                        Undo skip
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => void setStatus(item.key, "skipped")}
                        className="text-meta text-ink-3 hover:text-ink-2 disabled:opacity-40"
                      >
                        Skip for now
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {error ? (
        <p role="alert" className="border-l border-accent pl-3 text-helper leading-prose text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StatusDot({ status }: { status: LaunchStep["status"] }) {
  return (
    <span
      aria-hidden="true"
      className={`size-[7px] flex-none rounded-pill ${
        status === "done" ? "bg-accent" : status === "skipped" ? "bg-ink-3" : "border border-line"
      }`}
    />
  );
}

/**
 * Per-step detail — real, kit-derived content where the kit has it,
 * an honest "not yet" where it doesn't. Never generic advice standing in
 * for a missing field.
 */
function StepDetail({ step, context }: { step: LaunchStepKey; context: LaunchStepContext }) {
  switch (step) {
    case "site_setup":
      return (
        <ButtonLink href={context.siteHref} variant="secondary" className="self-start">
          Open the site editor
        </ButtonLink>
      );

    case "update_directory":
    case "google_profile": {
      const statement = personalStatement(context.practitionerLine, context.practiceDetails);
      if (!statement) {
        return (
          <p className="text-helper leading-prose text-ink-2">
            Add your credential and location in the site editor to get your board-safe statement here.
          </p>
        );
      }
      return <CopyBlockRow label="Statement" text={statement} />;
    }

    case "social_setup": {
      const bio = shortBio(context.aboutExcerpt);
      return (
        <div className="flex flex-col gap-2">
          {bio ? (
            <>
              <CopyBlockRow label="Bio" text={bio} />
              <MonoLabel tracking="12" className="self-end">
                {`${bio.length} / 150`}
              </MonoLabel>
            </>
          ) : (
            <p className="text-helper leading-prose text-ink-2">
              Your about copy isn&rsquo;t ready yet — it will turn into your bio here once it is.
            </p>
          )}
          <ButtonLink href={context.assetsHref} variant="secondary" className="self-start">
            Get your avatar and cover image
          </ButtonLink>
        </div>
      );
    }

    case "email_signature": {
      const signature = emailSignatureText(
        context.practiceName,
        context.practitionerLine,
        context.practiceDetails,
        context.bookingUrl
      );
      return (
        <div className="flex flex-col gap-2">
          {signature ? (
            <CopyBlockRow label="Signature" text={signature} />
          ) : (
            <p className="text-helper leading-prose text-ink-2">
              Finish your practice details in the site editor to get your signature block here.
            </p>
          )}
          <p className="text-meta leading-body text-ink-2">
            Gmail: Settings → See all settings → Signature. Paste it in, then save.
          </p>
          <p className="text-meta leading-body text-ink-2">
            Outlook: File → Options → Mail → Signatures. Paste it in, then set it as default.
          </p>
        </div>
      );
    }

    case "booking_link":
      return context.bookingUrl ? (
        <div className="flex flex-col gap-2">
          <CopyBlockRow label="Booking link" text={context.bookingUrl} />
          <p className="text-meta leading-body text-ink-2">
            Your site, your email signature, your profiles — the same link everywhere.
          </p>
        </div>
      ) : (
        <p className="text-helper leading-prose text-ink-2">
          Add your booking link in the site editor to get it here.
        </p>
      );

    case "first_post":
      return (
        <ButtonLink href={context.assetsHref} variant="secondary" className="self-start">
          Get your signature template
        </ButtonLink>
      );

    default:
      return null;
  }
}
