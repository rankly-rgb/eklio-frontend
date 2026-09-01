"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import { PadlockGlyph } from "@/components/ui/glyphs";
import { PlaceholderLines } from "@/components/ui/placeholder-lines";
import { MonthlyPresenceModal } from "@/components/home/monthly-presence-modal";
import { darkenLightness } from "@/lib/brand/color";
import type { Palette, Typography } from "@/lib/brand/shapes";
import type { CalendarItem } from "@/lib/data/calendar";

/*
 * La grille de contenu du mois (Écran 7).
 *
 * LA TUILE VERROUILLÉE, exactement comme la référence : le MÊME contenu, flouté
 * par une couche `inset:-16px` — le débord existe pour qu'aucun bord net
 * n'apparaisse au ras du cadre — un cadenas centré, et le titre LISIBLE en
 * encre juste dessous.
 *
 * Ce titre-là n'est pas décoratif : le §9 demande que la tuile verrouillée
 * porte son titre en texte accessible, pas seulement dans la couche floutée.
 * Un lecteur d'écran doit apprendre ce qui est verrouillé, pas qu'il y a
 * quelque chose de flou.
 */

export function ContentGrid({
  items,
  palette,
  typography,
  lockedCount,
  monthLabel,
  columns = 5,
}: {
  items: CalendarItem[];
  palette: Palette;
  typography: Typography;
  lockedCount: number;
  monthLabel: string;
  columns?: 5 | 4;
}) {
  const [modal, setModal] = useState<{
    open: boolean;
    title: string | null;
    checkoutUrl: string | null;
  }>({ open: false, title: null, checkoutUrl: null });

  async function unlock(item: CalendarItem) {
    setModal({ open: true, title: item.title, checkoutUrl: null });

    try {
      const response = await fetch(`/api/content/${item.id}/unlock`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string | null; entitled?: boolean }
        | null;

      setModal((current) => ({
        ...current,
        checkoutUrl: body?.checkoutUrl ?? null,
      }));
    } catch {
      setModal((current) => ({ ...current, checkoutUrl: null }));
    }
  }

  return (
    <>
      <div
        className={`grid gap-5 ${
          columns === 5 ? "grid-cols-5" : "grid-cols-4"
        } max-lg:grid-cols-3 max-md:grid-cols-2`}
      >
        {items.map((item, index) =>
          item.status === "locked" ? (
            <LockedTile
              key={item.id}
              item={item}
              palette={palette}
              typography={typography}
              index={index}
              onOpen={() => void unlock(item)}
            />
          ) : (
            <OpenTile
              key={item.id}
              item={item}
              palette={palette}
              typography={typography}
            />
          )
        )}
      </div>

      {lockedCount > 0 ? (
        <div className="mt-4 flex items-center gap-8">
          <MonoLabel tracking="16" tone="ink-3">
            {`${lockedCount} more locked`}
          </MonoLabel>
          <div className="flex-1" />
          <Button
            variant="tertiary"
            onClick={() =>
              void unlock(
                items.find((entry) => entry.status === "locked") ?? items[0]
              )
            }
          >
            {`Unlock the rest of ${titleCase(monthLabel)}.`}
          </Button>
        </div>
      ) : null}

      <MonthlyPresenceModal
        open={modal.open}
        title={modal.title}
        checkoutUrl={modal.checkoutUrl}
        onClose={() => setModal({ open: false, title: null, checkoutUrl: null })}
      />
    </>
  );
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** Les tuiles alternent le clair et sa version assombrie, comme la référence. */
function tileSurface(palette: Palette, index: number): string {
  return index % 2 === 0 ? palette.light : darkenLightness(palette.light, 3.3);
}

function OpenTile({
  item,
  palette,
  typography,
}: {
  item: CalendarItem;
  palette: Palette;
  typography: Typography;
}) {
  const ready = item.status === "ready";

  return (
    <div>
      <div
        className="box-border flex h-[138px] items-end rounded-preview p-[18px]"
        style={{ background: ready ? palette.primary : palette.light }}
      >
        <span
          className="text-pretty"
          style={{
            fontFamily: `"${typography.heading_font}", Georgia, serif`,
            fontWeight: 500,
            fontSize: 22,
            lineHeight: 1.12,
            letterSpacing: "-0.015em",
            color: ready ? palette.light : palette.dark,
          }}
        >
          {item.title ?? "Coming this month"}
        </span>
      </div>

      {/* La légende est longue : la tuile en montre le RYTHME, pas le texte. */}
      <PlaceholderLines
        className="mt-3.5"
        widths={[92, 80, 56]}
        height={4}
        gap={6}
        opacity={0.5}
      />
      <MonoLabel
        tracking="14"
        tone={ready ? "accent" : "ink-3"}
        className="mt-3 block"
      >
        {ready ? "Ready" : item.status === "published" ? "Published" : "Draft"}
      </MonoLabel>
      {item.caption ? <span className="sr-only">{item.caption}</span> : null}
    </div>
  );
}

function LockedTile({
  item,
  palette,
  typography,
  index,
  onOpen,
}: {
  item: CalendarItem;
  palette: Palette;
  typography: Typography;
  index: number;
  onOpen: () => void;
}) {
  const title = item.title ?? "A post for later this month";

  return (
    <div>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Unlock “${title}”`}
        className="relative block h-[138px] w-full overflow-hidden rounded-preview"
        style={{ background: tileSurface(palette, index) }}
      >
        {/*
          Débord de 16px : le flou d'une couche posée à ras du cadre laisserait
          un liseré net sur les quatre bords.
        */}
        <span
          aria-hidden="true"
          className="absolute -inset-4 box-border flex items-end p-[34px] blur-[9px]"
        >
          <span
            style={{
              fontFamily: `"${typography.heading_font}", Georgia, serif`,
              fontWeight: 500,
              fontSize: 22,
              lineHeight: 1.12,
              color: palette.dark,
            }}
          >
            {title}
          </span>
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <PadlockGlyph />
        </span>
      </button>

      {/* Le titre en clair : lisible à l'œil ET pour un lecteur d'écran. */}
      <p className="mt-3.5 text-ui leading-body text-ink">{title}</p>
    </div>
  );
}
