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
