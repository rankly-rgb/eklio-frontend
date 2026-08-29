"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { RailSection } from "@/components/site/rail-section";
import {
  FIX_ALL_MAX_STEPS,
  contrastSummary,
  fixAllReport,
  hasUnfixableFailure,
  isBelowAa,
  nextPairToFix,
  pairNote,
  pairReading,
  type FixAllReport,
} from "@/lib/site/contrast";
import type { SiteEditorState } from "@/components/site/use-site-editor";

/*
 * Le rapport de contraste. Sept paires, toujours les sept, toujours dans
 * l'ordre où elles arrivent.
 *
 * ── UN CORRECTIF N'EST NI LOCAL NI DÉFINITIF ────────────────────────────
 *
 * Il réécrit UN jeton, et toute paire qui partage ce jeton bouge avec lui —
 * y compris vers le bas. Mesuré sur OCHRE & PAPER : appliquer
 * `primary_on_paper` fait tomber `cta_label_on_primary` de 5.23 à 4.90 et
 * retourne le libellé du bouton du neutre sombre au blanc. Rien de tout ça
 * n'était prévisible depuis la paire cliquée.
 *
 * D'où trois règles, tenues ici :
 *   - le bloc entier est re-rendu depuis l'enveloppe retournée ; on ne
 *     rapièce pas la paire cliquée ;
 *   - `suggested_fix` n'est jamais mis en cache au travers d'une écriture —
 *     ce composant ne lit que `editor.envelope`, qui est remplacé en bloc ;
 *   - « tout est réparé » se lit sur `contrast.passes_aa`, jamais sur le fait
 *     qu'un appel a réussi.
 *
 * ── LE CONTRASTE NE BLOQUE JAMAIS UNE ÉCRITURE ──────────────────────────
 *
 * Il n'y a aucune contrainte sur un ratio en base : un spec avec une paire en
 * échec s'enregistre normalement. On le signale, on propose le bouton, on ne
 * met pas de barrière.
 */
export function ContrastSection({ editor }: { editor: SiteEditorState }) {
  const { contrast } = editor.envelope;
  const [fixing, setFixing] = useState<string | null>(null);
  const [report, setReport] = useState<FixAllReport | null>(null);
  const summary = contrastSummary(contrast);

  async function fixOne(pairId: string) {
    setFixing(pairId);
    setReport(null);
    try {
      await editor.fixContrast(pairId);
    } finally {
      setFixing(null);
    }
  }

  /*
   * « Tout corriger », le pire d'abord. La boucle relit le contraste dans
   * l'enveloppe RETOURNÉE à chaque tour — la suggestion de l'appel suivant
   * n'existe pas avant celui-ci. Bornée à quatre tours : le pire cas mesuré
   * sur les six familles livrées est deux.
   */
  async function fixAll() {
    setFixing("all");
    setReport(null);
    try {
      for (let step = 0; step < FIX_ALL_MAX_STEPS; step += 1) {
        const pair = nextPairToFix(editor.envelope.contrast);
        if (!pair) break;
        await editor.fixContrast(pair.pair_id);
      }
    } finally {
      setFixing(null);
      /*
       * On RAPPORTE ce qui a été obtenu, on n'annonce pas un succès. Les appels
       * ont pu tous réussir et laisser une paire en échec : un correctif
       * déplace un jeton, et toute paire qui le partage bouge avec lui.
       * `editor.envelope.contrast` est ici celui du DERNIER appel.
       */
      setReport(fixAllReport(editor.envelope.contrast));
    }
  }

  return (
    <RailSection
      id="site-contrast"
      title="Contrast"
      trailing={
        <span
          className={`flex-none rounded-pill border px-3 py-1 font-mono text-mono uppercase tracking-mono-12 ${
            summary.passes
              ? "border-line text-ink-2"
              : "border-[var(--danger)] text-[var(--danger)]"
          }`}
        >
          {summary.label}
        </span>
      }
    >
      <ul className="flex flex-col gap-2">
        {contrast.pairs.map((pair) => {
          const below = isBelowAa(pair);
          const note = pairNote(pair);
          return (
            <li
              key={pair.pair_id}
              className="flex flex-wrap items-center gap-3 border-b border-line pb-2 last:border-b-0 last:pb-0"
            >
              <span className="flex flex-none items-center gap-0.5" aria-hidden="true">
                {/* Les deux couleurs mesurées, telles qu'elles arrivent : `fg`
                    est déjà la variante là où c'en est une. */}
                <span
                  className="size-4 rounded-l-check border border-line"
                  style={{ background: pair.bg }}
                />
                <span
                  className="size-4 rounded-r-check border border-line"
                  style={{ background: pair.fg }}
                />
              </span>

              <span
                className={`min-w-0 flex-1 text-meta leading-body ${
                  below ? "text-[var(--danger)]" : "text-ink-2"
                }`}
              >
                {pair.label}
              </span>

              <MonoLabel
                tracking="hex"
                tone={below ? "ink" : "ink-2"}
                uppercase={false}
                className={`flex-none whitespace-nowrap ${
                  below ? "text-[var(--danger)]" : ""
                }`}
              >
                {pairReading(pair)}
              </MonoLabel>

              {below && pair.suggested_fix ? (
                <button
                  type="button"
                  disabled={fixing !== null}
                  onClick={() => void fixOne(pair.pair_id)}
                  className="flex-none rounded-pill border border-[var(--danger)] px-3 py-0.5 text-meta text-[var(--danger)] disabled:opacity-40"
                >
                  Fix
                </button>
              ) : null}

              {/*
                Une NOTE en clair plutôt qu'une infobulle : c'est la même
                information, et elle ne demande ni survol ni pointeur. Une
                infobulle sur une ligne non focalisable serait invisible au
                clavier — et c'est précisément la ligne qu'il ne faut pas lire
                de travers.
              */}
              {note ? (
                <p className="w-full text-meta leading-body text-ink-2">{note}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {report ? (
        <p
          role="status"
          className={`mt-4 border-l pl-3 text-meta leading-body ${
            report.done ? "border-line text-ink-2" : "border-[var(--danger)] text-ink"
          }`}
        >
          {report.message}
        </p>
      ) : null}

      {!summary.passes ? (
        <div className="mt-4 flex flex-col gap-2">
          {/*
            « Fix them all » n'est PAS l'action principale de ce bloc : le
            geste par défaut reste le `Fix` d'une ligne, où l'on voit ce qu'on
            change. Elle existe pour la cascade, que personne ne peut suivre de
            tête — d'où un lien et non un bouton.
          */}
          {nextPairToFix(contrast) ? (
            <button
              type="button"
              disabled={fixing !== null}
              onClick={() => void fixAll()}
              className="self-start text-meta text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4 disabled:opacity-40"
            >
              {fixing === "all" ? "Working through them…" : "Fix them all, worst first"}
            </button>
          ) : null}

          {hasUnfixableFailure(contrast) ? (
            <p className="border-l border-[var(--danger)] pl-3 text-meta leading-body text-ink">
              {/* Le second cas du §4 : aucune clarté de cette couleur
                  n'atteint 4.5:1 sans que la teinte disparaisse. Renvoyer du
                  noir serait un remplacement, pas une correction. */}
              One pair can&rsquo;t be fixed by darkening &mdash; no shade of
              that color reaches AA against the surface behind it. Pick a
              different color for that role.
            </p>
          ) : null}

          <p className="text-meta leading-body text-ink-2">
            Your spec saves either way. This is a warning, not a gate.
          </p>
        </div>
      ) : null}
    </RailSection>
  );
}
