/*
 * The one status vocabulary. Every surface in the app that shows a status —
 * an asset row, a content item, a check result — reads its label, colour
 * role and glyph from here, through <StatusChip> (components/ui/status-chip.tsx).
 * A status never appears with two different words in two places: this file
 * is the only place the nine words are spelled out.
 *
 * Nine statuses, each with exactly one colour role and one glyph shape.
 * Colour is never the only signal — the label is always rendered as text
 * alongside the glyph, never glyph/colour alone.
 */

export const STATUS_KEYS = [
  "ready",
  "updated",
  "downloaded",
  "draft",
  "scheduled",
  "posted",
  "checked",
  "locked",
  "needs-rebuild",
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

/** One of the app's existing neutral/semantic colour tokens — never a brand color. */
export type StatusColor = "ink" | "ink-2" | "ink-3" | "accent" | "warning" | "danger";

export type StatusGlyphShape =
  | "check"
  | "diamond-outline"
  | "diamond-filled"
  | "circle-filled"
  | "circle-outline"
  | "square-outline"
  | "square-filled"
  | "padlock"
  | "triangle-filled";

export type StatusDefinition = {
  label: string;
  color: StatusColor;
  glyph: StatusGlyphShape;
};

export const STATUSES: Record<StatusKey, StatusDefinition> = {
  ready: { label: "Ready", color: "ink", glyph: "check" },
  updated: { label: "Updated", color: "warning", glyph: "diamond-filled" },
  downloaded: { label: "Downloaded", color: "ink-2", glyph: "circle-filled" },
  draft: { label: "Draft", color: "ink-3", glyph: "circle-outline" },
  scheduled: { label: "Scheduled", color: "ink-2", glyph: "square-outline" },
  posted: { label: "Posted", color: "accent", glyph: "square-filled" },
  checked: { label: "Checked", color: "ink-2", glyph: "diamond-outline" },
  locked: { label: "Locked", color: "accent", glyph: "padlock" },
  "needs-rebuild": { label: "Needs rebuild", color: "danger", glyph: "triangle-filled" },
};

export function statusDefinition(key: StatusKey): StatusDefinition {
  return STATUSES[key];
}
