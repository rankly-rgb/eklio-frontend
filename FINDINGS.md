# FINDINGS.md

Things seen while working the post-purchase chantier that are outside its scope. Recorded, not fixed, not
built around. One line each: what, where, why it matters.

- `monthly_presence_content` was a fully-coded feature that was never turned on. **Superseded 2026-09-06
  by the entry below** — `lib/data/calendar.ts` and the old `content-grid.tsx` no longer exist, the home
  screen and the calendar both read `content_items`, and the only remaining reference to the old table is
  the monthly cron, which has still never been turned on. Kept here because the original observation is
  what the decision rests on, not because it is still the current state.

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

- `direction_assets` (eklio-backend `20260901074421_direction_assets.sql`) is a fully built, production-
  grade mechanism — table, RLS, and three RPCs (`direction_assets_claim`/`_mark_ready`/`_mark_failed`)
  implementing a claim/reclaim/daily-spend-cap system for a photoreal "ambiance" image per free direction
  (`gpt-image-1`, shown in place of the CSS-gradient placeholder in the reveal once ready) — that no
  frontend code has ever called. Repo-wide grep for the three RPC names in eklio-frontend finds only the
  generated `types/supabase.ts` stubs and one unrelated `WORKLOG.md` citation. `brand_kit_reveal_get`
  already reads `direction_assets` and returns `ambiance_url` in its envelope, so the return value is
  wired end to end — it is just always `null`, for every kit, because nothing ever inserts a `ready` row.
  Same "built and never turned on" pattern already logged above for `monthly_presence_content` and the
  Monthly Presence retention TODOs. Matters because the reveal (explicitly out of scope for the
  post-purchase-v2 chantier) is silently shipping a placeholder-only experience for a feature whose full
  backend already exists and was paid for; someone should decide whether to wire up the frontend caller or
  remove the dormant mechanism. (Full detail: `POST_PURCHASE_V2_INVENTORY.md` §4.)

- No `/help`, `/privacy`, or `/terms` route exists anywhere in the app (logged-in or marketing) — confirmed
  by repo-wide search. LOT 2's app footer names all three explicitly (`components/app/footer.tsx`); building
  three legal/support pages isn't named by any lot in this chantier, so they render as inert mono labels
  rather than as links to a page that 404s. Matters because the footer now visibly promises three pages
  that don't exist; someone should decide whether to write them or drop them from the footer's own spec.

- **There is no 30-day purge of superseded asset versions — the only 30-day purge in the product is
  `app/api/cron/purge-deleted-kits`, which removes a SOFT-DELETED kit's storage objects and row 30 days
  after `delete_brand_kit`.** Session 2b's brief described version history as "older ones downloadable
  until the existing 30-day purge"; the existing purge only fires on a deleted kit, so on a live kit a
  superseded version's bytes stay in storage indefinitely. `brand_assets.superseded_at`
  (`20260905191203_asset_version_history.sql`) now records exactly when each version stopped being current,
  which is the column such a retention job would key off — but no job reads it, and none was written: a
  retention cron is its own piece of work with its own failure modes (an object removed while a signed URL
  is still live, a re-render racing the purge), and widening the deleted-kits cron to also sweep live kits
  would make its name and its documented contract wrong. Matters because storage grows with every palette
  edit, and because the phrase "until the 30-day purge" is not true today. Someone should decide whether
  superseded versions get a retention window at all, and if so, whether it lives in a new cron or in a
  renamed general-purpose one.

- **`gpt-image-2` is not evaluated, and cannot be until it has a flat price.** It exists and is available,
  but it is billed by token only, with no published flat per-image price. That makes a hard, provable spend
  cap impossible to compute BEFORE the call, which is what `brand_images_claim` reserves against — the whole
  budget mechanism assumes a number you can know in advance. `gpt-image-1` is pinned in
  `lib/images/config.ts` for exactly that reason, in one place, never inlined. Someone should re-evaluate
  gpt-image-2 (quality per dollar, and whether a token-based estimate can be bounded tightly enough to
  reserve against) once OpenAI publishes flat pricing or once a measured token ceiling is trustworthy.

