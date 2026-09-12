import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import {
  CheckGlyph,
  ChevronGlyph,
  DownloadGlyph,
  SectionGlyph,
} from "@/components/ui/glyphs";
import type { LaunchProgress } from "@/lib/data/checklist";
import type { HomeQuote } from "@/lib/data/home";

/*
 * ── THE RAIL ─────────────────────────────────────────────────────────────
 *
 * Under the ring: the seven steps with their real states, four tools, her own
 * sentence, and the mono footer that used to sit under the hero canvas.
 *
 * The rows are READ-ONLY. The one actionable step already lives in the NEXT
 * STEP card beside them, and a second place to click "Mark done" is a second
 * place for the two to disagree.
 */

/*
 * The seven, in the database's own `sort_order` — the same order `/app/launch`
 * walks, from the same RPC. Done carries a filled clay box; the current step
 * is the emphasised one; the rest are empty squares.
 *
 * ⚠ "CURRENT" IS THE FIRST `todo`, WHICH IS THE ONE THE CARD CHOSE. It is
 * found the same way `pickNextAction` finds it rather than passed in, so the
 * emphasised row and the card can never point at different steps.
 */
export function RailChecklist({ progress }: { progress: LaunchProgress }) {
  const currentKey = progress.items.find((item) => item.status === "todo")?.key ?? null;

  return (
    <ul className="flex flex-col">
      {progress.items.map((item) => {
        const isCurrent = item.key === currentKey;
        return (
          <li
            key={item.key}
            aria-current={isCurrent ? "step" : undefined}
            className={`flex items-start gap-3 border-t border-line py-2.5 first:border-t-0 ${
              isCurrent ? "-mx-2 rounded-preview border-t-transparent bg-card px-2" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-4 flex-none items-center justify-center rounded-check ${
                item.status === "done"
                  ? "bg-accent"
                  : item.status === "skipped"
                    ? "border border-line bg-line"
                    : "border border-line"
              }`}
            >
              {item.status === "done" ? <CheckGlyph size="sm" /> : null}
            </span>
            <span
              className={`min-w-0 text-ui leading-body ${
                isCurrent ? "font-medium text-ink" : item.status === "todo" ? "text-ink" : "text-ink-3"
              }`}
            >
              {item.label}
              {item.status === "skipped" ? (
                <span className="sr-only"> (skipped)</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/*
 * Four tools, each a route that exists.
 *
 * `brandKitId` is never null on this screen — the rail only renders with a kit
 * and a chosen direction — so none of these is the inert grey label the header
 * nav falls back to.
 */
export function QuickTools({ brandKitId }: { brandKitId: string }) {
  const tools = [
    { label: "Open brand kit", href: `/app/brand-kits/${brandKitId}`, icon: <SectionGlyph section="identity" /> },
    { label: "Create a new post", href: "/app/content", icon: <SectionGlyph section="words" /> },
    { label: "View checklists", href: "/app/launch", icon: <CheckGlyph size="sm" color="currentColor" /> },
    {
      label: "Download resources",
      href: `/app/brand-kits/${brandKitId}/assets`,
      icon: <DownloadGlyph />,
    },
  ];

  return (
    <nav aria-labelledby="quick-tools" className="flex flex-col gap-2">
      <MonoLabel tracking="16" as="h2" id="quick-tools">
        Quick tools
      </MonoLabel>
      <ul className="flex flex-col">
        {tools.map((tool) => (
          <li key={tool.label}>
            <Link
              href={tool.href}
              className="-mx-2 flex min-h-[44px] items-center gap-3 rounded-preview px-2 hover:bg-card"
            >
              <span
                aria-hidden="true"
                className="flex size-7 flex-none items-center justify-center rounded-pill border border-line text-ink-2"
              >
                {tool.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-ui leading-body text-ink">
                {tool.label}
              </span>
              {/* `ChevronGlyph` points down by default; rotated -90° it points
                  at what the row links to. */}
              <span aria-hidden="true" className="block flex-none -rotate-90">
                <ChevronGlyph color="var(--ink-3)" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/*
 * Her own sentence, on linen.
 *
 * ⚠ THE ATTRIBUTION IS THE PROVENANCE, NEVER THE PRACTICE NAME. The mockup
 * signs this card `EMER CONSULTING` — her practice, under a sentence the
 * product wrote. That is an attribution, and a false one. This card carries
 * the positioning paragraph she wrote in her own brief, and says so. With no
 * positioning on the brief, the card does not render: there is no house quote
 * to fall back on, by design.
 */
export function RailQuote({ quote }: { quote: HomeQuote }) {
  return (
    <figure className="flex flex-col gap-3 rounded-card bg-card p-[18px_20px]">
      <blockquote className="text-pretty font-display text-subsection font-normal italic leading-card text-ink">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      <figcaption>
        <MonoLabel tracking="16" tone="ink-3">
          {quote.provenance}
        </MonoLabel>
      </figcaption>
    </figure>
  );
}

/*
 * The mono footer: direction, specialty, city.
 *
 * This is where the `PRACTICE · DIRECTION · AS OF …` line that used to sit
 * under the hero canvas ended up, as the mockup places it. `lines` arrives
 * already filtered — a kit with no specialty prints two lines.
 */
export function RailMeta({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {lines.map((line) => (
        <MonoLabel key={line} tracking="16" tone="ink-3">
          {line}
        </MonoLabel>
      ))}
    </div>
  );
}
