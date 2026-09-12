# CHANTIER_LOG.md

How the five post-purchase-v2 sessions talk to each other. Read this in full before doing anything else,
in every session after the first.

**The working branch is `claude/post-purchase-v2` in both repos**, as the brief always specified. Session
1 pushed to a harness-assigned branch (`claude/nifty-dirac-7isjqb`) instead; Session 2 reconciled this
before doing any other work — see its entry below for detail. Do not create or look for any other branch.

---



## PREFER THE JOIN THAT FAILS CLOSED OVER THE COLUMN THAT FAILS QUIETLY

*Standing design rule. 2026-09-11, tenancy chantier.*

When a row can be reached two ways — through a foreign key to its parent, or through a
copied `user_id` on the row itself — **use the join.** Always, and even though it is the
slower query and the longer policy.

The reason is not purity. It is what each one does when it is wrong.

A policy that reaches the owner through `projects`, and is wrong, returns **nothing**. She
sees an empty screen, knows something is broken, and writes in. It is visible, it is
reported, and it is fixed the same day.

A policy bound to a copied `user_id`, and wrong, returns **her own rows** — correctly formed,
plausible, just not the practice's. Nobody reports "slightly emptier than it should be" as a
bug. They report it as "the product feels a bit empty", months later, if at all.

⚠ **This codebase does not fail with errors. It fails with plausible values.** Every
expensive thing found in the last two weeks is that shape: an orphaned purchase that resolved
a paid tier for every project, a sign-in that silently did not claim a brief, a funnel step in
the wrong order that would have blamed the wrong screen forever, a "payment received" that was
never withdrawn. None of them raised anything.

So the rule generalises past RLS: **given a choice between a mechanism that fails loudly and
one that fails plausibly, take the loud one, and pay whatever it costs.** A denormalised
column, a cached copy, a default value that stands in for a missing one, a `catch` that
returns a fallback — each is a place where wrong looks like right.

Session 3 of the tenancy chantier makes this choice fourteen times, once per policy in
`TENANCY.md` §5. The answer is the same fourteen times: drop the copied `user_id` from the
policy and reach the organization through the kit. Keep the column only where it answers a
different question than access — `brand_assets.user_id` records who generated an asset, which
is provenance and stays true with two members — and say so in a comment, so nobody reattaches
a policy to it.


## EVERY HAND-WRITTEN LIST IN THIS REPOSITORY HAS BEEN INCOMPLETE. DERIVE IT.

*Standing design rule. 2026-09-11, tenancy chantier, session 3.*

Not "lists tend to rot". **Every single one, without exception, has been wrong when checked.**
That is now five for five, and the fifth was found inside this chantier, in a list I had
written myself two commits earlier:

| The list | How it was wrong | How it was fixed |
|---|---|---|
| trigger functions to revoke | hand-listed 11, there were 16 | a loop over `pg_proc` |
| callers of a gated function | enumerated 3 from memory, there were 4 — the fourth was the database itself | follow the call graph, and name the identityless caller |
| the notification count after a retirement | corrected in one place, the same number stood in **three** | one `grep`, once |
| the drift between repo and database | "`direction_asset_daily_spend` is a finding" | fingerprint all 1,910 objects |
| the register of silently-absent env vars | two tests hand-wrote it as `["RESEND_API_KEY"]`, and as an environment holding only that key; both fell the moment `CRON_SECRET` joined | derive both the environment and the expected list from `REQUIRED_IN_PRODUCTION` |

**The rule: if a list can be computed, computing it is not an optimisation, it is the only
correct version.** Enumerate from the catalogue — `pg_proc`, `pg_policies`, `pg_constraint`,
`pg_class`, `information_schema` — or from the filesystem, or from a `grep`. Never from memory
and never from reading around.

This applies to: trigger functions, callers, routes, tables, policies, grants, columns,
validators, exemption lists, **and plural labels**. "The two notifications", "the three
callers", "the eighteen functions" — every one of those phrases in this repository has been a
hand-count, and the ones that were checked were wrong.

⚠ **A hand-written list is not merely incomplete, it is ACTIVELY MISLEADING**, because it
looks like the answer. `direction_asset_daily_spend` had a deny-all policy on a table with RLS
off: the list of server-only tables was right, the policy was right, and the table enforced
nothing. Nobody would have found it by reading, because everything read correctly.

**Where a list genuinely cannot be derived** — a set of decisions, like "these three tables are
per-person on purpose" — then it is not a list, it is a register, and each entry carries its
reason in the file beside it. The test that reads it fails when a name is present without a
reason, or absent when the catalogue says it should be there. See
`20260829112000_null_safe_jsonb_validators.test.sql` and
`20260911180620_tenancy_layer.test.sql` for the shape: the classification is computed, and only
the justification is written by hand.


## A CHECKLIST ROW NAMES AN OBSERVATION, AND THE OBSERVATION MUST BE ON A SURFACE WE CAN READ.

*Standing design rule. 2026-09-12, tenancy chantier, session 4.*

`LAUNCH_CHECKLIST.md` carried `CRON_SECRET`. It had carried it since the trial
notice shipped. **It could not detect the failure it warned about.**

Its verification step said: *"after the first 05:00 UTC run, the anon-briefs job
shows a 200 in its log"* — pointing at Vercel's panel. Two things were wrong with
that instrument, and either alone is fatal:

1. a missing `CRON_SECRET` makes `authorizeCron` return **404**, which in that
   panel reads as *"the route does not exist"* — so the operator goes looking for
   a deployment problem that is not there; and
2. the panel's history sits behind a paid retention upgrade, so beyond a short
   window there is nothing to read at all.

⚠ **A verification step aimed at the wrong instrument turns "unknown" into
"checked", which is strictly worse than having no row.** An unchecked row is
honest about its ignorance. A row that cannot fail manufactures confidence.

**The rule: every checklist row must name (a) the observation that distinguishes
the good state from the bad one, and (b) a surface where that observation is
actually visible to us.** If the only instrument is one we cannot read — a
third-party panel, a paywalled log, a mailbox nobody owns — the row is not done,
and saying so is the row's real content.

The fix here was to move the instrument, not to reword the row: every cron route
reaches PostgREST on an authorised run, so **Supabase's** API Gateway log
answers the question, on a retention we control and a vendor whose silence we
can cross-check against `postgres_logs` in the same hours.

Related, and the reason this is a rule rather than an anecdote: the same session
found that the Supabase MCP log window silently ignores a wider time filter and
returns ~24 hours. An instrument that answers a question you did not ask is the
same defect one layer out. See `FINDINGS.md`.


## A SUMMARY IS NOT THE SOURCE. GO BACK TO WHAT WAS ACTUALLY SAID.

*Standing working rule. 2026-09-12, tenancy chantier, session 4.*

Session 3 was about to record that "the brief quoted the schema without the invitation
columns". **That was false, and checking it before writing it down was the whole lesson.**

The brief arrived at **2026-09-11 13:55:02Z** and carried the block in full:

```
organizations        id, name, slug, owner_user_id, brand_charter_kit_id, created_at
organization_members org_id, user_id (nullable until they sign up), role ('owner'|'clinician'),
                     status ('invited'|'active'|'removed'), invite_token, invited_email,
                     project_id, created_at, activated_at
```

Every column supposedly missing — `user_id` nullable, `status`, `invite_token`,
`invited_email`, `activated_at` — was there. So were `organizations.slug` and
`owner_user_id`, which went unnoticed in the same reading.

At **17:58:32Z** a compaction summary replaced that block with a placeholder:

> `## SESSION 2 — the layer itself [organizations / organization_members schema;`
> `is_org_member(org_id); the test that enumerates tables; Two roles. owner and`
> `clinician.; Invisible to solo users.]`

Session 3 was built at ~18:00, from the summary. **The source was still in the transcript the
entire time, and I did not go back to it.**

⚠ **This was a READING failure, not a gap in the brief — and the two call for opposite care.**
A gap is answered by asking. A reading failure is answered by returning to a source that was
available all along; asking would have wasted someone's time re-typing what they had already
written.

**The rule: a summary of an instruction is evidence that an instruction exists, never evidence
of what it said.** Anything arriving as a recap, a paraphrase, a compaction or a quotation is a
pointer. Follow it to the original before building on it — and above all before recording that
something was absent from it.

The same discipline was applied correctly, in this same chantier, to someone else's text: the
2 September document was refused with "I do not have the document" rather than reconstructed
from the passages quoted at me. The failure was applying it to a text I did not have, and not
to a lossy copy of a text I had been given.


## ASK WHO CALLS IT, AND WITH WHAT IDENTITY — NOT WHAT THE OWNER PREDICATE IS

*Standing design rule. 2026-09-11, function-surface chantier, session 2.*

When you gate anything — a `SECURITY DEFINER` body, an RLS policy, a route — the question is
not "which owner predicate is correct here?". It is **who reaches this, and carrying what
identity**. Enumerate the callers first; pick the predicate second. The predicate is a
consequence of the answer, never a substitute for it.

The rule came from a near-miss that cost nothing only because the question got asked in time.

`site_spec_default_target` needed an authority check. `brand_kit_is_owned` is right there, it
takes a `brand_kit_id`, it is named for exactly this, and it compiles. It also **passes the
suite, raises nothing, and silently returns `'generic'` instead of her real builder target on
every anonymous generation** — because its owner predicate is `user_id = auth.uid()`, and the
caller is a trigger chain on an anonymous brief: `handle_new_brand_kit` → `seed_site_spec` →
`site_spec_seed_values`. There is no `auth.uid()` anywhere on that path. `owns_project`
honours the anonymous token as well as the session, so it is the one that fits the callers.

Note what the wrong choice would have looked like from the outside: a working product,
generating site specs, for a generic target. Same shape as everything else in
`PREFER THE JOIN THAT FAILS CLOSED` above — **this codebase fails with plausible values.**

**How to ask it, in order.**

1. `select ... from pg_proc` / grep the routes: what calls this, transitively? Triggers count.
   A trigger fires under whoever wrote the row, and an anonymous insert has no `auth.uid()`.
2. For each caller, what identity is actually present — a session (`auth.uid()`), a service
   role (`auth.role() = 'service_role'`), an anonymous token (`anon_token_hash()`), nothing?
3. Only now choose the predicate, and choose the one that is true for **every** legitimate
   caller. If no single predicate covers them, the gate is a disjunction, and write the
   disjunction out rather than picking the common case.
4. If a caller has no identity at all, that is the finding. Do not paper it with a predicate
   that happens to return `false` quietly.

⚠ **A gate that returns the fallback instead of raising is not a gate, it is a bug with a
comment.** Where the honest answer is "this caller may not", raise or return nothing — never a
default that reads like an answer.


## A GUARD THAT DEPENDS ON SEED DATA ASSERTS THE SEED, NOT THE CONSTRAINT

*Standing design rule. 2026-09-11, tenancy chantier, session 3.*