- **`<PhotoSlot>` had zero call sites when Session 3 started.** Session 2's log records it as the seam every
  photo surface was built on — "every surface in LOTS 3 and 4 that will later carry a generated photograph
  … built NOW with the existing gradient colour block as its rendered state, behind a single component that
  takes an optional image source". The component was built, tested and committed; nothing ever rendered it.
  A repo-wide grep for `PhotoSlot` and `ambiancePlaceholder` found only the component, its own helper, and
  that helper's unit test. So Session 3's "supply the source" meant wiring it in for the first time, in the
  one place a hero photograph belongs (the kit header's full-bleed band). Matters because the gap was
  invisible: the component compiled, its tests passed, and the log said the surfaces were on it. Anyone
  reading Session 2's log should read this entry beside it.

- **An image regeneration spends a DIRECTION regeneration.** `consume_generation_credit` is the product's
  only credit primitive, and its meter is `generation_credits.directions_generated` /
  `regenerations_used` against `plans.regenerations_limit` — the ladder for regenerating brand DIRECTIONS.
  Lot 5 was told regeneration of a photograph consumes a credit, and rather than invent a second meter
  (the same reasoning that kept `launch_checklist_items` and `direction_assets` from being duplicated) it
  spends that one. So a therapist who regenerates her hero photograph twice has two fewer direction
  regenerations, which is not what either meter's name suggests. Matters because the two are priced
  completely differently — a direction regeneration is a model call over text, a photograph is $0.25 — and
  because she cannot see which meter she is spending. Someone should decide whether photographs get their
  own allowance, and if so, whether it is per kit or per plan.

- **There is no post-purchase refund for a generation credit.** `release_generation_credit` refunds only
  while `brand_kits.directions is still null`, which is never true after delivery. That is why the image
  pipeline checks credit availability BEFORE the API call (advisory,
  `brand_kit_has_generation_credit`) and consumes AFTER the image is recorded, rather than
  consume-then-refund. The window between the two is real: two concurrent regenerations of different slots
  could both pass the advisory check and both consume. It is bounded by the per-slot claim lock and by the
  daily image ceiling, and it costs at most one extra credit, never money. Someone should decide whether a
  genuine post-purchase refund primitive is worth having.

- **`monthly_presence_content` is dead, and the month is unified. RESOLVED 2026-09-06.** LOT 6 built
  `content_items` (migration `20260906155600`) rather than reshaping it, because that table refuses every
  client write by policy, holds zero rows on the live project, and lacks six of the columns the editor
  writes. The old table was deliberately not dropped, not altered and not renamed, and a guard rail in
  that migration fails if its four policies ever change.

  Session 4 left one thing open: the home screen still counted the old table through `calendar_summary`
  while `/app/content` rendered the new one. The owner ruled that shut — the home now reads
  `get_content_month`, the same rows the calendar shows, and `app/__tests__/one-month-model.test.ts`
  fails if any file outside one named exemption touches `monthly_presence_content`,
  `calendar_summary` or `ensure_month_skeleton` again. The locked tile, the "N more locked" row and the
  unlock modal went with it: those belonged to content generated FOR her behind a subscription, and
  `content_items` are her own words, so nothing there is withheld.

  ⚠ **THE ONE REMAINING WRITER, AND I WAS WRONG ABOUT IT (corrected 2026-09-06).**
  `app/api/cron/monthly/route.ts` still writes the old table through `ensure_month_skeleton`. I recorded it
  as "built, never turned on", inferring that from the empty table and from the September inventory's note
  that no generator calls `ensure_month_skeleton` in production. **That inference was wrong.**
  `vercel.json` — on `main`, since Lot 9, well before this chantier — schedules
  `/api/cron/monthly` at `0 5 1 * *`. It is armed. Why the table is nonetheless empty is not something this
  repo can answer: no production deployment, no kit at the last firing, or a firing that failed all look
  identical from here, and nothing records a run.

  What this means now that the home screen and the calendar read `content_items`: **if that cron fires, it
  calls a model, spends real money, and writes rows into a table no surface reads.** It was already armed
  before this chantier; what changed is that its output is now invisible. Two ways to close it, and the
  choice is a product one: remove the entry from `vercel.json` (one line, reversible, and it matches
  "monthly_presence_content stays dead"), or port the generator onto `content_items` — which means deciding
  how a PAID, GENERATED item lives in a table she can edit, since `content_items` has no `locked` state,
  deliberately. **Nobody should leave it as it is.** It is named in the exemption list inside
  `app/__tests__/one-month-model.test.ts` so it cannot be forgotten quietly.
---

## Added in Session 5, and left open

### 1. The first thing the next chantier inherits: porting the monthly generator

**Deciding how a paid, generated item lives in a table she can edit, when `content_items` deliberately has
no `locked` state, is a chantier of its own.** That sentence is the reason this was not done here, and it is
the whole of it.

The state as of 2026-09-06: the home screen and the calendar both read `content_items`.
`app/api/cron/monthly/route.ts` still writes `monthly_presence_content` through `ensure_month_skeleton`, and
that table is read by nothing. **Its Vercel cron entry has been removed** — the owner's decision, taken
because leaving a schedule armed in production that pays a model to write rows nobody reads is not
something to carry to 1 October. The route still exists and still works; it is simply no longer scheduled,
and re-adding four lines to `vercel.json` reverses that.

So the inheritance is a decision, not a repair:

- `content_items` is HER authoring space. Every row is writable by her, and there is no paywalled state —
  that absence is deliberate, and it is what makes the publishing log trustworthy.
- Monthly Presence delivers content generated FOR her, behind a subscription, which needs exactly the
  state `content_items` refuses to have.
- Reconciling those two is a product design question with a schema consequence, and neither half should be
  bent quietly to fit the other.

Until it is answered, Monthly Presence does not run. That is a smaller problem than it running into a void.


- **The Check rewrite can spend one extra credit under a race.** Availability is checked before the model
  call (`brand_kit_has_generation_credit`) and the credit is consumed after, only when the rewrite actually
  resolved. Two rewrites started at the same moment can both pass the advisory check and both consume. It
  costs at most one extra credit and never money, and the alternative — consume-then-refund — is worse,
  because `release_generation_credit` only refunds while `brand_kits.directions` is still null, which is
  never true after delivery. The same shape already exists in the image pipeline and is recorded above.
  Someone should decide whether a real post-purchase refund primitive is worth having; it would close both.

- **The SVG sanitiser is a scrubber, not a parser.** `lib/uploads/svg.ts` strips scripts, event handlers,
  embedded HTML, SMIL attribute setters, remote `@import` and external references with regular expressions,
  and refuses entity declarations outright. That is weaker than parse-and-serialize, and the file says so.
  What makes it acceptable today is three other controls: the file is served from a private bucket, through
  a signed URL that expires in five minutes, and is never inlined into a page of ours or rendered as HTML.
  **If any of those three change, this is not enough** and the honest fix is a real XML parser. Nobody
  should relax one of the three without reading that file first.

- **Check gates on the kit's entitlement, not on a per-use meter.** The scan is free and deterministic;
  only the rewrite spends. A practitioner with an exhausted allowance can still scan as much as she likes,
  which is deliberate — refusing to tell someone their copy breaks an advertising rule because they ran out
  of credits would be the wrong product. Worth revisiting only if scanning ever becomes expensive.

- **Uploads have a per-kit quota but no account-level one.** Twenty-four files and 50 MB per brand kit, in
  `app_settings`. Someone with many kits multiplies that, and nothing today counts across kits. Fine at
  current volume, and the ceilings move without a deploy; it becomes a real question if kits per account
  ever stops being roughly one.

- **`brand_images` and `direction_assets` are still two image systems.** Unchanged since Session 3:
  `direction_assets` is free, pre-purchase, per direction, and dormant; `brand_images` is paid,
  post-purchase, per slot, and live. Unifying them is a decision, not a refactor, and nobody has made it.

- **The per-slot image fingerprint is deferred by the owner** (5 September, recorded in `CHANTIER_LOG.md`).
  One per-kit fingerprint means any prompt edit invalidates all seven slots. Revisit when the kit count
  makes a full sweep expensive — not before.

- **A named `slotExclusion` in an image prompt is advisory, not enforced.** `post_bg_2` rendered the
  cushion its own exclusion forbade by name. Only the master's hard constraints — no people, no faces, no
  hands, no text — held across every generation made. Anything that needs a guaranteed absence must get it
  from cropping, compositing or review, never from a sentence in a prompt.

- **`texture` renders entirely in the primary colour**, against a palette rule that says paper and light
  neutral dominate. Accepted as a ground rather than a scene. Type over it has to be light;
  `solveScrimOpacity` measures rather than assumes and reports `meetsTarget: false` honestly.

---

## Added while rewriting the home page ("your practice this week")

- **A `content_ready` notification's `payload.item_id` still points at `monthly_presence_content`, a table
  Session 5 made dead.** `sync_notifications` (backend, `20260905175222`) was written before `content_items`
  existed; its `content_ready` insert selects from `monthly_presence_content`, which now has zero rows and
  no live writer (the monthly cron that fed it lost its schedule the same session). A `content_ready`
  notification can therefore only exist for a row synced before Session 5 — but if one does, treating
  `item_id` as a `content_items` id would 404. The home page's "Since you were here" routes this kind to
  `/app/content` rather than to the specific item, and `lib/data/__tests__/home-canvas.test.ts` asserts the
  id is never used in the href. Not fixed at the source: that is the same backend migration the disarmed
  cron lives in, and reshaping `sync_notifications` to read `content_items` is a small but real change to a
  function this lot did not otherwise need to touch.

- **`loadHomeActivity` / `HomeActivity` (`lib/data/brand-kit.ts`) are now unreferenced.** The home screen's
  "Since you were here" moved from that asset/content-activity feed to the notifications table (per the
  redesign). The function and its backing RPC (`home_recent_activity`) are untouched and still work; nothing
  calls them any more. Left in place rather than deleted, since deleting an exported function from a file
  this lot did not otherwise need to touch is a bigger footprint than the situation calls for — but it is
  genuinely dead code now, and a future cleanup pass should know that before "helpfully" re-wiring it.

- **The week strip undercounts near a month boundary.** `buildWeekStrip` (`lib/data/home.ts`) reads
  `hasContent` off `home.month`, which is scoped to the calendar month containing today
  (`get_content_month`). A week that spans two months can therefore miss a day or two that belong to the
  adjacent month's own fetch. Documented in code rather than fixed with a second `get_content_month` call,
  which this lot's brief did not ask for ("one line of code" — composition over what was already loaded).

- **Two more named exceptions to "her brand colour only inside canvases."** The home redesign's own brief
  explicitly asked for two: the Next card's stand-alone "Open it" button on a content item (her primary,
  `--s-cta-ink` label), and the week strip's today-underline (her primary). Both are commented at the call
  site and both are deliberate, not drift. The pre-existing "single primary button" framing undercounts
  them by one; recorded here so a later session reads it as ratified, not as something to quietly "fix"
  back to a neutral tone.

