"use client";

import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";
import { CheckGlyph } from "@/components/ui/glyphs";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import { useCopied } from "@/components/site/copy-chip";
import { STEP_PLACES } from "@/lib/launch/places";
import { STEP_ASSET_KEYS, assetFormatLine, stepTextBlocks, type TextBlock } from "@/lib/launch/material";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";
import type { LaunchStepKey } from "@/lib/data/checklist";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";
import type { DirectoryField } from "@/lib/launch/directory";
import { SiteSetupMaterial } from "@/components/launch/site-setup-material";
import type { LovablePrompt } from "@/lib/site/lovable";
import type { LaunchSlots } from "@/lib/launch/slots";

/*
 * ── EVERYTHING ONE STEP HANDS OVER ───────────────────────────────────────
 *
 * In order: the words she pastes, the files she uploads, then the door out.
 * The door is last on purpose — the point of the step is that she leaves with
 * the material, not that she leaves.
 *
 * ⚠ A BLOCK WHOSE SOURCE IS NULL IS ABSENT. Not an empty well, not a
 * placeholder, not a greyed box with "coming soon". `stepTextBlocks` returns
 * nothing for a field that is null, and an asset key missing from the manifest
 * gets no row — so a step with no booking link shows what to do about that
 * rather than an empty box to copy nothing out of.
 */