Migrations in this repository carry guard rails, and that is right. But a guard rail runs in
two places that are not alike: against **production**, once, with data in it; and against a
**fresh replay** in CI, on every push, with none.

A probe that reads a row to test a constraint passes the first and is meaningless in the
second — or, worse, fails it. `20260910144421` probed its CHECK with
`insert into content_months (...) select bk.id from brand_kits limit 1`. On an empty database
the SELECT returns nothing, the INSERT writes nothing, **nothing raises**, and the guard
concluded the constraint was missing and aborted the replay. Its own comment —
`when others then v_ok := true; -- no kit to test against` — shows the author saw the
empty-database case and reached for the wrong mechanism.

The cost was not the migration. It was that **`supabase db reset` stops at the first failure**,
so every test file after it never ran: the function-surface enumeration shipped in Session 2
into a pipeline that could not reach it, and nobody noticed for a day.

**How to write one that holds in both places.**

- Assert the **catalogue** — `pg_constraint`, `pg_policies`, `pg_proc`, `information_schema`.
  True on an empty database and a full one.
- Then probe the **behaviour** with data the guard creates itself, never with data it hopes to
  find. A bogus foreign key is usually fine: a CHECK is verified during the insert while a
  foreign key is an AFTER trigger, so the CHECK raises first and no parent row is needed.
- Never `when others then <pass>`. That handler is a guard agreeing with itself.
- And: **read the CI run of the thing you just pushed.** A defence written into a pipeline
  nobody reads is a defence that exists only in the commit message.


## THE FUNNEL IS EKLIO'S DATA, AND IT NEVER REACHES A SCREEN

*2026-09-10, chantier « acquisition », session 3.*

`public.funnel_events` records Eklio's own funnel: who arrived, how far they got, whether
they paid. Three rules were fixed at the moment it was built, and each of them is enforced by
something other than good intentions.

**It informs no screen in the product.** Not a counter, not "twelve practitioners chose this
direction", not a badge. The moment a number from this table appears in the product it stops
being measurement and becomes a claim about other people — and Eklio never displays a number
it cannot measure, least of all one about strangers. A test walks `app/**` and fails if any
file so much as names the table, its steps table or its report. The one exemption is the
retention cron, which deletes and never reads.

**No word she wrote can be in it.** Not her positioning, not her referral quote, not the text
she pasted into Check, not truncated, not hashed. This was a comment in `lib/analytics.ts`
for months; it is now a CHECK on the column (`funnel_props_are_safe`): flat object, at most
twelve keys, no nesting, no string over 64 characters. A new call site cannot forget a CHECK.

**No cross-site identifier, and no new cookie.** A visitor is joined by the daily-salted IP
hash the spend ceilings already derive — useless the next day by construction — and from her
first brief answer onward by `project_id`. Nothing follows anyone across a site boundary, so
there is no consent banner to add and nothing to ask for.

The one place an event starts in the browser is `POST /api/e`, and its vocabulary is closed
to two names with no properties and no identifiers, because the landing and pricing pages are
static and must stay that way. That is the whole exception; anything wider needs a different
design and a fresh decision.


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

## 2026-09-06 — Session 4: steps 9, 11 and 13 (LOTS 6, 8 and 10)

Three lots, three commits per repo where a repo was touched, suite green before each. No model call
anywhere in this session, and nothing in these three lots reaches `consume_generation_credit` or
`plans.image_budget_cents` — that is enforced by a test and by a migration guard rail, not by this
paragraph.

### Step 9 — LOT 6: content

**`content_items` is new, and `monthly_presence_content` was left exactly as it is.** The brief's own
contingency, taken on the facts carried in: that table refuses every client write by policy, holds zero
rows, and lacks six of the columns the editor writes. It was not dropped, not altered, not renamed — a
drop has no undo and nothing here needed it gone.

⚠ **"Dead" is precise, and a later session should read it precisely.** No NEW surface reads or writes it,
but `calendar_summary` is still called by `lib/data/calendar.ts`, and the home screen's `ContentGrid`
still renders from it. So there are two month models in the product right now: the home card's
sixteen-tile summary over the old table, and `/app/content` over the new one. Recorded in FINDINGS.md
with the decision left open — moving the home card across is a real change to what that card counts, not
a rename.

**The log IS the publication state.** `content_items` has no `published_at` and no `published` status.
Whether an item is posted is derived from the last row of the append-only `content_publications`, which
clients cannot write at all. There is no second copy of the fact to drift from, un-posting leaves a
history rather than overwriting one, and `mark_content_posted` is idempotent so a double click cannot
invent a publication.

**`update_content_item` takes a jsonb patch, not nine nullable arguments.** Only a patch can tell "leave
the title alone" (key absent) from "clear the title" (key present, value null), and autosave needs that
distinction to avoid overwriting a field edited in another tab. An unknown key is REFUSED rather than
dropped: dropping it is what lets a renamed field autosave into nothing for a whole release.

**`content_kit_access` holds the refusal ordering in one place.** `not_found` is decided first and alone,
so a stranger's kit can never answer `payment_required` — a refusal code that confirms existence is a
leak, and this is the only function that decides it.

**`types/supabase.ts` was hand-edited, not regenerated.** Regeneration wipes the manual addendum block
(four status unions) that has had to be re-applied four times already, and the schema addition here is
two tables and seven functions. If a later session regenerates, re-apply the addendum.

### Step 11 — LOT 8: the guided launch flow

`/app/launch` and `/app/launch/[stepKey]`, over the SAME `launch_checklist_items` rows and the same two
RPCs the home accordion uses. No second table, no second endpoint, no progress number recomputed. The
per-step detail is `LaunchStepDetail`, the same component the accordion renders in its expanded row,
exported rather than copied — two versions of the board-safe statement would mean one of them never gets
reviewed when the ethics rules change.

The step actions here are deliberately NOT optimistic, unlike the accordion's: this screen shows one
step and its state is the whole point of the screen.

An unknown step key, and a key with no row, are both 404. A key with no row would otherwise render an
empty screen with a working "Mark done" underneath it.

### Step 13 — LOT 10: handoff

`/app/brand-kits/[id]/handoff`: a plain-text brief she pastes into an email, plus the files she already
owns, plus what must never appear — the real `ethics_rules` rows verbatim, because that is the part a
web designer breaks without knowing and it has a licensing board behind it.

⚠ **There is no share URL, and there must not be one.** This page is precisely where "Eklio never hosts,
publishes or shares" erodes first, one convenience at a time. The absence is a test: the three surfaces
are scanned for `navigator.share`, copy-link, `shareUrl` and `getPublicUrl`, with a canary proving the
scan bites. A handoff is something she forwards herself, which is also why the recipient needs no
account.

### Photography, and why every photo surface is a gradient

Expected, and correct. Photographs exist for one test kit only, at `medium`, and those rows are stale
against `IMAGE_PROMPT_VERSION` 7. `<PhotoSlot>` renders its deterministic block for all of them. The item
editor READS `brand_images` to supply a source when one is current — reading is not generating — and
nothing in these three lots can cause an image to be made. `lib/images` was not modified.

### Decisions taken without asking

- **Content is gated on the KIT's entitlement, not on a Monthly Presence subscription.** Planning her own
  posts is part of the brand she bought; Monthly Presence is about content generated FOR her, which this
  lot does not build. If that is wrong it is a one-line change in three places, all of them named
  `isBrandKitEntitled`.
- **Item routes live at `/api/content-items/[id]`, not `/api/content/[id]`.** `/api/content/[id]/unlock`
  already exists and takes a `monthly_presence_content` id; two id spaces under one path would make the
  same URL mean two things depending on which table the uuid happened to live in.
- **The launch flow is reachable from the home checklist card, not from a fifth nav slot.** The chrome
  spec fixes four (Home, Brand kit, Content, Check) and adding one is a chrome decision, not a lot
  decision.
- **`content_items` carries no `user_id`.** Ownership runs through `brand_kit_id -> projects.user_id`,
  the one path `brand_images` uses. A second column recording the same fact is a second column that can
  be wrong.

### Not done, and deliberately

- **Steps 10 and 12 were not started.** They are Session 5.
- **The per-slot image fingerprint was not started**, per the owner's deferred decision recorded above.
- **`monthly_presence_content` and its two functions were not dropped**, see FINDINGS.md.

## 2026-09-06 — Session 5: steps 10, 12, 14, 15, and two rulings. The chantier closes.

### The two rulings, first

**Ruling 1 — the month is unified.** The home screen counted
`monthly_presence_content` through `calendar_summary` while `/app/content` rendered `content_items`. The
owner was right that moving it changes what the card counts, and right that that is the point: the old
table holds zero rows, so the number home showed was not merely different, it was nothing. `loadHome` now
reads `get_content_month`. `/api/calendar`, `/api/content/[id]/unlock`, `lib/data/calendar.ts` and the
locked-tile machinery went with it — those belonged to content generated FOR her behind a subscription,
and `content_items` are her own words, so nothing there is withheld.
`app/__tests__/one-month-model.test.ts` fails if any file outside one named exemption touches the old
model again.

⚠ **The exemption is the monthly cron, and I got its status wrong — corrected while merging.** I wrote
that it "has never been turned on", inferring that from the empty table. `vercel.json` on `main` has
scheduled `/api/cron/monthly` at `0 5 1 * *` since Lot 9, long before this chantier: **it is armed**. Why
the table is empty anyway cannot be answered from this repo — no production deployment, no kit at the last
firing, or a failed firing all look the same from here.

So the real state is worse than logged: if it fires it calls a model, spends money, and writes rows nothing
reads. It was already armed before this chantier; what changed is that its output is now invisible. Either
remove the entry from `vercel.json` (one line, reversible, and it matches "stays dead") or port the
generator onto `content_items` — which means deciding how a paid, generated item lives in a table she can
edit. It is named inside the test so it cannot be forgotten quietly, but it should not be left as it is.

**Ruling 2 — the typegen trap is loud now.** `types/__tests__/generated-types-drift.test.ts` fails when the
three hand-added tables, the eleven hand-added RPCs, or the four manual status unions go missing from
`types/supabase.ts`. The warning is also at the top of the file itself, because whoever regenerates reads
the file before the tests.

### Step 10 — LOT 7: Check v2

Built around the re-scan, because that is the step. A model asked to remove a guarantee produces a softer
guarantee — "heals your anxiety" becomes "will help you heal your anxiety" — and a rewrite returned
unchecked is worse than no rewrite, because she trusts it more for having come from Eklio. The model's
output goes back through the same deterministic scanner, always; when it still trips a rule that is shown,
not hidden.

The money, in order: availability checked before the call, the credit consumed after and **only when the
rewrite resolved**. A model that fails its one job is Eklio's cost. Text already clean never reaches the
model at all, which is structural rather than a condition in a route.

No score, no percentage, no "compliant" — a score is a number Eklio cannot compute and "compliant" is a
legal conclusion about six regular expressions. Her text is never stored, anywhere, and only rule ids are
tracked.