---

## Added while splitting the brand kit into a section switcher

*Four of the entries first written here were closed by the closing pass on 8 September and have been
replaced by what remains true. What follows is the residue, not the original list.*

- **A lifetime download total is not available from this schema, and labelling is the whole of the fix
  that was possible.** `brand_assets.download_count` is an integer on the asset row, and the row is keyed
  by `(brand_kit_id, key, fingerprint)` — so every current asset becomes a new row with a count of zero
  the first time she changes a colour. The two surfaces that show it now name their own scope
  (`Downloads of this version` on the asset's fiche, `Most downloaded (this version)` in the library's
  sort), and the header band ships no downloads tile at all. That makes the number true; it does not make
  a lifetime total possible. A real one needs an events table — one row per download, with a timestamp —
  not a bigger integer, and nobody has asked for one.

- **The kit's "Your site" section renders `BrandPreview`, which is the five-role `--p-*` preview model, one
  click away from an editor that renders the thirteen-field `--s-*` token set.** Same brand, two
  fidelities, and the preview one has no `cta_ink`, no `primary_text` and no `accent_text`. This is the
  known two-token-system split, seen from a new angle: it now shows up WITHIN one route family rather than
  between two distant screens, which makes it easier to notice and no easier to justify.

- **`needs-rebuild` is the status vocabulary's word for something that needs nothing from her.**
  `lib/status`'s nine-status system is settled and was not this lot's to change, so the library's chip and
  its `?status=needs-rebuild` filter still use it. The Overview's tile no longer does — it says the files
  rebuild the next time she downloads them, which is what `ensureAssetRendered` actually does, free and
  without consuming a credit. The two now describe the same state in different registers. Worth unifying
  the day the status vocabulary is opened for another reason.

