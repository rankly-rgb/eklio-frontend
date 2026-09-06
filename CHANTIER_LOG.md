# CHANTIER_LOG.md

How the five post-purchase-v2 sessions talk to each other. Read this in full before doing anything else,
in every session after the first.

**The working branch is `claude/post-purchase-v2` in both repos**, as the brief always specified. Session
1 pushed to a harness-assigned branch (`claude/nifty-dirac-7isjqb`) instead; Session 2 reconciled this
before doing any other work — see its entry below for detail. Do not create or look for any other branch.

---

## 2026-09-05 — Session 1: the facts

**Session number was not stated by the user.** Checked for evidence before proceeding: no
`CHANTIER_LOG.md` and no `POST_PURCHASE_V2_INVENTORY.md` existed anywhere in the repo or its history, and
both repos' designated branch (`claude/nifty-dirac-7isjqb`, per this session's own harness instructions —
not `claude/post-purchase-v2`, see below) was already byte-identical to `origin/main` with a clean tree.
That is unambiguous evidence no prior v2 session ran. Session 1's own job is investigation-only and ends
in a stop before any code, so proceeding under that assumption carried no risk of overwriting or
duplicating a later session's work even if the assumption turned out wrong. Proceeded as Session 1.

**Completed**: step 1 only — `POST_PURCHASE_V2_INVENTORY.md`, at the root of eklio-frontend. Full facts
report; read it, not this summary, for the actual content. **No code, no migration, no component was
written.**

**Commit**: `7dcf4f5` (eklio-frontend) — `POST_PURCHASE_V2_INVENTORY.md` + one `FINDINGS.md` addition.
**No commit in eklio-backend** — this session's backend investigation was entirely read-only, done via
live Supabase MCP queries (schema, RLS policies, function bodies) rather than by editing migration files,
so there is nothing to commit there.

### Decisions this session took that the brief didn't dictate

- **Branch name.** The brief's own §0.1 says create `claude/post-purchase-v2` from `main`. This session's
  harness-level instructions (which take precedence, and explicitly forbid pushing to a branch other than
  the one named) designated `claude/nifty-dirac-7isjqb` instead. Since that branch was already fresh off
  `main` with zero divergence in both repos, this satisfies the brief's actual intent (a clean starting
  point) without creating a second branch. **Every later session should keep developing on
  `claude/nifty-dirac-7isjqb` in both repos — do not go looking for or try to create
  `claude/post-purchase-v2`.**
- **Stop-condition reading.** None of brief §0.4's four literal conditions was unambiguously true (see
  inventory §11 for the nuance on each). Chose to stop anyway, per the delivery order's explicit
  instruction that Session 1 ends at "stop and report" regardless — not because a condition fired.
- **`monthly_presence_content` vs. a new `content_items` table for LOT 6.** Did not decide this — it's
  Session 4's call — but recorded the fact pattern in the inventory (§2) plainly enough that Session 4
  shouldn't need to re-investigate: the existing table stores posts as rows but RLS hard-denies every
  client write, has zero live rows, and lacks half the columns the brief's `content_items` schema needs.
  The brief's own contingency plan (build `content_items` fresh) looks like the right call from here, but
  it's written up as a recommendation, not a decision.
- **The dormant `direction_assets` mechanism** (inventory §4) — a fully built ambiance-image
  claim/reclaim/daily-cap system that no frontend code has ever called — was logged to `FINDINGS.md`
  rather than fixed, per this chantier's own scope rule (the reveal is explicitly out of scope). It is
  also written up in the inventory itself, not just `FINDINGS.md`, because it's directly relevant prior
  art for Session 3's LOT 5 design, not just an unrelated stray fact.

### What the next session needs to know

