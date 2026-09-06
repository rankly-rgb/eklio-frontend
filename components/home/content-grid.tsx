"use client";

import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { PlaceholderLines } from "@/components/ui/placeholder-lines";
import type { Palette, Typography } from "@/lib/brand/shapes";
import { ARCHETYPE_LABELS, type ContentItem } from "@/lib/data/content";

/*
 * ── ONE MONTH MODEL, AND THIS IS IT ─────────────────────────────────────
 *
 * This grid used to read `monthly_presence_content` through `calendar_summary`
 * while `/app/content` read `content_items`. Two models for the same month is
 * the failure this repo keeps producing: the home says one number, the
 * calendar shows another, and nothing errors. The old table holds zero rows,
 * so the number home showed was not merely different — it was nothing.
 *
 * WHAT WENT WITH IT: the locked tile, the "N more locked" row, and the unlock
 * modal. Those belonged to content generated FOR her behind a subscription.
 * `content_items` are HERS — she wrote them — so nothing here is withheld and
 * there is nothing to unlock. Monthly Presence is still sold, by
 * `MonthlyPresenceSubscriptionCard`, which is a card about a subscription
 * rather than a lock drawn over her own words.
 */

export function ContentGrid({
  items,
  palette,
  typography,
  monthLabel,
  columns = 5,
}: {
  items: ContentItem[];
  palette: Palette;
  typography: Typography;
  monthLabel: string;
  columns?: 5 | 4;
}) {
  return (
    <div
      className={`grid gap-5 ${
        columns === 5 ? "grid-cols-5" : "grid-cols-4"
      } max-lg:grid-cols-3 max-md:grid-cols-2`}
    >
      {items.map((item) => (
        <ItemTile
          key={item.id}
          item={item}
          palette={palette}
          typography={typography}
          monthLabel={monthLabel}
        />
      ))}
    </div>
  );
}

function ItemTile({
  item,
  palette,
  typography,
}: {
  item: ContentItem;
  palette: Palette;
  typography: Typography;
  monthLabel: string;
}) {
  const ready = item.status === "ready";

  return (
    <Link
      href={`/app/content/${item.id}`}
      className="group block rounded-preview focus-visible:outline-none"
    >
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
          {item.title ?? "Untitled"}
        </span>
      </div>

      {/* The caption is long: the tile shows its RHYTHM, never its text. */}
      <PlaceholderLines className="mt-3.5" widths={[92, 80, 56]} height={4} gap={6} opacity={0.5} />

      <div className="mt-3 flex items-center justify-between gap-3">
        <MonoLabel tracking="14" tone={item.posted ? "accent" : ready ? "accent" : "ink-3"}>
          {item.posted ? "Posted" : ready ? "Ready" : "Draft"}
        </MonoLabel>
        <MonoLabel tracking="14" tone="ink-3">
          {ARCHETYPE_LABELS[item.archetype]}
        </MonoLabel>
      </div>
    </Link>
  );
}