- **No stored value anywhere points at an app route — verified, not assumed.** The site editor's move from
  `/app/brand-kits/[id]/site` to `/site-editor` raised the question, because `content_ready`'s
  `payload.item_id` is a live example of this repo persisting a reference that later went stale. A scan of
  all 217 text/jsonb columns across every base table in `public` found zero rows containing
  `/app/brand-kits` or a `brand-kits/…/site` path, and the static picture agrees: no migration writes an
  app path, `launch_checklist_items` stores a label and a description with the hrefs built in the frontend
  (`LaunchStepContext`), `site_stale` notifications carry `'{}'::jsonb`, `calendar_summary` returns no
  href, and the three email `ctaHref`s point at `/app/briefs/:id`, `/app/brand-kits/:id/reveal` and
  `/app/content`. **App routes are a frontend concern in this system and nothing outside the frontend
  depends on one.** That is worth knowing before the next rename — and worth re-checking rather than
  trusting, since it is a property nothing enforces.

---

## Added while closing the gap to the mockup (second pass on the shell)

- **The kit shell and the site editor now disagree about where a rail goes.** The kit's rail begins under
  the app header with the header band beside it; the site editor, one click away at `/site-editor`, still
  puts its own controls in a 360px rail with its own internal header above the fold. Two paid screens in
  the same route family, two rail idioms. Neither is wrong on its own and the editor's layout law is
  settled, so nothing was changed — but the inconsistency is now visible in a way it was not when the kit
  had no rail at that height.

- **`initialsFrom` is one function serving two different jobs, and only one of them is an avatar.** The
  account chip uses it on a person's name (`Dana Whitfield` → `DW`); the kit rail uses it on a practice
  name to draw her monogram (`Elm & Ember Therapy` → `ET`). A monogram is a brand mark with typographic
  rules of its own — the rendered `monogram_svg` asset does not derive itself this way — and the two will
  eventually want different answers. They share an implementation today because they happen to agree on
  "first letter of the first and last word".

- **The header's search field and the modal's search field are two inputs bound to one `query`.** That is
  deliberate and tested (a character typed in the header must survive the modal taking focus a frame
  later), but it means both are visible and identical while the modal is open, one behind the overlay.
  Nobody has looked at whether that reads as a duplicate or as continuity; it was not worth a second
  component to find out.

- **The `Status` tile is now the only bordered card in the Overview's first screen**, since the counts
  became a strip in the band above it. It reads as a leftover of the pattern it used to belong to. It is
  still the right information — see the entry above about what `staleKeys` can say — but its container is
  now the odd one out, and folding it into the band would put a sentence among three numbers, which the
  no-aphorism ruling exists to prevent.

---

## Added while un-conflating the meters, hardening the image run, and building the tier guard

- **~~The image budgets were sized for regenerations only~~ — RESOLVED 9 September, same day.** Every
  image now reserves against `plans.image_budget_cents`, and a full set of seven at the current price
  table is **59 cents** (hero 25c at high, two ambients 7c, four squares 5c) — not the 41c an earlier
  report quoted from an older table, which is the `--quality medium` figure. At the original 100 / 250 /
  500 that left Starter with 41c for the life of a kit: one hero regeneration. The budgets are now
  **200 / 400 / 600**, leaving 141 / 341 / 541 cents of headroom after a full set. Kept here because the
  ARITHMETIC is the thing to re-check: any change to the price table, the slot list, or a slot's quality
  moves the cost of a full set, and these three numbers were chosen against 59c specifically. Resizing is
  an `update public.plans` and no code, exactly as that table's own comment intends.

- **A first generation that fails now costs a reservation round-trip it did not before.** Reserve, fail,
  release — two extra RPCs on the unhappy path of the seven initial images. It is the price of the per-kit
  accounting and it is small, but it is a real change to a path that used to be free of the budget
  entirely.

- **`reserve_image_regeneration` and `settle_image_regeneration` are now called for first generations
  too, and their database names still say "regeneration".** The frontend wrappers were renamed
  (`reserveImageSpend`, `settleImageSpend`, `getImageBudget`) because a money path whose local name
  disagrees with what it does is precisely what produced two contradictory reports about which meter
  images spend. The RPC names were left alone: renaming a live function is a migration and a redeploy for
  a word. The mismatch is now documented at both ends rather than silent.

- **The Check rewrite no longer refunds nothing, because it no longer charges anything.** It used to
  consume a directions credit only when the rewrite *resolved* — Eklio ate the failures. The daily count
  that replaces it is charged before the call and regardless of outcome, because a bound that only counts
  successes does not bound a script whose rewrites all fail. The trade is deliberate: a failed rewrite
  costs one of fifty rather than nothing. (Twenty was the first ceiling and it WAS tight: a bio with six
  flagged sentences, worked through twice, is twelve, and a second piece of copy hit the wall — with the
  refusal lasting until the next UTC day. Raised to fifty on 9 September, one row in `app_settings`, no
  deploy, which is what putting it there was for.)

- **`brand_kit_has_generation_credit` has one caller fewer and may now have none that matter.** The Check
  rewrite was using it as its advisory pre-check. It still exists and is still correct; whether anything
  else needs it should be checked before someone assumes it is load-bearing.

- **~~`min_tier` is enforced nowhere~~ — the guard is wired, and `asset_catalog.min_tier` still is not.**
  The nineteen product surfaces now resolve through `surfaceAccess`, with six above `starter` (site editor,
  other sizes and formats, in-situ frames and the ethics rewrite at Practice; version history and the
  designer handoff at Signature). `asset_catalog.min_tier` — 35 rows, all `starter` — is a SEPARATE and
  still-unread column, and the two ask different questions: "may she see this THING" versus "may she have
  this FILE". Nothing disagrees today because the catalogue is uniformly permissive. The day a file is
  raised, someone has to decide whether a `practice`-only file inside a `starter` surface is coherent.

