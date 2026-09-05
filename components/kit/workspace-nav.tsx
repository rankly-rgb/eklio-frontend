const SECTIONS = [
  { id: "kit-identity", label: "Identity" },
  { id: "kit-colors", label: "Colors" },
  { id: "kit-type", label: "Type" },
  { id: "kit-site", label: "Your site" },
  { id: "kit-words", label: "Your words" },
  { id: "kit-assets", label: "Your assets" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * Section navigation (Lot 3) — a sticky rail down the left on desktop, a
 * horizontal chip row on mobile. On desktop, plain anchor links scroll to
 * each section (all six are always rendered). On mobile, per Lot 3's
 * hierarchy inversion, only one section renders at a time — the chips pick
 * which; `brand-kit-view.tsx` defaults it to "Your assets" rather than the
 * scroll-order's "Identity".
 *
 * No scroll-spy/active-section tracking on desktop — this sandbox can't
 * drive a real browser to verify one, and a wrong "active" state would be
 * worse than none (see WORKLOG.md).
 */
export function WorkspaceNav({
  activeMobileSection,
  onSelectMobileSection,
}: {
  activeMobileSection: SectionId;
  onSelectMobileSection: (id: SectionId) => void;
}) {
  return (
    <nav
      aria-label="Brand kit sections"
      className="sticky top-6 flex w-[168px] flex-none flex-col gap-1 self-start max-lg:static max-lg:w-full max-lg:flex-row max-lg:gap-2 max-lg:overflow-x-auto max-lg:pb-2"
    >
      {SECTIONS.map((section) => {
        const active = section.id === activeMobileSection;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active ? "true" : undefined}
            onClick={() => onSelectMobileSection(section.id)}
            className={`whitespace-nowrap rounded-pill px-3 py-1.5 text-ui text-ink-2 transition-colors hover:bg-card hover:text-ink max-lg:flex-none max-lg:border max-lg:border-line ${
              active ? "max-lg:border-ink max-lg:text-ink max-lg:font-semibold" : ""
            }`}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
