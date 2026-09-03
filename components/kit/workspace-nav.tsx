const SECTIONS = [
  { id: "kit-identity", label: "Identity" },
  { id: "kit-colors", label: "Colors" },
  { id: "kit-type", label: "Type" },
  { id: "kit-site", label: "Your site" },
  { id: "kit-words", label: "Your words" },
  { id: "kit-assets", label: "Your assets" },
] as const;

/**
 * Section navigation (Lot 3) — a sticky rail down the left on desktop, a
 * horizontal scroller under the header on mobile. Plain anchor links to
 * each section's `id`; no scroll-spy/active-section tracking — this
 * sandbox can't drive a real browser to verify one, and a wrong "active"
 * state would be worse than none (see WORKLOG.md).
 */
export function WorkspaceNav() {
  return (
    <nav
      aria-label="Brand kit sections"
      className="sticky top-6 flex w-[168px] flex-none flex-col gap-1 self-start max-lg:static max-lg:w-full max-lg:flex-row max-lg:gap-4 max-lg:overflow-x-auto max-lg:pb-2"
    >
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="whitespace-nowrap rounded-pill px-3 py-1.5 text-ui text-ink-2 transition-colors hover:bg-card hover:text-ink max-lg:flex-none max-lg:border max-lg:border-line"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