- **`launch_steps` (the brief's name) is actually `launch_checklist_items`** in the live schema. Same
  table, same three RPCs, same seven-step "Your first week" list the brief describes — just a different
  name. Don't go looking for a table called `launch_steps`; it doesn't exist.
- **The ethics scanner's exported name is `checkEthics`, not `scanCopy`** (`lib/ethics/rules.ts:408`). The
  brief calls it `scanCopy` generically throughout; that's the function LOT 7 needs to route the rewrite's
  output back through.
- **`min_tier` is seeded on every `asset_catalog` row (always `'starter'`) but enforced nowhere** — not in
  any of the three asset RPCs, not in any frontend component. If any lot this chantier wants real
  tier-gating on an asset, it has to be built from scratch, and per September's already-established rule,
  the comparison must be against `resolveEntitledTier()`/`purchases`, never `brand_kits.tier`.
- **No kill-switch or feature-flag mechanism exists anywhere in either repo today.** LOT 5's
  `IMAGE_GENERATION_ENABLED` is genuinely new, not an extension of something existing.
- **`OPENAI_API_KEY`'s production configuration could not be verified this session** — no Vercel dashboard
  access. The brand-shots CLI proves the access pattern works locally. Session 3 should confirm the key is
  actually set in production before building LOT 5's route handler, per the brief's own instruction there.
- **The route-enumerating paywall test's own 2026-09-03 decision to add page-tree auto-discovery was never
  acted on** — `KIT_PAGES` is still a hand-maintained array. Whoever adds the first new page route this
  chantier (`/app/brand-kits/[id]/assets` in Session 2's LOT 4, most likely) should decide whether to
  close that gap then or leave it for LOT 11 as originally planned — both are defensible, but it shouldn't
  be silently forgotten a third time.

### Questions I would have asked the user, if they'd been reachable mid-session

- Should the dormant `direction_assets`/ambiance mechanism be wired up (a real frontend caller written) as
  part of this chantier, or left dormant/removed in a separate piece of work? Left untouched per scope
  rules, but it's a real product gap someone should decide on deliberately rather than by default.
- Is `claude/nifty-dirac-7isjqb` (this session's harness-assigned branch) intended to BE this chantier's
  branch for its full five-session run, or was `claude/post-purchase-v2` meant literally and the harness
  assignment is a per-session detail that might change session to session? Assumed the former (one
  continuous branch across all five sessions) since the alternative would make `CHANTIER_LOG.md`'s whole
  purpose — continuity across sessions — much harder to honor. If each session gets a *different*
  harness-assigned branch name, later sessions need to say so here explicitly and reconcile branches
  before continuing.

  **Answered by the user, opening Session 2: `claude/post-purchase-v2` was meant literally.** Reconciled —
  see Session 2's entry below. Every later session should now find `claude/post-purchase-v2` already
  correct in both repos and just keep developing on it directly; the branch-name uncertainty above is
  closed, not open.

---

## 2026-09-05 — Session 2: the surfaces

**Corrections from the user, opening this session, applied before any other work:**
1. Reconciled onto `claude/post-purchase-v2` in both repos (branch rename + re-push; the old
   `claude/nifty-dirac-7isjqb` name could not be deleted from eklio-frontend's origin — git proxy returned
   403 on branch deletion — but it now points to the same commit as `claude/post-purchase-v2`, so nothing
   is stranded on it). **This is now the chantier's one branch, in both repos, for the rest of its run.**
2. `launch_steps` confirmed to not exist — used `launch_checklist_items` throughout, as Session 1's
   inventory already found.
3. `min_tier` stays seeded-but-unenforced this session — nothing new gates on it.

**Completed**: delivery-order steps 2 through 6 (LOTS 1–4 in full), one commit per step in each repo where
that step touched it.

**Commits:**

*eklio-frontend* (`claude/post-purchase-v2`):
- `3888706` — branch reconciliation
- `92f2e63` — LOT 1: status vocabulary (`lib/status/`), readability (`lib/ethics/readability.ts`), and
  `components/kit/photo-slot.tsx` (the gradient-placeholder-now/photograph-later component every
  photo-carrying surface in LOTS 3–4 already uses, per this session's own cross-lot instruction). The purge
  itself (§1.1–1.3) had nothing to do — none of the forbidden strings, sharing affordances, or "Insights"
  exist anywhere in this repo; confirmed by search, not assumed.
- `120e1d9` — LOT 2: nav/footer/account menu/settings/breadcrumbs/search/notifications.
- `ea7e314` — LOT 3: kit header, six-card assets preview, named colours, mobile inversion.
- `6f29552` — LOT 4: the asset library route (filter/sort/grid/detail panel/spec table).
- `1ee5ae4` — LOT 4: in-situ frames.

*eklio-backend* (`claude/post-purchase-v2`):
- `208e1fb` — `notifications` table + `sync_notifications`/`mark_notifications_read` RPCs.
- `f37753b` — `app_search` RPC.
- `d1387f1` — `site_specs.color_labels` + `color_names`/`nearest_color_name` + the sync trigger.
- `a329196` — `brand_assets.download_count` + `record_asset_download`.

### Decisions this session took that the brief didn't dictate

- **Notifications' three signal kinds reuse `home_recent_activity`'s own two existing signals** (new
  `brand_assets` rows, `monthly_presence_content` rows becoming ready) plus one new one (`site_specs`'
  `diff.stale`) — per the brief's own "same events as Since you were here" wording. The bell needed its
  own baseline (`notifications_synced_at`), separate from home's `home_content_seen_at`, because read
  state on the bell is independent of home visits. Per-kind partial unique indexes make
  `sync_notifications` genuinely idempotent, not just "usually fine because requests are spaced out" — this
  was caught by testing a same-transaction rerun, which real separate-transaction production calls
  wouldn't have exposed.
- **`color_labels` is computed by a trigger, not at seed time.** All six colour roles are patchable
  (`site_spec_patchable_keys()`), so a label frozen at generation would go stale the first real edit. A
  `BEFORE INSERT OR UPDATE` trigger recomputes all six from the row's current hex values on every write,
  regardless of which RPC performed it — `seed_site_spec`/`site_spec_patch`/`site_spec_reset` needed zero
  changes. The redmean colour-distance formula had a real bug caught in verification (rmean normalized
  twice, matching pure black to "Amber") — fixed and reverified before committing, not shipped and left
  for later.
- **Download tracking required distinguishing intent.** A thumbnail preview (six-card kit cards, the
  library grid, every in-situ frame) calls the exact same per-key route a real download does, to get a
  signed URL to DISPLAY. Only `?intent=download` (sent by `AssetDownloadButton`) counts. Built ahead of the
  library UI specifically so nothing in it fakes a number.
- **"Sizes and formats on demand" and "Version history" (LOT 4) were cut from this session.** The brief's
  own delivery order sequences them "after the panel works"; each is substantial new surface on its own
  (per-size render variants in `lib/kit/render/registry.ts`; a write-path change to what supersedes what
  in `record_brand_asset`) that the working core (filter/sort/grid/detail/spec table/in-situ frames) does
  not depend on. Not silently dropped — recorded here and in the LOT 4 commit messages. **Whoever picks up
  LOT 4 again should build these two before considering it fully done**, since the brief does list them
  under the same numbered step.
- **The kit page's six "usage" cards and the asset library's filter rail use two deliberately different
  groupings** — usage (Website preview/Social post template/Profile image/Business card/Email
  signature/Brand colors) vs. the catalog's own structural `group` (identity/web/social/print/color/
  document). The brief names both, separately, without reconciling them — treated as intentional ("both
  groupings survive, each where it helps"), not a contradiction to resolve. The kit-page cards deep-link
  into the library via an explicit `?keys=` list rather than `?group=`, since the two taxonomies don't map
  onto each other.
- **The per-key asset route (`assets/[key]/route.ts`) was left un-refactored** even though the new batch
  zip route (`assets/zip/route.ts`) needed the same render → upload → record sequence, now factored into
  `lib/kit/render-asset.ts`. The existing route is already tested and working; refactoring it onto the
  shared helper risked a subtle status-code regression for a minor duplication saved. Flagged rather than
  done reflexively.
- **The route-enumerating paywall test's page-tree auto-discovery gap (flagged, not closed, in Session
  1's log) was closed this session** — `/app/brand-kits/[id]/assets` is this chantier's first new page
  route, so per the September 2026-09-03 decision this was always meant to trigger, `KIT_PAGES` now has a
  companion test that walks the real page tree and fails if one is missing from it.

### What the next session needs to know

- **`claude/post-purchase-v2` is now correct in both repos — do not rename, do not look for
  `claude/nifty-dirac-7isjqb` again.**
- **LOT 4 is not fully done** — sizes/formats-on-demand and version history remain, per the decision above.
  If Session 4 or 5 touches the asset library again, check this before assuming LOT 4 is closed.
- **`lib/kit/render-asset.ts`'s `ensureAssetRendered`** is the render-if-needed helper to reuse for any
  future route that needs to guarantee an asset is current (e.g. a future handoff bundle, LOT 10) — don't
  write a third copy of the render → upload → record sequence.
- **`IN_SITU_FRAME` (`components/kit/in-situ/frames.tsx`) maps exactly ten catalog keys to five frame
  types.** If LOT 5's photography adds new catalog-adjacent keys that would benefit from an in-situ
  placement (a post background in a phone frame, say), extend that map rather than building a parallel
  mechanism.
- **The eklio-frontend git proxy refuses branch deletion (403).** Don't spend time retrying it if a future
  session needs to clean up a stray branch — note it and move on, same as this session did.

### Questions I would have asked the user, if they'd been reachable mid-session

- Is grouping the kit page's six cards by usage (rather than by the catalog's own six structural groups,
  which the asset library's filter rail already uses) actually the right read of "how she looks for a
  file"? Built as specified, but the two six-way groupings sitting side by side on adjacent screens is a
  real design choice worth confirming rather than assuming.
- Should "Download selected (.zip)" cap how many assets can be selected at once, given each uncached one
  triggers a real render? Capped informally at 34 (the whole catalog) via the request schema; no explicit
  UI-side warning for a large selection.

---

## 2026-09-05 — Session 2b: closing LOT 4

Branch: `claude/post-purchase-v2`, both repos. Two commits per repo, steps 5b and 5c.

### The two verifications, first

- **The purge test from §Tests item 10 did not exist.** Written as
  `app/__tests__/forbidden-metrics.test.ts` (commit `f426161`) — a GUARD, not a cleanup: none of the five
  phrases has ever been in this repo, they live in the mockups, and Lot 1 found nothing to purge. Proven
  to fail before being trusted: a canary component carrying one of the phrases turned it red, and its
  removal turned it green again. The reading level stays permitted and the test says why — Flesch-Kincaid
  is measured from the text, not scored.
- **The `notifications` RLS test already existed** — `supabase/tests/20260905175222_notifications_and_
  workspaces.test.sql:159-176` asserts a non-owner reads zero rows while the owner reads her own, and the
  four policies ship in `20260905175222_notifications_and_workspaces.sql`, the migration that creates the
  table. Nothing to write.

### Step 5b — sizes and formats on demand

`available_sizes int[]` and `available_formats text[]` on `asset_catalog`, seeded for the **ten** keys whose
pixels come from a vector this repo can rebuild. Everything else stays empty on purpose: no encoder here
makes webp or jpeg, and `business_card_*` / `monogram_png_512_*` return a Buffer with no SVG behind them —
they would have to be re-laid-out, not re-rasterized. A menu entry that fails on click is worse than no
menu entry.

`brand_assets` gains `size`/`format` with `(0, '')` as the native sentinel — chosen over NULLs so the unique
constraint and every `ON CONFLICT` stay plain column lists. The constraint widens to
`(brand_kit_id, key, fingerprint, size, format)`: a width she asks for later lives **beside** the native one
under the **same** fingerprint, because it is the same rendering. `asset_variant_path` is the single source
of truth for the path and its native case resolves to exactly the pre-variant shape, so nothing already in
storage becomes unreachable.

The render-bomb guard is in `request_brand_asset_upload` and `record_brand_asset` — next to the paid check,
not in a client that can be edited. `record_asset_download` increments exactly the rendition handed over;
the manifest still returns one row per key (joined to the native alone) and SUMs `download_count` across
renditions, so a file taken three times at 48px does not read "never downloaded".

`lib/kit/render/variants.ts` re-rasterizes from the **same exported SVG function** each key's `registry.ts`
entry already calls, so a variant and its native rendition cannot drift. **`registry.ts` is untouched.**

`app/__tests__/download-is-never-a-generation.test.ts` enumerates the whole delivery path (asset, PDF,
composition, manifest) and fails if any of it names `consume_generation_credit` in code. It strips comments
— three files mention the call precisely to say they do not make it — and carries a positive control on the
real generation route so the stripper cannot gut the thing it is searching. Proven to fail on a canary.

### Step 5c — version history

Built on the history that already existed rather than a new one: `brand_assets` is content-addressed by
fingerprint, so a rebuild has always added a row. `superseded_at` and `change_summary` make it legible, and
`fingerprint_inputs` keeps what the hash was computed from so the next rebuild can say what moved.

`superseded_at` is decided inside `record_brand_asset`, in the same call that stores the file — never by a
caller passing a flag. Recording a fingerprint makes it current and every other one for that key superseded;
recording one that was superseded before makes it current again, so **putting a colour back leaves exactly
one current version**, not zero. That case has its own assertion; it is the one this shape would most
easily get wrong.

`describeAssetChange` turns the two versions' inputs into one sentence ("Your primary color and heading font
changed."), naming at most three fields before counting the rest. Its test moves **every** hashed field one
at a time and fails if any produces the renderer-bump fallback — so a future session that adds a field to
the fingerprint cannot leave it silently unexplained.

An older version is served from what was stored and **never re-rendered**: the inputs behind it are gone, so
a re-render would quietly hand her the new file under the old name.

### Decisions taken without asking

- **`available_formats` lists the asset's own kind alongside the alternatives** ("PNG / SVG") because that
  is how the menu reads to her — and a follow-up migration normalizes a requested format back to `''` when
  it equals that kind. Without it, picking "PNG" on a png-kind asset would have stored a second row pointing
  at the native object: two rows, one file. The catalogue guard still runs first, so an asset offering
  nothing does not accept its own kind by the back door.
- **`fingerprint_inputs` records the inputs; it does not compute anything.** The brief said to stop rather
  than change how fingerprints are computed. Recording what `computeAssetFingerprint` was handed is not
  changing it — the same object is passed to the same function — and it is the only way to describe a diff
  without re-deriving the hash in SQL. `loadAssetContext` now names that object instead of building it
  inline, which also guarantees what gets recorded is exactly what was hashed.
- **The split button lives only in the asset library's detail panel.** `AssetDownloadButton` stays as it is
  in its four other call sites; a size menu on a kit-page card or in the delivery ceremony would be a
  decision at a moment she is not making one.
- **No "restore this version" button.** Putting an old file back would leave her kit saying one thing and
  her assets another. The way back to an old look is to put the colour back; the asset follows.

### What I did not do, and why

- **No retention job for superseded versions** — see FINDINGS.md. The brief said older versions stay
  downloadable "until the existing 30-day purge", but the only 30-day purge in the product is
  `cron/purge-deleted-kits`, which fires on a soft-deleted kit. On a live kit, superseded bytes now stay
  indefinitely. `superseded_at` is the column such a job would key off, and nothing reads it. Writing one
  is its own piece of work (an object removed under a live signed URL, a re-render racing the sweep), and
  widening the deleted-kits cron would make its documented contract wrong. **This is the one thing in
  Session 2b that is described in the brief and not built.**
- **No new lots.** LOT 5 is Session 3's. `direction_assets`, the reveal, and every content table were not
  read, called, or touched — the diff contains none of them.

### What the next session needs to know

- **LOT 4 is now closed.** Both cut items are in.
- **`lib/kit/render/variants.ts` is seeded to match `asset_catalog`, not the reverse.** Adding a width to
  the catalogue without a source there produces a menu entry that 404s at render time. Add both, together.
- **`app/__tests__/download-is-never-a-generation.test.ts` will fail any future code that puts
  `consume_generation_credit` on the delivery path.** If a lot genuinely needs to charge for something in
  `lib/kit`, that test is the conversation to have first — not the file to edit.
- **`asset_variant_path` is the only place a storage path is built.** Do not construct one in TypeScript.

---

## 2026-09-05 — Session 3, step 7A: what `direction_assets` already solved

Branch: `claude/post-purchase-v2`, both repos.

Read in full: `eklio-backend/supabase/migrations/20260901074421_direction_assets.sql` (355 lines) and the
palette-hash + reveal-read half of `20260901074458_brand_kit_reveal.sql`. **Nothing was called, extended,
wired or fixed.** Re-verified this session that no eklio-frontend file references
`direction_assets_claim`, `_mark_ready`, `_mark_failed` or `brand_kit_direction_palette_hash` outside the
generated `types/supabase.ts` — the grep returns nothing.

### How it claims a slot

`direction_assets_claim(brand_kit_id, direction_index, palette_hash, cost_estimate_cents, daily_cap_cents,
reclaim_after default interval '10 minutes')`. It upserts the slot row (`on conflict … do nothing` against
the unique `(brand_kit_id, direction_index, kind)`), then takes `select … for update` on it. **Every
decision happens under that one row lock**, which is what makes two concurrent invocations impossible to
both satisfy:

| state | outcome |
| --- | --- |
| `ready` + same `palette_hash` | `already_ready`, nothing reserved |
| `failed` + same `palette_hash` | `already_failed`, nothing reserved |
| `claimed`, `claimed_at` inside the window | `busy`, nothing reserved |
| `claimed`, `claimed_at` older than the window | `reclaimed` — **budget-neutral** |
| anything else | reserve, then `claimed` |

The claim token is `claimed_at` itself, stamped from `clock_timestamp()` (not `now()`, so two claims inside
one transaction still differ). `mark_ready`/`mark_failed` act only
`where status = 'claimed' and claimed_at = p_claim_token`, so an invocation that lost its claim to a
reclaim and then finishes writes zero rows and gets `{ok:false, reason:'stale_claim'}` — refused, never
believed, never a clobber.

**A claim that is never released is not collected by anything.** There is no sweeper. It simply becomes
reclaimable after `p_reclaim_after`, and the reclaimer inherits the original `reserved_cents` rather than
booking a second one. If no one ever calls again, the reservation stays booked — but against
`spend_date = current_date`, so it stops mattering when the date rolls over. It self-heals at midnight
rather than leaking permanently, which is a deliberate-looking consequence of keying the budget by day.

**One real edge case in that design.** `mark_ready`/`mark_failed` release against `claimed_at::date`, and a
reclaim re-stamps `claimed_at`. A claim booked just before midnight and reclaimed just after releases
against the *new* day's row: day 1's `reserved_cents` stays permanently inflated and day 2's would go
negative if `greatest(0, …)` did not clamp it. Small, self-healing, and worth not inheriting.

### How the daily cap is expressed and enforced

`direction_asset_daily_spend`, one row per `spend_date` (the date is the primary key), carrying
`reserved_cents` and `actual_cents`.

**The ceiling lives in neither a table nor a SQL constant — it is passed in per call** as
`p_daily_cap_cents`, alongside `p_cost_estimate_cents`. The migration says why in its own words: this
function "enforces a budget, it does not know one", because OpenAI's current price and the configured cap
live in eklio-frontend, which is the side that holds the key. Since nothing in eklio-frontend has ever
called it, **the cap is today a parameter with no caller — undefined in practice, not merely unused.**

Enforcement is one conditional UPDATE, which is the whole trick:

```sql
update public.direction_asset_daily_spend
   set reserved_cents = reserved_cents + p_cost_estimate_cents
 where spend_date = current_date
   and reserved_cents + p_cost_estimate_cents <= p_daily_cap_cents
returning true into v_reserved;
```

Check and increment are the same statement, so concurrent claims cannot each read an under-cap total and
then each add to it. Reserved is booked **at claim time** — in-flight spend counts against the budget the
moment it starts — and reconciled down at settle time; `actual_cents` only ever grows, and only by what a
real successful generation cost.

### What it records on refusal, failure, and moderation

- **Refusal: nothing.** `budget_exceeded`, `busy`, `already_ready` and `already_failed` all return a reason
  to the caller and change no state, increment no counter, and leave no timestamp. After the fact you
  cannot tell a kit that rendered a gradient because the cap was hit from one where nothing ever ran.
- **Failure: the fact, and nothing else.** `mark_failed` sets `status='failed'` and releases the
  reservation. No reason, no error text, no attempt count. Failure is terminal *for that palette hash*
  only — a regenerated direction with a different hash is a fresh, unbilled slot, which is how the schema
  avoids "permanently failed" outliving the input that caused it. Retry is explicitly the caller's job
  ("one retry on a transient error, before ever calling this").
- **Moderation: nothing at all.** There is no moderation column, no distinct status, no code. A repo-wide
  grep for "moderation" across every migration in eklio-backend returns zero hits. A content-policy refusal
  is indistinguishable from a timeout — both land as `failed`. (The marketing CLI
  `scripts/brand-shots/openai.ts` *does* separate `content_policy_violation` / `moderation_blocked` into a
  `ContentPolicyError`, but nothing carries that distinction into the database.)

That last one is the gap that matters most for LOT 5: this chantier forbids faces, people, hands and text in
any generated image, so a moderation refusal is a **prompt defect we need to see**, not a transient failure
to retry into.

### What `brand_images` should mirror

1. Upsert + `select … for update` as the single decision point, returning
   `{claimed, reason, image_id, claim_token}`.
2. `claimed_at` as an opaque claim token, with both settle functions conditioned on it and returning
   `{ok:false, reason:'stale_claim'}` instead of raising.
3. Reserve-at-claim / reconcile-at-settle against a per-day row, with the cap checked and applied in **one**
   conditional UPDATE.
4. Budget-neutral reclaim past a caller-supplied window.
5. Cost estimate and cap passed in by the caller — the database enforces a budget it does not know. This is
   what keeps OpenAI's price in exactly one place, next to the key.
6. `status not null default 'pending'` and the permissive-default discipline: only `status='ready'` **and** a
   fingerprint matching the kit's current one is ever exposed; every other state is silently the gradient.
7. `service_role`-only EXECUTE on the write functions, a defense-in-depth owner SELECT policy, and no
   INSERT/UPDATE policy for `authenticated` at all.

### What is specific to the reveal and must not be copied

1. `direction_index between 0 and 2` and `kind = 'ambiance'`. `brand_images` is keyed by **slot** on a paid
   kit, not by a free direction index.
2. `palette_hash` and `brand_kit_direction_palette_hash`. That md5 over five palette roles belongs to the
   reveal and stays there. `image_fingerprint` is a different function over a deliberately different input,
   and the rest of this repo fingerprints with SHA-256, not md5.
3. The free/pre-purchase framing. `brand_images` sits behind `brand_kit_entitled`, and must additionally
   separate **initial slots** (part of what she bought, no credit) from **regeneration** (a credit checked
   before the call and not charged on failure) — a distinction the reveal has no reason to make.
4. Terminal failure with no reason. Add a reason, and make moderation its own outcome.
5. Deriving the spend row from `claimed_at::date`. Store the reservation's own `spend_date` on the row, so a
   reclaim across midnight releases against the row it actually booked.
6. `url` as a stored column. `direction_assets` persists both `url` and `storage_path`; this chantier's rule
   is signed URLs only, never persisted. Store the path.

### ⚠ The product now has two image systems, one of them dormant

`direction_assets` (free, pre-purchase, one ambiance image per direction, fully built, wired into
`brand_kit_reveal_get`, **never called**) and `brand_images` (paid, post-purchase, seven slots, built this
session). They will share a pattern and share nothing else — no table, no function, no hash. Whether they
should eventually be unified into one image subsystem is a **product decision for a later chantier, not
this session's**, and it is deliberately not taken here. Anyone taking it should start from this section
and from FINDINGS.md's `direction_assets` entry.

### Cut from this chantier

**The ornament is cut.** Logged here so it is not silently forgotten: it is not built, not scaffolded, and
not stubbed, and no slot in `brand_images` is reserved for it.

---

## 2026-09-05 — Session 3, step 7C: LOT 5.1–5.5, one slot end to end

Branch: `claude/post-purchase-v2`, both repos. Two commits: `Step 7c (backend)`, `Step 7c (frontend)`.

**Nothing was generated. Nothing was spent.** `api.openai.com` is unreachable from this session, so the one
real call is a command for a human to run — documented at the bottom of this entry. Everything else is
proved by tests against a stubbed client: 66 files, 1180 tests, green.

### What was built

| | |
| --- | --- |
| `brand_images` | seven slots per paid kit, one row each, claim/settle RPCs |
| `brand_image_daily_spend` | the ceiling, one row per day |
| `lib/images/config.ts` | the prompt pack — model, slots, price table, ceiling |
| `lib/images/fingerprint.ts` | `computeImageFingerprint`, deliberately narrower |
| `lib/images/prompt.ts` | the derived prompt, built from closed vocabularies |
| `lib/images/client.ts` | the injectable model client and its error classification |
| `lib/images/generate.ts` | claim → prompt → model → upload → settle |
| `app/api/brand-kits/[id]/images/[slot]` | POST, Node runtime, the therapist's own session |
| `app/api/brand-kits/[id]/images` | GET, every slot with its state |
| `scripts/brand-image/generate-one.ts` | the one command, guarded to one slot |

### The three things asked for up front, and where each one lives

1. **The model client is injectable.** `generateBrandImage` takes an `ImageModelClient`.
   `lib/images/__tests__/generate.test.ts` runs eighteen cases — claim refusals, one retry and only one, a
   moderation that is never retried, an upload failure that still settles the reservation, a lost claim,
   credits before and after — all against a stub, all for nothing. `openAiImageClientFromEnv()` is
   constructed in exactly two places: the route handler and the script.
2. **The placeholder is the seam.** `<PhotoSlot>` already took an optional `src`; the kit header now renders
   it as a full-bleed band and the page signs a URL server-side and passes it. No skeleton, no second
   loading pattern, no rewrite of the surface — the gradient is still exactly what a kit with no photograph
   draws. ⚠ **The premise needed correcting: `<PhotoSlot>` had zero call sites.** Session 2 built and tested
   the component but never rendered it anywhere. See FINDINGS.md.
3. **`computeAssetFingerprint` is byte-identical.** Two tests hold it there: one greps
   `lib/kit/asset-fingerprint.ts` for any mention of photography, one freezes its output for a fixed input
   at `dad3d59478ded36a9619deaf4f4f7ccab94250baa399bfcaf7783e577342b402`. `computeImageFingerprint` hashes
   direction (id, name, tone keywords), the six colour roles, specialty, city, state, and
   `IMAGE_PROMPT_VERSION` — and PROJECTS those fields explicitly rather than spreading its input, so a
   caller handing over a wider object cannot silently widen the hash. Eleven tests move each hashed field
   and assert it shifts; six add copy fields and assert it does not.

### The four departures from `direction_assets`, all tested

Step 7A named two flaws and the brief added the fix for both. All four departures are in
`supabase/tests/20260905194933_brand_images.test.sql`:

1. **A refusal is recorded.** The cap writes `status='refused_cap'` with a `failure_reason` on the row. A
   gradient is always explainable, which in `direction_assets` it is not.
2. **Moderation is terminal; a transient failure is not.** `moderated` is never reclaimed — retrying a
   refused prompt spends money to be refused again. `failed` (a timeout, a 5xx) and `refused_cap` stay
   retryable, because neither means the prompt is wrong and neither should cost her a slot.
3. **The reservation remembers its own day** (`reserved_on`), instead of deriving it from
   `claimed_at::date`, which released against the wrong day when a claim was reclaimed across midnight.
4. **The caller is `authenticated`, not `service_role`** — this product forbids `service_role` in a
   user-facing route. That makes the borrowed "caller supplies the cap" pattern unsafe on its own, so the
   caller-supplied cap and estimate are clamped against `app_settings` bounds it can only tighten. A forged
   cap of 999999999 and a zeroed estimate are both tested and both refused. The frontend still supplies the
   real numbers, keeping OpenAI's price in one place next to the key.

### Cost, as configured

Price table in `lib/images/config.ts`, retrieved 2026-09-05, keyed on (model, quality, size). Cents are
rounded **up**: this number is both what is reserved against the ceiling and what is recorded as spend, and
a budget that under-counts is not a budget.

| slot | size | quality | USD | recorded |
| --- | --- | --- | --- | --- |
| hero | 1536x1024 | high | $0.250 | 25¢ |
| ambient_a | 1024x1536 | medium | $0.063 | 7¢ |
| ambient_b | 1024x1536 | medium | $0.063 | 7¢ |
| post_bg_1 | 1024x1024 | medium | $0.042 | 5¢ |
| post_bg_2 | 1024x1024 | medium | $0.042 | 5¢ |
| post_bg_3 | 1024x1024 | medium | $0.042 | 5¢ |
| texture | 1024x1024 | medium | $0.042 | 5¢ |
| **per kit** | | | **$0.544** | **59¢** |

**100 kits: $54.40 actual, $59.00 as recorded.** The 8% gap is the rounding, always in the safe direction.
A test asserts every slot resolves to a price and that an unpriced combination THROWS rather than costing
nothing — the failure mode that would let an image slip under the ceiling without filling it.

`cost_cents` never comes from the response's `usage` block. `usage` is recorded and never treated as money.

### Six of seven slots are off

`IMAGE_SLOTS[slot].enabled` is `true` for `hero` alone. A disabled slot is refused before a claim is made,
before a client is constructed, and before anything is reserved — so "do not generate the other six" is a
property of the code, not of anyone's discipline. A test asserts exactly one slot is enabled. Turning the
others on is a deliberate edit in a later session.

### Decisions taken without asking

- **The kill switch lives in `app_settings`, not in an environment variable.** A switch only the caller
  honours is not a switch: the RPC is reachable directly, so the switch has to be where the RPC reads it.
  Off, missing, or unparseable all read as off. Flipping it is a row update, not a deploy.
- **Images go in the existing `brand-assets` bucket** under `{kit}/images/{fingerprint}/{slot}.webp`, so the
  existing storage policies authorize them unchanged — owned AND entitled, via the first path segment. A
  new bucket would have meant a second copy of that policy. The bucket's mime allowlist gains `image/webp`;
  the deterministic renders keep their SVG/PNG paths untouched.
- **The specialty label and the city never reach the model.** They go through closed lookup tables to a
  setting register and a light register. A specialty label is clinical language about her clients, and a
  named city invites a recognisable landmark; neither belongs in a photograph of an empty room. This is
  where "no free-text prompt in the paid space" is actually kept rather than merely stated, and it is why
  her three tone keywords — the only part of the prompt not written in that file — pass a narrow character
  gate rather than being trusted.
- **A moved fingerprint is not a regeneration.** She spends a credit only when she asks for a different
  image of a slot she already has at the current fingerprint. Changing a colour makes a new photograph of a
  changed brand, bounded by the daily ceiling rather than by her allowance.
- **The credit is checked before the call and consumed after the record.** There is no post-purchase refund
  primitive, so this is the only shape that satisfies both halves of the brief. The window is real and
  bounded; see FINDINGS.md.

### Known, logged, not fixed

- **An image regeneration spends a DIRECTION regeneration.** `consume_generation_credit` is the only credit
  primitive, and its meter is the directions ladder. Rather than invent a second meter, Lot 5 spends that
  one. FINDINGS.md carries the full note; the decision is yours.
- **`city` is hashed but not prompted.** A move within the same state invalidates an image whose prompt
  would be identical. That is the specified input list, kept as specified; the alternative — silently
  dropping an input you named — is worse. It costs one regeneration in a rare case.
- **The ornament is cut**, and was cut in step 7A. Nothing was built, scaffolded or stubbed for it, and no
  slot is reserved for it.

### 2026-09-06 — the art direction revision (config only)

The first real generation validated the pipeline and failed the art direction. Cost, fingerprint, webp,
storage path: all correct. The photograph: four defects, all of them mine, all of them in the prompt pack.
**No schema change, no route change, no migration.** `lib/images/config.ts` and `lib/images/prompt.ts`, plus
one flag on the script.

| # | defect | the line that caused it | the fix |
| --- | --- | --- | --- |
| 1 | whole frame sunk in brown, underexposed, nowhere near her warm off-white `paper` | "colour grade the image toward this palette" — it TINTED instead of PLACING | that instruction is gone; the palette now lives in objects and the rule ends "Do not tint the image." |
| 2 | light contradicted itself — grey overcast window under a warm grade, no direction, no cast shadow | a per-state light register fighting the grade | one light for every image: warm late-afternoon, upper left, hard enough to cast a soft-edged shadow |
| 3 | a lone empty armchair — the therapy category's most-used stock image, and it reads melancholy | `DEFAULT_SETTING`, which every unmapped specialty fell through to | furniture is never the subject; "no empty armchairs" and "no couches" are explicit exclusions |
| 4 | a European room: panel radiator, tilt-turn window | nothing said otherwise | "An American interior: no wall-mounted panel radiators, no tilt-turn windows, no European fittings" |

The master art direction, the palette rule and the hero brief are the owner's words. **One positional
change, no editorial one:** the master's own exclusion sentence is held in its own constant so it can be
assembled LAST — after the slot brief and the palette — where a long instruction is least likely to be
dropped. Every word survives, in its own order.

**The left-third rule is untouched, word for word.** It is the one part of the pack that worked first time,
and a test asserts the exact sentence still reaches the model.

Four tests now hold the four defects so a future session cannot reintroduce them by rewriting the pack:
no grading language, one directional light with no regional register left to contradict it, no lone
armchair and the stock vocabulary excluded, and the American interior stated. `PROMPT_EXCLUSIONS` is now
DERIVED from the sentence the model actually receives, so the guard and the prompt cannot drift apart.

`SlotConfig.subject` and `.composition` collapsed into one `brief`, because the hero brief is a single
piece of prose and splitting it would have reordered the owner's words. The six disabled slots carry their
old two sentences joined; **rewriting them against the new master is step 8's, not this revision's.**

⚠ `IMAGE_PROMPT_VERSION` is bumped 1 → 2. The prompt's output changed, so every stored photograph is now
correctly stale and the gradient returns until something regenerates.

#### Iterating cheaply

`--quality` renders at something other than the slot's configured quality. **For art direction only** — no
route reads it, and `high` is still what ships.

```
npx tsx scripts/brand-image/generate-one.ts --kit <brand_kit_id> --quality medium
```

1536x1024 at `medium` is 6.3c against 25c at `high`, and it is more than enough to judge exposure, light
direction and colour placement. Three medium tries cost less than one high one, and a test says so.

The reserved AND recorded cost follow the **effective** quality — a medium try books 7c and records 7c. A
ceiling fed the wrong price is not a ceiling.

⚠ **A second try at the same fingerprint returns `already_ready`.** Quality is deliberately not part of
`image_fingerprint` — it is a spend decision, not a brand one — so a successful try occupies the slot. To
iterate again on the same brand, clear the row first:

```sql
delete from brand_images where brand_kit_id = '<brand_kit_id>' and slot = 'hero';
```

That is the intended friction, not a bug: outside this art-direction loop, refusing to re-spend on an image
that already exists is exactly what should happen.

### 2026-09-06 — three rulings: the object register, the invariant, and what left the hash

Config plus the fingerprint's inputs. No migration, no route change.

#### Ruling 1 — specialty is back, as an object register

Not for variety's sake: a brand studio whose seven photographs are identical for every client is visibly a
template, and the specialty is the one honest axis of variation the brief already asks about.

`SETTING_BY_SPECIALTY` is gone. `lib/images/specialties.ts` carries
`OBJECT_REGISTER_BY_SPECIALTY` — twelve still lifes, **no furniture as subject, never a chair of any
kind**, and a neutral fallback that is itself a still life. The old map was six-tenths chairs and its
fallback WAS the armchair; that is the rule made structural rather than remembered.

**The coverage bug is fixed at its cause.** The old map was keyed on labels written from imagination —
`couples therapy`, `eating disorders`, `substance use`, none of which the brief can emit — and was missing
six real specialties. It is now keyed on the **catalogue id** (`self_esteem`, not `Self-esteem`: stable,
lowercase, no punctuation to miss on), and `BRIEF_SPECIALTY_IDS` is the real twelve, taken from
`public.specialties`. Three tests hold it: every brief specialty resolves to a mapped register, the map
contains no key the brief cannot emit, and — whenever eklio-backend is checked out beside this repo — the
list is parsed straight out of `20260827100000_catalog_reference_data.sql` and must match. In CI without
the sibling repo that last one skips; the first two always run.

**Never clinical.** No pill bottles, no scales, no food, no bottles, no journals opened to writing,
nothing that depicts a condition — in the registers by construction, in the exclusion sentence by name,
and asserted over every register value.

#### Ruling 2 — `city` and `state` are out of the prompt and out of the hash

The regional light register was the thing fighting the master's single directional light, and
"An American interior" already covers what it was for. `city` never reached the prompt at all.

#### Ruling 3 — the invariant, as a test

> A field belongs in `image_fingerprint` if and only if it reaches the prompt.

It is stated above `computeImageFingerprint`, both failure modes named: hashed-but-not-prompted bills a
regeneration for a byte-identical photograph; prompted-but-not-hashed serves a stale one forever. The test
moves each field once and asserts BOTH halves, plus a guard that the enumeration covers every leaf of the
type — so a new field cannot be added without the test noticing first.

⚠ **Applying the invariant removed three more fields than the ruling named.** They were hashed and never
reached the prompt:

| field | why it went |
| --- | --- |
| `direction.id` | an identifier, never prose — no renderer ever sent it |
| `direction.name` | "Quiet Clay" never reached the model, and a test asserts it still does not |
| `palette.accent` | the palette rule places five roles; the owner's verbatim wording does not include accent |

`ImageFingerprintInput` is now `toneKeywords`, five palette roles, and `specialty`. If accent should
matter to a photograph, the fix is to place it in the palette rule — not to re-add it to the hash.

`IMAGE_PROMPT_VERSION` 2 → 3.

#### Two seam decisions, flagged rather than buried

Where the owner's hero brief meets the owner's registers, both legibility rather than direction:

- the join is an em dash, not the original colon, because a register can carry its own colon
  ("a mirror-free vanity corner: a ceramic dish, …") and two in one sentence read as a stutter;
- the original trailing clause ("with the shadow of the branches falling across the wall behind") named
  branches, which only the neutral register has. Dropped — the master already asks for light "directional
  enough to cast a soft-edged shadow across a wall" and for "believable contact shadows".

⚠ **One register contradicts the master's fixed light.** `anxiety` ends "…, early light", against the
master's "Warm late-afternoon daylight entering from the upper left". Used as written, per the
instruction, and flagged here: it is the same shape as defect 2, on one specialty out of twelve.
`self_esteem`'s "warm light across the wall" agrees with the master and is fine.

### 2026-09-06 — the palette trace, and two more rulings

#### The palette question: the code was right, my report was not

The owner spotted that the prompt I printed carried six different hexes from the ones the first real
generation carried, for the same kit. That is exactly the failure shape worth stopping for — a photograph
in the wrong colours still looks warm and plausible, so nobody catches it by eye.

**Traced from the database row to the string. `buildImagePrompt` reads the kit.**

| source | primary | secondary | accent | paper | light | dark |
| --- | --- | --- | --- | --- | --- | --- |
| `site_specs` for the kit | #B4674A | #C08A3E | #6E3320 | #FAF6EE | #F4EEE3 | #2B2A27 |
| first real generation | #B4674A | #C08A3E | #6E3320 | #FAF6EE | #F4EEE3 | #2B2A27 |
| what I printed | #B4653F | #2E4E8A | — | #FAF7F2 | #E8E2D9 | #2B2724 |

The path is `loadImageContext` → `siteSpecGet` → `siteSpec.data.preview.tokens` → `input.palette` → the
palette rule. `grep '#[0-9A-Fa-f]{6}' lib/images/*.ts` returns **nothing**: there is no hardcoded hex
anywhere in the image code.

What I printed came from a throwaway harness in which I hardcoded the values from
`lib/images/__tests__/fingerprint.test.ts` instead of loading the kit. **A reporting defect, and mine.**
One correction to the owner's reading: `#B4653F` is not the marketing pack's terracotta — `scripts/brand-shots/`
contains neither it nor `#2E4E8A`. It is this repo's own test-fixture value; the canonical sample terracotta
is `#B4674A`, which is what the kit actually uses.

**The fear was right even though the diagnosis was not**, so `lib/images/__tests__/palette-wiring.test.ts`
now exists. It asserts against the kit's REAL values, captured from `site_specs` with the query to
re-derive them, and its load-bearing clause is not "the prompt contains six hexes" but:

- every role of the real kit appears, **and no other hex appears at all** — the clause that catches a
  constant, a default or a fixture leaking into the path;
- each role sits in ITS OWN sentence, so a swapped mapping (secondary ← accent) fails rather than passing
  with six correct-looking values;
- the five fixture hexes are named and asserted absent;
- `loadImageContext`, given that same real `site_specs` row, returns the palette unchanged.

The shared fixtures deliberately keep values the real kit does NOT have. A fixture equal to production data
would let a hardcoded constant pass every test.

#### Ruling — accent goes back in, via the rule

The palette rule gains: `{accent} on one small detail only — a book spine, a glaze, a stem — never a
surface.` In the six-role system accent is "small marks only"; that is its photographic equivalent. Because
it now reaches the prompt, **the invariant returns it to the hash on its own** — which is the invariant
working in the useful direction: the fix for a hashed-but-unprompted field is to decide whether the prompt
should read it. `direction.id` and `direction.name` stay out, as ruled.

#### Ruling — a register never describes light

The master owns the light, and every register that also names light is defect 2 in miniature. Five registers
carried that vocabulary and have had it removed:

| register | removed |
| --- | --- |
| `anxiety` | "early light" |
| `trauma` | "sunlit" |
| `depression` | "bright… never dim" |
| `self_esteem` | "warm light across the wall" |
| `parenting` | "never bright primary plastic" → "never primary-coloured plastic" |

Two of those AGREED with the master and went anyway: a rule that holds only where it is convenient is not a
rule. `parenting` is the one where the banned word meant something else — "bright" described the PLASTIC,
not the room — and the reword keeps that meaning exactly; a test cannot tell the two senses apart, and a
carve-out for "but I meant it differently" is the carve-out the next author will also claim.

The test scans **registers only**, with a canary proving the vocabulary list actually fires. The hero
brief's "plain sunlit wall" is composition, not a register, and stays word for word.

`IMAGE_PROMPT_VERSION` 3 → 4.

### 2026-09-06 — secondary gets its own job back

The owner's own correction to the palette rule. The first wording read
"{secondary} as one small accent", which put secondary and accent in competition for the same job while
secondary's real one went unsaid. In the six-role system secondary is "supporting headings and surfaces"
and accent is "small marks only", so photographically they are a MATERIAL and ONE SMALL OBJECT — different
amounts of the frame, which is the whole point of having six roles.

| role | asks for |
| --- | --- |
| primary | once, on a single soft furnishing or ceramic |
| **secondary** | **a supporting material presence — a wood tone, a woven textile, a second ceramic — never the dominant surface** |
| accent | on one small detail only — a book spine, a glaze, a stem — never a surface |
| paper + light_neutral | the wall and the daylight, dominating the frame |
| dark_neutral | only in shadow |

The accent clause is unchanged. A test now asserts the two clauses ask for different things and that
"as one small accent" appears nowhere.

`IMAGE_PROMPT_VERSION` 4 → 5.

#### A standing rule for the rest of this chantier

**Any example printed for the owner comes from the production path, or is labelled a fixture in the same
breath.** Earned the hard way: a direction was nearly judged, and money nearly spent, on a prompt printed
from a throwaway harness carrying test-fixture colours.

The print harness now goes through `loadImageContext` and `buildImagePrompt` — the production loader and
the production builder — with only the Supabase round trip stubbed, and stubbed with the row read live
from `site_specs` immediately before printing. It echoes the palette and specialty as they come OUT of
`loadImageContext`, so the mapping step that could mis-wire a role is visible in the output rather than
assumed.

### 2026-09-06 — step 8: LOT 5.6 and 5.7

#### ⚠ The stored hero for kit `45de0dac…` is a `medium` test render

Not the `high` the config specifies for production. It was generated during the art-direction loop with
`--quality medium` (6.3c against 25c) to judge exposure, light direction and colour placement cheaply. It is
correctly stale-able — `IMAGE_PROMPT_VERSION` has moved since — and the next production render at `high`
will replace it. **If it looks softer than it should, that is why.**

#### 5.6 — the six briefs, rewritten before anything was enabled

Not "enable": the six still carried their pre-master sentences joined with a full stop. Every one is
rewritten, and the rule is the registers' rule — **a brief names composition and objects only.** The master
owns the light, the material family, the geography and the exclusions, and a brief that reopens one of them
is a second voice arguing with the first.

**Composition follows where the text goes**, which is the only reason the seven differ:

| slot | text sits | so the brief |
| --- | --- | --- |
| hero | over the left third | leaves the left third empty — unchanged, word for word |
| ambient_a, ambient_b | beside it, never under | reserves nothing and may be fuller |
| post_bg_1/2/3 | over the upper two thirds, behind a scrim | keeps the TOP calm; object at or below the lower third |
| texture | nowhere | a ground: no object, no horizon, no room |

`ambient_a` is a closer, fuller frame of the same object register as the hero — deliberately, because a
real editorial shoot photographs one set-up more than once, and "one shoot, not seven stock photos" is the
brief. `ambient_b` is a different corner. The three post backgrounds are three DISTINCT object groups, and
a test asserts their subject clauses are not equal.

One deliberate omission from the owner's own wording: `texture` read "folded or draped material in raking
light". The light is dropped — the master already rakes it, and this is the same call the owner made on
`anxiety`'s "early light". `hero` is the ONE brief exempt from the vocabulary test, by name and with its
reason recorded: "plain sunlit wall" is the owner's sentence, ruled untouchable twice and since ratified by
a photograph they approved. That is an exemption they granted, not one found for convenience — the exact
difference from `parenting`'s "bright", which was rewritten.

All seven are now `enabled`. `IMAGE_PROMPT_VERSION` 5 → 6.

#### 5.7 — the composition layer, where the scrim is solved rather than chosen

**The opacity is computed from the measured mean luminance of the region the text actually occupies.** Not a
fixed value: a fixed opacity passes on an average photograph and fails at both ends — the text disappears on
a bright frame, and the scrim buries a photograph she paid for on a dark one.

`lib/kit/render/luminance.ts` decodes the stored webp with `sharp`, extracts the text region (fractions of
the frame, so it survives any output size), downsamples, **linearizes** each pixel and averages. `stats()`
would have been one call and would have averaged GAMMA-ENCODED channels — the mean of encoded values is not
the encoded mean luminance, and it overstates dark regions badly. A test pins `#808080` at ≈0.216, not 0.5.

The opacity then climbs in 1% steps until the headline clears **4.5:1**, and the ratio actually achieved is
reported in the spec line. A climb rather than a bisection because blending is not monotonic for every
palette: a `dark_neutral` lighter than the photograph makes raising the scrim *reduce* contrast, and that
case is reported honestly (`meetsTarget: false`) rather than pretended past.

**Tested against two deliberately extreme fixtures**, `#FAFAFA` and `#0A0A0A`, because a test on an
average-luminance image proves nothing and would pass while the feature is broken. The bright frame needs
>60% scrim, the dark frame <15%, and a test asserts the two opacities are **not equal** — which is exactly
what a fixed value would make them.

The four variations are four arrangements of two inputs: `full` (photo + scrim + headline + wordmark),
`text` (colour ground + headline + wordmark), `photo` (photo + wordmark), `logo` (colour ground + monogram).
`full` reports a solved ratio, `text` a computed one, and the two headline-free variations report **nothing**
— a contrast ratio for a mark nobody reads as type would be a number reported about nothing. `text` also
CHOOSES its ink, whichever of paper and dark_neutral reads better on her primary, the way `cta_ink` already
works elsewhere.

**The headline comes from satori. Ever, only, always.** A test greps this module for any image-client import
and fails if one appears.

Both modules live in `lib/kit/render/`, not `lib/images/`, because that is where every module touching a
native binary belongs — and `sharp` was added to `renderer-not-in-client-bundle.test.ts`'s native list,
which had been silent about it. `__tests__` is now skipped by that scan: a test file is never bundled, and a
fixture that builds a webp is a legitimate direct import.

`sharp` is now an explicit dependency rather than a transitive hoist from `next`. Without a decoder,
"measured luminance" is not implementable.

#### Regeneration — four buttons, a money budget, and the meter finally separated

`plans.image_budget_cents` (starter 100c, practice 250c, signature 500c), reserved before the call in one
conditional UPDATE and **released on failure** — she is never charged for a photograph she did not receive.

**It no longer touches `consume_generation_credit`.** FINDINGS.md flagged that the two meters were
conflated; an image regeneration was spending a DIRECTION regeneration, which is priced completely
differently. Two tests hold the separation, one in SQL and one against the stub.

A **money** budget, not a count, because a hero is 25c and a texture 5c: `regenerationsRemaining()` divides
by the price of the slot she is looking at, so "4 left" on the hero and "20 left" on the texture are both
true at once.

Four bounded nudges — Lighter, Warmer, Fewer objects, Different framing — each appending one closed clause.
**No free-text field anywhere in the paid space**; a free-text prompt would be a channel from her keyboard
to an external model in a product that has spent this whole chantier keeping her words out of one. The
clauses name no light either, same rule, same test. A variation is deliberately **not** hashed: it asks for
a different photograph of the same brand, and hashing it would mint a permanent new identity for the slot
every time she nudged it.

#### Costs for the full-kit run

At `--quality medium`: hero 7c + ambient ×2 at 7c + squares ×4 at 5c = **41c recorded, $0.357 actual**.
At production quality the same kit is 59c recorded, $0.544 actual.

`generate-one.ts` still refuses more than one slot per run, deliberately — seven invocations, one per slot.

### 2026-09-06 — the three squares, and the texture that rendered a room

Bounded to the square briefs. The master, the palette rule, the registers, the hero and the ambients are
untouched — the set already reads as one shoot, and that test passes.

#### `texture` DID generate

Answering the question directly, from `brand_images`: `status = ready`, one attempt, 98,816 bytes, no
failure reason, same fingerprint as the other six. It was neither refused nor failed. **It rendered a room
while its brief said "no room"** — so per the conditional instruction it gets the same treatment as the
three squares. That is why four briefs changed here, not three.

#### Two corrections

**1. Three angles on one set-up became three subjects.** All three squares had rendered seating on the
left and a side table on the right with a vase of dried grasses — the hero's set-up, three times. On a grid
that reads as a template. Each now names its own subject and ends "Nothing else in frame".

Naming different subjects was **not enough on its own**, so `SlotConfig` gains `slotExclusions`, appended
after the master's exclusion sentence: *"In this frame specifically: no seating of any kind, no cushion, no
side table, no dried grasses. Those belong to other photographs in this set."* The distinction is worth
keeping straight — the master's list is what NO Eklio photograph may contain; a slot exclusion is what
belongs to a DIFFERENT slot in the same set.

**2. "At or below the lower third" was an intention; it is now a geometry.** It produced objects reaching
the middle of the frame. Replaced by three overlapping statements that leave nothing to negotiate: the
subject occupies the **bottom quarter** and is cropped by the bottom edge; **nothing rises above the
horizontal midline**; the **entire upper half** is plain wall or soft-focus depth. A test asserts all three
are present and that the old phrasing is gone.

`texture` gets the same shape: the cloth IS the frame, reaching every edge and continuing past all four,
plus a slot exclusion refusing room, wall, floor, ceiling, furniture, objects and horizon by name.

`IMAGE_PROMPT_VERSION` 6 → 7.

#### ⚠ THE BUMP INVALIDATES ALL SEVEN, NOT FOUR

`IMAGE_PROMPT_VERSION` is part of the ONE per-kit fingerprint, so bumping it makes every slot stale, not
only the ones whose brief changed. After this bump the hero and the two approved ambients stop being
`current` and the kit renders gradients for them until they are re-run. Re-running the three approved
slots at `medium` is 7c + 7c + 7c = **21c** on top of the four being fixed (5+5+5+5 = 20c).

The cost consequence above stands and is accepted. The structural fix was proposed and **declined** — see
the deferred decision below, which is the ruling on it.

#### DEFERRED DECISION — per-slot image fingerprint

> Per-slot image fingerprint — deferred by the owner on 5 September. Today one per-kit fingerprint means
> any prompt edit invalidates all seven slots. The proposed fix was to hash the exact prompt string plus
> model and size, which makes invalidation exact per slot and removes IMAGE_PROMPT_VERSION entirely. Not
> built: it reshapes get_brand_images and every caller, and at current volume the waste is cents. Revisit
> when the kit count makes a full sweep expensive.

**To sessions 4 and 5: this is a decision that has already been taken, not an open finding.** Do not start
this change on your own. No prompt hashing, no reshaping of `computeImageFingerprint`, no touching
`get_brand_images`. `IMAGE_PROMPT_VERSION` stays at 7 and stays the invalidation lever. The condition for
revisiting it is named in the ruling — kit count, not annoyance — and revisiting is the owner's call.

### 2026-09-06 — Session 3 closed: two observations from the delivered set

Both are the owner's, from looking at the seven photographs he actually generated. Both are **accepted as
they stand** — neither is a defect to fix, and neither is an invitation for a later session to go back into
`lib/images`.

#### A named `slotExclusion` is ADVISORY, not enforced

`post_bg_2` rendered the terracotta cushion that its own exclusion forbade **by name**. The mechanism added
in `9d68caa` reduces the odds; it does not guarantee absence.

**The rule a future session must not get wrong:** naming a thing in an exclusion is not a constraint the
system can hold you to. Only the master's hard constraints — no people, no faces, no hands, no text — held
reliably across every generation made today. Anything built on top of "the exclusion says it will not be
there" is built on sand. If absence ever has to be guaranteed, it has to be guaranteed by cropping,
compositing or review, not by a sentence in a prompt.

#### `texture` renders entirely in the primary colour

The palette rule says `paper` and `light_neutral` are the wall and the daylight and dominate the frame.
`texture` does not obey it: the whole frame is `primary`. **Accepted, because it is a ground rather than a
scene** — a full-bleed surface behind type is a different job from a room with a subject in it, and the
rule was written for the room.

**The consequence for whoever puts type over it: the ink must be light.** A dark headline on a saturated
primary ground will not clear 4.5:1. `solveScrimOpacity` in `lib/kit/render/luminance.ts` already measures
rather than assumes, and it reports `meetsTarget: false` honestly rather than pretending — that is the
mechanism to trust here, not an eyeballed choice of ink.

### FIRST, A SESSION TO RUN IT AS

`generate-one.ts` runs every RPC as the therapist herself, because
`brand_kit_entitled()` and the storage policies are the security boundary and a `service_role` run would
prove nothing about either. That means it needs a real session — and nothing in the repo produced one, which
made the command below unrunnable as documented. Digging tokens out of browser cookies by hand is not a
procedure to ask anyone to follow.

```
npx tsx scripts/brand-image/session-token.ts --email her@example.com
```

It prompts for the password (not echoed, not even as bullets — the length is information too) and prints
exactly three lines on **stdout**:

```
# access token expires 2026-09-05T22:11:40.000Z (in 60 minutes)
EKLIO_SESSION_ACCESS_TOKEN=eyJhbGciOi...
EKLIO_SESSION_REFRESH_TOKEN=v1.Mr8k...
```

Paste all three into `.env.local`. The `#` line is a comment the file's own reader skips, so **the expiry
travels with the tokens it describes** — you can always see how long you have without re-running anything.
The confirmation and the prompts go to stderr, so `| pbcopy` gives you exactly what belongs in the file.

`--password` exists for a non-interactive run, but the prompt is the default because argv lands in shell
history. It **never writes `.env.local` itself** — a script that edits the file holding your API key is a
script you have to trust twice. The password is never printed, echoed or logged, and a failed sign-in says
only that it failed, never which half was wrong.

It needs `NEXT_PUBLIC_SUPABASE_URL` and the publishable key, nothing else. Access tokens are short-lived
(an hour by default); when `generate-one.ts` reports it cannot restore the session, run this again.

⚠ **Both scripts refuse a `service_role` key by CONTENT, not by variable name** — `sb_secret_…` prefixes
and JWTs whose `role` claim is `service_role` are both caught, because a secret key pasted into a variable
called `NEXT_PUBLIC_…` is exactly the mistake worth catching and exactly the one a name check misses. A key
of an unrecognised shape passes: the refusal targets a known error, and blocking everything unfamiliar
would break the procedure the day Supabase changes format without having protected anything. Five tests in
`scripts/brand-image/__tests__/shared.test.ts` hold that behaviour.

(`generate-one.ts`'s header claimed this refusal from the moment it was written; until this entry it was
only true by omission — the script never read a `service_role` variable, but would have used one pasted
into the publishable slot. `scripts/brand-image/shared.ts` now makes the claim real for both.)

### THE ONE COMMAND

Run on a machine that can reach `api.openai.com`. It calls the same `generateBrandImage` the route handler
calls — same claim, same ceiling, same price table, same storage path. Not the marketing CLI.

```
npx tsx scripts/brand-image/generate-one.ts --kit <brand_kit_id> --slot hero
```

It needs, in `.env.local` at the repo root (already covered by `.gitignore`) or in the environment:

```
OPENAI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EKLIO_SESSION_ACCESS_TOKEN=...      # both from session-token.ts above, so
EKLIO_SESSION_REFRESH_TOKEN=...     # every RPC runs as SHE would run it
```

It deliberately refuses a `service_role` key. The point is to exercise the caller's own session:
`brand_kit_entitled()` and the storage policies are the security boundary, and a `service_role` run would
prove nothing about either.

**The guard:** one slot per run. `--all` is refused, a comma-separated `--slot` is refused, an unknown slot
is refused, and a slot that is not `enabled` in the prompt pack is refused — all before a client is
constructed. There is no batch mode and adding one is not a config change.

**A healthy run looks like this** (the fingerprint, path, byte size and prompt wording will differ):

```
  kit           7c9f2e40-....-............
  slot          hero
  size/quality  1536x1024 high
  fingerprint   4f1c8a...   (64 hex chars)
  price table   25 cents

  prompt
    A photograph for a therapy practice's brand. an empty, softly lit interior corner of a private
    consulting room. The room contains an uncluttered chair beside a window with a long, calm view.
    wide editorial photograph, the left third open and uncluttered so text can sit over it, shallow
    depth of field. Lighting: warm hazy afternoon light. Mood: calm, plain, warm. Colour grade the
    image toward this palette: #B4653F as the dominant hue, ... Strictly excluded: no people, no
    faces, no hands, no body parts, no text, no lettering, no numbers, no logos, no signage, no
    watermarks, no brand names.

  calling the image API once…

  DONE
    storage path  7c9f2e40-..../images/4f1c8a.../hero.webp
    byte size     412,880 bytes
    cost_cents    25   (recorded on brand_images)
    usage         {"input_tokens":...,"output_tokens":...}   (recorded only; never money)
```

Anything else is a refusal, and it prints the machine reason: `budget_exceeded`, `moderated`, `busy`,
`already_ready`, `disabled`, `slot_disabled`, `payment_required`. **`moderated` means the prompt is wrong**
— it is terminal, it is not retried, and it wants a person, not another run.

Afterwards the row is readable directly:

```sql
select slot, status, cost_cents, byte_size, storage_path, failure_reason
  from brand_images where brand_kit_id = '<brand_kit_id>';
select * from brand_image_daily_spend where spend_date = current_date;
```

`reserved_cents` should be back to 0 and `actual_cents` should be 25.

### What the next session needs to know

- **Step 8 was not started.** LOT 5.6 onward, the other six slots, and the ornament are all untouched.
- **`IMAGE_PROMPT_VERSION` is the invalidation lever.** Changing a word in `lib/images/prompt.ts` without
  bumping it leaves every stored photograph claiming to be current when it is not.
- **The price table has a retrieval date in its comment.** Re-verify it before trusting the 100-kit number
  again; OpenAI can change prices at any time, and nothing in this repo will notice.
