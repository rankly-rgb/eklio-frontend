# CHANTIER_LOG.md

How the five post-purchase-v2 sessions talk to each other. Read this in full before doing anything else,
in every session after the first.

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
