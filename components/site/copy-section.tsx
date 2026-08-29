"use client";

import { RailSection } from "@/components/site/rail-section";
import { LimitedField } from "@/components/site/limited-field";
import { ClampNote } from "@/components/site/clamp-note";
import { clampNoteFor } from "@/lib/site/seed-clamped";
import {
  limitForTarget,
  patchForTarget,
  targetField,
  valueForTarget,
  type EditTarget,
} from "@/lib/site/edit";
import { sectionTypeOf, sortSections } from "@/lib/site/pages";
import type { SiteEditorState } from "@/components/site/use-site-editor";
import type { Direction } from "@/lib/brand/shapes";
import type { SiteCatalog } from "@/lib/site/types";

/*
 * Les champs longs.
 *
 * Ce ne sont PAS tous les textes du site : la copy s'édite en place, dans la
 * maquette. Ceux-ci sont ceux qui s'y éditent mal — un paragraphe de 600
 * caractères dans un `contentEditable` qui repousse la section suivante à
 * chaque retour à la ligne. Ils sont donc ici AUSSI, avec leur limite, et les
 * deux vues écrivent la même chose.
 *
 * ⚠ L'introduction est autorisée sur DEUX pages et lit UNE valeur. L'éditer
 * change les deux endroits. Le libellé le dit — il n'y a aucun moyen de donner
 * une intro différente à Home et à About, et c'est le dessin, pas une
 * limitation à contourner.
 */
export function CopySection({
  editor,
  catalog,
  direction,
}: {
  editor: SiteEditorState;
  catalog: SiteCatalog;
  direction: Direction;
}) {
  const { spec } = editor.envelope;

  function field(target: EditTarget, label: string, hint?: string) {
    const path = targetField(target);
    const clamped = clampNoteFor(spec.seed_clamped, direction, path);

    return (
      <LimitedField
        key={path}
        label={label}
        hint={hint}
        value={valueForTarget(spec, target)}
        limit={limitForTarget(catalog, spec, target)}
        multiline
        error={editor.error?.field === path ? editor.error.message : null}
        note={clamped ? <ClampNote field={clamped} /> : null}
        onChange={(next) => editor.edit(patchForTarget(spec, target, next))}
      />
    );
  }

  /* Les `longtext` de chaque section activée, page par page. */
  const sectionFields = spec.pages.flatMap((page) =>
    sortSections(page.sections)
      .filter((section) => section.enabled)
      .flatMap((section) =>
        (sectionTypeOf(catalog, section.type)?.fields ?? [])
          .filter((entry) => entry.kind === "longtext")
          .map((entry) =>
            field(
              { kind: "section", page: page.key, section: section.key, field: entry.key },
              `${page.label} · ${sectionTypeOf(catalog, section.type)?.label ?? section.type}`,
              entry.label
            )
          )
      )
  );

  return (
    <RailSection id="site-copy" title="Copy" hint="The long ones. Everything else, click it in the mockup.">
      <div className="flex flex-col gap-5">
        {field(
          { kind: "about" },
          "Your introduction",
          "Shown on Home and About. There is one version — editing it changes both."
        )}
        {sectionFields}
      </div>
    </RailSection>
  );
}
