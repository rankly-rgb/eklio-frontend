"use client";

import type { SiteEditorState } from "@/components/site/use-site-editor";
import type { Direction } from "@/lib/brand/shapes";
import type { SiteCatalog } from "@/lib/site/types";

/*
 * Le rail de contrôle. Coquille du lot 1 : les sections arrivent aux lots 3
 * à 6 — couleurs et contraste, typographie, pages et sections, copy, détails,
 * instructions.
 */
export function ControlRail({
  editor,
}: {
  editor: SiteEditorState;
  catalog: SiteCatalog;
  direction: Direction;
}) {
  return (
    <div className="p-6">
      <p className="text-helper leading-prose text-ink-2">
        {editor.envelope.spec.pages.length} pages in your spec.
      </p>
    </div>
  );
}
