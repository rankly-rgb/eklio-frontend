"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrowserFrame } from "@/components/ui/browser-frame";
import { useBrandFont } from "@/components/preview/use-brand-font";
import { domainFor } from "@/lib/brand/derive";
import { MockupSection, type Wrap } from "@/components/site/mockup-section";
import { InlineEdit } from "@/components/site/inline-edit";
import {
  limitForTarget,
  patchForTarget,
  targetField,
  type EditTarget,
} from "@/lib/site/edit";
import { activePage } from "@/lib/site/mockup";
import { siteTokenVariables } from "@/lib/site/tokens";
import type { SiteEditorState } from "@/components/site/use-site-editor";
import type { SiteCatalog } from "@/lib/site/types";

/*
 * La maquette — `preview`, rendue telle qu'elle arrive.
 *
 * Quelles pages, quelles sections, dans quel ordre, et d'où vient la copy de
 * chacune : la base a déjà tranché. Ce composant navigue entre les pages et
 * peint ; il ne compose pas.
 *
 * ── Ce qu'il ne fait PAS bouger ─────────────────────────────────────────
 *
 * `extra_instructions` n'a rien à faire ici, et n'y est pas. Elles partent mot
 * pour mot dans les instructions, et le champ le dit sous lui-même. Chercher à
 * les refléter dans la maquette demanderait de les INTERPRÉTER — c'est-à-dire
 * d'inventer.
 *
 * ── Les polices ─────────────────────────────────────────────────────────
 *
 * `useBrandFont` est réutilisé tel quel : les paires déjà chargées ailleurs
 * dans l'application sont prêtes dès la première frame. Tant qu'elle n'est pas
 * là, on garde les jetons précédents plutôt que de montrer une maquette nue —
 * un fondu de 200 ms, jamais un clignotement.
 */
export function Mockup({
  editor,
  catalog,
}: {
  editor: SiteEditorState;
  catalog: SiteCatalog;
}) {
  const { preview, spec } = editor.envelope;
  const ready = useBrandFont(preview.tokens.google_fonts_url);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);

  const page = activePage(preview.pages, pageKey);
  const { commit, error } = editor;

  /*
   * L'ENVELOPPE de l'édition en place. Elle est construite ici, une fois, et
   * descend jusqu'à chaque texte : la limite vient du catalogue, le patch vient
   * du descripteur, et le refus de la base s'affiche sur le champ que
   * `error.field` désigne — jamais en toast.
   */
  const editable: Wrap = useCallback(
    (node: ReactNode, target: EditTarget, value: string) => (
      <InlineEdit
        value={value}
        limit={limitForTarget(catalog, spec, target)}
        label={targetField(target)}
        error={error?.field === targetField(target) ? error.message : null}
        onCommit={(next) => commit(patchForTarget(spec, target, next))}
      >
        {node}
      </InlineEdit>
    ),
    [catalog, spec, commit, error]
  );

  useEffect(() => {
    if (!fullScreen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFullScreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullScreen]);

  const frame = (
    <div
      /*
       * `.brand-preview` porte la transition de 500 ms sur les couleurs. Elle
       * est posée ICI, sur la racine qui porte les jetons : un changement de
       * palette doit TRAVERSER la maquette, pas la remonter. C'est tout
       * l'effet recherché — elle bouge une couleur, le site devant elle change.
       */
      className="brand-preview"
      style={siteTokenVariables(preview.tokens)}
    >
      <BrowserFrame size="full" domain={domainFor(preview.practice_name)}>
        <div
          className="transition-opacity duration-[var(--dur-font)]"
          style={{ background: "var(--s-paper)", opacity: ready ? 1 : 0 }}
        >
          <SiteNav
            practice={preview.practice_name ?? "Your practice"}
            pages={preview.pages.map((entry) => entry.label)}
            current={page?.label ?? ""}
          />
          {page ? (
            page.sections.map((section) => (
              <MockupSection
                key={section.key}
                page={page.key}
                section={section}
                editable={editable}
              />
            ))
          ) : (
            <EmptySite />
          )}
        </div>
      </BrowserFrame>
    </div>
  );

  return (
    <div>
      {/* ── Onglets de page ──────────────────────────────────────────────
          Ils suivent `preview.pages` : une page désactivée n'y est plus, et
          rien n'est renuméroté pour autant. */}
      <div
        role="tablist"
        aria-label="Pages"
        className="mb-3 flex flex-wrap items-center gap-6 text-ui"
      >
        {preview.pages.map((entry) => {
          const current = entry.key === page?.key;
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={current}
              onClick={() => setPageKey(entry.key)}
              className={`pb-1.5 ${
                current
                  ? "border-b border-accent font-semibold text-ink"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {entry.label}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Plein écran : c'est le geste mobile, mais il marche partout —
            personne n'a jamais reproché à une maquette de s'agrandir. */}
        <button
          type="button"
          onClick={() => setFullScreen(true)}
          className="text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
        >
          Full screen
        </button>
      </div>

      {/*
        Collée au défilement : le rail est long, la maquette doit rester en
        face de la couleur qu'on est en train de bouger. `--header-h` la place
        sous l'en-tête de l'application, pas dessous.
      */}
      <div className="sticky top-[calc(var(--header-h)+16px)] max-[1100px]:static">
        {frame}
      </div>

      <p className="mt-3 text-helper leading-prose text-ink-2">
        Your design reference. Your builder will follow it closely, not pixel
        for pixel.
      </p>

      {fullScreen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site mockup, full screen"
          className="route-enter fixed inset-0 z-50 overflow-auto bg-bg p-[var(--gutter-sm)]"
        >
          <div className="mb-4 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setFullScreen(false)}
              className="h-10 rounded-pill border border-line px-6 text-ui text-ink"
            >
              Close
            </button>
          </div>
          {frame}
        </div>
      ) : null}
    </div>
  );
}

/**
 * La barre du site maquetté. Le nom de la practice est un titre → variante du
 * primaire ; la navigation est du texte courant → l'encre.
 */
function SiteNav({
  practice,
  pages,
  current,
}: {
  practice: string;
  pages: string[];
  current: string;
}) {
  return (
    <div
      className="flex items-center gap-7 px-11 py-5"
      style={{
        background: "var(--s-paper)",
        borderBottom: "1px solid color-mix(in srgb, var(--s-dark) 12%, transparent)",
      }}
    >
      <span
        className="whitespace-nowrap"
        style={{
          fontFamily: "var(--s-heading)",
          fontWeight: 600,
          fontSize: 19,
          letterSpacing: "-0.01em",
          color: "var(--s-primary-text)",
        }}
      >
        {practice}
      </span>
      <div className="flex-1" />
      <div
        className="flex flex-none items-center gap-6 whitespace-nowrap"
        style={{ fontFamily: "var(--s-body)", fontSize: 13, color: "var(--s-dark)" }}
      >
        {pages.map((label) => (
          <span key={label} style={{ opacity: label === current ? 1 : 0.6 }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Toutes les pages désactivées. Rare, et il faut le dire plutôt qu'un vide. */
function EmptySite() {
  return (
    <div className="px-11 py-20" style={{ background: "var(--s-paper)" }}>
      <p
        style={{
          fontFamily: "var(--s-body)",
          fontSize: 15,
          color: "var(--s-dark)",
          opacity: 0.7,
        }}
      >
        Every page is switched off. Turn one back on in the controls and it
        appears here.
      </p>
    </div>
  );
}
