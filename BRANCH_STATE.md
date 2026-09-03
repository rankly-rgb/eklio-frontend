# Branch State — 2026-09-02

Read-only audit. No merges, rebases, pushes, or deletions performed. `gh` is not available in this
session (GitHub MCP tools were used instead — same data, different transport, noted here as required).

Both repos: working tree clean, no staged changes, no stashes, on branch `claude/happy-maxwell-37v4v2`
(this session's designated branch), no detached HEAD, no mid-rebase state.

---

## 1. eklio-frontend

### Repo-level facts

- `git status`: clean. `git stash list`: empty.
- Current branch: `claude/happy-maxwell-37v4v2`. Its tip (`68a5933`) is byte-identical to
  `origin/claude/eklio-bootstrap-ukuxfu` and to `origin/claude/eklio-image-generation-tool-m9x3kh`.
  Zero local commits added yet — this session has not started work.
- **GitHub's default branch for this repo is `claude/eklio-bootstrap-ukuxfu`.**
- **`origin/main` does not exist in this repository.** `git ls-remote`/`git branch -r` list exactly
  7 branches, none named `main`:
  `claude/comp-access-grant-sk7rn6`, `claude/eklio-bootstrap-ukuxfu`, `claude/eklio-design-system-flow-zmf8rl`,
  `claude/eklio-fr-us-migration-53dnk1`, `claude/eklio-image-generation-tool-m9x3kh`,
  `claude/eklio-reveal-rebuild-28o625`, `claude/eklio-v1-priorities-ssmasp`.
  Every "ahead/behind main" comparison below is therefore made against
  **`claude/eklio-design-system-flow-zmf8rl`**, the only branch that functions as trunk (see §1.2) — this
  is a stand-in, not a real `main`, and Section 3's `git checkout main && git pull` will fail as written
  until a `main` branch is created (or the intent is redirected to a differently named trunk).

### 1.1 Ancestry graph (confirmed via `git merge-base --is-ancestor`)

```
claude/eklio-design-system-flow-zmf8rl (root 4293b4f5, 31 commits, "lot 3" … "lot 11.19")
  └─ [merge 8342e38: old c1dfe31-rooted lineage + design-system-flow + reveal steps 3/4]
       └─ claude/eklio-bootstrap-ukuxfu  ==  claude/eklio-image-generation-tool-m9x3kh   (both = 68a5933, identical tree)
            └─ claude/comp-access-grant-sk7rn6 (a46ae75 = bootstrap + 2 commits)
                 └─ claude/eklio-reveal-rebuild-28o625 (e7d5855 = bootstrap + same 2 commits, merged in via PR #14 and #15)

claude/eklio-fr-us-migration-53dnk1   — disjoint history, root c1dfe319, unrelated to design-system-flow (no common ancestor)
claude/eklio-v1-priorities-ssmasp     — disjoint history, root c1dfe319, unrelated to design-system-flow (no common ancestor)
```

`git branch -r --merged origin/claude/eklio-design-system-flow-zmf8rl` → only itself. Nothing is merged
back into it; everything else is built on top of it, never folded back in (there is no target to fold
into, absent `main`).

### 1.2 Branch-by-branch

**`claude/eklio-bootstrap-ukuxfu`** (repo's GitHub default branch; this session's tip matches it exactly)
- Not merged into design-system-flow-zmf8rl or anywhere else — no PR exists with this branch as head or base, in the full PR list (#1–#15).
- 20 commits ahead of `design-system-flow-zmf8rl`; diffstat 66 files, +6419/−189.
- Contains: the old pre-reconciliation lineage (incl. `099fccf Add brand-shots CLI for gpt-image-1 marketing images`), all of design-system-flow's trunk, Reveal ceremony steps 3/4 (`a687b39`, `2479aaa`), the full "How you work"/positioning lot (steps 2.1–2.7, USP gates), and `68a5933 Add "Edit your brief" to the home page`.
- Ahead of `design-system-flow-zmf8rl`, and neither ahead nor behind anything named `main` (doesn't exist). Still wanted: yes — it's the only branch carrying the merged reveal+how-you-work+positioning work; it is the practical trunk today.

**`claude/eklio-design-system-flow-zmf8rl`**
- **Touches design tokens, typography, and shared components directly**: `styles/tokens.css`,
  `lib/site/tokens.ts`, `components/site/typography-section.tsx` all live here.
- 31 commits of its own ("lot 3" brief clients → "lot 11.19" reconciliation), functions as the de facto
  application trunk — every other branch is built on top of it.
- **Collision verdict: yes, but ordering is moot.** It isn't a competing unmerged branch sitting beside
  the others waiting to "land first" — it already underlies all of them. The real risk for the coming
  brief's design-token layer is not merge order, it's that `styles/tokens.css` / `lib/site/tokens.ts`
  already exist and have consumers; new token work must extend/reconcile them, not create a second
  token system.

**`claude/eklio-reveal-rebuild-28o625`**
- **Touches the reveal/direction-selection screens**: PR #13 ("Reveal ceremony steps 3-4: full-screen
  shell, navigation, cascade, real CTA"), open since 2026-08-30, last updated 2026-09-02, base =
  `design-system-flow-zmf8rl`. Still open/unmerged.
- However its content *beyond* `bootstrap-ukuxfu` is minimal: diffing it against `bootstrap-ukuxfu`
  shows only the two `comp-access-grant-sk7rn6` commits (merged in twice, via PR #14 and PR #15 — both
  closed, both landed the same 2 commits, likely a duplicate/redundant merge). The reveal-steps-3/4 work
  itself is already present in `bootstrap-ukuxfu` via the earlier merge commit `8342e38`.
- Direct collision with the coming post-payment delivery screen: yes, by design — the brief adds a
  screen "shown right after Stripe returns," i.e. adjacent to/inside this same reveal flow.

**`claude/comp-access-grant-sk7rn6`**
- **Touches the paid check and the "Comp access" badge**: `lib/billing/entitlements.ts` (new, 25 lines),
  `components/kit/brand-kit-view.tsx`, `app/app/brand-kits/[id]/page.tsx` show the badge; `lib/site-url.ts`
  (new) adds the `VERCEL_URL` fallback.
- Two commits total beyond `bootstrap-ukuxfu`. Already merged into `reveal-rebuild-28o625` (PR #14, #15,
  both closed/duplicate-merged). Does **not** touch the `plans` table directly on the frontend side — that
  lives in the backend counterpart (see §2).
- This is exactly the guard the coming brief needs every new route to sit behind — must land before or
  alongside the post-payment work, not duplicated again.

**`claude/eklio-image-generation-tool-m9x3kh`**
- **Identical tree to `claude/eklio-bootstrap-ukuxfu`** (same commit, `68a5933`) — not a separate
  diff, the same content under two branch names.
- **Adds image rendering**: `scripts/brand-shots/index.ts`, `scripts/brand-shots/openai.ts`,
  `scripts/brand-shots/presets.json` — a CLI that calls OpenAI's `gpt-image-1` to generate marketing
  images from presets. No storage-bucket or font-loading code found alongside it.
- **Direct collision risk with the coming brief's "deterministic asset renderer"**: yes — two different
  image-generation approaches (this CLI's OpenAI-based preset renderer vs. the brief's deterministic
  `<BrandCanvas>` pipeline) would coexist unless reconciled or one is retired.

**`claude/eklio-fr-us-migration-53dnk1`** — dead
- Disjoint history from the design-system-flow trunk (no common ancestor). 7 commits, last commit
  2026-08-16. Diffstat vs. trunk: 303 files, +8331/−37601 — this branch is missing nearly all the work
  that landed on the trunk since reconciliation (PR #1, merged 2026-08-22).
- No PR anywhere. Superseded by the "lot" PRs that were reconciled onto `design-system-flow-zmf8rl`.

**`claude/eklio-v1-priorities-ssmasp`** — dead in this repo (see §2 for its backend counterpart, which is *not* dead)
- Also disjoint history from the trunk. 7 commits, last commit 2026-08-31 (recent date, stale lineage —
  someone committed to the pre-reconciliation root after reconciliation had already happened). Diffstat
  vs. trunk: 293 files, +3619/−37346.
- No PR anywhere.

### 1.3 Dead vs. stale-needs-a-decision (frontend)

- **Dead, safe to delete:** `claude/eklio-fr-us-migration-53dnk1` (disjoint, no PR, fully superseded).
- **Dead in this repo, but its name is reused for live backend work — do not delete without checking §2:**
  `claude/eklio-v1-priorities-ssmasp` (frontend side is disjoint/stale; backend side of the same name is
  1 commit ahead of `main` and easy to land).
- **Stale, needs your call:** `claude/eklio-image-generation-tool-m9x3kh` — identical to `bootstrap-ukuxfu`
  today, so it isn't "extra risk" to keep, but its brand-shots CLI is the thing most likely to conflict
  with the coming asset-renderer work. Decide whether to fold it in, replace it, or drop the CLI.

---

## 2. eklio-backend

### Repo-level facts

- `git status`: clean. `git stash list`: empty. Current branch `claude/happy-maxwell-37v4v2`, tip
  identical to `origin/main` (`3443799`) — 0 ahead / 0 behind. GitHub default branch: `main` (exists,
  unlike frontend).
- `git branch -r --merged origin/main` → `claude/comp-access-grant-sk7rn6` and `main` itself. Every other
  `claude/*` branch is unmerged.
- Newest migration on `origin/main`: **`20260901091000_comp_grant_entitlement.sql`** (preceded by
  `20260901090000_comp_access_grants.sql`).

### 2.1 Branch-by-branch

**`claude/backend-app-schema`** — dead
- 10 commits ahead of `main`, last commit 2026-08-27. PR #8, closed, not merged.
- Adds 8 migrations timestamped `20260827100000`–`20260827107000` (catalog reference data, brief
  autosave/preview, brand kit deliverable, rendering constraints, launch checklist, monthly content
  calendar, subscription state, English-only schema pass).
- **All 8 of those exact filenames already exist on `origin/main`.** The content landed through some
  other path; this branch is fully superseded. Safe to delete.

**`claude/brief-step-4-practitioner-dapkfv`**
- 25 commits ahead of `main`, last commit 2026-09-01. No PR opened in this repo.
- Contains `dc11c77 Merge remote-tracking branch 'origin/claude/eklio-reveal-rebuild-28o625'` — i.e. it's
  reveal-rebuild's 4 backend migrations plus 7 more of its own (how-you-work catalogs, USP guardrail
  tables/RPCs, brief step renumber, `project_briefs` data-shape CHECK).
- New migrations: `20260830100000_direction_assets.sql`, `20260830101000_brand_kit_reveal.sql`,
  `20260830102000_reveal_specialties.sql`, `20260830103000_reveal_practitioner_line.sql`,
  `20260831100000_how_you_work_catalogs.sql`, `20260831101000_usp_guardrail_tables.sql`,
  `20260831102000_project_briefs_how_you_work_columns.sql`, `20260831103000_brief_step_renumber.sql`,
  `20260831104000_usp_fingerprints.sql`, `20260831105000_usp_distinct_and_banned_phrase_checks.sql`,
  `20260831106000_project_briefs_data_shape.sql`.
- **All 11 timestamps (Aug 30–31) are older than main's newest, `20260901091000` (Sep 1).** None of
  these filenames exist on `main` yet — not a name collision, but an ordering hazard: merging as-is
  drops migrations dated before the last-applied one.
- Cross-repo flag: the frontend's `bootstrap-ukuxfu` already ships the "How you work"/positioning UI
  (USP gates, step renumber) that this branch's schema backs. **The frontend code for that flow is
  currently running against a backend schema that isn't on `main`.**

**`claude/comp-access-grant-sk7rn6`**
- 0 ahead of `main` — already merged (PR #10, and confirmed by `--merged origin/main`). Nothing to do.

**`claude/eklio-reveal-rebuild-28o625`**
- 5 commits ahead of `main`, last commit 2026-08-30. PR #9, **open**, base `main`.
- Migrations: `20260830100000_direction_assets.sql`, `20260830101000_brand_kit_reveal.sql`,
  `20260830102000_reveal_specialties.sql`, `20260830103000_reveal_practitioner_line.sql`.
- **All 4 timestamps (Aug 30) are older than main's newest, `20260901091000`.** Same ordering hazard as
  above (this is the subset of `brief-step-4-practitioner-dapkfv`'s migrations that came from this branch).

**`claude/eklio-v1-priorities-ssmasp`**
- Only 1 commit ahead of `main`, last commit 2026-08-31. No PR opened in this repo.
- Migration: `20260831090000_revoke_internal_function_surface.sql` (revokes anonymous access to internal
  functions — security hardening).
- **Timestamp (Aug 31) is older than main's newest, `20260901091000`.** Small, isolated, easy to
  re-timestamp and land. Note the discrepancy with §1: the *frontend* branch of the same name is dead/
  disjoint; the *backend* branch of the same name is live and nearly trivial to merge.

### 2.2 Timestamp collisions — summary

Newest on `main`: `20260901091000`. Every unmerged branch's migrations predate it:

| Branch | Migration timestamps | vs. main's newest (`20260901091000`) |
|---|---|---|
| `backend-app-schema` | `20260827100000`–`107000` | older — moot, content already on `main` under identical names |
| `brief-step-4-practitioner-dapkfv` | `20260830100000`–`20260831106000` (11 files) | older — real hazard |
| `eklio-reveal-rebuild-28o625` | `20260830100000`–`103000` (4 files) | older — real hazard |
| `eklio-v1-priorities-ssmasp` | `20260831090000` (1 file) | older — real hazard |

None of the pending filenames collide by *name* with anything already on `main`; the hazard is purely
ordering — every one of them needs a timestamp later than `20260901091000` before or at merge time.

### 2.3 Dead vs. stale-needs-a-decision (backend)

- **Dead, safe to delete:** `claude/backend-app-schema` (fully superseded, content already on `main`).
- **Live, small, ready:** `claude/eklio-v1-priorities-ssmasp` (1 commit, 1 migration, no PR — easiest win).
- **Live, needs the migration-timestamp fix before merge:** `claude/eklio-reveal-rebuild-28o625` (PR #9
  open) and `claude/brief-step-4-practitioner-dapkfv` (no PR yet, superset of reveal-rebuild's backend
  changes plus the how-you-work/USP schema the frontend already assumes exists).

---

## Proposed dispositions (not acted on)

- **Delete:** frontend `claude/eklio-fr-us-migration-53dnk1`; backend `claude/backend-app-schema`.
- **Your call, likely abandon:** frontend `claude/eklio-v1-priorities-ssmasp` (disjoint/stale) —
  but keep the *backend* branch of the same name, it's unrelated and still good.
- **Your call, reconcile or drop:** frontend `claude/eklio-image-generation-tool-m9x3kh`'s brand-shots
  CLI, given the coming deterministic asset renderer.
- **Keep, needs to land:** frontend `bootstrap-ukuxfu` (today's practical trunk), `design-system-flow-zmf8rl`
  (token/typography source of truth), `reveal-rebuild-28o625` + `comp-access-grant-sk7rn6` (already folded
  into reveal-rebuild); backend `eklio-v1-priorities-ssmasp`, `eklio-reveal-rebuild-28o625`,
  `brief-step-4-practitioner-dapkfv` — all three need fresh migration timestamps before/at merge.

---

## What actually happened (2026-09-02/03)

Executed after approval, in this order. Not the plan above verbatim — two real problems surfaced during
execution that the original audit couldn't have found without querying the live database, and both are
recorded here because they change what "reconciled" means for anyone reading this later.

### 1. Backend schema drift — bigger than a rename

Auditing why the frontend's already-merged "how you work" UI ran against schema absent from backend
`main` turned up two separate drifts between the repo and the hosted project (`fobgdsupyfslxbswfuay`,
us-east-1):

- **11 migrations were live on the hosted project but on no branch's `main`** — pushed directly from the
  unmerged `eklio-reveal-rebuild-28o625` and `brief-step-4-practitioner-dapkfv` branches, under timestamps
  neither branch's own files carried.
- **28 migrations already on `main` were recorded on the hosted project under different timestamps than
  the files in the repo** — the root cause: migration files had been renumbered on `main` *after* being
  pushed, which is how the repo stopped describing the database.

Fixed in **eklio-backend PR #11** ("Reconcile migration history with the deployed schema"): renamed the
28 to match what the project actually recorded, added the 11 under their recorded versions, and — after
diffing all 18 live function bodies against the branch files via `pg_get_functiondef` — fixed 2 functions
whose deployed comments had drifted from the source (no logic difference). Verified before merging: sorting
all 50 resulting migrations by corrected timestamp reproduces the exact same order as the original
file timestamps (no dependency-order regression), and CI (`db-tests`, full `supabase db reset` replay)
passed after one real fix — 3 validators the reconciliation introduced weren't registered in the repo's
own NULL-safety coverage test, exactly the kind of gap that test exists to catch.

Added to `eklio-backend/README.md`, next to the existing "permissive default" defect-pattern note: a
migration file's timestamp is never edited after it has been pushed to any project; a wrong timestamp is
corrected by a new migration, never by rewriting an old one.

### 2. A second undocumented object, found by the first fix

Rebasing `eklio-v1-priorities-ssmasp` onto the reconciled trunk, its migration (`REVOKE EXECUTE` on 18
functions) failed on a fresh CI replay: one of them, `rls_auto_enable()`, didn't exist. Checked against
the live project: it's real, owned by `postgres` (not Supabase platform scaffolding — the project's other
6 event triggers are all `supabase_admin`-owned), and it's the function behind a `ddl_command_end` event
trigger (`ensure_rls`) that **auto-enables RLS on every new table created in `public`.** No migration
anywhere in git history ever created it.

Fixed in **eklio-backend PR #14**: transcribed verbatim from `pg_get_functiondef()` and `pg_event_trigger`
on the live project, no changes. Confirmed live, not assumed, what "RLS enabled with zero policies" does
to each role that matters: `anon` → 0 rows, `authenticated` → 0 rows, `service_role` → all rows (bypasses
RLS) — no permission error at any point, because default privileges on `public` already grant full table
access; RLS is the only gate, and it fails silently. **The rule this sets for the next chantier: every new
table ships its RLS policies in the same migration that creates it** — `CREATE TABLE` alone produces a
table that is silently unreadable and unwritable to `anon`/`authenticated`, indistinguishable from a
healthy empty result.

### 3. Backend merge sequence (after PR #11 and #14)

In dependency order, each rebased on the reconciled trunk with now-duplicate migration files removed
(confirmed zero new migrations remained in `eklio-reveal-rebuild-28o625`'s and
`brief-step-4-practitioner-dapkfv`'s diffs after dedup — every migration they carried was already
reconciled):

1. `eklio-backend#12` (`eklio-v1-priorities-ssmasp`) — merged.
2. `eklio-backend#9` (`eklio-reveal-rebuild-28o625`) — merged.
3. `eklio-backend#13` (`brief-step-4-practitioner-dapkfv`) — merged; two real rebase conflicts (both
   branches had independently registered the same 3 validators in the coverage test), resolved in favor
   of this branch's more detailed rationale.

### 4. Frontend trunk rename

`claude/eklio-bootstrap-ukuxfu` renamed to `main` on GitHub (default branch and Vercel's production
branch both updated, by the repo owner). `README.md` and `RECONCILIATION.md` updated to match
(`eklio-frontend#16`) — `RECONCILIATION.md`'s historical branch-name references were left as an accurate
record of what was true when that pass ran, with a dated note added at the top rather than rewritten.

### 5. Dead-branch disposition — archived, not deleted

Tagging as originally planned (`git tag` + `git push`) failed: this session's git-over-HTTPS access
returns `403` on any destructive ref operation (tag push, branch delete) — reproducible, not a transient
network error, and confirmed on both a lightweight tag push and a plain `git push --delete`. No
tag-creation or branch-deletion endpoint is exposed by the GitHub tooling available in this session either.

Substituted a branch under `archive/` for each, created via the GitHub API, pinned at the same commit a
tag would have carried:

- `eklio-frontend`: `archive/eklio-fr-us-migration-53dnk1` → `215ac88`, `archive/eklio-v1-priorities-ssmasp`
  → `94a6f94`.
- `eklio-backend`: `archive/backend-app-schema` → `5341876`.

**The three original branch names — frontend `claude/eklio-fr-us-migration-53dnk1`, frontend
`claude/eklio-v1-priorities-ssmasp`, backend `claude/backend-app-schema` — are still on `origin`, not
deleted.** Their content is fully preserved under the `archive/` names above; deleting the originals needs
either elevated write access in a future session or manual deletion in the GitHub UI.

### 6. Final state

Both repos: `claude/post-purchase-space`, branched from `main` after all of the above merged, clean
working tree, level with `origin/main`, pushed.