`lib/check/review.ts` (free, deterministic) is split from `lib/check/rewrite.ts` (the model) because
`max-duration.test.ts` correctly flagged the scan route and the page as generation surfaces through a
transitive import of the Anthropic client.

### Step 12 — LOT 9: uploads and the portrait path

**The rule the whole lot exists to keep: a file she uploaded never carries a brand fingerprint and is never
invalidated by a colour change.** `brand_assets` are derived from her tokens; her portrait is derived from
nothing. `user_uploads` has no fingerprint column, no `superseded_at`, no `current` flag, and a migration
guard rail fails if one appears — as does any function there referencing the derived-asset machinery.

Bytes, not extensions: `lib/uploads/sniff.ts` reads signatures, and the claim survives only to tell her it
disagreed. A PNG containing "<svg" stays a PNG. `lib/uploads/svg.ts` strips what makes an SVG a document
and refuses entity declarations outright. Quotas live in the RPC, re-checked at record time.

### Step 14 — LOT 11

The route enumeration now covers everything this chantier added, and the roots list is itself checked
against the real tree: a new directory under `app/api` or `app/app` fails the suite until someone says
whether it is paid or gated otherwise, with a reason. Mobile: the month grid becomes a list below the
medium breakpoint. Accessibility: the dialog closes on Escape and takes focus, every fetch surface
announces its errors, and no glyph-only button ships without a name.

### The measured cost of one kit's photography

From `brand_images` on the live project, kit `45de0dac…`, seven slots, all `ready`, all `medium`:

| | recorded | actual |
|---|---|---|
| The one real kit, at `--quality medium` | **41c** | **$0.357** |
| The same seven at their configured production quality | **59c** | **$0.544** |

`brand_image_daily_spend` for 2026-09-06 reads **86c actual, 0c reserved** — 41c of current slots plus
45c of superseded runs from the art-direction iterations, and every reservation released cleanly.

⚠ Both numbers are **Eklio's own price-table arithmetic**, not an invoice. Nothing in either repo reads
OpenAI billing, and the price table carries its retrieval date (2026-09-05) precisely because it will go
stale without anything noticing.

### What the next chantier inherits

Everything is in `FINDINGS.md`. The five that will actually cost someone time:

1. **Porting the monthly generator onto `content_items`.** The cron's `vercel.json` entry was REMOVED on
   6 September by the owner's decision — it was scheduled for the 1st of each month and wrote a table
   nothing reads any more, paying a model to do it. The route still exists and still works; it is simply no
   longer scheduled. What is inherited is the decision behind it: deciding how a paid, generated item lives
   in a table she can edit, when `content_items` deliberately has no `locked` state, is a chantier of its
   own. Until it is answered, Monthly Presence does not run — which is a smaller problem than it running
   into a void.
2. **The image regeneration meter is the DIRECTIONS meter.** `plans.image_budget_cents` exists for
   photographs, but `consume_generation_credit` is still what a direction regeneration and the Check
   rewrite share. Someone should decide whether photographs get their own allowance.
3. **There is no post-purchase refund primitive**, which is why every paid path is check-then-consume and
   why a bounded one-credit race exists in two places.
4. **The SVG sanitiser is a scrubber, not a parser**, and its acceptability rests on three other controls
   named in its header. Do not relax one without reading it.
5. **Two image systems still exist** — `direction_assets` dormant, `brand_images` live — and the per-slot
   image fingerprint stays deferred by the owner until kit count makes a full sweep expensive.

## 2026-09-06 — the home page, rewritten as "your practice this week"

Never one of the twelve lots — the chrome around it changed five times across this chantier and its body
never did. Composition only: no migration, no new table, no model call, `lib/images` untouched except
through its already-exported read functions (`loadImageContext`, `computeImageFingerprint`,
`getBrandImages`), called exactly the way the images route and the content item page already call them.

### The six pieces

**The header.** The greeting is no longer the largest thing on the screen. A mono date line, then the
practice name at its own size. `greeting()` itself is untouched and still backs `GET /api/home` and its own
test — only the page stopped rendering it as an h1.

**The hero — `<BrandCanvas>`.** Full fidelity means the REAL site tokens (`SitePreviewTokens`, `--s-*`,
`siteTokenVariables` — the same custom properties `components/site/mockup.tsx` sets) and the real hero copy
from `site_specs`, not the five-role palette the pre-purchase preview uses. The sizes and color roles match
`mockup-section.tsx`'s own `Hero()` — headline on `--s-dark`, subhead at 0.86 opacity, the button on
`--s-primary` with `--s-cta-ink` — so it reads as the same site rather than a second opinion of it. The
nav's page labels are her real, enabled pages (`preview.pages`), not invented placeholders. What the real
site doesn't have is a photograph — that's the one thing this canvas adds, through `<PhotoSlot slot="hero">`,
the seam everywhere else in the product already uses; a kit with no current photo renders the gradient, same
as every other photo surface in this chantier.

**"Next" — exactly one thing, chosen by rule.** `pickNextAction` in `lib/data/home.ts`: the first launch step
that is neither done nor skipped (same order `/app/launch` itself walks), else the nearest content item
scheduled within three days that she hasn't posted, else nothing. The launch-step branch reuses
`LaunchStepDetail` and `LaunchStepActions` WHOLE — the same copy blocks and the same Mark done / Skip for
now write `/app/launch/[stepKey]` uses, kept in the product's own ink-black button styling on purpose (it is
the identical button; recoloring it only here would make the two disagree). The content-item branch is new
to this card, and its one action — "Open it" — is styled in her primary colour with `cta_ink` for the label:
`buttonClasses("primary")`'s shape with the two colors overridden inline.

**The week strip.** Seven day letters, a dot under any day carrying a content item (read `scheduled_for` off
the already-loaded month — the one line of composition the brief asked for), today underlined in her
primary.

**"Since you were here" — now from the notifications table.** At most three rows, a hairline between them,
each a real link. The retired "Your site instructions are ready" top banner folds in as the first row, under
the exact condition that used to raise it, so the hero no longer competes with a full-width bar above the
fold. `content_ready`'s `payload.item_id` was checked before trusting it as a link target — see FINDINGS.md,
it references a table this chantier made dead — so that kind routes to the calendar, never to the id.

**The right column — the launch ring.** A read-only summary, deliberately not the interactive accordion:
the one actionable step already lives in "Next," so this card is a glance at the rest, not a second place to
click Mark done. When all seven are done or skipped, the ring is replaced by the quiet line and the Monthly
Presence card takes its position, unchanged from before this rewrite.

### Two more named exceptions to "her brand colour only inside canvases"

The brief's own item 3 and item 4 explicitly asked for them: the Next card's stand-alone button on a content
item, and the week strip's today-underline. Both commented at the call site. Recorded in FINDINGS.md so a
later session reads them as ratified rather than drift to "fix."

### What did not change

`EmptyHome` (no project yet) is untouched — items 1-7 describe "your practice this week," which presumes a
practice, and there is nothing to make a week of before one exists. The two intermediate states (a project
with no kit yet; a kit with no direction chosen) keep the same prompt cards as before, under the new header.

`loadHome`/`HomeModel` stay the shared aggregate `GET /api/home` and five other routes read for `brandKit`
alone — the new site-spec/photo/notifications/next-action/week-strip composition lives in a SEPARATE
function, `loadHomeCanvas`, called only from `/app` itself, so those five routes don't pay for what only the
home screen needs. "The screen and the route cannot diverge" was about `loadHome`; this doesn't touch that.

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

---

## 2026-09-08 — the brand kit, split into a section switcher

`/app/brand-kits/[id]` shipped as one long scrolling page with a floating anchor list. It is now a shell —
a header band and a persistent left rail — around one section at a time. Composition and routing only: no
migration, no new table, no model call, `lib/images` untouched except through its already-exported read
functions.

### The route family

Seven routes under `app/app/brand-kits/[id]/(sections)/` — Overview (`page.tsx`), `identity/`, `colors/`,
`type/`, `site/`, `words/`, `assets/`. **The parentheses add nothing to the URL**: `page.tsx` is still
`/app/brand-kits/[id]`, `colors/` still `/app/brand-kits/[id]/colors`. The group exists so
`(sections)/layout.tsx` wraps the sections and nothing else — `reveal/`, `delivered/`, `handoff/`,
`uploads/` and the site editor are siblings outside it, and each has its own reason not to carry a
paid-kit rail.

`lib/data/kit-page.ts` is the aggregate. `React.cache`d, and it takes **the kit id and nothing else** — a
Supabase client passed in is a new object per call, would key every caller differently, and would silently
double every query inside it. The entitlement guard lives there once, in the order that matters: 404
before `payment_required`, because a 402 shown to a stranger confirms the kit exists and that its owner
has not paid. `brand-kit-entitlement.test.ts` gained a third guard mechanism for it and asserts the shared
guard is itself real rather than trusting a function name.

The assets route reads its manifest from that aggregate rather than calling `loadAssetStats` again: the
band already needed it for the counts, so folding it in removed a round trip and costs nothing.

The floating scroll-spy list is **deleted, not adapted**. `KIT_SECTIONS` in `lib/kit/sections.ts` is the
one list; the rail reads the active item from `useSelectedLayoutSegment()`, holds no state of its own, and
an unknown segment marks nothing rather than falling back to Overview.

### The site editor moved, and this is the thing to know

