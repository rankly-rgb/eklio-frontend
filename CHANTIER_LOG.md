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