- **`assets_in_situ` is the one paid surface guarded only in a component**, and the test carries the
  exemption with its reason: the in-situ panel fetches nothing of its own — it frames a thumbnail the
  assets route already served under `assets_download`. If it ever gains a server-side composite render,
  the exemption has to go with it.

- **Six surfaces became refusable, and production has no customer who can be refused.** All 4 paid
  purchases are `practice`, so the two Signature surfaces are the only ones any live customer would hit,
  and there is exactly one live paid kit. The distribution is therefore untested against a real Starter
  buyer, because none exists.

- **Two tier vocabularies exist and they nearly agree.** `asset_catalog.min_tier` is per-catalogue-key
  (35 rows, all `starter`), enforced by nothing; `SURFACE_MIN_TIER` is per product surface (19 rows, all
  `starter`), enforced by `surfaceAccess`. They answer different questions — "may she have this FILE" and
  "may she see this THING" — and both are currently permissive, so nothing disagrees. The day either moves,
  someone has to decide whether a `practice`-only file inside a `starter` surface is coherent.

- **The `plans` table has a fourth row, `free`, that is not a sold tier.** `KIT_TIERS` in the frontend is
  three long (`starter`, `practice`, `signature`); `plans` also carries `free` with a zero price and one
  regeneration. Nothing in this lot's guard can express `free`, and `parseKitTier` returns `null` for it —
  which fails closed, correctly. Worth knowing before someone reads `plans` as the list of tiers.

---

## Added while correcting the tier names and the two in-place refusals

- **The sold names were wrong for a day, and nothing could have caught it.** `lib/billing/tier-names.ts`
  shipped holding the enum values capitalised — "Starter", "Practice", "Signature" — which is exactly what
  a plausible-but-wrong value looks like. The live names are **Brand Kit / Brand Kit Plus / Practice
  Suite**. No test can tell a real product name from a capitalised enum, so the only defence is that the
  file exists at all and has one job; the test now pins the three strings and asserts none of them is its
  own enum value lowercased, which would at least catch a silent revert.

- **The Check screen no longer offers a whole-text rewrite to a Brand Kit customer, and offers nothing in
  its place.** The button is gone rather than refusing on click; the teaching moved inside each blocking
  finding as one line. That means a Brand Kit customer has no path from "this trips a rule" to "here is
  wording that does not" other than her own writing. That is the intended shape — the scan teaches, the
  rewrite is sold — but it is worth watching: if the six rules turn out to be hard to satisfy by hand, the
  scan becomes an alarm she cannot silence.

- **`TierLine` and `TierUpgradePrompt` are two refusal registers, and the rule for choosing is positional
  rather than stylistic.** In place of a surface → the card, with price and tagline. Beside something she
  is using → the line, with neither. Written down because the next surface to be gated will need the
  choice made again, and "which one looks better" is the wrong question.

- **Upload storage is now a 200 MiB ceiling per kit, and nothing measures the real number.** At a hundred
  kits the ceiling is 19.53 GiB (it was 4.88). Actual usage today is zero bytes across zero uploads, so
  there is no basis for predicting where inside that envelope real customers land — and nothing in the
  product reports aggregate storage. Worth a query before the kit count makes the ceiling interesting.

---

## Added while building the three included months of Monthly Presence

- **⚠ The single fact I could NOT verify, and designed around instead.** In a Stripe Checkout session in
  `mode: "subscription"`, a one-time line item becomes a posting on the subscription's FIRST invoice. With
  a 90-day trial, that invoice is not issued until the trial ends — which would mean delivering a $249 kit
  and collecting nothing for three months, on a subscription she can cancel throughout. `docs.stripe.com`
  is blocked from this environment, so I could not confirm what Stripe actually does with a one-time
  posting on a trialing subscription's first invoice. Rather than guess on a question worth $249 per sale,
  the kit is now charged in `mode: "payment"` and the subscription is created afterwards by the webhook,
  which makes the question moot. **If anyone ever wants to collapse the two back into one session, that is
  the fact to establish first**, in Stripe test mode, with a real 90-day trial and a real one-time line.

- **Stripe does NOT deduplicate subscriptions, and never has.** A second Checkout session in subscription
  mode for a customer who already subscribes creates a SECOND subscription; Stripe publishes a page called
  "Limit customers to one subscription" precisely because preventing it is the integrator's job. Our
  `subscriptions` table is unique on `user_id`, so a second Stripe subscription would not even produce a
  second row — it would produce one row that silently alternates between two Stripe objects while both
  bill $39. `findLiveSubscription` + `planIncludedMonths` are what stand between us and that.

- **`findLiveSubscription` deliberately does not filter on the price id.** The product sells exactly one
  subscription, so any live subscription IS Monthly Presence. Filtering on `monthlyPresencePriceId()`
  would create a second subscription the day that price is rotated in Stripe (same product, same $39, new
  `price_…`) — the exact duplicate the function exists to prevent. If a second recurring product is ever
  sold, this assumption breaks and the function must learn to tell them apart.

- **The pricing page's `metadata.description` still says "Starter $79, Practice $149, Signature $249".**
  Those are enum values, not the sold names, and the tier-name lot did not reach this string. It is what
  search engines and link previews show. Not fixed here — out of this lot's scope — but it is public copy
  contradicting the three names the same page now renders.

