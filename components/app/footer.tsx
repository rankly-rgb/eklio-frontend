/*
 * Footer — every logged-in page. Hairline above, mono at 11px, her voice on
 * the left ("Eklio — A calmer way to create." is Eklio's own editorial
 * line, never attributed to her practice), Help/Privacy/Terms on the right.
 *
 * No /help, /privacy, or /terms route exists anywhere in this repo today
 * (confirmed by search) -- building three legal/support pages isn't named
 * by any lot in this chantier, so these render as inert labels rather than
 * links to a 404. Logged in FINDINGS.md.
 */
export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-line px-[var(--gutter)] py-6 max-md:px-[var(--gutter-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-mono uppercase tracking-mono-08 text-ink-3">
        <p>Eklio · A calmer way to create.</p>
        <p aria-label="Footer" className="flex items-center gap-4">
          <span>Help</span>
          <span>Privacy</span>
          <span>Terms</span>
        </p>
      </div>
    </footer>
  );
}
