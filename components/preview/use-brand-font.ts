"use client";

import { useEffect, useReducer } from "react";

/*
 * Chargement dynamique des polices de MARQUE (§4).
 *
 * Les trois polices de l'app sont auto-hébergées au build ; celles de la
 * marque ne sont connues qu'au runtime — elles arrivent en `google_fonts_url`
 * avec le modèle. On injecte donc un <link> par URL, dédupliqué par href, et
 * on ne le retire jamais : la même paire revient d'un écran à l'autre, et un
 * retrait provoquerait un rechargement visible.
 *
 * `ready` pilote le fondu de 200 ms. Il est DÉRIVÉ au rendu depuis un registre
 * de module, pas posé en effet : une paire déjà chargée est prête dès la
 * première frame (retour sur le kit, changement de direction et retour), sans
 * le clignotement qu'imposerait un `useState(false)` remonté à chaque montage.
 */

/** URLs dont la feuille a été injectée. */
const injected = new Set<string>();
/** URLs dont les polices sont posées — donc affichables sans fondu. */
const settled = new Set<string>();

export function useBrandFont(googleFontsUrl: string | null): boolean {
  const [, rerender] = useReducer((tick: number) => tick + 1, 0);
  const ready = !googleFontsUrl || settled.has(googleFontsUrl);

  useEffect(() => {
    if (!googleFontsUrl || settled.has(googleFontsUrl)) return;

    let cancelled = false;

    if (!injected.has(googleFontsUrl)) {
      injected.add(googleFontsUrl);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = googleFontsUrl;
      document.head.appendChild(link);
    }

    const settle = () => {
      settled.add(googleFontsUrl);
      if (!cancelled) rerender();
    };

    /*
     * `document.fonts.ready` peut se résoudre AVANT que la feuille Google ne
     * soit parsée : d'où le second tour. Le plafond existe pour ne jamais
     * laisser la maquette masquée si la police n'arrive pas — réseau coupé,
     * domaine bloqué par une extension.
     */
    const fallback = setTimeout(settle, 1200);
    document.fonts?.ready
      .then(() => document.fonts.ready)
      .then(settle)
      .catch(settle);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [googleFontsUrl]);

  return ready;
}