- **The trial notice bypasses `lib/email/state.ts` entirely, and that asymmetry is now load-bearing.**
  `canSend`'s 72-hour all-types cooldown, its never-repeat-a-kind rule, and the marketing unsubscribe are
  all correct for nudges and all wrong for a pre-charge billing notice. Deduplication moved onto
  `subscriptions.trial_notice_sent_for` instead. The risk this creates: there are now TWO email paths with
  different suppression rules, and a future email will have to be classified into one of them. The test
  that the notice carries no unsubscribe link is what keeps the boundary visible.

- ~~**Nothing measures whether the notice was actually delivered.**~~ **FIXED in the next lot.** The sweep
  now stamps only on `delivered === true`; a missing key is an `ok: false` in production; and
  `instrumentation.ts` refuses to serve without the key. Left here as the record of the defect.

- **`trial_settings.end_behavior.missing_payment_method: "create_invoice"` has never been exercised.**
  It only fires if the card attached by `setup_future_usage` is gone 90 days later (expired, removed,
  bank-reissued). The chosen behaviour issues a visible invoice rather than silently cancelling, and
  `past_due` then gets the existing 3-day grace — but that whole path is reasoned, not observed.

- **Production has 4 paid purchases, all `practice`, zero `signature`; 1 subscription row, 0 `trialing`**
  (counted against the live database while writing this, not carried over from an earlier session). So
  every line of this lot is unexercised by real data: no trial has ever existed, no notice has ever been
  sent, and the already-subscribed branch of `planIncludedMonths` has never run against Stripe. The first
  Practice Suite sale is the integration test — and the one existing subscriber is who would exercise the
  extend path if she bought it.

---

## Added while fixing the delivery stamp and sweeping the tier names

- **What the startup guard actually does, measured rather than assumed.** On Next 16.3.0 in this repo, with
  `RESEND_API_KEY` removed: `next build` **succeeds** (the instrumentation hook does not run at build time,
  so deployments still build), and `next start` prints `Failed to prepare server` with the reason, then
  **answers 500 to every request** while the process stays alive. It is loud, immediate and visible at
  deploy — but it is not a clean crash, and anyone reading a health check will see 500s rather than a
  stopped process. Worth knowing before someone debugs it at 2am.

- **The nudge emails have the same bug and I did not fix it.** `app/api/cron/nudges/route.ts` calls
  `recordSend` on `outcome.ok`, so a nudge that was never delivered is still recorded as sent and will
  never be retried — the same shape as the notice defect. It is out of this lot's scope and its
  consequence is different in kind: a missed nudge costs a conversion, a missed notice costs an unlawful
  charge. But it is the same class, the fix is the same one line, and the new three-branch `SendOutcome`
  type makes it a one-word change (`outcome.ok` → `outcome.delivered`).

- **There are no Open Graph tags and no JSON-LD anywhere in the repo.** The sweep looked for them and found
  zero. Nothing is therefore *wrong* in them — but with cold email starting, every link shared to LinkedIn,
  Slack or iMessage renders from `<title>` and `metadata.description` alone, with no image and no card. A
  test now fails the moment someone adds an `openGraph` block or a `ld+json` script, forcing it through the
  tier-name sweep; building them is a separate decision.

- **`app/layout.tsx`'s description is the site-wide fallback and names no product at all.** Every page
  except `/pricing` and the three checkout screens inherits it. That is not a correctness defect — it names
  no tier, so nothing in it can be wrong — but it means the pricing page is the *only* page whose snippet
  says what is sold, and it is the only one the sweep had anything to correct.

- **Four of the five metadata blocks are bare titles.** `/app/checkout`, `/app/checkout/success` and
  `/app/checkout/canceled` carry `title` only, no description. They are behind auth so snippets do not
  matter, but it is worth knowing the sweep found nothing there because there is nothing there.

- **`SOLD_TIER_NAME` is now read by exactly four places**, and the sweep confirmed no fifth exists:
  `KIT_PLANS[*].label` (which feeds the pricing cards, the comparison table, the checkout screen and now
  the meta description), `TierLine`, `TierUpgradePrompt` and `lib/api/surface-guard.ts`. Every other
  appearance of the words `starter` / `practice` / `signature` in the repo is either an enum value in a
  key, a URL parameter, or a code comment using the internal vocabulary correctly.

---

## Added during the Content chantier, Session 1 (inventory only)

- **⚠ `monthly_presence_content`'s live shape is not the shape in the migration that
  creates it.** `20260825160000_lot4_billing.sql` creates it as
  `(project_id, month, content jsonb, status)`; `20260827105000_monthly_content_calendar.sql`
  reshapes it to `(user_id, brand_kit_id, month, day_of_month, type, title, caption,
  visual_spec, published_at)` with a completely different `status` vocabulary
  (`locked/draft/ready/published`). I initially read `home_recent_activity` as broken —
  it selects `mpc.brand_kit_id`, `mpc.type`, `mpc.day_of_month`, none of which exist in the
  creating migration — and it is fine. Anyone auditing this table from its `create table`
  alone will reach a wrong conclusion; the live schema is the only reliable source.

- **Two SECURITY DEFINER functions read the dead table on ordinary user traffic.**
  `home_recent_activity(uuid)` and `sync_notifications(uuid)` both run on the home screen.
  They are safe today only because the table has zero rows. Neither was in the tendril list
  the chantier brief carried, and `sync_notifications` is the actual writer of the
  `content_ready` notification whose payload the brief did name.

- **The `content_ready` payload shape is load-bearing inside an index.**
  `notifications_content_ready_idx` is a partial unique index on
  `(brand_kit_id, (payload ->> 'item_id')) WHERE kind = 'content_ready'`, and
  `sync_notifications` relies on it for its `on conflict … do nothing`. Retiring the
  notification kind means dropping an index and relaxing a CHECK, not just deleting an
  insert. Production has never created a `content_ready` row (only `asset_rendered` exists),
  so there is no data to migrate.

