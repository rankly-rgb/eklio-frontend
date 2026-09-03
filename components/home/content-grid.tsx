"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import { PadlockGlyph } from "@/components/ui/glyphs";
import { PlaceholderLines } from "@/components/ui/placeholder-lines";
import { MonthlyPresenceModal } from "@/components/home/monthly-presence-modal";
import type { Palette, Typography } from "@/lib/brand/shapes";
import type { CalendarItem } from "@/lib/data/calendar";

/*
 * La grille de contenu du mois (Écran 7).
 *
 * LOT 8 — la tuile verrouillée n'est plus floutée : le §9 accessible existe
 * déjà (le titre en clair, dessous), donc le flou par-dessus n'ajoutait
 * qu'une couche décorative que le brief demande de supprimer purement et
 * simplement — "Delete every blurred card in the product." Elle rend
 * maintenant en LISIBLE et sobre : date, type (Post/Story), le titre réel en
 * ses polices, à opacité réduite, avec un petit cadenas — jamais un rendu
 * flou faisant semblant de cacher quelque chose.
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
        {items.map((item) =>
          item.status === "locked" ? (
            <LockedTile
              key={item.id}
              item={item}
              typography={typography}
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

/** `2026-09-01` + `3` → `Sep 3`, for the locked row's date column. */
function shortDate(month: string, dayOfMonth: number): string {
  const date = new Date(`${month}T12:00:00Z`);
  const monthAbbrev = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date);
  return `${monthAbbrev} ${dayOfMonth}`;
}

function downloadCaption(item: CalendarItem) {
  const title = item.title ?? "Untitled";
  const text = item.caption ? `${title}\n\n${item.caption}` : title;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${title.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "post"}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
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
      <div className="mt-3 flex items-center justify-between gap-3">
        <MonoLabel tracking="14" tone={ready ? "accent" : "ink-3"}>
          {ready ? "Ready" : item.status === "published" ? "Published" : "Draft"}
        </MonoLabel>
        {item.caption ? (
          <button
            type="button"
            onClick={() => downloadCaption(item)}
            className="text-meta text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
          >
            Download
          </button>
        ) : null}
      </div>
      {item.caption ? <span className="sr-only">{item.caption}</span> : null}
    </div>
  );
}

function LockedTile({
  item,
  typography,
  onOpen,
}: {
  item: CalendarItem;
  typography: Typography;
  onOpen: () => void;
}) {
  const title = item.title ?? "A post for later this month";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Unlock “${title}”`}
      className="box-border flex h-[138px] w-full flex-col justify-between rounded-preview border border-line p-[18px] text-left opacity-50 transition-opacity hover:opacity-70"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <MonoLabel tracking="12" tone="ink-3">
          {`${shortDate(item.month, item.day_of_month)} · ${item.type === "post" ? "Post" : "Story"}`}
        </MonoLabel>
        <PadlockGlyph size="sm" />
      </div>
      <span
        className="text-pretty"
        style={{
          fontFamily: `"${typography.heading_font}", Georgia, serif`,
          fontWeight: 500,
          fontSize: 17,
          lineHeight: 1.2,
        }}
      >
        {title}
      </span>
    </button>
  );
}
