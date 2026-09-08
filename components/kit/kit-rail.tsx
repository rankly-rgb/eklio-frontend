"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { KIT_SECTIONS, sectionHref } from "@/lib/kit/sections";

/*
 * The kit's section switcher — a persistent rail down the left.
 *
 * ⚠ THE ACTIVE ITEM COMES FROM THE ROUTER. The list this replaces kept it in
 * a `useState` seeded to "Your assets" that only moved on click, so on
 * desktop the highlight sat on a section that wasn't on screen. There is
 * nothing left to guess here: `useSelectedLayoutSegment()` returns the
 * segment the router is rendering, and exactly one item can match it.
 */
export function KitRail({ brandKitId }: { brandKitId: string }) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav aria-label="Brand kit sections" className="flex flex-col gap-0.5">
      {KIT_SECTIONS.map((section) => {
        const current = section.segment === segment;
        return (
          <Link
            key={section.id}
            href={sectionHref(brandKitId, section)}
            aria-current={current ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-pill px-3 py-2 text-ui transition-colors ${
              current
                ? "bg-card font-semibold text-ink"
                : "text-ink-2 hover:bg-card hover:text-ink"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