- **The "alt text before `ready`" rule does not exist.** It is named in the chantier brief as
  something the editor already has. It does not: the only constraint on `alt_text` anywhere is
  `char_length <= 420`. `status` is a plain three-value dropdown with no precondition, and
  `update_content_item` does not check alt text when moving to `ready`. The editor shows the
  field with the hint "Worth writing before you post, not after." That is advice. Accessibility
  is sold on the pricing page and to an audience that sells accessibility; a rule everyone
  believes exists and which does not is worse than a known gap.

- **`content_items` has no `month` column.** The month is derived from `scheduled_for`, which
  is nullable, so an item can exist in no month at all — the `unscheduled` bucket. Any "month
  record" added later needs its own key and its own link, and cannot assume an item knows
  which month it belongs to.

- **Five archetypes, six registers.** `content_items.archetype` is a CHECK over
  `statement|question|notes|signature|story`, chosen to match the asset-catalogue keys the
  satori renderer draws (`post_statement_1080`, …). The Content chantier's six registers are a
  different taxonomy with different safety rules. Whichever way they are reconciled, the
  renderer's five layouts are the constraint underneath, not the CHECK.

- **The monthly cron was already disarmed and the chantier brief did not know.** It was armed
  in `0f8a908` and its `vercel.json` entry removed in `14c6725`. The route and its generator
  still exist and still answer to `CRON_SECRET`. This is the good version of the "armed cron"
  problem, and it is worth recording that the disarm happened, because the brief's own
  cautionary example is now stale.

- **Production content is three rows, not two.** All `draft`, all untitled, no captions, no alt
  text; two scheduled on the same day (2026-09-08, both `question`), one unscheduled. The
  September calendar shows two because the third has no date. `Ready 0` / `Posted 0` are
  literally true.

---

## Added during the Content chantier, Session 2 (retirement + schema)

- **⚠ A SQL guard rail caught my own comment, and it was right to.** The retirement's guard greps every
  function body for the dead table's name — and `pg_get_functiondef` returns the COMMENTS too. My first
  draft left an explanatory comment inside the replaced `sync_notifications` naming the table, and the
  migration failed. A name inside a function body is indistinguishable, to that check, from a live
  reference. The fix was to write prose that does not lie to the grep ("the dead table") and to have the
  guard ASSEMBLE the name rather than contain it. This is the SQL twin of the repo's own rule for its
  static tests, and it is the first time that rule has bitten in SQL rather than TypeScript.

- **`eklio-backend/types/supabase.ts` is CLI-generated, says "Do not hand-edit", and is badly stale.** It
  does not contain `content_items` or `content_publications` at all — tables that shipped on 2026-09-06.
  I removed the retired table and its two RPCs from it (making it less wrong), but I deliberately did NOT
  hand-write the six new tables into it: that would be simulating typegen, which is the very trap
  "Ruling 2 — make the typegen trap fail loudly" was about. It needs a real
  `supabase gen types` run against a replayed migration set. The FRONTEND's copy is the hand-maintained
  one and is current.

- **The frontend `HomeActivity.contentReady` was mapped but never rendered.** `loadHomeActivity` built a
  `contentReady` array from the RPC and no component ever read it. So the content half of "Since you were
  here" was dead on both sides of the wire, not just in the database.

- **The three production items now sit under a rule they cannot satisfy without an edit.** All three are
  `draft`, untitled, with no alt text. The new gate means marking any of them `ready` refuses with
  `alt_text_required` until alt text is written. That is the intended rule and they are her own drafts, so
  nothing is lost — but it is a behaviour change to three existing rows and worth knowing before someone
  reports it as a bug.

- **`content_kit_access` refuses an unpaid kit, which makes every content fixture a billing fixture.** A
  test kit needs a `paid` purchase row, and a `paid` row must carry `paid_at` (`purchases_paid_at_check`).
  Worth recording because it is not obvious from the content migrations, and it cost two failed test runs.

- **How many themes a month gets is still undecided, and the schema deliberately does not decide it.** The
  chantier brief says "a month record holding the four themes", but its own cadence table gives 2 / 3 / 4
  square grounds for 1× / 2× / 3× per week. Four themes with two grounds, or two themes at the lowest
  cadence? `content_months.themes` is bounded 1..6 rather than pinned to four precisely so Session 3 can
  answer this without a migration. **It must be answered there** — the grounds table is keyed
  `(month_id, theme)`, so the count of themes IS the count of photographic grounds and therefore the
  month's image spend.

- **No renderer/register pairing is physically impossible yet, because nothing renders a register.** The
  brief asked for any pairing the renderer cannot do to be recorded as a fact. As of this session the
  answer is: none, and the reason is that `archetype` alone drives the satori layouts and every register
  can be carried by any of the five. The real constraint will be LENGTH — `post_signature_1080` and
  `story_1080x1920` have the least room for text — and that is a Session 3 measurement against real
  captions, not something this schema can assert.

---

## Added during the Content chantier, Session 3 (types + capacity measurement)

- **⚠ THE MEASURED CAPACITIES SIT BETWEEN `title` AND `caption`, AND THAT MAKES STEP 4 AMBIGUOUS.**
  Measured floors across all six type pairings: `statement` **144** characters, `question` **168**,
  `signature` **195**, `story` **431**, `notes` **472**. But `content_items.title` is capped at **34**
  characters and `content_items.caption` at **2200**. So the on-image text is neither: it can hold four to
  fourteen times more than a title, and a fraction of a caption. Step 4 says "pick the archetype from what
  the caption's length physically allows" — at 2200 characters no layout allows anything. **What the
  layout renders needs its own field, or the generator needs to know which slice of the caption goes on
  the image.** Flagged rather than guessed.

