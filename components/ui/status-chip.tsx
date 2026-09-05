import { CheckGlyph, PadlockGlyph } from "@/components/ui/glyphs";
import { MonoLabel, type MonoTone } from "@/components/ui/mono-label";
import { STATUSES, type StatusColor, type StatusKey } from "@/lib/status";

/*
 * <StatusChip> — the one status component. A small glyph, drawn the same
 * hand-built-div way as `components/ui/glyphs.tsx`'s three glyphs, plus the
 * status label as text. Colour is never the only signal: the label always
 * renders, so a status reads correctly without colour (colour-blind, print,
 * high-contrast mode).
 *
 * The nine status shapes are scoped to this file rather than added to
 * glyphs.tsx, whose own header comment names "the three only glyphs of the
 * app" — that claim stays true for glyphs.tsx; this is a second, separate
 * family for status specifically, not an extension of it.
 */

const COLOR_VAR: Record<StatusKey, string> = {
  ready: "var(--ink)",
  updated: "var(--warning)",
  downloaded: "var(--ink-2)",
  draft: "var(--ink-3)",
  scheduled: "var(--ink-2)",
  posted: "var(--accent)",
  checked: "var(--ink-2)",
  locked: "var(--accent)",
  "needs-rebuild": "var(--danger)",
};

function StatusGlyph({ status }: { status: StatusKey }) {
  const color = COLOR_VAR[status];
  const shape = STATUSES[status].glyph;

  if (shape === "check") return <CheckGlyph size="sm" color={color} />;
  if (shape === "padlock") return <PadlockGlyph size="sm" />;

  const base = { display: "block" as const, width: 7, height: 7 };

  switch (shape) {
    case "diamond-outline":
      return (
        <span
          aria-hidden="true"
          style={{ ...base, border: `1.5px solid ${color}`, transform: "rotate(45deg) scale(0.8)" }}
        />
      );
    case "diamond-filled":
      return (
        <span
          aria-hidden="true"
          style={{ ...base, background: color, transform: "rotate(45deg) scale(0.8)" }}
        />
      );
    case "circle-filled":
      return (
        <span aria-hidden="true" style={{ ...base, background: color, borderRadius: "50%" }} />
      );
    case "circle-outline":
      return (
        <span
          aria-hidden="true"
          style={{ ...base, border: `1.5px solid ${color}`, borderRadius: "50%" }}
        />
      );
    case "square-outline":
      return <span aria-hidden="true" style={{ ...base, border: `1.5px solid ${color}` }} />;
    case "square-filled":
      return <span aria-hidden="true" style={{ ...base, background: color }} />;
    case "triangle-filled":
      return (
        <span
          aria-hidden="true"
          style={{
            display: "block",
            width: 0,
            height: 0,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderBottom: `7px solid ${color}`,
          }}
        />
      );
    default:
      return null;
  }
}

/** `StatusColor` and `MonoTone` name the same six roles — the vocabulary owns the mapping. */
function toneFor(color: StatusColor): MonoTone {
  return color;
}

export function StatusChip({
  status,
  className = "",
}: {
  status: StatusKey;
  className?: string;
}) {
  const { label, color } = STATUSES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <StatusGlyph status={status} />
      <MonoLabel tracking="10" tone={toneFor(color)}>
        {label}
      </MonoLabel>
    </span>
  );
}
