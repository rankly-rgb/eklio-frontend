import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { buttonClasses } from "@/components/ui/button";
import { PhotoSlot } from "@/components/kit/photo-slot";
import { LaunchStepDetail } from "@/components/checklist/launch-checklist";
import { LaunchStepActions } from "@/components/launch/step-actions";
import { ARCHETYPE_LABELS } from "@/lib/data/content";
import type { NextAction } from "@/lib/data/home";

/*
 * ── THE "NEXT" MODULE ────────────────────────────────────────────────────
 *
 * Exactly one thing, never a list -- `pickNextAction` in `lib/data/home.ts`
 * already chose it. This renders whichever of the three shapes it picked.
 *
 * The launch-step branch reuses `LaunchStepDetail` and `LaunchStepActions`
 * whole: the SAME copy blocks and the SAME Mark done / Skip for now write
 * `/app/launch/[stepKey]` uses, so there is exactly one place that "what does
 * this step actually need" lives. Its Mark done button keeps the product's
 * own ink-black styling deliberately -- it is the identical button on
 * `/app/launch`, and recoloring it only here would make the two disagree.
 *
 * The content-item branch is new to this card, so its one action IS in her
 * primary colour -- `buttonClasses("primary")`'s shape (pill, 40px, bold)
 * with the two colours overridden inline, the one place besides the canvas
 * this screen puts her colour outside a rendering of her own site.
 */
export function NextCard({
  brandKitId,
  next,
  primaryColor,
  ctaInk,
}: {
  brandKitId: string;
  next: NextAction;
  /** Her site's primary and cta-ink roles, for the one button this card may color itself. */
  primaryColor: string;
  ctaInk: string;
}) {
  return (
    <section
      aria-labelledby="next-up"
      className="box-border flex flex-col rounded-card border border-line p-[22px_24px]"
    >
      <MonoLabel tracking="16" as="h2" id="next-up">
        Next
      </MonoLabel>

      {next.kind === "launch_step" ? (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-ui font-medium text-ink">{next.step.label}</p>
          {next.step.description ? (
            <p className="-mt-2 text-helper leading-prose text-ink-2">
              {next.step.description}
            </p>
          ) : null}
          <LaunchStepDetail step={next.step.key} context={next.context} />
          <div className="border-t border-line pt-4">
            <LaunchStepActions
              brandKitId={brandKitId}
              stepKey={next.step.key}
              status={next.step.status}
            />
          </div>
        </div>
      ) : next.kind === "content_item" ? (
        <div className="mt-4 flex items-start gap-5 max-md:flex-col">
          <PhotoSlot
            tokens={{ primary: primaryColor, dark_neutral: ctaInk }}
            src={next.photoUrl}
            className="aspect-square w-[120px] flex-none rounded-preview max-md:w-full"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <MonoLabel tracking="14" tone="ink-3">
              {ARCHETYPE_LABELS[next.item.archetype]}
              {next.item.scheduled_for ? ` · ${scheduledLabel(next.item.scheduled_for)}` : ""}
            </MonoLabel>
            <p className="text-ui font-medium text-ink">{next.item.title ?? "Untitled"}</p>
            {next.item.caption ? (
              <p className="line-clamp-2 text-helper leading-prose text-ink-2">
                {next.item.caption}
              </p>
            ) : null}
            <Link
              href={`/app/content/${next.item.id}`}
              className={`${buttonClasses("primary")} mt-1 self-start`}
              style={{ background: primaryColor, color: ctaInk }}
            >
              Open it
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-body leading-prose text-ink-2">Nothing needs you today.</p>
      )}
    </section>
  );
}

/** `2026-09-06` → `Sep 6`, for the content-item branch's meta line. */
function scheduledLabel(scheduledFor: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${scheduledFor}T12:00:00Z`)
  );
}
