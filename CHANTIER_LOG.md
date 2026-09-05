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
