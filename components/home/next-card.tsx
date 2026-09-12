"use client";

import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { buttonClasses } from "@/components/ui/button";
import { CheckGlyph } from "@/components/ui/glyphs";
import { PhotoSlot } from "@/components/kit/photo-slot";
import { useCopied } from "@/components/site/copy-chip";
import { LaunchStepActions } from "@/components/launch/step-actions";
import { assetFormatLine, launchStepCopy, type StepCopy } from "@/lib/home/next-step";
import { ARCHETYPE_LABELS } from "@/lib/data/content";
import { initialsFrom } from "@/lib/app/header-context";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";
import type { NextAction } from "@/lib/data/home";

/*
 * ── THE NEXT STEP CARD ───────────────────────────────────────────────────
 *
 * Exactly one thing, never a list. `pickNextAction` in `lib/data/home.ts`
 * already chose it, by the rule it has always used, and this lot does not
 * touch that rule — only what the chosen thing looks like.
 *
 * Three blocks below the title are each conditional on the step actually
 * carrying them: the asset row, the copy well, and — for a content item —
 * neither. A step with no file and no text to paste renders a title, a body
 * and its two buttons, and that is a composed card, not a broken one. There
 * is no placeholder asset and no example text anywhere in here.
 *
 * `Mark done` / `Skip for now` are `LaunchStepActions` whole — the same write
 * against the same RPC `/app/launch` uses, so the two screens cannot drift
 * into disagreeing about what "done" means. Only the fill differs, and by an
 * opt-in prop rather than a fork.
 */
export function NextCard({
  brandKitId,
  next,
  nextIndex,
  nextAsset,
  totalSteps,
  primaryColor,
  ctaInk,
}: {
  brandKitId: string;
  next: NextAction;
  /** 1-based position among the seven, or null when this is not a launch step. */
  nextIndex: number | null;
  nextAsset: AssetManifestEntry | null;
  totalSteps: number;
  /** Her site's primary and cta-ink roles, for the content branch's one button. */
  primaryColor: string;
  ctaInk: string;
}) {
  return (
    <section
      aria-labelledby="next-step"
      className="box-border flex flex-col rounded-card border border-line p-[22px_24px]"
    >
      <div className="flex items-baseline gap-4">
        <MonoLabel tracking="16" as="h2" id="next-step">
          Next step
        </MonoLabel>
        {nextIndex ? (
          <MonoLabel tracking="14" tone="ink-3" className="ml-auto">
            {`${nextIndex} of ${totalSteps}`}
          </MonoLabel>
        ) : null}
      </div>

      {next.kind === "launch_step" ? (
        <LaunchStepBody
          brandKitId={brandKitId}
          next={next}
          asset={nextAsset}
        />
      ) : next.kind === "content_item" ? (
        <ContentItemBody next={next} primaryColor={primaryColor} ctaInk={ctaInk} />
      ) : (
        <p className="mt-4 text-body leading-prose text-ink-2">Nothing needs you today.</p>
      )}
    </section>
  );
}

function LaunchStepBody({
  brandKitId,
  next,
  asset,
}: {
  brandKitId: string;
  next: Extract<NextAction, { kind: "launch_step" }>;
  asset: AssetManifestEntry | null;
}) {
  const copy = launchStepCopy(next.step.key, next.context);

  return (
    <div className="mt-3 flex flex-col gap-4">
      <h3 className="text-pretty font-display text-card-title font-medium leading-card tracking-card-title text-ink">
        {next.step.label}
      </h3>

      {next.step.description ? (
        <p className="-mt-2 text-helper leading-prose text-ink-2">{next.step.description}</p>
      ) : null}

      {asset ? <AssetRow asset={asset} practiceName={next.context.practiceName} /> : null}

      {copy ? <CopyWell copy={copy} /> : null}

      <div className="border-t border-line pt-4">
        <LaunchStepActions
          brandKitId={brandKitId}
          stepKey={next.step.key}
          status={next.step.status}
          variant="accent"
        />
      </div>
    </div>
  );
}

