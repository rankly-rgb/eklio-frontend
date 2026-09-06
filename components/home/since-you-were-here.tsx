import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { ChevronGlyph } from "@/components/ui/glyphs";
import type { SinceRow } from "@/lib/data/home";

/*
 * "Since you were here" — now sourced from the notifications table (plus one
 * folded-in row, see `lib/data/home.ts`'s `buildSinceRows`) rather than the
 * asset/content activity feed this replaced. At most three rows, a hairline
 * between them, each a real link to the thing it names.
 */
export function SinceYouWereHere({ rows }: { rows: SinceRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="since-you-were-here"
      className="mt-7 flex flex-col rounded-card border border-line"
    >
      <MonoLabel tracking="16" as="h2" id="since-you-were-here" className="p-[18px_20px_0]">
        Since you were here
      </MonoLabel>
      <ul className="mt-2 flex flex-col">
        {rows.map((row) => (
          <li key={row.id} className="border-t border-line first:border-t-0">
            <Link
              href={row.href}
              className="flex items-center gap-4 p-[14px_20px] hover:bg-card"
            >
              <span className="min-w-0 flex-1 text-ui leading-body text-ink">{row.text}</span>
              {/* `ChevronGlyph` points down by default (its one other use is an
                  expand toggle); rotated -90deg it points at what the row
                  links to. */}
              <span className="block flex-none -rotate-90">
                <ChevronGlyph color="var(--ink-3)" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
