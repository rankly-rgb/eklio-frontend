"use client";

import { useState } from "react";
import { CopyButton } from "@/components/site/copy-chip";
import { ButtonLink } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * The handoff, as one screen.
 *
 * ⚠ THERE IS NO SHARE LINK ON THIS PAGE, AND THERE MUST NOT BE ONE. Eklio
 * never hosts, publishes or shares — so a handoff is a thing she copies or
 * downloads and forwards herself. That is not a limitation to route around:
 * it is the reason the recipient needs no account, and the reason nothing
 * about this practice is sitting on a URL that anyone can guess.
 *
 * The brief is shown in full rather than summarized. She is about to send it
 * to another person, and something she has not read is something she cannot
 * stand behind.
 */
export function HandoffView({
  brief,
  zipHref,
  pdfHref,
  assetsHref,
}: {
  brief: string;
  /** The asset library, where the download that needs a selection lives. */
  zipHref: string;
  /** The brand PDF route, which is a plain GET. */
  pdfHref: string;
  assetsHref: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-8 flex max-w-[860px] flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <MonoLabel tracking="16" as="h2">
            The brief
          </MonoLabel>
          <CopyButton text={brief} onCopied={() => setCopied(true)}>
            {copied ? "Copied" : "Copy the whole brief"}
          </CopyButton>
        </div>

        <p className="text-helper leading-prose text-ink-2">
          Paste this into an email. It is plain text on purpose: it reads the same in every mail
          client, and whoever receives it can copy a color out of it without opening anything.
        </p>

        <pre className="overflow-x-auto rounded-card border border-line bg-paper-2 p-5 font-mono text-mono leading-prose text-ink">
          {brief}
        </pre>
      </section>

      <section className="flex flex-col gap-4">
        <MonoLabel tracking="16" as="h2">
          The files
        </MonoLabel>
        <p className="text-helper leading-prose text-ink-2">
          Attach these to the same email. They are yours to send on — there is nothing to sign in
          to, and nothing expires at the other end.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={assetsHref} variant="secondary">
            Choose files to download
          </ButtonLink>
          <ButtonLink href={pdfHref} variant="secondary">
            Download the brand PDF
          </ButtonLink>
        </div>
        {/*
         * `zipHref` is the asset library's own multi-select download, which is
         * a POST with a list of keys — so it is reached through the library
         * rather than linked directly here. Naming it in the props keeps the
         * page honest about where that download actually lives.
         */}
        <p className="text-meta leading-body text-ink-3">
          The .zip is built from the files you select in the asset library ({zipHref}).
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line p-6">
        <MonoLabel tracking="16" as="h2">
          What Eklio does not do
        </MonoLabel>
        <p className="text-helper leading-prose text-ink-2">
          Eklio does not host your site, publish anything for you, or put your brand on a link that
          other people can open. There is no share URL on this page and there will not be one. Your
          brand goes wherever you decide to put it, and you send it yourself.
        </p>
      </section>
    </div>
  );
}
