"use client";

import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";
import { useCopied } from "@/components/site/copy-chip";
import type { LovablePrompt } from "@/lib/site/lovable";
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
export function SiteSetupMaterial({
  prompt,
  siteHref,
  slots,
}: {
  /** Null when her builder target emits a setup sheet rather than a prompt. */
  prompt: LovablePrompt | null;
  siteHref: string;
  slots: LaunchSlots;
}) {
  return (
    <div className="flex flex-col gap-7">
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