export function StepMaterial({
  brandKitId,
  stepKey,
  context,
  manifest,
  directoryFields = [],
  siteSetup = null,
}: {
  brandKitId: string;
  stepKey: LaunchStepKey;
  context: LaunchStepContext;
  manifest: AssetManifestEntry[];
  /**
   * Resolved directory fields, for the one step that fills in a form. Empty
   * everywhere else, and empty here too when she picked nothing.
   */
  directoryFields?: DirectoryField[];
  /** Step 1 only: the assembled builder prompt, and the two optional slots. */
  siteSetup?: { prompt: LovablePrompt | null; slots: LaunchSlots } | null;
}) {
  const place = STEP_PLACES[stepKey];
  const texts = stepTextBlocks(stepKey, context);
  const assets = STEP_ASSET_KEYS[stepKey]
    .map((key) => manifest.find((entry) => entry.key === key))
    .filter((entry): entry is AssetManifestEntry => Boolean(entry));

  return (
    <div className="flex flex-col gap-6">
      {texts.map((block) => (
        <CopyWell key={block.label} block={block} />
      ))}

      {/*
        The form's own fields, each copied on its own. She is filling in boxes,
        not writing a paragraph, so each one is its own line with its own
        button — pasting four things means four copies, and a single blob would
        make her cut it up by hand.
      */}
      {directoryFields.length > 0 ? (
        <div className="flex flex-col gap-2">
          <MonoLabel tracking="12" tone="ink-3">
            Your profile fields
          </MonoLabel>
          <ul className="flex flex-col rounded-card border border-line">
            {directoryFields.map((field) => (
              <li key={field.label} className="border-t border-line first:border-t-0">
                <FieldRow field={field} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        ⚠ THE GOOGLE DESCRIPTION IS NOT WRITTEN, AND THIS SAYS SO. Google asks
        for one; Eklio has not generated one, because copy that goes out in her
        name goes through the Ethics Guard and that is its own piece of work.
        Saying nothing would leave her staring at a required box with no idea
        why the product skipped it — so the absence is named, and it points at
        the statement sitting a few inches above, which she can adapt herself.
      */}
      {stepKey === "google_profile" ? (
        <p className="text-helper leading-prose text-ink-2">
          Google asks for a short description. Eklio hasn&rsquo;t written one yet — your
          statement above is the closest thing you have, and it&rsquo;s yours to adapt.
        </p>
      ) : null}

      {assets.length > 0 ? (
        <div className="flex flex-col gap-2">
          <MonoLabel tracking="12" tone="ink-3">
            {assets.length === 1 ? "The file" : "The files"}
          </MonoLabel>
          <ul className="flex flex-col rounded-card border border-line">
            {assets.map((asset) => (
              <li key={asset.key} className="border-t border-line first:border-t-0">
                <div className="flex items-center gap-3 p-[12px_16px]">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-ui font-medium leading-body text-ink">
                      {asset.label}
                    </span>
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
                  <AssetDownloadButton
                    brandKitId={brandKitId}
                    assetKey={asset.key}
                    className="flex-none"
                  >
                    Download
                  </AssetDownloadButton>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
       * ⚠ THE BOOKING LINK'S EMPTY CASE, NAMED. `cta_target_url` is nullable
       * and seeded null, so this step's only material can legitimately not
       * exist. It says where to set it instead of showing a well with nothing
       * in it — the one case in the seven where a step has nothing to hand over.
       */}
      {stepKey === "booking_link" && !context.bookingUrl ? (
        <div className="flex flex-col gap-3 rounded-card border border-line p-[18px_20px]">
          <p className="text-helper leading-prose text-ink-2">
            You don&rsquo;t have a booking link yet. Add one in the site editor and it
            will appear here, in your email signature, and on your site&rsquo;s button.
          </p>
          <ButtonLink href={context.siteHref} variant="secondary" className="self-start">
            Open the site editor
          </ButtonLink>
        </div>
      ) : null}

      {/*
        Step 1 carries its own block: the prompt first, the builder second, the
        editor last and described as what it is. It also owns the link out, so
        the generic service block below is skipped for it.
      */}
      {stepKey === "site_setup" && siteSetup ? (
        <SiteSetupMaterial
          prompt={siteSetup.prompt}
          siteHref={context.siteHref}
          slots={siteSetup.slots}
        />
      ) : null}

      {place.service && stepKey !== "site_setup" ? (
        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <MonoLabel tracking="12" tone="ink-3">
            Then
          </MonoLabel>
          <p className="text-helper leading-prose text-ink-2">
            {`You'll need to sign in to ${place.service.name} — Eklio doesn't have access to your account.`}
          </p>
          {/*
           * The service's front door, and nothing more specific. Eklio holds no
           * account identifier for any of these, so a constructed profile URL
           * would be a guess. `noopener noreferrer` on every one: a new tab
           * must not get a handle on this one.
           */}
          <a
            href={place.service.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 self-start text-ui text-ink underline decoration-[var(--accent)] underline-offset-4 hover:opacity-80"
          >
            {`Open ${place.service.name}`}
            <span aria-hidden="true">&#8599;</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}

/** One form field: its name, her answer, and a copy of that answer alone. */
function FieldRow({ field }: { field: DirectoryField }) {
  const [copied, write] = useCopied();

  return (
    <div className="flex items-center gap-3 p-[12px_16px]">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <MonoLabel tracking="12" tone="ink-3">
          {field.label}
        </MonoLabel>
        <span className="text-ui leading-body text-ink">{field.value}</span>
      </span>
      <button
        type="button"
        onClick={() => void write(field.value)}
        aria-label={`Copy ${field.label.toLowerCase()}`}
        className="-my-2 inline-flex min-h-[44px] flex-none items-center px-2 hover:opacity-70"
      >
        <MonoLabel tracking="12" tone={copied ? "accent" : "ink-2"}>
          {copied ? "Copied" : "Copy"}
        </MonoLabel>
      </button>
    </div>
  );
}

/** The exact text, in a bordered well, with COPY at its bottom right. */
function CopyWell({ block }: { block: TextBlock }) {
  const [copied, write] = useCopied();

  return (
    <div className="flex flex-col gap-2">
      <MonoLabel tracking="12" tone="ink-3">
        {block.label}
      </MonoLabel>
      <div className="flex flex-col gap-2 rounded-preview border border-line p-[14px_16px]">
        <p className="whitespace-pre-wrap text-helper leading-prose text-ink">{block.text}</p>
        <button
          type="button"
          onClick={() => void write(block.text)}
          aria-label={`Copy ${block.label.toLowerCase()}`}
          className="-mb-2 -mr-2 inline-flex min-h-[44px] items-center self-end px-3 hover:opacity-70"
        >
          <MonoLabel tracking="12" tone={copied ? "accent" : "ink-2"}>
            {copied ? "Copied" : "Copy"}
          </MonoLabel>
        </button>
      </div>
    </div>
  );
}
