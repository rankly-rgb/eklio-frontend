"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import { useSiteEditor } from "@/components/site/use-site-editor";
import { ControlRail } from "@/components/site/control-rail";
import { Mockup } from "@/components/site/mockup";
import { OutputPanel } from "@/components/site/output-panel";
import type { Direction } from "@/lib/brand/shapes";
import type { SiteCatalog, SiteSpecEnvelope } from "@/lib/site/types";
import type { TypePairing } from "@/lib/catalog/types";

/*
 * L'éditeur de site — la coquille.
 *
 * GABARIT (§2 de la commande). Au-dessus de 1100px : rail de contrôle de
 * 360px sur `--surface-2`, maquette qui prend le reste et reste COLLÉE au
 * défilement, panneau de sortie pleine largeur en dessous. En dessous de
 * 1100px : la maquette d'abord, tapable pour passer en plein écran, les
 * contrôles dans une feuille par le bas, la sortie ensuite.
 *
 * 1100px, et pas un point d'arrêt du framework : c'est la largeur en dessous
 * de laquelle 360 + 900 + gouttières ne tiennent plus côte à côte. Le gabarit
 * décide du point de rupture, pas l'inverse.
 *
 * CE QUE L'ÉCRAN DIT DE LUI-MÊME. Eklio ne construit pas et n'héberge pas le
 * site. C'est écrit en haut, en une phrase, et ce n'est pas décoratif : ça
 * gouverne tout ce que la praticienne attend de la suite. Il n'y a donc, ici
 * et nulle part dans cette fonctionnalité, ni publication, ni déploiement, ni
 * partage.
 */
export function SiteEditor({
  brandKitId,
  initial,
  catalog,
  pairings,
  direction,
}: {
  brandKitId: string;
  initial: SiteSpecEnvelope;
  catalog: SiteCatalog;
  /** Les paires typographiques du catalogue du brief — la même table. */
  pairings: TypePairing[];
  /** La direction retenue — lue seulement pour les originaux de `seed_clamped`. */
  direction: Direction;
}) {
  const editor = useSiteEditor(brandKitId, initial);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { undo, redo, canUndo, canRedo } = editor;

  /* Cmd/Ctrl+Z et Cmd/Ctrl+Shift+Z, partout sur l'écran. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      const target = event.target as HTMLElement | null;
      // Dans un champ de saisie, Cmd+Z appartient au champ : l'annulation de
      // frappe est plus proche de ce qu'on vient de faire que celle du spec.
      if (target?.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target?.tagName ?? "")) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const practice =
    editor.envelope.preview.practice_name ?? "Your practice";

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-24 pt-6 max-md:px-[var(--gutter-sm)]">
      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-8 max-lg:flex-col max-lg:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
            Your site
          </h1>
          <p className="mt-2.5 max-w-[560px] text-helper leading-prose text-ink-2">
            Edit the spec for {practice}, then copy the instructions below into
            your website builder. Eklio doesn&rsquo;t build or host your
            site &mdash; your builder does, and it stays yours.
          </p>
        </div>

        <div className="flex flex-none items-center gap-3">
          <SaveState saving={editor.saving} />
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              onClick={undo}
              disabled={!canUndo}
              aria-keyshortcuts="Meta+Z Control+Z"
              className="px-4"
            >
              Undo
            </Button>
            <Button
              variant="secondary"
              onClick={redo}
              disabled={!canRedo}
              aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
              className="px-4"
            >
              Redo
            </Button>
          </div>
          <Link
            href={`/app/brand-kits/${brandKitId}`}
            className="whitespace-nowrap text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
          >
            Back to kit
          </Link>
        </div>
      </div>

      {/* ── Rail + maquette ─────────────────────────────────────────────── */}
      <div className="mt-7 flex items-start gap-8 max-[1100px]:flex-col max-[1100px]:gap-6">
        {/*
          En dessous de 1100px, la maquette passe DEVANT le rail — `order`
          plutôt qu'un second arbre : un seul DOM, donc un seul ordre de
          tabulation, et rien à tenir en double.
        */}
        <aside
          aria-label="Site controls"
          className="w-[360px] flex-none rounded-card border border-line bg-surface-2 max-[1100px]:hidden"
        >
          <ControlRail
            editor={editor}
            catalog={catalog}
            pairings={pairings}
            direction={direction}
          />
        </aside>

        <div className="min-w-0 flex-1 max-[1100px]:order-first max-[1100px]:w-full">
          <Mockup editor={editor} catalog={catalog} />
        </div>

        {/* Contrôles en feuille par le bas — sous 1100px seulement. */}
        <div className="hidden w-full max-[1100px]:block">
          <Button
            variant="secondary"
            className="w-full"
            aria-expanded={sheetOpen}
            aria-controls="site-controls-sheet"
            onClick={() => setSheetOpen((open) => !open)}
          >
            {sheetOpen ? "Hide controls" : "Edit colors, pages and copy"}
          </Button>
          <div
            id="site-controls-sheet"
            hidden={!sheetOpen}
            className="mt-4 rounded-card border border-line bg-surface-2"
          >
            <ControlRail
            editor={editor}
            catalog={catalog}
            pairings={pairings}
            direction={direction}
          />
          </div>
        </div>
      </div>

      {/* ── Sortie ──────────────────────────────────────────────────────── */}
      <div className="mt-10">
        <OutputPanel editor={editor} catalog={catalog} brandKitId={brandKitId} />
      </div>
    </main>
  );
}

/**
 * L'état de sauvegarde, en mono — le même vocabulaire que « SAVED » dans le
 * brief. Il est en `aria-live` parce que c'est la seule confirmation qu'une
 * édition est partie : sans lui, l'autosave est invisible.
 */
function SaveState({ saving }: { saving: boolean }) {
  return (
    <MonoLabel tracking="16" tone={saving ? "ink-3" : "ink-2"} className="whitespace-nowrap">
      <span role="status" aria-live="polite">
        {saving ? "Saving" : "Saved"}
      </span>
    </MonoLabel>
  );
}
