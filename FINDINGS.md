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

- Once "Your first week" fully resolves, home's right-column slot shows only the one-liner "Your brand is
  live in seven places." with nothing beside it — the brief says Monthly Presence's card takes that slot at
  that point, but that card is Lot 8's build, not this one. Not broken (the layout doesn't collapse oddly,
  the slot just looks sparse), and not worth a placeholder built now only to be replaced next lot — flagged
  so Lot 8 knows this is the exact transition point it needs to wire into, per the delivery order.
  RESOLVED by Lot 8: `home-view.tsx` now renders `MonthlyPresenceCard` in that slot once
  `home.checklist.resolvedCount === home.checklist.total`, instead of relying on `ChecklistCard`'s own
  internal one-line collapse (which stays as-is for the kit page's row, where remaining inside the "Your
  first week" framing when resolved is still the right call).

- `app/app/actions.ts`'s `createProject`/`deleteProject` — both `redirect()` to the removed
  `/app/projets/...` route tree, and both are dead code: grep confirms nothing imports either function from
  any component. Not a live bug (nothing reachable 404s through it), so left alone rather than bundled into
  Lot 8's live dead-route fix (`checkout/success`) — deciding whether unused server actions are safe to
  delete outright is a separate call from this lot's "sold honestly" scope. If this file is ever wired back
  up, its redirect targets need the same fix `checkout/success` just got.

- `MONTHLY_PRESENCE_STORIES`/`MONTHLY_PRESENCE_POSTS` in `lib/billing/plans.ts` and the pre-existing
  `TODO(retention)` comment above `MONTHLY_PRESENCE` (three documented-but-unbuilt retention seams: a
  monthly-ready delivery notification, per-post publish reminders, easier publishing/export) — read in full
  while researching Lot 8, left untouched. All three need a scheduler/infrastructure decision the comment
  itself says doesn't belong to the frontend; none of them are what "sold honestly" asked for. Still real
  and still worth doing eventually — noted here rather than re-discovered by whoever builds them.

- `home_recent_activity` (Lot 9) advances its own "last seen" marker on every call, and it's called from
  inside `loadHome()` — the one function both the home page and `GET /api/home` share. Nothing in this repo
  calls `GET /api/home` today, so this is safe as shipped, but if that route is ever polled by a future
  client (rather than loaded once per visit) "Since you were here" will under-report, since each poll would
  advance the marker past activity a real visit hasn't actually happened for yet. See DECISIONS.md for why
  this wasn't re-architected pre-emptively.

- A brand kit that gets soft-deleted (Lot 9) makes `loadBrandKitByProject` return `null` for its project —
  home then falls back to its "no kit yet, start your brief" empty state for that project, even though the
  underlying brief is complete. Not wrong exactly (there genuinely is no active kit for that project
  anymore), but the copy ("Your brief is where it starts…") doesn't quite fit a user who finished a brief
  and then deleted the kit it produced. A real redesign of home's empty states for this specific case is
  out of proportion to the rest of this lot — flagged rather than patched with copy that would only cover
  one of several possible paths into that same fallback.

- Lot 9's accessibility/mobile pass was a CODE-level review of this session's own additions (Lots 2, 6, 7,
  8, 9) — semantic elements, `aria-label`s on icon-only controls, focus-trap/Escape/focus-return on the two
  new modals (copied from `components/site/reset-section.tsx`'s already-established pattern), responsive
  `max-md:`/`max-lg:` classes where a layout goes multi-column, and status conveyed by more than color alone
  (text + strikethrough alongside `LaunchChecklist`'s status dot, for instance). It did not extend to the
  rest of the app, and none of it was confirmed in an actual browser or screen reader — same authenticated-
  session gap as every other UI surface this session, called out explicitly here rather than implied by a
  clean `tsc`/`eslint` run.
