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
 * layout: the folder name for a section, `null` on the index route.
 *
 * ⚠ THE INDEX IS NOT IN THIS LIST. Overview used to be a seventh row, which
 * spent a rail slot on a route that is really the kit's front door. The kit
 * block at the top of the rail — monogram, name, direction — IS that link
 * now, and it carries the active treatment when she is on it. "Exactly one
 * active thing" stays true; it is just not always one of the six.
 */

export type KitSectionId =
  | "identity"
  | "colors"
  | "type"
  | "site"
  | "words"
  | "assets";

export type KitSection = {
  id: KitSectionId;
  /** The route segment below the sections layout. */
  segment: string;
  label: string;
};

export const KIT_SECTIONS: readonly KitSection[] = [
  { id: "identity", segment: "identity", label: "Identity" },
  { id: "colors", segment: "colors", label: "Colors" },
  { id: "type", segment: "type", label: "Type" },
  { id: "site", segment: "site", label: "Your site" },
  { id: "words", segment: "words", label: "Your words" },
  { id: "assets", segment: "assets", label: "Your assets" },
] as const;

/** Where a section lives, for a given kit. */
export function sectionHref(brandKitId: string, section: KitSection): string {
  return `/app/brand-kits/${brandKitId}/${section.segment}`;
}

/** The kit's front door — what the rail's identity block links to. */
export function kitIndexHref(brandKitId: string): string {
  return `/app/brand-kits/${brandKitId}`;
}

/**
 * Whether the router is showing the index route rather than a section.
 *
 * `useSelectedLayoutSegment()` answers `null` there, and `null` means the
 * index specifically — not "nothing matched".
 */
export function isKitIndexActive(segment: string | null): boolean {
  return segment === null;
}

/**
 * The section the router is currently showing.
 *
 * Returns `null` — not a fallback to the first row — for a segment that
 * isn't a section: the index (where the kit block is current instead), and
 * any nested route under a section, which would otherwise light up a row
 * for a page the rail does not contain. That is the same lie the old
 * scroll-spy told, from the other direction.
 */
export function activeSection(segment: string | null): KitSection | null {
  return KIT_SECTIONS.find((section) => section.segment === segment) ?? null;
}

/**
 * A direction's name as an identity, not as a label: `Warm ground`.
 *
 * The header band says `WARM GROUND` in mono caps, because there it IS a
 * label — a classification of the kit, sitting under its title. The rail
 * says `Warm ground`, because there it is the second line of a name block
 * and shouting it would make it compete with the practice name above it.
 * Both are deliberate; neither is the "right" casing of the other.
 */
export function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}