/*
 * The file this step needs: her monogram, the catalogue's own label, its
 * format and pixels, and a check when it has actually been rendered under the
 * kit's current fingerprint.
 *
 * The check means `current`, not "exists". An asset rendered under a
 * fingerprint that no longer matches is stale, and ticking it would tell her
 * a file is ready that she would download out of date.
 */
function AssetRow({
  asset,
  practiceName,
}: {
  asset: AssetManifestEntry;
  practiceName: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-11 flex-none items-center justify-center rounded-preview bg-accent"
      >
        <MonoLabel tracking="08" tone="ink" className="text-bg">
          {initialsFrom(practiceName, null)}
        </MonoLabel>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-ui font-medium leading-body text-ink">{asset.label}</span>
        <MonoLabel tracking="12" tone="ink-3">
          {assetFormatLine(asset.kind, asset.width, asset.height)}
        </MonoLabel>
      </span>

      {asset.current ? (
        <span
          className="flex size-5 flex-none items-center justify-center rounded-pill bg-accent"
          role="img"
          aria-label="Ready"
        >
          <CheckGlyph size="sm" />
        </span>
      ) : null}
    </div>
  );
}

/*
 * The exact text, in a bordered well, with COPY at its bottom right.
 *
 * `useCopied` is the product's one clipboard behaviour, reused rather than
 * rewritten — including its refusal to say "Copied" when the write actually
 * failed. The text stays selectable either way.
 */
function CopyWell({ copy }: { copy: StepCopy }) {
  const [copied, write] = useCopied();

  return (
    <div className="flex flex-col gap-2 rounded-preview border border-line p-[14px_16px]">
      <MonoLabel tracking="12" tone="ink-3">
        {copy.label}
      </MonoLabel>
      <p className="text-helper leading-prose text-ink">{copy.text}</p>
      <button
        type="button"
        onClick={() => void write(copy.text)}
        aria-label={`Copy ${copy.label.toLowerCase()}`}
        className="-mb-1 -mr-1 self-end px-2 py-1 hover:opacity-70"
      >
        <MonoLabel tracking="12" tone={copied ? "accent" : "ink-2"}>
          {copied ? "Copied" : "Copy"}
        </MonoLabel>
      </button>
    </div>
  );
}

/** The other thing `pickNextAction` can choose: a post due within three days. */
function ContentItemBody({
  next,
  primaryColor,
  ctaInk,
}: {
  next: Extract<NextAction, { kind: "content_item" }>;
  primaryColor: string;
  ctaInk: string;
}) {
  return (
    <div className="mt-3 flex flex-col gap-4">
      <PhotoSlot
        tokens={{ primary: primaryColor, dark_neutral: ctaInk }}
        src={next.photoUrl}
        className="aspect-[4/3] w-full rounded-preview"
      />
      <MonoLabel tracking="14" tone="ink-3">
        {ARCHETYPE_LABELS[next.item.archetype]}
        {next.item.scheduled_for ? ` · ${scheduledLabel(next.item.scheduled_for)}` : ""}
      </MonoLabel>
      <h3 className="text-pretty font-display text-card-title font-medium leading-card tracking-card-title text-ink">
        {next.item.title ?? "Untitled"}
      </h3>
      {next.item.caption ? (
        <p className="-mt-2 line-clamp-3 text-helper leading-prose text-ink-2">
          {next.item.caption}
        </p>
      ) : null}
      <Link
        href={`/app/content/${next.item.id}`}
        className={`${buttonClasses("primary")} self-start`}
        style={{ background: primaryColor, color: ctaInk }}
      >
        Open it
      </Link>
    </div>
  );
}

/** `2026-09-06` → `Sep 6`, for the content-item branch's meta line. */
function scheduledLabel(scheduledFor: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${scheduledFor}T12:00:00Z`)
  );
}
