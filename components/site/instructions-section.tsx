"use client";

import { RailSection } from "@/components/site/rail-section";
import { LimitedField } from "@/components/site/limited-field";
import type { SiteEditorState } from "@/components/site/use-site-editor";
import type { SiteCatalog } from "@/lib/site/types";

/*
 * Ce qu'elle ajoute pour son constructeur, en toutes lettres.
 *
 * ── LA PHRASE SOUS LE CHAMP N'EST PAS NÉGOCIABLE ────────────────────────
 *
 * Elle répond à la question qu'on se pose en tapant : « est-ce que ça va
 * changer quelque chose là-haut ? ». Non. Le texte part MOT POUR MOT dans les
 * instructions — c'est l'étape « Your own notes » de la feuille, et une ligne
 * du prompt — et il ne touche pas la maquette.
 *
 * ── ET ON N'ESSAIE PAS DE L'Y REFLÉTER ──────────────────────────────────
 *
 * « Keep the fee off the home page » n'a pas de rendu. « Tuesday and Thursday
 * are the only hours open » non plus. Les interpréter, ce serait inventer une
 * modification qu'elle n'a pas demandée, sur une maquette qui est censée
 * montrer ce qu'elle va coller.
 */
export function InstructionsSection({
  editor,
  catalog,
}: {
  editor: SiteEditorState;
  catalog: SiteCatalog;
}) {
  const { spec } = editor.envelope;

  return (
    <RailSection id="site-instructions" title="Anything else for your builder">
      <LimitedField
        label="Anything else for your builder"
        value={spec.extra_instructions ?? ""}
        limit={catalog.site_spec_limits.extra_instructions}
        multiline
        error={
          editor.error?.field === "extra_instructions" ? editor.error.message : null
        }
        onChange={(next) => editor.edit({ extra_instructions: next })}
      />
      <p className="mt-2 text-meta leading-body text-ink-2">
        Added to your instructions word for word. It won&rsquo;t show up in the
        mockup above.
      </p>
    </RailSection>
  );
}
