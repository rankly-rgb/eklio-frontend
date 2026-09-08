/*
 * The brand kit's sections — the spine of `/app/brand-kits/[id]`.
 *
 * One list, and it is the ONLY one. The rail renders it, the layout's
 * `<nav>` marks one item current from it, and the tests assert against it —
 * so a section that exists as a route but not here has no way into the
 * product, and a section here without a route fails the build. That is the
 * point: the previous shape kept the labels in `workspace-nav.tsx`, the
 * anchors in `brand-kit-view.tsx`, and the "which one is active" answer in a
 * `useState` that never agreed with either.
 *
 * `segment` is what `useSelectedLayoutSegment()` returns from the sections
 * layout: `null` on the index route (Overview), the folder name otherwise.
 * Reading the active section from the router rather than from state is what
 * retires the scroll-spy defect — there is nothing left to guess.
 */

export type KitSectionId =
  | "overview"
  | "identity"
  | "colors"
  | "type"
  | "site"
  | "words"
  | "assets";

export type KitSection = {
  id: KitSectionId;
  /** The route segment below the sections layout — `null` for the index. */
  segment: string | null;
  label: string;
};

export const KIT_SECTIONS: readonly KitSection[] = [
  { id: "overview", segment: null, label: "Overview" },
  { id: "identity", segment: "identity", label: "Identity" },
  { id: "colors", segment: "colors", label: "Colors" },
  { id: "type", segment: "type", label: "Type" },
  { id: "site", segment: "site", label: "Your site" },
  { id: "words", segment: "words", label: "Your words" },
  { id: "assets", segment: "assets", label: "Your assets" },
] as const;

/** Where a section lives, for a given kit. */
export function sectionHref(brandKitId: string, section: KitSection): string {
  const base = `/app/brand-kits/${brandKitId}`;
  return section.segment === null ? base : `${base}/${section.segment}`;
}

/**
 * The section the router is currently showing.
 *
 * Returns `null` — not a fallback to Overview — for a segment that isn't a
 * section: a nested route under one of them would otherwise light up a rail
 * item for a page the rail doesn't contain, which is the same lie the old
 * scroll-spy told, just from a different direction.
 */
export function activeSection(segment: string | null): KitSection | null {
  return KIT_SECTIONS.find((section) => section.segment === segment) ?? null;
}
