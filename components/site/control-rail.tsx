"use client";

import { ColorSection } from "@/components/site/color-section";
import { ContrastSection } from "@/components/site/contrast-section";
import { TypographySection } from "@/components/site/typography-section";
import { PagesSection } from "@/components/site/pages-section";
import { CopySection } from "@/components/site/copy-section";
import { DetailsSection } from "@/components/site/details-section";
import type { SiteEditorState } from "@/components/site/use-site-editor";
import type { Direction } from "@/lib/brand/shapes";
import type { SiteCatalog } from "@/lib/site/types";
import type { TypePairing } from "@/lib/catalog/types";

/*
 * Le rail de contrôle — les sections, dans l'ordre où on les traverse :
 * couleurs, contraste, typographie, pages et sections, copy, détails,
 * instructions, remise à zéro.
 *
 * Chaque section lit `editor.envelope` et rien d'autre. Aucune ne garde de
 * copie locale de l'état : une enveloppe est remplacée EN BLOC à chaque
 * réponse, et un état local survivrait à ce remplacement en le contredisant.
 */
export function ControlRail({
  editor,
  catalog,
  pairings,
  direction,
}: {
  editor: SiteEditorState;
  catalog: SiteCatalog;
  pairings: TypePairing[];
  /** La direction retenue — lue seulement pour les originaux de `seed_clamped`. */
  direction: Direction;
}) {
  return (
    <div className="flex flex-col">
      <ColorSection editor={editor} />
      <ContrastSection editor={editor} />
      <TypographySection editor={editor} pairings={pairings} />
      <PagesSection editor={editor} catalog={catalog} />
      <CopySection editor={editor} catalog={catalog} direction={direction} />
      <DetailsSection editor={editor} catalog={catalog} direction={direction} />
    </div>
  );
}
