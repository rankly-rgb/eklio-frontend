"use client";

import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";
import { useCopied } from "@/components/site/copy-chip";
import { AssetDownloadButton } from "@/components/kit/asset-download-button";
import { ImageDownloadButton } from "@/components/launch/image-download-button";
import type { LovablePrompt } from "@/lib/site/lovable";
import type { SiteImage } from "@/lib/site/imagery";
import type { LaunchSlots } from "@/lib/launch/slots";

const LOVABLE = { name: "Lovable", url: "https://lovable.dev/" };

/*
 * ── STEP 1: THE PROMPT IS THE WAY THROUGH ────────────────────────────────
 *
 * The step used to offer one affordance — "Open the site editor" — and that
 * route currently throws in production (FINDINGS.md carries the elimination
 * pass). Until it is found, the editor must not be presented as the way
 * through. So the prompt comes first and the editor second, described as what
 * it actually is: where she shapes the copy BEFORE she copies the prompt.
 *
 * The two are sequential, not alternatives, and the order on screen says which
 * comes first.
 */
export type SiteSetupBlock = {
  /**
   * `spec.hero.cta_target_url` — the one thing that turns the site into a way
   * to reach her. Null means the button ships unlinked.
   */
  bookingUrl: string | null;
  /** Null when her builder target emits a setup sheet rather than a prompt. */
  prompt: LovablePrompt | null;
  slots: LaunchSlots;
  /** The logo file the prompt names, with the catalogue key to download it. */
  wordmark: { key: string; label: string; format: string } | null;
  /** The four site photographs she has, with the role each one plays. */
  images: SiteImage[];
};

