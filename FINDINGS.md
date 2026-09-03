# FINDINGS.md

Things seen while working the post-purchase chantier that are outside its scope. Recorded, not fixed, not
built around. One line each: what, where, why it matters.

- `monthly_presence_content` is a fully-coded feature that was never turned on: the table exists with
  owner-only RLS, `lib/data/calendar.ts` and `components/home/content-grid.tsx` are fully built against it,
  and no RPC or route anywhere writes to it — it has zero rows in production. Matters because "This month,
  in your brand" and the Content page have always been rendering an empty state that looks like a bug
  rather than a deliberately-unlaunched pipeline; someone should decide when/how the generator gets built.
  (`POST_PURCHASE_INVENTORY.md` §4 has the full detail.)

- Font acquisition for every rendered asset depends on undocumented Google Fonts behavior: which font-file
  format the CSS2 API's `@font-face src` points to is branched on User-Agent, and there is no published rule
  for which UA gets which format — three UA strings were found to reliably return `format('truetype')` by
  testing directly against the live endpoint (`lib/kit/render/font-cache.ts`, `TTF_FORCING_USER_AGENTS`), not
  from documentation. It can change or close without warning; the list-with-fallback and the named
  `FontAcquisitionError` are mitigation, not a guarantee. Matters because the day it closes, a kit whose
  fonts aren't already cached in the `fonts` bucket gets no rendered assets at all until this is fixed. The
  warming script (`scripts/warm-font-cache.ts`) that pre-fills the bucket for every font in the six type
  pairings turns this from a runtime dependency into a build-time one — run it after any change to those
  pairings, and see its own comment for what running it does and does not cover.

- `site_setup_md`'s asset-cache fingerprint doesn't cover everything its content actually depends on. The
  asset content-cache (`asset-fingerprint.ts`) hashes tokens/practiceName/hero/socialTemplates/
  practitionerLine/practiceDetails/bookingUrl — every field some OTHER renderer reads. `site_setup_md`'s
  actual content comes from `site_output_get(..., 'md')`, which is derived from the FULL site spec (every
  page, every section's copy, the builder target) — a much wider surface than what's practical to hash
  field-by-field. Hashing the fetched md string's own content isn't an option either: the fingerprint has
  to be computable BEFORE fetching, to decide whether a fetch/render is even needed. Net effect: if
  someone edits site copy that isn't one of the hashed fields (e.g. a page's body text) without touching
  their palette, fonts, hero, or practice details, `site_setup_md`'s cached download can serve a stale copy
  until the next change that DOES touch a hashed field. Not destructive, not money, not security — a stale
  instructions file, at worst. Flagged rather than silently shipped as if solved; a real fix would mean
  widening the fingerprint to the site spec's own version/etag (`SiteSpecEnvelope.etag` already exists for
  exactly this kind of staleness check) rather than the current field-by-field list, which is a real design
  change to the caching scheme this session isn't making unilaterally.