- **`satori` echoes a `height` you pass it.** Give it `{ width, height }` and the root `<svg>` comes back
  with exactly that height whatever it laid out; give it `{ width }` alone and it auto-sizes honestly. My
  first capacity run measured every archetype at zero because 4000 > every budget, and it looked like a
  layout problem rather than a measurement bug. Anything in this repo that reads back a satori height must
  pass width only.

- **Capacity varies by 60% across the pairings, and the generator does not get to choose.**
  `cormorant_source` holds 234 characters where `caslon_inter` holds 168 in the same `question` layout —
  Cormorant Garamond is a narrow face. The generator must respect the FLOOR, not an average, because the
  typeface is hers.

- **`api.supabase.com` is refused from this environment (curl returns 000), and there is no
  `SUPABASE_ACCESS_TOKEN`, and Docker is unusable.** All three of the CLI's paths to `gen types` are
  therefore closed. The Supabase MCP server does reach the project and exposes the same generator, which
  is what produced the current `eklio-backend/types/supabase.ts` — real generation, not hand-writing. The
  remaining difference from the documented command is recorded in that file's own header: it reflects the
  LIVE project rather than a clean replay of `supabase/migrations` + `seed.sql`.

- **`api.anthropic.com` is reachable (401 without a key); there is no `ANTHROPIC_API_KEY` and no
  `OPENAI_API_KEY` in this environment, and no `.env.local`.** So captions cannot be generated here even
  though the network would allow it, and grounds cannot be generated at all. The Session 3 gate is not
  executable from this environment.

- **The tier-name sweep was narrower than its brief.** `tier-names-in-metadata.test.ts`
  walks `app/` and checks metadata only, so `lib/billing/plans.ts` shipped "Everything in
  Starter" and "Everything in Practice" as visible bullets on `/pricing`. Found by the
  acquisition walk; see `ACQUISITION_WALK.md` §5.1. Not fixed here — Session 1 is report-only.

- **2026-09-11 (CLOSED, and the diagnosis was corrected) — a revoke that no longer holds.** `20260902090000_revoke_internal_function_surface.sql` closed 18 functions to `anon`; 17 have their grants back, PUBLIC included. The only survivor is the one a later migration re-revoked. 35 `SECURITY DEFINER` functions are `anon`-callable today, 22 of them take arguments. A `REVOKE` is not a durable defence in this database — the check belongs inside the function body, and the enumeration belongs in CI. `TENANCY.md` §1.
  **Correction, same day:** the "blanket platform re-grant" reading was wrong — a blanket
  grant would have undone the revokes of 3–11 September too, and those all hold. The tooling
  was tested and cleared as well. The cause remains unnamed; the fix does not depend on it.
  Closed by backend `20260911170458`: the authority check moved inside the function body,
  trigger functions were revoked by enumeration rather than by a hand-kept list, and the rule
  now runs in CI (`supabase/tests/20260911170458_function_surface.test.sql`) against a
  database rebuilt from every migration. 35 anon-callable `SECURITY DEFINER` functions → 18;
  8 gateless → 1 named exemption; 16 anon-callable trigger functions → 0.

- **2026-09-11 — an abandoned tenancy branch exists in both repos, and its migrations are dated
  in the past.** `origin/claude/tenancy-layer` (frontend `2f514ad`, backend equivalent) carries a
  whole earlier attempt at this layer — `organizations`, `organization_members`, clinician
  profiles, an SEO grid, a practice dashboard and landing page — in **twelve migrations all
  stamped `20260903*`**, plus sixteen `supabase/tests/tenancy_*.test.sql`. It forked long ago
  (72 migrations against main's 99) and was never merged. **Nothing from it exists in the live
  database** — no `organizations`, no `organization_id` column, no `*_org_*` function
  (checked against `information_schema` and `pg_proc` on 2026-09-11). Two reasons not to
  resurrect it: most of what it contains is the practice UI and per-seat surface, explicitly
  out of scope for October; and its `20260903*` stamps now sort **before** migrations already
  applied, which cannot be corrected without renumbering — and migrations are not renumbered.
  New work takes today's timestamps. Read the branch for ideas, never for files.

- **2026-09-11 (CLOSED) — the backend's CI has been failing in the MIGRATION REPLAY, not in any
  test, and nobody looked.** `db-tests` run #100 — Session 2's own push — failed, and I shipped
  the function-surface enumeration without checking whether the workflow that runs it was green.
  It was not, and the enumeration has therefore never executed in CI. The replay aborts inside
  `20260910144421_content_months_theme_source.sql`, whose guard rail probes the CHECK with
  `insert into content_months (...) select bk.id ... from brand_kits limit 1`. On a fresh
  `supabase db reset` there are no `brand_kits`, so the SELECT returns nothing, the INSERT writes
  nothing, and **nothing raises** — measured: `rows=0, exception_seen=false`. Its `when others
  then v_ok := true -- no kit to test against` shows the author saw the empty-database case and
  reached for the wrong mechanism. The guard now asserts the constraint in `pg_constraint` and
  probes with a `gen_random_uuid()` brand_kit_id, which works because a CHECK is verified during
  the insert while a foreign key is an AFTER trigger — so the CHECK raises first and no kit is
  needed. ⚠ **Corrections are new migrations, except this one, which cannot be:** nothing later
  can stop an earlier migration's DO block from raising during a replay. No DDL changed; the
  live database is untouched by the edit. **A guard that depends on seed data asserts the seed,
  not the constraint** — and the sibling at `20260911133504` is skipped entirely on an empty
  database (`if v_user is not null`), so it is vacuous in CI rather than failing. That one is
  left alone; it did its work against the live database when it was applied.