export function SiteSetupMaterial({
  brandKitId,
  bookingUrl,
  prompt,
  siteHref,
  slots,
  wordmark,
  images,
}: SiteSetupBlock & { brandKitId: string; siteHref: string }) {
  return (
    <div className="flex flex-col gap-7">
      {/*
        ⚠ FIRST ON THE SCREEN, ABOVE THE PROMPT. A site with no booking link,
        no phone and no email is not a site — the button ships unlinked and the
        Contact page is a heading over a dead button. She has to be told before
        she copies, not after, so this sits above the well and not beside it.

        ⚠ AND IT LINKS RATHER THAN ASKING AGAIN. `hero.cta_target_url` already
        has two editors — the site editor's Details section and Settings —
        both patching the same field through the same route. A third input here
        would be a third surface writing one column. Settings is the one linked
        because it works: the site-editor route still throws in production
        (FINDINGS.md), and sending her there is the defect this step already
        fixed once.
      */}
      <BookingLink bookingUrl={bookingUrl} />
      {/*
        ⚠ SCANNED BEFORE SHOWN. If the Ethics Guard flags the assembled prompt,
        the step says so and shows WHAT flagged — it does not display the text
        and leave her to paste it into a builder that will publish it.
      */}
      {prompt && !prompt.scan.ok ? (
        <div className="flex flex-col gap-3 rounded-card border border-danger p-[18px_20px]">
          <MonoLabel tracking="12" tone="danger">
            Held back
          </MonoLabel>
          <p className="text-helper leading-prose text-ink">
            Your prompt didn&rsquo;t pass the advertising rules check, so it isn&rsquo;t shown
            here. What flagged:
          </p>
          <ul className="flex flex-col gap-2">
            {prompt.scan.violations.map((violation) => (
              <li key={`${violation.ruleId}-${violation.excerpt}`} className="text-meta leading-prose text-ink-2">
                <span className="text-ink">{violation.reason}</span>
                <span className="block font-mono text-mono text-ink-3">
                  &ldquo;{violation.excerpt}&rdquo;
                </span>
              </li>
            ))}
          </ul>
          <ButtonLink href={siteHref} variant="secondary" className="self-start">
            Open the site editor
          </ButtonLink>
        </div>
      ) : null}

      {prompt && prompt.scan.ok ? <PromptWell prompt={prompt} /> : null}

      {/*
        ⚠ THE FILES THE PROMPT NAMES, ON THE SAME SCREEN AS THE PROMPT.
        The prompt says "use the wordmark file downloaded from Eklio" and names
        four photographs by slot. Until now neither was offered here: the
        instruction pointed at a download that was not on the page, and the
        step screen's only file was the setup sheet. The list comes from
        `lib/site/imagery.ts`, which is also what the prompt reads — so what she
        downloads and what the prompt asks for cannot drift apart.
      */}
      {wordmark || images.length > 0 ? (
        <div className="flex flex-col gap-2">
          <MonoLabel tracking="12" tone="ink-3">
            Upload these to your builder
          </MonoLabel>
          <ul className="flex flex-col rounded-card border border-line">
            {wordmark ? (
              <li className="border-t border-line first:border-t-0">
                <div className="flex items-center gap-3 p-[12px_16px]">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-ui font-medium leading-body text-ink">
                      {wordmark.label}
                    </span>
                    <MonoLabel tracking="12" tone="ink-3">
                      {`${wordmark.format.toUpperCase()} · your logo, in the header and footer`}
                    </MonoLabel>
                  </span>
                  <AssetDownloadButton
                    brandKitId={brandKitId}
                    assetKey={wordmark.key}
                    className="flex-none"
                  >
                    Download
                  </AssetDownloadButton>
                </div>
              </li>
            ) : null}
            {images.map((image) => (
              <li key={image.slot} className="border-t border-line first:border-t-0">
                <div className="flex items-center gap-3 p-[12px_16px]">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-ui font-medium leading-body text-ink">
                      {image.title}
                    </span>
                    <MonoLabel tracking="12" tone="ink-3">
                      {`${image.dimensions} · ${image.slot}`}
                    </MonoLabel>
                  </span>
                  <ImageDownloadButton
                    brandKitId={brandKitId}
                    slot={image.slot}
                    label={image.title}
                    className="flex-none"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prompt === null ? (
        <p className="text-helper leading-prose text-ink-2">
          Your builder takes a setup sheet rather than a prompt. Open the site editor
          to copy it.
        </p>
      ) : null}

      {/*
        The slots. Absent when unset — no placeholder, no dummy embed, no
        coming-soon. See lib/launch/slots.ts.
      */}
      {slots.videoUrl ? (
        <a
          href={slots.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 self-start text-ui text-ink underline decoration-[var(--accent)] underline-offset-4 hover:opacity-80"
        >
          Watch how this works
          <span aria-hidden="true">&#8599;</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <MonoLabel tracking="12" tone="ink-3">
          Then
        </MonoLabel>
        <p className="text-helper leading-prose text-ink-2">
          {`You'll need a ${LOVABLE.name} account — Eklio doesn't have access to it, and it builds and hosts the site, not us.`}
        </p>
        <a
          href={slots.affiliateUrl ?? LOVABLE.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 self-start text-ui text-ink underline decoration-[var(--accent)] underline-offset-4 hover:opacity-80"
        >
          {`Open ${LOVABLE.name}`}
          <span aria-hidden="true">&#8599;</span>
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>

      {/*
        The editor, second and described as what it is. Not the way through —
        the place she shapes the words the prompt above will carry.
      */}
      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <MonoLabel tracking="12" tone="ink-3">
          Before you paste
        </MonoLabel>
        <p className="text-helper leading-prose text-ink-2">
          The prompt carries whatever your site copy says right now. To change the
          words first, shape them in the site editor and copy the prompt again.
        </p>
        <ButtonLink href={siteHref} variant="secondary" className="self-start">
          Open the site editor
        </ButtonLink>
      </div>
    </div>
  );
}

const SETTINGS_HREF = "/app/settings";

function BookingLink({ bookingUrl }: { bookingUrl: string | null }) {
  if (bookingUrl) {
    return (
      <div className="flex flex-col gap-2">
        <MonoLabel tracking="12" tone="ink-3">
          Your call-to-action link
        </MonoLabel>
        <p className="break-words text-helper leading-prose text-ink">{bookingUrl}</p>
        <a
          href={SETTINGS_HREF}
          className="inline-flex min-h-[44px] items-center self-start text-ui text-ink-2 underline decoration-[var(--accent)] underline-offset-4 hover:opacity-80"
        >
          Change it in Settings
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-warning p-[18px_20px]">
      <MonoLabel tracking="12" tone="warning">
        Before you copy
      </MonoLabel>
      <p className="text-helper leading-prose text-ink">
        You don&rsquo;t have a booking link yet, so your site will have{" "}
        <strong className="font-medium">no working way to reach you</strong>: the button
        will be there but won&rsquo;t go anywhere, and your Contact page will be a heading
        with nothing under it.
      </p>
      <p className="text-helper leading-prose text-ink-2">
        Add it here and it goes into the prompt below, into your email signature and
        onto your site&rsquo;s button — one link, everywhere.
      </p>
      <ButtonLink href={SETTINGS_HREF} variant="primary" className="self-start">
        Add your booking link
      </ButtonLink>
    </div>
  );
}

function PromptWell({ prompt }: { prompt: LovablePrompt }) {
  const [copied, write] = useCopied();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-3">
        <MonoLabel tracking="12" tone="ink-3">
          Your builder prompt
        </MonoLabel>
        {prompt.placeholders.length > 0 ? (
          <MonoLabel tracking="10" tone="warning">
            {`${prompt.placeholders.length} to fill in`}
          </MonoLabel>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-preview border border-line p-[14px_16px]">
        <pre className="max-h-[320px] overflow-y-auto whitespace-pre-wrap font-sans text-helper leading-prose text-ink">
          {prompt.text}
        </pre>
        <button
          type="button"
          onClick={() => void write(prompt.text)}
          aria-label="Copy your builder prompt"
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
