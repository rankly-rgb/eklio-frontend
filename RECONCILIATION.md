# Branch reconciliation — pre–US-migration base

This document is the deliverable of a reconciliation pass run before the
France→US migration. Its job was to establish one coherent source-of-truth
branch to migrate *from*, without touching production or Supabase. It changes
no application code — see "What this branch actually contains" below.

## État des lieux (verified facts)

Verified fresh via the GitHub API and this session's Supabase access,
independent of any prior session's notes.

- **Repository default branch:** `claude/eklio-bootstrap-ukuxfu`. There is no
  `main`. This is the branch Vercel builds for production
  (`https://eklio-frontend.vercel.app`).
- **Three branches exist on `origin`:**
  - `claude/eklio-bootstrap-ukuxfu` — the default/production branch.
  - `claude/eklio-design-system-flow-zmf8rl` — contains the working guided
    flow: `lib/brief/steps.ts`, `lib/ai/directions.ts`, a 7-step brief with
    Zod schemas, and 3-direction generation via Claude. Storage table
    `project_briefs`, types in `types/supabase.ts`, white-background design
    system, French throughout.
  - `claude/eklio-fr-us-migration-53dnk1` — a separate, prior attempt at the
    France→US migration, built from the bootstrap scaffold rather than from
    `eklio-design-system-flow-zmf8rl`. It duplicates Lot 1/Lot 2 with
    different conventions (`brief_answers` instead of `project_briefs`,
    `types/database.ts` instead of `types/supabase.ts`, data-driven field
    defs instead of Zod) and additionally contains Lot 0 (an ethics
    compliance layer), Lot 3 (brand kit) and Lot 4 (USD pricing + Stripe),
    none of which exist anywhere else. **Explicitly out of scope for this
    pass** — not merged, not cherry-picked from.

- **`claude/eklio-bootstrap-ukuxfu` has zero commits beyond the initial
  bootstrap commit.** Its tip (`c1dfe31`) *is* the merge-base with
  `claude/eklio-design-system-flow-zmf8rl`. Concretely:
  `git rev-parse origin/claude/eklio-bootstrap-ukuxfu` equals
  `git merge-base origin/claude/eklio-bootstrap-ukuxfu origin/claude/eklio-design-system-flow-zmf8rl`.

- **`claude/eklio-design-system-flow-zmf8rl` is a strict superset of the
  default branch.** `comm -23` between the two branches' file trees returns
  exactly one file: `types/database.ts` — which the design-system branch
  deliberately replaced with `types/supabase.ts` (an intentional rename, not
  a gap).

### Correction to the initial brief for this pass

The brief for this pass stated "18 fichiers en collision... entre la source
de vérité et la branche par défaut." That is not what the git history shows.
**There is no collision between `claude/eklio-design-system-flow-zmf8rl` and
`claude/eklio-bootstrap-ukuxfu`** — merging the former into the latter would
be a pure fast-forward with zero conflicts, because the default branch never
advanced past the commit both share. The 18-file collision that was actually
observed (schema, types, validation-library and design-token differences) is
between `claude/eklio-design-system-flow-zmf8rl` and
`claude/eklio-fr-us-migration-53dnk1` — the branch this pass was explicitly
told not to merge in. That collision is real, but it is a problem for the
*next* pass (the US migration itself), once it has a clean base to migrate
from.

## What this branch actually contains

Given the above, `claude/eklio-reconcile-us-base` is branched directly from
`claude/eklio-design-system-flow-zmf8rl` (commit `c5d6a28`) with **no
cherry-picks and no merges** — there was nothing on the default branch to
bring over, and the migration branch was correctly left untouched per
instructions. This branch's tree is therefore identical to
`claude/eklio-design-system-flow-zmf8rl`; this file is the only content this
branch adds.

### Verification (Step 4)

Run against this branch's own tree, from a clean `npm install`:

| Check | Result |
|---|---|
| `npm run build` | ✅ Clean — 10 routes compiled, no errors |
| `npm run lint` | ✅ Clean, no warnings |
| `npx tsc --noEmit` | ✅ Clean, no errors |
| `grep -r "brief_answers"` | Absent (this branch uses `project_briefs`) |
| `types/database.ts` present, or imported anywhere | Absent, no dead imports |
| `BriefField` / `BriefAnswers` (the migration branch's field-def API) | Absent |
| `optionLabel(` present | Present, but it is this branch's own small local helper (`lib/brief/steps.ts:478`, `optionLabel(options, value)` over a `ChoiceOption[]`) — coincidentally-named, not a leftover from the other branch. Verified by reading each call site. |
| Zod as the validation layer | Present (5 files) — this branch's own convention, unchanged |
| `project_briefs` as the storage table | Present (5 files) — this branch's own convention, unchanged |

No structural resolution was needed on any of the axes described in the
original brief (brief storage, types file, validation library, design
tokens, colliding pages) because none of them actually diverge from
`claude/eklio-design-system-flow-zmf8rl` — that branch was never in conflict
with itself.

## Supabase schema — audited, not applied

**No Eklio Supabase project is reachable from this session.** Checked twice,
including an organization-level check to rule out account scoping:

- `list_organizations` → exactly one organization, "Sentio AI"
  (`tyapcmqubnbszzythxds`).
- `list_projects` → exactly one project inside it, "Sentio AI dev"
  (`upqakxuatlshhqiagbqw`, eu-central-1).
- Read directly: `list_tables` on that project returns 40 tables —
  `accounts`, `organizations`, `cohorts`, `mrr_movements`, `playbooks`,
  `webhook_configs`, `retention_metrics`, etc. This is an unrelated
  churn/retention-analytics SaaS. **None of Eklio's tables
  (`projects`, `project_briefs`, `directions`) exist in it.**

One migration on this branch,
`supabase/migrations/20260816090000_fix_directions_schema.sql`, has a comment
describing a session that *did* have access to a live project and hit a
pre-existing `directions` table "unrelated to Eklio" left over from a
different bootstrap. That project is not the one visible to this session —
either a different account was used at the time, or it no longer exists.
This is worth flagging to a human with dashboard access, but it does not
change the conclusion for this session: **there is nothing to diff against.**

### What the code expects (from this branch's own migrations)

For when a real Eklio project is identified, here is the exact schema this
branch's code is written against, taken straight from
`supabase/migrations/`:

| Table | Columns |
|---|---|
| `public.projects` | `id, user_id, name, metier, status, current_step, created_at, updated_at` |
| `public.project_briefs` | `project_id, data (jsonb), completed_steps (smallint[]), updated_at` |
| `public.directions` | `id, project_id, position, name, description, palette (jsonb), typographie_titre, typographie_corps, is_selected, created_at, updated_at` |

All three tables have owner-only RLS policies scoped through `auth.uid()`
(directly on `projects`, transitively via `project_id` on the other two).

**Not applied in this pass, per instructions.** If a real Eklio project is
identified, the three migration files under `supabase/migrations/` on
`claude/eklio-design-system-flow-zmf8rl` are ready to run as-is (they already
build cleanly, and the third migration already resolves the one known
schema-drift incident from a prior session, so no new migration was written
here).

## Ce qui reste pour la migration US

Deliberately left open — these are decisions the US migration pass should
make, not this reconciliation:

- **Schema renames.** Whether the US migration keeps `project_briefs` /
  `types/supabase.ts` / Zod (this branch's conventions) or switches to
  `brief_answers` / `types/database.ts` / data-driven field defs (the
  abandoned migration branch's conventions) is unresolved. Recommendation:
  keep this branch's conventions, since they're attached to the only working
  implementation of Lot 1/Lot 2 — but that is the next pass's call.
- **Visual direction.** Warm-cream tokens (bootstrap/abandoned-migration
  branch) vs. the white-background "calm premium" redesign already on this
  branch — not decided here, per instructions.
- **Everything past Lot 2 does not exist on this branch yet:** the ethics
  compliance layer (Lot 0), the brand kit (Lot 3), and USD pricing + Stripe
  (Lot 4) currently exist only on the abandoned `claude/eklio-fr-us-migration-53dnk1`
  branch, in English, against `brief_answers`/`types/database.ts` conventions.
  None of it is merged here. The US migration pass can use that branch as
  reference material for scope and shape, but will need to re-implement
  against whichever schema/validation convention gets chosen above — it
  cannot be merged wholesale into this base without recreating exactly the
  18-file collision this pass was told to avoid.
- **Real Supabase project.** Needs a human to point at (or provision) an
  actual Eklio-dedicated project before the schema above can be verified or
  the US migration's own schema changes can be applied.
- **English content + USD pricing.** Every user-facing string on this branch
  is French, and the landing/checkout copy on the abandoned migration branch
  is not connected to this branch's schema — the actual re-specialization
  (French→US, EUR→USD, générique→therapist-specific) has not happened here
  and is the substance of the next pass.

## Not done in this pass (by instruction)

- No push to `claude/eklio-bootstrap-ukuxfu`.
- No change to the repository's default branch.
- No merge of `claude/eklio-fr-us-migration-53dnk1` into this branch (or
  vice versa).
- No Supabase migration applied, no Supabase project created.
- No Vercel deployment triggered.
- No decision made on warm-white vs. cream design direction.
