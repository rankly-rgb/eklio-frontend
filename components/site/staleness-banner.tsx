"use client";

import { CopyButton } from "@/components/site/copy-chip";
import { stalenessBanner } from "@/lib/site/diff";
import { primaryCopyText } from "@/lib/site/output";
import type { SiteEditorState } from "@/components/site/use-site-editor";

/*
 * « Ce que vous avez copié n'est plus à jour. »
 *
 * Elle est posée AU-DESSUS de la sortie, en `--accent-soft`, pleine largeur,
 * et elle porte son propre bouton de copie. C'est délibérément la chose la
 * plus voyante de l'écran : c'est la seule qui empêche de coller chez un
 * constructeur des instructions qui ne correspondent plus à la maquette qu'on
 * vient de regarder.
 *
 * Elle disparaît par `mark-copied`, et par rien d'autre.
 */
export function StalenessBanner({ editor }: { editor: SiteEditorState }) {
  const { diff, output } = editor.envelope;
  const banner = stalenessBanner(diff);

  if (!banner.visible) return null;

  return (
    <div
      role="status"
      className="route-enter flex items-center gap-6 rounded-card bg-accent-soft p-[18px_24px] max-md:flex-col max-md:items-stretch max-md:gap-4"
      style={{ borderLeft: "3px solid var(--accent)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-ink">{banner.headline}</p>
        {banner.changes.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
            {banner.changes.map((label) => (
              <li key={label} className="text-helper leading-body text-ink-2">
                {label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <CopyButton
        text={primaryCopyText(output)}
        onCopied={() => void editor.markCopied()}
        className="flex-none max-md:w-full"
      >
        Copy the updated version
      </CopyButton>
    </div>
  );
}
