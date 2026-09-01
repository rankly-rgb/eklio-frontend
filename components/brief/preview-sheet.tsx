"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { BrandPreview } from "@/components/preview/brand-preview";
import type { PreviewModel } from "@/lib/brand/shapes";

/*
 * La prévisualisation en mobile (Écran 8) — une feuille ancrée en bas.
 *
 * Repliée : 148px sur `--bg`, filet en haut, rayon 20px en haut, poignée de
 * 44×3 centrée, libellé mono PREVIEW, et LE HAUT DE LA MAQUETTE qui dépasse
 * sous la ligne de flottaison. C'est ce dépassement qui fait la promesse :
 * une feuille close ne dirait pas qu'il y a un site derrière.
 *
 * Dépliée : toute la hauteur, la maquette entière.
 *
 * La feuille est un vrai bouton pour sa poignée : au clavier comme au doigt,
 * elle s'ouvre et se referme, et son état est annoncé par `aria-expanded`.
 */
export function PreviewSheet({ model }: { model: PreviewModel | null }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 box-border overflow-hidden rounded-t-[20px] border-t border-line bg-bg px-5 pt-3 lg:hidden ${
        expanded ? "top-0 overflow-y-auto rounded-t-none pb-10" : "h-[148px]"
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Hide the preview" : "Show the preview"}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-col items-stretch"
      >
        <span className="flex justify-center">
          <span className="h-[3px] w-11 rounded-pill bg-line" />
        </span>
        <MonoLabel tracking="16" className="mt-3 block text-left">
          Preview
        </MonoLabel>
      </button>

      {model ? (
        <div
          className={`mt-3 ${
            // Repliée, la maquette est rognée par la feuille : seul son haut
            // dépasse, et c'est voulu.
            expanded ? "" : "pointer-events-none"
          }`}
        >
          <BrandPreview model={model} size="panel" />
        </div>
      ) : null}
    </div>
  );
}