**`/app/brand-kits/[id]/site` is now the kit's "Your site" SECTION. The editor is
`/app/brand-kits/[id]/site-editor`.** The section list needed the name `site/`, and the editor could not
be squeezed into the shell: its own layout law is a 360px control rail beside a 900px mockup, breaking at
1100px, which a 212px section rail does not survive. Ten internal links were retargeted (home, the
checklist card, the launch flow, `hrefForNotification`, the site card, the kit's own Overview).

Verified afterwards, and worth not re-verifying blind: **nothing outside the frontend stores an app
route.** All 217 text/jsonb columns in `public` were scanned for `/app/brand-kits` — zero rows. See
FINDINGS.md for the static half of that check. No redirect was added because nothing needs one.

### The tile that did not ship

The band carries three counts, not four. There is **no `Total downloads` tile**, and the reason is not
that the number is hard to get. `brand_assets.download_count` is an integer on the asset row, and the row
is keyed by fingerprint — the first time she changes a colour, every current asset becomes a new row with
a count of zero and any lifetime total silently restarts. A figure that resets when she edits her palette
is not one this product can show. **Do not "add it back"; it needs an events table, not a bigger integer.**

`BRAND ASSETS 28` and `DOWNLOADABLE FILES 28` were the same number by construction (one file per catalogue
key), so `downloadableFileCount` is gone. `Asset categories` replaces it, derived from the same rows — the
library had been computing that from `GROUP_ORDER.length`, a flat six, whatever the kit contained.

The band's tile is labelled **`Assets ready`**, not `Total assets`, because the library one section over
opens on `All assets (N)` which counts every catalogue key including the unrendered and the stale. The two
differ on any kit that has either, and `Total` beside `All` gave the reader no way to tell which one
excluded something.

### The four production defects, and the closing pass

`YOUR FIRST WEEK` drew its bar and count twice when expanded — and the two could disagree, because
`LaunchChecklist` counts its own optimistic state while the summary row read a server prop. The Colors
canvas had two independent causes, not one (a `top-full` tag needs the flow to leave it room; a wide tag
centred on a narrow pill overflows into an `overflow-hidden` edge). The account chip's name now falls
through `full_name → practice name → first name from the brief → email local part`, and the avatar
initials follow the same resolved name. The wrong-highlight defect died with the route split, confirmed
rather than assumed.

The closing pass then: scoped both download-count labels to the version they count; moved the kit-shaped
loading skeleton down into `(sections)/` (it had been at `[id]/`, flashing a header band and a rail at
five screens that are not the kit); gave `AssetDetailPanel` **two different answers at two widths** — a
labelled `region` beside the grid above 900px, a real `role="dialog" aria-modal="true"` with a focus trap
and a backdrop below it, because one answer is necessarily wrong at one of the two; and rewrote the
Overview's `Status` tile, which had said "N assets need rebuilding" — a chore with no button, when
`ensureAssetRendered` rebuilds a stale file on the next download at no cost and no credit.

### What a later session should not undo

- **The aggregate takes an id, not a client.** Adding the client back to the signature breaks the memoisation
  invisibly.
- **The guard lives in `requireKitPage`, once.** Seven pages re-deriving 404-before-402 is seven chances to
  invert it.
- **`Assets ready` and `All assets (N)` are two different sets on purpose.** They are not a bug to reconcile.
- **The rail holds no state.** `useState` in `kit-rail.tsx` is what the scroll-spy defect was.
- **The site editor is at `/site-editor`.** `/site` is the section.

---

## 2026-09-09 — the meters, the image runbook, and the tier guard

### Which report was right about the credits

Two reports from this chantier contradicted each other. **Session 3 was right; the final report was half
wrong.** Traced rather than remembered:

- **Images already spent `plans.image_budget_cents`** and had since the backend migration of 6 September.
  `lib/images/generate.ts` reserved through `reserve_image_regeneration` and never reached
  `consume_generation_credit`. The final report's "nothing routes to `plans.image_budget_cents` yet" was
  simply false.
- **The Check rewrite really did spend the directions meter** — `app/api/check/rewrite/route.ts`, one
  `consume_generation_credit` call on every rewrite that resolved. The final report was right about that
  half, and it is the half that mattered: a brand regeneration, sold at 79–249 USD, charged for a text call
  costing a fraction of a cent.

### What each path spends now

| path | meter |
| --- | --- |
| brand images (first seven AND regenerations) | `plans.image_budget_cents`, reserve → settle, in cents |
| direction regeneration | `consume_generation_credit` — unchanged, and now its only caller |
| Check rewrite | neither; a per-user daily count |

Every image reserves now, not only a regeneration. The first seven "drew on nothing", which is true of the
price and false of the accounting: it left the operator's GLOBAL daily ceiling as the only record of what a
kit's photographs had cost. **The budgets were sized when only regenerations drew on them, and were
raised the same day** — 100/250/500 → **200/400/600**, leaving 141/341/541 cents of headroom after a full
set (59c). Any change to the price table or the slot list moves that arithmetic; the three numbers were
chosen against 59c.

The Check rewrite is bounded by `consume_check_rewrite()`, twenty per user per UTC day, the number in
`app_settings.check_rewrites_per_user_per_day` so it moves without a deploy — **raised to 50 the same
day**, because twenty is reachable in a first honest session (six flagged sentences worked twice is
twelve) and the refusal lasts until the next UTC day. Counted BEFORE the call and regardless of outcome: a
bound that only counts successes does not bound a script whose rewrites all fail.
Refusal is 429 with `retry-after`, never 402 — nothing is for sale that lifts it.

**Do not put this back.** `app/__tests__/meters-are-not-conflated.test.ts` walks every import chain from the
four image entry points and fails if any reaches `consume_generation_credit`, if the reservation stops
preceding the model call, if a failing exit stops releasing, or if any new file in `app/` or `lib/` starts
spending the directions meter. That last assertion is a closed list of exactly one file. The monthly content
generation — the next chantier — is precisely the path that must not join it.

### The image run

`scripts/brand-image/preflight.ts` refuses the run from a checkout that is behind `origin/main`, disagrees
with it about `IMAGE_PROMPT_VERSION`, or has uncommitted changes under `lib/images/` or
`scripts/brand-image/`. Four earlier rounds failed exactly there and reported `already_ready`, which is
correct and unreadable. Every fix it prints is a `git stash push`; a test fails if a discard ever appears in
one.

Seven slots, **59 cents** at `IMAGE_PROMPT_VERSION` 7, computed from the production price table
(`lib/images/config.ts`): hero 25c, two ambients 7c each, four squares 5c each. All seven are `enabled`.
The runbook is in the session report.

### `min_tier`

Inventory: `min_tier` is written in `asset_catalog` only — 35 rows, **all `starter`** — with a CHECK
constraint over (`starter`, `practice`, `signature`) and no reader anywhere. The 39 USD/month subscription is
NOT a tier: it is a `subscriptions` row answered by `isEntitledToMonthlyPresence`, and it stays out of this
mechanism. Production holds **4 paid purchases, all `practice`, and 1 live paid kit** — so no grandfathering
path is needed, and no Starter buyer exists to have received too much.

Built: `lib/billing/surfaces.ts` (the map, 19 surfaces, **every row `starter`**) and
`lib/billing/surface-access.ts` (the one guard, 404 before `payment_required`, unreadable tier fails closed).
`components/billing/tier-upgrade-prompt.tsx` is the named upgrade path.

**THE DISTRIBUTION LANDED THE SAME DAY**, from the owner. Six rows above `starter`:

| tier | surfaces |
| --- | --- |
| Practice | `site_editor`, `assets_sizes_and_formats`, `assets_in_situ`, `ethics_rewrite` |
| Signature | `assets_version_history`, `designer_handoff` |

The other thirteen are `starter` — the whole kit, every file, the PDF, the archive, her own uploads and the
ethics scan. `own_uploads` stays `starter` deliberately: uploads are bounded by a QUOTA (10 MiB a file,
50 MiB and 24 files a kit, in `app_settings`), and that quota is global rather than per-tier.

All nineteen surfaces consult the guard, including the thirteen that can never refuse — a surface that
consults nothing is the one nobody remembers when a row moves. Every refusable surface is guarded at its
ROUTE as well as on screen, with one documented exemption (`assets_in_situ` fetches nothing of its own).
`surface-access.test.ts` pins every row against a hand-written copy of the decision, so a tier change
cannot arrive inside a diff that was about something else.

**Sold names live in `lib/billing/tier-names.ts`, and only there.**

    starter → "Brand Kit"        $79
    practice → "Brand Kit Plus"  $149
    signature → "Practice Suite" $249

`starter`/`practice`/`signature` are enum values in `purchases.tier`; they are not what anyone bought, and
`purchases.tier` is never rewritten to match a marketing change because it records what was charged. The
file shipped for one day holding the enum values capitalised — plausible, and wrong, and uncatchable by
any test. Copy that builds a sentence from one of these says "comes with", never "is part of": the names
are nouns, and "is part of Brand Kit Plus" reads like a row in a comparison table.

**A refusal never replaces what she paid for.** Two registers, chosen by POSITION and not by taste:

- `<TierUpgradePrompt>` stands IN PLACE of a surface — a whole editor, a whole handoff sheet. Price,
  tagline, one button.
- `<TierLine>` sits BESIDE something she is using. One sentence, the tier name carrying the link, no
  price and no argument.

Check is the case that decided it. The scan, the named rule, its rationale and her own words are hers on
every tier — a scan that alarms about her licensing board without teaching her what to change is a sales
vitrine. So the refusal renders INSIDE each blocking finding, under the rationale, exactly where a
generated alternative would have been, and the whole-text rewrite button disappears rather than refusing
on click. Same instinct in the asset panel: without Brand Kit Plus the split button degrades to the plain
download (she keeps the file), and one line underneath names what the other sizes come with.

**Uploads: 60 files and 200 MiB per kit, per-file cap unchanged at 10 MiB, and NOT a tier.** Her own files
are the substitute for the portrait Eklio refuses to generate; rationing them to sell a bigger plan is
petty. 19.53 GiB of ceiling at a hundred kits, against 4.88 before.

---

## Practice Suite includes three months of Monthly Presence

**It is the subscription, not a flag.** Buying Practice Suite creates a real Stripe subscription with a
90-day trial. `subscriptions.status` is `trialing`, and `subscriptions.active` — generated, added back in
`20260827106000` — has read `status in (active, trialing)` since long before this lot. So
`isEntitledToMonthlyPresence` learned **nothing**: no `trial_end` comparison, no included-months counter,
no boolean. One copy of the fact, same principle as the publishing log being the publication state. Two
columns were added (`trial_end`, `trial_notice_sent_for`) and **neither is an entitlement input** — a
migration guard rail fails if `active` ever starts reading `trial_end`, and a test asserts `active` stays
true for `trialing` with a null, past and future `trial_end`.

**The kit is charged in `payment` mode; the subscription is created afterwards, by the webhook.** The
obvious shape — one `mode: "subscription"` session with both lines and `trial_period_days: 90` — was
rejected: a one-time line item becomes a posting on the subscription's first invoice, and with a 90-day
trial that invoice may not be issued for three months. Delivering a $249 kit and collecting nothing until
day 91, on a subscription she can cancel, is not a risk worth taking for a saving of one API call. I could
not verify Stripe's exact behaviour here (docs are blocked from this environment), so the design makes the
question moot rather than answering it wrongly. `setup_future_usage: "off_session"` saves the card so the
subscription has something to charge at day 91.

**Already subscribed → three months ADDED, never a second subscription.** Stripe does not deduplicate:
a second subscription-mode checkout for the same customer creates a second subscription, which is why
Stripe publishes a page called "Limit customers to one subscription". `planIncludedMonths` (pure, tested at
the boundaries) extends the existing subscription's `trial_end` by 90 days from **the end of what she has
already paid for** — never from today, which would swallow the days she has bought — and never from a past
date, which would hand a `past_due` subscriber a trial that expired before it started. `proration_behavior:
"none"`, so she gets the three months sold and not a bonus credit for the current period.

**Seven days' notice, and the number is not arbitrary.** California's Automatic Renewal Law (Bus. & Prof.
Code § 17602, amended 1 July 2025) requires, for a free trial longer than 31 days, a notice between **3 and
21 days** before it converts, naming the renewal terms, the amount, the frequency and how to cancel. Ninety
days is well over 31. Seven sits inside the window with four days of slack against the legal floor — the
sweep runs daily, and a notice due at day 3 that slips one day is unlawful. Twenty-one would be read and
forgotten. Seven also matches Stripe's own trial-ending default, so a customer who gets both gets them the
same day.

**The notice is transactional and bypasses the marketing email machinery.** `lib/email/state.ts` enforces a
72-hour all-types cooldown, a never-repeat-a-kind rule and a marketing unsubscribe — all correct for nudges,
all wrong for a message that announces a charge. Deduplication lives on `subscriptions.trial_notice_sent_for`
instead, which stores **which** trial end was warned about rather than whether one was: a replayed sweep is a
no-op, and an *extended* trial earns a fresh notice, which a boolean would have swallowed. The notice carries
no unsubscribe link, and a test asserts it never gains one.

**Cancelling now works, because there is now a way to cancel.** `cancel_at_period_end` had been stored and
read since Lot 4, and nothing in the product could set it. `/api/billing/portal` opens Stripe's billing
portal, with `flow_data.type = "subscription_cancel"` deep-linking straight to the cancellation screen
rather than a dashboard she has to search. It is reachable from Settings (`#subscription`, the anchor the
notice email links to) and it is deliberately ungated: gating the exit is the one thing a subscription must
never do.

**The two purchases are independent, in both directions, and it is written as tests.** No subscription
event writes to `purchases`, no allowance, no status transition; no refund or dispute event writes to
`subscriptions`. `surfaceAccess` takes only the purchased tier and its source contains no reference to a
subscription; `isEntitledToMonthlyPresence` takes only a subscription and its body references neither
`purchases` nor `tier`. Cancelling removes Monthly Presence and nothing else — every Practice Suite surface
stays open at `signature` — and a refunded kit leaves the subscription untouched.

Production check while writing this: 4 paid purchases, all `practice`, zero `signature`; 1 subscription row,
0 `trialing`. Every line of this lot is unexercised by real data. The first Practice Suite sale is the
integration test.

---

## The notice is stamped only when it is delivered, and no tier is named by hand

**"Not configured" was returning a success shape, and that was a compliance defect.** `sendEmail` answered
`{ ok: true, delivered: false }` when `RESEND_API_KEY` was missing; the sweep read `ok` and stamped
`trial_notice_sent_for`. On a deployment without the key that marks every trial warned, warns nobody, and
lets the charge go out — against a notice California requires (Bus. & Prof. Code § 17602). Three locks now:

- `SendOutcome` is three branches, not `delivered: boolean`. Only `delivered: true` licenses a stamp, and
  the type makes `ok && delivered` the obvious read.
- In **production** a missing key is `ok: false`. Nothing ever claims to have sent. In development it stays
  `ok: true, delivered: false, reason: "not_configured_dev"` — nobody is billed locally, and requiring the
  key would stop the project running.
- The sweep returns before the stamp when `delivered` is false, leaving the row due so the next day retries.
  Seven days of window against a legal floor of three is exactly the room for four retries — which is why
  the window is seven and not three.

**A silently-absent variable now refuses to serve.** `lib/env/required.ts` lists only variables whose
absence is *silent*: Stripe keys throw `StripeConfigError` at first use and are deliberately not in it. The
criterion is written into the file, and the reason is stored beside each name so the boot failure explains
itself. Measured on Next 16.3.0: `next build` still succeeds (the hook does not run at build time), and
`next start` prints the reason then answers 500 to every request. Loud, immediate, visible at deploy — and
not a clean crash, which is recorded rather than glossed.

**The meta description said "Starter $79, Practice $149, Signature $249".** Enum values from
`purchases.tier`, in the string Google shows as a snippet and every link preview renders — three product
names nobody sells, at the top of the funnel. It is now built from `ORDERED_PLANS`, so name and price both
come from `SOLD_TIER_NAME` and the catalogue: *"Brand Kit $79, Brand Kit Plus $149, Practice Suite $249."*

**The sweep found nothing else, and now enforces that.** Five files declare metadata; only `/pricing` named
a tier. There are **no Open Graph tags and no JSON-LD anywhere** in the repo, and no email subject names a
tier. The enforcing test walks `app/` rather than reading a hand-kept list, so a new page cannot escape it;
it bans the enum names in metadata and email subjects; it fails the moment an `openGraph` or `ld+json`
block appears, forcing it through the same sweep; and a canary re-feeds the exact string that was in
production to prove the rule bites — it fails three assertions.

---

# CONTENT CHANTIER — Session 1: inventory

Read-only. No schema, no code, no migration touched. Only this file and
`FINDINGS.md` changed.

**Starting state:** frontend `main` at `c85eb1c` (the brief said `bc26d83`, which
is one commit behind — `c85eb1c` is the delivery-stamp and tier-name lot).
Backend `main` at `8343e9f`, as stated. Both trees clean.

## The dead table has TWENTY tendrils, not three

`monthly_presence_content` holds **0 rows** in production and has never held
any. The brief named three tendrils; there are more, and two of them are
`SECURITY DEFINER` functions that run for every user on every home visit.

**In the database (backend):**

1. The table itself — 13 columns. ⚠ Its LIVE shape is **not** the one in
   `20260825160000_lot4_billing.sql`: `20260827105000_monthly_content_calendar.sql`
   reshaped it from `(project_id, month, content jsonb, status)` to
   `(user_id, brand_kit_id, month, day_of_month, type, title, caption,
   visual_spec, published_at, status)`. Reading only the creating migration
   gives the wrong table.
2. 4 RLS policies — `select_own`, insert/update/delete denied.
3. 4 indexes, including the unique `(brand_kit_id, month, type, day_of_month)`.
4. 7 CHECK constraints, including `status in (locked, draft, ready, published)`
   — a *different* status vocabulary from `content_items`.
5. Trigger `set_monthly_presence_content_updated_at`.
6. RPC `calendar_summary(uuid, date)` — invoker rights. **Named in the brief.**
7. RPC `ensure_month_skeleton(uuid, date)` — invoker rights. **Not named.**
8. RPC `home_recent_activity(uuid)` — **SECURITY DEFINER**, reads it to build
   the home screen's "content that became ready" list. **Not named.**
9. RPC `sync_notifications(uuid)` — **SECURITY DEFINER**, this is what actually
   INSERTS `content_ready` notifications with `payload.item_id`. **Not named**
   (the brief named the payload, not its writer).
10. `notifications.kind` CHECK — includes `'content_ready'`.
11. Partial unique index `notifications_content_ready_idx` on
    `(brand_kit_id, (payload ->> 'item_id')) WHERE kind = 'content_ready'`.
    **Not named.** The payload SHAPE is load-bearing in an index.

No views reference it. No foreign key points at it. Nothing cascades from it.

**In the frontend:**

12. `app/api/cron/monthly/route.ts` — the generator. Five read/write sites.
13. `lib/generation/monthly.ts` — its generation half.
14. `lib/presence/month.ts` — month normalisation written for its `date` CHECK.
15. `lib/kit/render/social-posts.ts` — names it as the "primary source" the
    satori post renderer deliberately did **not** wire in.
16. `lib/data/home.ts` — `hrefForNotification` special-cases `content_ready`
    and routes it to `/app/content` rather than to an item, precisely because
    `payload.item_id` is an id in the dead table's id space.
17. `types/supabase.ts` — Row/Insert/Update plus the two RPC signatures.
18. `app/__tests__/one-month-model.test.ts` — already enforces that nothing
    reads the old model **except one allow-listed file**, the cron. Its
    `PARKED` map is the retirement checklist Session 2 needs, pre-written.
19. `components/home/content-grid.tsx`, `app/app/content/page.tsx` — comments
    recording the migration away from it. Prose, not tendrils.

**And one the brief got wrong, in our favour:**

20. `vercel.json` — the monthly cron is **already disarmed**. It was armed in
    `0f8a908` and removed in `14c6725` ("Disarm the monthly cron"). The route
    file still exists and still answers to `CRON_SECRET`, but Vercel does not
    call it. Nothing is scheduled against the dead table today.

**Production evidence:** `notifications` contains only `asset_rendered` rows.
No `content_ready` notification has ever been created, so the `item_id` tendril
has never fired against real data. Retirement can drop it without a data
migration.

## `content_items` — the live model

Columns: `id, brand_kit_id, archetype, status, title, caption, alt_text,
tags text[], category, image_slot, scheduled_for, created_at, updated_at`.

- **There is no `month` column.** The month is derived from `scheduled_for`
  (a `date`), and `scheduled_for` is NULLABLE — an item with no date lands in
  an `unscheduled` bucket, not in a month.
- **States: `draft | ready | archived`.** No `proposed`, no `posted`.
  `posted`/`posted_at`/`channel` are DERIVED from the last row of the
  append-only `content_publications` log, in the database. There is no parallel
  column and Session 2 must not add one.
- **Archetypes: `statement | question | notes | signature | story`** — five,
  and they are *not* the brief's six registers. They came from asset-catalogue
  keys (`post_statement_1080` etc.). Mapping six registers onto five archetypes
  is an open decision for Session 2/3, listed under Open questions below.
- **RLS: `select_own` only; insert, update and delete are all `false`.** Every
  write goes through one of eight `SECURITY DEFINER` RPCs:
  `create_content_item`, `update_content_item`, `delete_content_item`,
  `get_content_item`, `get_content_month`, `get_publishing_log`,
  `mark_content_posted`, `content_item_json`.

**Readers:** `lib/data/content.ts` (the only data layer),
`app/api/brand-kits/[id]/content`, `app/api/content-items/[id]`,
`app/api/content-items/[id]/posted`, `app/app/content` (calendar, item, log),
`components/content/content-calendar.tsx`, `components/content/item-editor.tsx`,
`components/home/content-grid.tsx`.

**Production rows: three, not two.** All `draft`, all `title` NULL (hence
"Untitled"), no captions, no alt text. Two are scheduled 2026-09-08 (both
`question`) and one is unscheduled — which is why the September calendar shows
two. `Ready 0` and `Posted 0` are literally true: nothing is `ready`, and
`content_publications` is empty.

## What the interface assumes

- **The alt-text rule does not exist.** There is no "alt text before `ready`"
  gate anywhere — not in the CHECK constraints (only `char_length <= 420`), not
  in `update_content_item`, not in the editor. `status` is a plain dropdown, and
  alt text is a field with the hint *"Worth writing before you post, not after."*
  Session 4's "alt text before `ready`" is a rule to BUILD, not to keep.
- `Mark as posted` → `mark_content_posted(p_id, p_posted, p_channel)`, which is
  idempotent: re-marking an already-posted item writes no log row.
- The publishing log is `content_publications`, append-only, client-unwritable,
  with `action in (published, unpublished)` — so unpost-then-repost leaves
  history rather than overwriting it.
- Channels: `instagram | facebook | linkedin | newsletter | other`.
- `image_slot` names one of the seven photograph slots but is deliberately NOT
  a foreign key — an item may name a slot before that slot has generated.

## Where the brief's answers live

`project_briefs`, one row per project, 33 columns across seven steps
(`practice, positioning, client, how_you_work, voice, look, website`).

**Voice / substance — what a caption can be written from:**
`positioning`, `problem_card_ids`, `gain_card_ids`, `data->>'problem_text'`,
`data->>'gain_text'`, `client_persona_ids`, `specialty_ids`, `license_type_id`,
`session_style_ids`, `modality_ids`, `modality_prominence`, `not_a_fit_ids`,
`not_a_fit_text`, `referral_quote`, `prior_career` (+ `prior_career_public`),
`usp_statement` / `selected_usp_id` / `usp_options`, `tone_card_id`,
`tone_cards`, `practice_name`, `city`, `state`, `site_goal_ids`,
`primary_action_id`.

**Visual only — must never reach a caption:**
`palette_family_ids`, `type_pairing_id`, `builder_target_id`,
`tone_cards_inputs_hash`.

`tone_card_id` is the hinge: it drives the visual preview AND is the closest
thing to a voice setting. `referral_quote` ("what a colleague would say", ≥20
chars, mandatory) and `not_a_fit_text` are the two free-text fields with real
voice in them.

## The image machinery

- **Seven slots**, `lib/images/config.ts`: `hero, ambient_a, ambient_b,
  post_bg_1..3, texture`. Each carries size, quality, `enabled`, a closed
  `brief`, and optional `slotExclusions`. `{subject}` is substituted from the
  specialty's object register.
- **Model pinned to `gpt-image-1`** in one place, deliberately not
  `gpt-image-2`, because a flat per-image price is required to reserve a spend
  cap BEFORE the call.
- **`IMAGE_PROMPT_VERSION = 7`**, hashed into the fingerprint.
- **Fingerprint** = SHA-256 of exactly `{toneKeywords, palette{6 roles},
  specialty, promptVersion}` — projected, never spread, so a caller handing over
  a wider object cannot silently widen the hash.
- **Reserve/settle**: `reserve_image_regeneration(kit, cost_cents)` →
  `settle_image_regeneration(kit, cost_cents, succeeded)`, wrapped as
  `reserveImageSpend` / `settleImageSpend`, drawing on `plans.image_budget_cents`
  (free 0, starter 200, practice 400, signature 600). Reserved before the call,
  released on failure.
- **Satori composition**: `lib/kit/render/social-posts.ts` renders the five
  post/story archetypes at 1080/1920 from `kit.socialTemplates`.
- **Measured scrim**: `lib/kit/render/luminance.ts`. Pixels are LINEARISED
  before averaging (WCAG relative luminance is defined on linear channels;
  `sharp().stats()` averages gamma-encoded values and overstates dark regions).
  Target `CONTRAST_TARGET = 4.5`, ceiling `MAX_SCRIM_OPACITY = 0.92`, solved by
  a 1%-step climb. Regions are fractions of the frame: `HERO_TEXT_REGION` is the
  left third, `POST_TEXT_REGION` the upper two thirds. The achieved ratio is
  reported in the asset's spec line.

## Two guard tests that will bind later sessions

- **`app/__tests__/content-never-generates.test.ts`** forbids every spending
  path (`consume_generation_credit`, `image_budget_cents`,
  `reserve_image_regeneration`, `OPENAI_API_KEY`, `anthropic`, …) from appearing
  anywhere under `lib/data/content.ts`, `lib/content`, `app/api/content-items`,
  `app/api/brand-kits/[id]/content`, `app/app/content`, `components/content`.
  Its own header says it is *meant* to go red when the generator arrives.
  **Session 3 must change it deliberately, not delete it** — and the new
  allowance must be added to `SPENDING` so the kit's lifetime budget stays
  forbidden on those paths.
- **`app/__tests__/one-month-model.test.ts`** enforces that only
  `app/api/cron/monthly/route.ts` may name the old model. Session 2's step 0
  empties `PARKED` and then `OLD_MODEL` should be unreachable everywhere.

## Open questions for Session 2 — answer before building

1. **Six registers vs five archetypes.** `content_items.archetype` is a CHECK
   over five values tied to asset-catalogue keys and to the satori renderer.
   The brief's six registers are a different taxonomy. Extend the CHECK to six,
   add a separate `register` column, or map? This changes the renderer.
2. **`posted` is not a status.** The brief writes `proposed → draft → ready →
   posted`, but `posted` is derived from `content_publications` and Session 4
   confirms the log "IS the publication state, with no parallel column". Reading
   the arrow as three statuses plus a derived fourth.
3. **There is no `month` column.** A "month record holding the four themes and
   the generated grounds" needs a month key; `content_items` derives its month
   from a nullable `scheduled_for`. The month record's key and the item→month
   link both need deciding.
4. **The cron route still exists, disarmed.** Retiring the table means deleting
   `app/api/cron/monthly/route.ts` and `lib/generation/monthly.ts` outright.
   Confirming that is the intent rather than porting them.

**Session 1 ends here. Nothing was built.**

---

# CONTENT CHANTIER — Session 2: retirement, then schema

Frontend `main` `c29e0a5` → `436625d` → (this). Backend `8343e9f` → `328544d` → `726de66`.

## The retirement order, which was the one hazard

**One migration, not five** (backend `20260910082539`). `home_recent_activity` and `sync_notifications`
both run on every home visit; between two migrations there is a window in which one of them selects a
table that is already gone — a 500 on the home screen of every paying customer. Postgres DDL is
transactional, so a single migration has no such window.

Inside it, each step removes only what nothing still standing refers to:

1. **Both readers replaced first.** After this, nothing executable depends on anything below.
2. **Rows deleted.** No `content_ready` notification has ever existed in production, but step 4 would
   fail against one and "there are none" is a fact about today.
3. **`notifications_content_ready_idx` dropped.** It existed only to serve step 1's `on conflict`.
   Dropping it FIRST would have broken dedup for the length of the window; after, it is inert.
4. **`notifications.kind` narrowed** to the two kinds that remain.
5. **`calendar_summary` and `ensure_month_skeleton` dropped.**
6. **The table last**, cascade taking its trigger, four policies, four indexes, seven CHECKs.

Verified live: table gone, both RPCs gone, index gone, CHECK narrowed, 24 `asset_rendered` notifications
intact, `content_items` untouched at 3 rows. Both home functions execute, and their `else` branches —
which plpgsql plans lazily, so the not-found smoke test never reaches them — were run verbatim against a
real kit and returned 28 real assets.

**Frontend:** `app/api/cron/monthly/route.ts`, `lib/generation/monthly.ts` and `lib/presence/month.ts`
deleted outright. `one-month-model.test.ts`'s `PARKED` allow-list is now **zero entries** — a stronger
invariant than one — and it asserts the three files stay deleted.

## The schema

`20260910083735` (tables) and `20260910084320` (write path).

- **`content_registers`** — the six editorial shapes as a CATALOGUE TABLE, each carrying its safety rule
  as data. A table rather than a CHECK because the six are needed twice (one per item, a set per kit),
  and two CHECK lists holding the same six strings is the drift being avoided.
- **⚠ Register and archetype are DISJOINT by construction.** `question` as a register is
  `reflective_question`. A guard rail fails the migration on any overlap, and tests prove both
  directions. This is the `min_tier` lesson applied in advance.
- **`content_preferences`** — cadence (1/2/3), `accepted_registers` validated by a TRIGGER against the
  catalogue (an array cannot carry a foreign key), `off_limits` bounded at 500 chars because it enters a
  prompt.
- **`content_checkins`** — three nullable fields per (kit, month). `taking_clients` is
  `yes|waitlist|no`, not a boolean: a waitlist has its own copy, and squeezing it into yes/no would put
  "book now" in front of someone who can take nobody. An unanswered check-in never blocks a month.
- **`content_months`** — provenance. `themes` bounded 1..6, NOT pinned to four (see FINDINGS: the count
  is Session 3's to decide).
- **`content_grounds`** — rows keyed `(month_id, theme)`, each with fingerprint, storage path, cost in
  cents and reserve/settle state. A settled ground must have a storage path; the CHECK says so.
- **`content_image_allowance`** — one row per (kit, month), so **the reset is structural**: a new month
  has no row, and last month's exhaustion cannot reach it. Ceiling 100 cents in `app_settings`
  (a ground is 5c; four at the largest cadence is 20c; 100 is 5× that and ~2.6% of the subscription).
- **`content_items`** gains `register` (FK) and `month_id` (nullable FK), and `proposed` in front of
  `draft`. `posted` stays derived from `content_publications`.

**The alt-text rule is BUILT, not kept.** The generator writes the alt text — Eklio composed the image.
The RPC enforces only the floor: no `ready` with blank alt text, resolved against the state the patch
will LEAVE the row in, so the editor's combined save still works. Whitespace does not count.

**Write doors split by author:** she gets RPCs (`set_content_preferences`, `set_content_checkin`); months
and grounds get NO client door, because a server job writes them as the Stripe webhook writes purchases;
spending is revoked from `authenticated` entirely, reading her allowance is hers.

Every new table ships RLS + four policies in its creating migration, guarded. Non-owner tests ran live: a
stranger reads zero rows from all five per-kit tables, the owner reads her own, no client can update any.

## For Session 3

1. **How many themes per cadence** — the open decision, deliberately not frozen. Themes = grounds =
   image spend.
2. **`content-never-generates.test.ts` must go red and be changed deliberately.** Its own header says so.
   Add `reserve_content_image` / `settle_content_image` to its `SPENDING` list so the KIT's lifetime
   budget stays forbidden on content paths while the monthly one becomes allowed.
3. **Register → layout is the generator's second choice, not a mapping.** Pick the register first from
   her accepted list, write under its safety rule, then choose a layout that fits the text and the
   month's photographic/solid mix.
4. `content_kit_access` refuses an unpaid kit — every fixture needs a `paid` purchase with `paid_at`.

**Session 2 ends here. Nothing was generated.**

---

# CONTENT CHANTIER — Session 3: types, capacity, and a stop at the gate

## The types are real now

`eklio-backend/types/supabase.ts` was regenerated by Supabase's own generator (via the Supabase MCP
server, the same endpoint the CLI's `--project-id` path calls). 1,459 lines added, 24 removed. It now
carries `content_items`, `content_publications` and all six new tables, and zero references to the
retired one. It typechecks.

**The documented command could not run here**, for three independent reasons, all verified rather than
assumed: no `SUPABASE_ACCESS_TOKEN`, Docker not usable so `--local` has no stack, and `api.supabase.com`
refused by the network (`curl` returns 000). The file's header now records exactly how this copy was
produced and the one difference that remains: it reflects the LIVE project, not a clean replay of
`supabase/migrations` + `seed.sql`.

**To produce the canonical copy in a Codespace:**

```bash
cd eklio-backend
supabase start                      # replays supabase/migrations + seed.sql
supabase gen types typescript --local > types/supabase.ts
supabase stop
```

Then re-apply the hand-written ADDENDUM block if `supabase gen types` drops it (it lives only in the
FRONTEND copy today, so the backend file needs no addendum).

## The archetype capacities, measured

`scripts/content/measure-archetype-capacity.ts` — real typefaces from `type_pairings`, real geometry from
`lib/kit/render/social-posts.ts`, real English sentences, binary-searched against satori's own laid-out
height.

| Archetype | Size | Box | fraunces | cormorant | newsreader | lora | caslon | sourceserif | **Floor** |
|---|---|---|---|---|---|---|---|---|---|
| `statement` | 96px | 888×888 | 144 | 164 | 148 | 144 | 144 | 144 | **144** |
| `question` | 84px | 888×888 | 168 | 234 | 215 | 168 | 168 | 168 | **168** |
| `notes` | 44px | 888×776 | 517 | 576 | 472 | 576 | 492 | 492 | **472** |
| `signature` | 72px | 888×768 | 195 | 234 | 215 | 195 | 195 | 195 | **195** |
| `story` | 72px | 888×1568 | 454 | 535 | 489 | 454 | 431 | 431 | **431** |

The floor is what the generator must respect: it does not choose her typeface. Capacity varies ~60%
across pairings (Cormorant Garamond is narrow), so an average would overflow half the customers.

**⚠ These numbers sit BETWEEN `title` (34 chars) and `caption` (2200 chars).** See FINDINGS: what the
layout renders is neither field, and step 4 needs that resolved before the generator can pick an
archetype from "what the caption's length allows".

## The gate did not run, and why

Verified, not assumed:

- `api.anthropic.com` → **401** (reachable, no key). `ANTHROPIC_API_KEY` unset. No captions.
- `OPENAI_API_KEY` unset, and `api.openai.com` is under a standing "do not attempt". No grounds.
- No `.env.local` anywhere; only `.env.example`.

So twelve captions, three square grounds, one vertical ground and the composed posts cannot be produced
here. The generator was **not written blind** — writing an unrunnable pipeline and calling it done is the
across-sessions assumption this chantier's own scope rules forbid.

**Session 3 stops here. Nothing was generated. Two answers are needed before it resumes** — see the
report: the layout-text field, and where the generator should run.

---

# CONTENT CHANTIER — Session 4 (weekend mode): counts, approval, data layer

Operating mode changed: decisions are taken and recorded rather than escalated, and
`WEEKEND_REVIEW.md` is the deliverable. Everything awaiting review is there.

**The gate still did not run.** No `ANTHROPIC_API_KEY`, no `OPENAI_API_KEY`, no
`.env.local`. That is a missing credential, not a decision — "take the reversible option"
has nothing to choose between. It also blocks the captions-only adversarial batch. Recorded
at the top of `WEEKEND_REVIEW.md` with what unblocks it.

**The two pre-Content items were already done** (`c85eb1c`): the trial notice stamps only on
`outcome.delivered`, and the tier-name sweep shipped with its enforcement test and
`lib/env/required.ts`. Verified rather than assumed; no action taken.

## Counts stopped counting what she has never seen

`get_content_month`'s `scheduled` was `count(*) filter (where scheduled_for is not null)`,
which included `proposed`. The first generated month would have reported **"12 scheduled"**
for twelve captions she had not read. `scheduled`, `ready` and `posted` now all exclude
proposals; a separate `proposed` count was added, because "twelve waiting for you" is both
measurable and honest. `items` still returns proposals — we stop counting her content, we
never hide it.

## Approval is one statement

`approve_content_month` moves the batch `proposed → draft` in a single UPDATE. Twelve
separate updates can half-succeed, and there is no state in this product that describes
half a month. Scoped by `month_id`, not by date: a proposal she dragged into November still
belongs to October's plan and moves with it — selecting by `scheduled_for` would strand it
as `proposed` forever, greyed inside a month whose plan she had already accepted. Idempotent
on replay, reporting `moved: 0` rather than repeating a number to look busy.

## The types are generated in both repos now

Frontend and backend both regenerated with Supabase's own generator. The hand-maintained
ADDENDUM is spliced back into the frontend copy. Two real drifts surfaced and were fixed:
three call sites passing `null` for a defaulted RPC parameter, and a `MonthlyPresenceStatus`
union describing a retired table. The typegen guard's premise changed with the file — see
`WEEKEND_REVIEW.md`, Decision 3.

## Still to do in Session 4

The interface itself: the check-in card at the top of the calendar, the preferences step,
and the month-as-a-plan screen. The data layer they compose against is done and typed.

## Session 4, continued: the check-in

`components/content/check-in-card.tsx` + `app/api/brand-kits/[id]/check-in`. Three questions
on one screen, at the top of `/app/content` until `taking_clients` is answered — one answer,
not three, because it is the only field that changes what may be generated. Each answer
states its consequence, because "waitlist only" silently rewriting every call to action is
something a clinician should be told rather than left to notice.

Two guards fired and both were right. The brand-kits route guard: the route now returns
through `contentResponse` so `payment_required` stays a 402, and `DB_REFUSED` learned
`setContentCheckin`. The a11y guard wanted a literal `role="alert"` where the card delegates
to `<InlineError>`, which already has one — widened to accept either, plus an assertion that
`InlineError` really announces so the new branch cannot outlive it.

Remaining in Session 4: the preferences step, the month-as-a-plan screen (worth waiting for
the gate — designing it before seeing twelve real proposals is how art direction goes wrong
twice), and rendering proposals greyed in the calendar.

## Session 5 — the generator, the review screen, and the switch

Written under the weekend operating mode: take the reversible option, write down what you
chose and why, keep going. Every choice is in `WEEKEND_REVIEW.md` as a numbered Decision;
this is what was built.

### The on-image line is its own field

Backend `20260910100415`: `content_items.on_image_text`, capped at **480** — the largest
measured archetype floor (`notes`, 472) plus air. One column cannot carry five different
caps, so the tighter per-archetype floor is enforced by the generator, which is the thing
that knows which layout it picked.

`20260910100758` corrects the same hour's mistake. Adding the field to `content_item_json`
by retyping the function rather than editing it dropped `stable`, replaced the lateral join
with three subqueries, and let a `posted_at` survive an unpublish — `posted: false` beside
a filled date, which the editor renders. Restored verbatim with a guard rail per
regression. Kept as its own migration because the first was already applied and the record
of what the database did should not be rewritten after the fact.

**Recorded, not fixed:** `content_publications` tiebreaks on a random uuid, so
`order by occurred_at desc, id desc` is undefined for two rows sharing a timestamp.
Unreachable through the product — `mark_content_posted` refuses a no-op — and a monotonic
column is a change to the publishing model, not to this one.

### The generator

`lib/content/generate/`, in the ruled order — decide, then write to the decision:

| File | What it holds |
|---|---|
| `capacity.ts` | the measured floors, as data, and the 6–40 word bound |
| `plan.ts` | the pure decisions: register draw, archetype rotation, the schedule |
| `model.ts` | the one seam every model call goes through, and the prompts |
| `ground.ts` | the photograph prompt, reusing the kit's own master direction |
| `pipeline.ts` | the six steps, and the reservation |
| `stub-model.ts` | a labelled stub, so the whole pipeline runs without a key |
| `run.ts` | the adapter: real RPCs, real image client, real storage, persistence |
| `armed.ts` | the switch |
| `queue.ts` | "a month is coming", as a row |

Four posts a month per weekly cadence — four weeks' worth, not every Tuesday in the month.
A month with five Tuesdays would otherwise spend 25% more of a fixed allowance on a post
nobody promised.

The grounds are drawn only **after** every text has passed the Ethics Guard, so a month
that fails on its last post has cost nothing.

### The review screen

`/app/content/plan`, previewed on fixtures at `/dev/content-plan`. Grouped by theme, not by
date. Both texts shown, never the caption alone. Eklio chrome rather than her brand, on
purpose — see Decision 8 and the section under it.

`theme` got its own column (backend `20260910102753`) rather than borrowing `category`,
which is hers to rename.

### The preferences step, and the switch

Preferences asked once at the top of the calendar, permanently editable from Settings, each
register showing the **safety rule read from `content_registers`** — the same string the
generator is held to.

The monthly cron is written and shipped disarmed behind two locks; the first month at
purchase is queued through the same switch and writes nothing while it is off.
`WEEKEND_REVIEW.md` records where both locks are.

### Still blocked, and it is the only thing

The words. `api.anthropic.com` answers 401 from this environment and there is no key. The
Session 3 gate — twelve real lines, twelve real captions, three real photographs — runs the
moment one exists, and everything around it is finished and tested.

## THE MODEL VENDOR SPLIT — settled, and written down so nobody re-derives it

**One rule: OpenAI for images, Anthropic for text. Split by modality, not by feature.**

| Modality | Vendor | Key | Entry point |
|---|---|---|---|
| Text | Anthropic | `ANTHROPIC_API_KEY` | `lib/ai/client.ts` → `getAnthropicClient()` |
| Images | OpenAI | `OPENAI_API_KEY` | `lib/images/client.ts` → `openAiImageClientFromEnv()` |

Everything that writes a word goes through the first: brand generation
(`lib/generation/model.ts`), the Check rewrite (`app/api/check/rewrite/route.ts`), the
Ethics Guard's targeted rewrite, and the Content generator (`lib/content/generate/model.ts`).
Everything that makes a picture goes through the second: the seven brand photographs and
the Content grounds. `@anthropic-ai/sdk` is the only model SDK in `package.json`; the image
path is a hand-written `fetch` against `api.openai.com`, with no SDK at all.

### Why this is in the log rather than only in a comment

Because it was already once re-derived wrongly, from memory, by the person who set it up —
and the correction cost a ruling and a session. The sentence that caused it was *"every
model dependency in this product is already OpenAI"*, asserted from a picture of the
codebase rather than from the codebase. It is the kind of claim that sounds like a fact and
is checkable in ten seconds:

```
rg -l "@anthropic-ai/sdk|getAnthropicClient"   # every text path
rg -l "openAiImageClient|IMAGES_ENDPOINT"      # every image path
rg '"openai"' package.json                     # no match: there is no OpenAI SDK
```

**Check before ruling.** A ruling made from a remembered architecture can invert its own
intent: that one was written to protect "one vendor, one key, one outage surface" for text,
and following it literally would have added a second text vendor to a stack that had one.

### The rule for a future session

A new model dependency asks one question — *is this text or is it a picture?* — and the
answer names the vendor, the key and the client. There is no third option and no
per-feature choice. Adding a vendor is a decision that gets its own entry in this file,
with the reason it could not be done inside the split.

Superseded by this entry: the OpenAI-for-captions ruling recorded as Decision 5 in
`WEEKEND_REVIEW.md`. It was withdrawn by its author; the generator's existing Anthropic
seam stands unchanged. The seam itself is worth keeping for its own reason, not this one:
`ContentModel` is four methods, and every model call in a month goes through it, which is
what let the whole pipeline be tested before any key existed.

---

## 2026-09-12 — Chantier home-v3: the signed-in home at `/app`

Branch: `claude/bold-bohr-o9kv30`, frontend only. **Backend diff: zero**, as
expected — every zone was already readable, and nothing here added a column, a
migration, a dependency or an RPC.

Ten commits: one per lot 0–8, plus one fix pass after them.

### What the target was, and a note on the contract

⚠ **This chantier was built BY EYE against an image pasted into the session,
and the committed reference landed afterwards.** No PNG existed in either
repo's `design/` folder while the work was done. The reference is

    design/reference/home-v3-mockup.png
    design/reference/home-v3-current-01.png
    design/reference/home-v3-current-02.png
    design/reference/home-v3-current-03.png

committed by the chantier's author from their own machine — flat in
`design/reference/`, not in a `home-v3/` subfolder.

So a session reading those files is reading the reference this work was
*checked against by eye*, not a file any commit here was produced from. **Where
the committed PNG and what shipped differ, the PNG is the one to trust and the
difference is a real finding** — the zone-by-zone table is where those get
recorded. `design/reference/Screen 7
- Home.dc.html` is a *different, earlier* home: three nav items, a URL bar, a
2fr/1fr grid, no rail, no next-step card, no week strip. It was not used.

### What shipped

| Lot | What landed |
| --- | --- |
| 0 | `HOME_V3_MAPPING.md` — every zone traced to its read. No code. |
| 1 | The 48/26/22 shell, header row, sticky rail with a full-height rule, the 375px stacking order. |
| 2 | The hero canvas: browser chrome dropped, her three tone words over the photograph, the three stats tiles. |
| 3 | The next-step card re-skinned: `1 OF 7`, the asset row, the copy well, clay `Mark done`. |
| 4 | The rail: seven real states, four quick tools, her positioning quote, the mono meta footer. |
| 5 | The week strip: seven dates, content dots, the dates spelled out. |
| 6 | The sub-grid: recent updates, brand at a glance, upcoming content. |
| 7 | Chrome: nav icons and the active linen pill. **The third delta was refused — see below.** |
| 8 | The guards: purged strings, emoji, quote attribution, and the fixture-import guard. |
| — | A fix pass on four defects a 375px harness render exposed. |

### The mapping table

It lives in `HOME_V3_MAPPING.md` rather than being copied here, because it is
the artifact the next session checks a change against, and two copies of it
would disagree within a month. It names the source of every number, string and
image on the screen, the zones that collapse when their source is null, and the
two places the chantier's brief asserted something this repo does not carry.

### Zones that collapse, and why

- **Both quote slots** when `usp_statement` / `positioning` is null. No
  placeholder, no house quote.
- **The third stats tile** when nothing has been rendered yet.
- **The next-step asset row and copy well**, independently, when the step
  carries neither.
- **The `POSTS ON THE …` line** when no scheduled post falls in the visible week.
- **Recent updates** and **upcoming content** entirely, when empty.
- **Each meta-footer line** on its own.

### The third stats tile

`Rebuilt <N>`, from `summarizeManifest().lastUpdated` — the most recent current
asset's `created_at`. Chosen over image-slot count and colour count, which the
brief also offered, because both of those already appear in "Brand at a glance"
two rows below: a tile repeating a number one screen-height away is a
decoration, not a fact.

### The three substitutions

1. **`+42% Brand clarity`** → `Rebuilt 2d`, as above. The guard test caught the
   forbidden phrase in a *comment* of mine on the first run — it scans raw text,
   which is the point — so no comment in the new code writes it either.
2. **`Welcome back, <name> 👋`** → the mono date over the practice name, with a
   calm grey sub-line (`Your practice this week.`). Both the greeting register
   and the emoji are now named in the guard.
3. **The two quote slots** → `usp_statement` in the header, `positioning` in the
   rail, each labelled `FROM YOUR POSITIONING` and never with her practice name.
   A structural guard holds it: no `<figcaption>` in this repo may name the
   cabinet, and those two slots are held by name to carrying their provenance.

### The chrome

Two of three deltas shipped: icons in the four nav items (three of the four
marks already existed; only the home mark is new), and the active item as a
filled linen pill. Search and the bell were already there.

**The third delta is not shipped.** `Your workspace` under the account button
is forbidden *by name* in `app/__tests__/kit-defects.test.ts` ("défaut 3"),
which asserts `not.toContain('?? "Your workspace"')`, and `account-menu.tsx`
carries the reasoning: with one workspace the line names nothing. The monogram
half of that delta already exists and is unchanged. Reversing a tested defect
fix needs its author, not a mockup. It is a one-line change on request.

### What was run, and what it returned

| Check | Result |
| --- | --- |
| `vitest run` | 2382 passed, 120 files, 0 failed |
| `tsc --noEmit` | clean, from a cleared `.next` |
| `next build` | exit 0 |
| `eslint .` | clean |
| Extended purged-strings guard | passes — 19 assertions in `forbidden-metrics.test.ts` |
| `home-reads-production-only` | passes — 5 assertions, graph of 40+ modules from `app/app/page.tsx` |
| `prefers-reduced-motion` | nothing new needed: `app/globals.css` already flattens every animation and transition with `!important`, and nothing added here moves by other means |

Two tests were changed rather than added. `kit-has-no-hero-band` bound its
intent to `BrowserFrame`; the intent (the slot is alive, the photograph is
bounded, never a full-bleed band) is unchanged, and the assertion now holds the
chrome *out* instead of in. `forbidden-metrics` gained two phrases, an emoji
rule and an attribution rule.

### Harness renders — geometry only, NOT the production path

A temporary `/dev` route rendered `HomeView` against hand-built props typed from
the generated Supabase types, was screenshotted at 1440px and 375px, and was
**deleted before committing**. It is a harness. It says nothing about data:
every value in it was written by hand, which is exactly what the new
`home-reads-production-only` guard forbids on the real route.

What the harness measured:

- Rail at x=1125 of 1440, width 315 → **21.9%**, `position: sticky`.
- At 375px the vertical order is: header, hero canvas, next step, week strip,
  rail checklist, recent updates, brand at a glance, upcoming content, quick
  tools, meta — the stacking the chantier specifies.
- Touch targets under 44px: **2**, both pre-existing (`LaunchStepActions`).
  The four this chantier introduced were found by the same pass and fixed.

The harness is also what surfaced the four defects in the last commit,
including an upcoming-content row whose only anchor was hidden under `md`.

### Still open, and assigned to you

Nothing below was verified by anyone in this session; no credentials were
acquired and none were asked for.

1. **The signed-in pass at 375px and 1440px on the real `/app`**, against a real
   kit with real data. Every screenshot in this entry is a harness render.
2. **Brand kit, Content and Check** after the LOT 7 chrome deltas. The header is
   shared, and it is the one place this chantier could break another screen.
3. **The `Your workspace` sub-line** — ship it or leave it, as above.

### Closed before merge — verification, not build

- **The success token was never implemented.** `#5E8C61` and a `-soft` tint
  appear in no working tree and in no commit on any ref of either repo, and no
  `--success` token name exists. The `READY` pill stays in ink; the gap is in
  `FINDINGS.md`. No token was added here.
- **No placeholder URL can reach the copy well.** The chain is closed at every
  link: the spec seeds `'cta_target_url', null` (`20260830061318_site_spec_
  paper.sql:538`), no migration carries a URL column default, the validator
  admits null/empty or a string matching `^(https?://|mailto:|tel:)\S`,
  `bookingUrlFrom` coerces empty to null, `emailSignatureText` appends the link
  only `if (bookingUrl)`, `launchStepCopy`'s `booking_link` branch returns null
  without one, and `NextCard` renders the well only when copy exists — so the
  block is ABSENT, never empty or placeholder-filled. The `example.com` seen in
  the harness render came from hand-written harness props, which is precisely
  why a harness is not evidence about data. The only `example.com` on any
  source path is `components/kit/in-situ/frames.tsx`, which draws a picture of
  an email on the kit's in-situ panel and is not reachable from `/app`.
- **The harness never landed.** `app/dev/home-harness` appears in no commit on
  any ref, and no tree of any commit on this branch contains a path matching
  `harness`. The guard was then proven rather than asserted: a fixture module
  added under `app/app/**` and imported by the home route turned
  `home-reads-production-only` red, naming the file; removing it turned it
  green. Note the guard's real boundary — it follows the import graph from
  `app/app/page.tsx`, so it catches anything the home route *loads*. A `/dev`
  route outside that graph is not caught by it, and never was: what keeps such
  a route off this screen is that `/app` does not import it.

`FINDINGS.md` carries what was noticed and deliberately not fixed.


---

## Standing rules — not enforced by any test

Both of these come out of the home-v3 chantier, and both are conventions a
session has to keep on purpose. Nothing in the suite checks either one. They
are written here because the next session reads this file and does not read the
prompt that held the line last time.

### 1. A render is labelled by where its data came from

- A render built from hand-written props is called a **harness**, in the same
  sentence as the image or the claim — never in a caption, a footnote, or the
  next paragraph.
- The words **verified**, **confirmed** and **matches the mockup** are not
  written about anything that was not rendered from the production read path.
  A harness shows geometry. It shows nothing whatever about data: every value
  in it was chosen by whoever wrote the props, so it is the most convincing way
  there is to be wrong about a number.
- A harness route is **deleted before committing**. It exists for one
  screenshot pass and leaves no trace in the tree.

`app/__tests__/home-reads-production-only.test.ts` is NOT this rule. It walks
the import graph from `app/app/page.tsx`, so it catches a fixture the home
route *loads* — proven by probe: a module added under `app/app/**` and imported
by the route turns it red. A harness route living *beside* `/app` is outside
that graph and the guard cannot see it. What kept harness output from being
reported as production was a person writing the rule down, and then this
paragraph. If you want it enforced, that is a test someone still has to write.

### 2. A visual contract is committed by its author, before the chantier starts

A session in this environment **cannot reach the author's filesystem**. There is
no `~/Downloads`, no `~/Téléchargements`, no `~/Bureau`, no user home in the
ordinary sense; the repos are cloned fresh into a remote container and nothing
of the author's machine is mounted. **Images attached to a message do not land
on disk either** — they are rendered into the session's context and have no
path, no bytes to copy and no hash to take.

Therefore: any prompt that asks a session to *find*, *copy*, *move* or *hash* a
file on the author's machine will fail, and the only ways it can appear to
succeed are a guess or a fabricated stand-in. Both are worse than the failure.

**A prompt that needs a reference names its committed path.** The author
commits the file first; the prompt points at it. This chantier ran the other
way round, and the cost was three stops and a mockup that arrived after the
work it was meant to govern.