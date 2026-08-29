"use client";

import { BrowserFrame } from "@/components/ui/browser-frame";
import { useBrandFont } from "@/components/preview/use-brand-font";
import { domainFor } from "@/lib/brand/derive";
import type { SiteEditorState } from "@/components/site/use-site-editor";

/*
 * La maquette. Coquille du lot 1 : le cadre, les jetons, la légende.
 * Les pages et l'édition en place arrivent au lot 2.
 */
export function Mockup({ editor }: { editor: SiteEditorState }) {
  const { preview } = editor.envelope;
  const ready = useBrandFont(preview.tokens.google_fonts_url);

  return (
    <div>
      <BrowserFrame size="full" domain={domainFor(preview.practice_name)}>
        <div
          className="min-h-[420px]"
          style={{ background: preview.tokens.paper, opacity: ready ? 1 : 0.6 }}
        />
      </BrowserFrame>
      <p className="mt-3 text-helper leading-prose text-ink-2">
        Your design reference. Your builder will follow it closely, not pixel
        for pixel.
      </p>
    </div>
  );
}
