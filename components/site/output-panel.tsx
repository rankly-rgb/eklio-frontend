"use client";

import type { SiteEditorState } from "@/components/site/use-site-editor";
import type { SiteCatalog } from "@/lib/site/types";

/*
 * Le panneau de sortie. Coquille du lot 1 : les pastilles de constructeur, les
 * deux formes de sortie, la copie et la bannière de péremption arrivent aux
 * lots 7 et 8.
 */
export function OutputPanel({ editor }: {
  editor: SiteEditorState;
  catalog: SiteCatalog;
  brandKitId: string;
}) {
  return (
    <section className="rounded-card border border-line p-6">
      <p className="text-helper leading-prose text-ink-2">
        Your instructions for {editor.envelope.spec.target}.
      </p>
    </section>
  );
}
