# THE TENANCY BILL

Session 1 of the tenancy chantier. **Measured against the live database on 2026-09-11.
Nothing was changed.**

---

## 0. TWO THINGS TO SAY BEFORE THE NUMBERS

**The 2 September document is not in either repository.** I grepped both for
`organization`, `organization_members`, `is_org_member`, `brand_charter`, `cabinet`,
`per-seat` and `tenancy`. Nothing. The decision, its reasoning and the schema exist only in
the brief you just sent and wherever you keep it.

That is itself a finding, and it has already cost this project once: Decision 5 was
re-derived from a half-remembered sentence and reversed in error, which is why
`CHANTIER_LOG.md` now carries the model-vendor split verbatim. **The tenancy decision belongs
in `CHANTIER_LOG.md` for the same reason** — a schema that lives outside the repo will be
re-litigated by whoever ships next. I have not written it there: it is your text, and copying
it from a brief would make the repo's copy a paraphrase, which is the failure mode itself.

**One correction to the brief's list.** `launch_steps` does not exist. The table is
`launch_checklist_items`, created **27 August** — before the boundary. Only a column
(`skipped_at`) was added after it. Everything else you named is real and is counted below.

---

## 1. ⚠ THE HEADLINE IS NOT THE TENANCY BILL

I went looking for `SECURITY DEFINER` functions whose authority check would survive a second
member. I found something worse, and it changes how Session 2 must be built.

**On 2 September, migration `20260902090000_revoke_internal_function_surface.sql` revoked
`EXECUTE` from `public, anon, authenticated` on eighteen functions** — thirteen trigger
functions and five `SECURITY DEFINER` helpers indexed by uuid. It carried a guard rail that
raises if `anon` still holds `EXECUTE` on any of them. It applied. The guard passed.

**Today, seventeen of the eighteen have their grants back.** Read from `pg_proc.proacl`:

```
complete_choose_direction   =X/postgres | postgres=X | anon=X | authenticated=X | service_role=X
seed_site_spec              =X/postgres | postgres=X | anon=X | authenticated=X | service_role=X
site_spec_default_target    =X/postgres | postgres=X | anon=X | authenticated=X | service_role=X
purchase_status_before      =X/postgres | postgres=X | anon=X | authenticated=X | service_role=X
rls_auto_enable             =X/postgres | postgres=X | anon=X | authenticated=X | service_role=X
handle_new_user             =X/postgres | postgres=X | anon=X | authenticated=X | service_role=X
set_updated_at              =X/postgres | postgres=X | anon=X | authenticated=X | service_role=X

seed_launch_checklist       postgres=X | service_role=X          ← the only survivor
```

`=X/postgres` is the grant to **PUBLIC**. Both the PUBLIC grant and the direct grants to
`anon` and `authenticated` are back.

**The one survivor is the proof of the mechanism.** `seed_launch_checklist` is the only one of
the eighteen that a *later* migration (`20260903260000`) re-revoked. It is the only one still
closed. Everything revoked once and never again has been re-opened.

**What I can state, and what I inferred wrongly.** The restored grants are a fact, read from
the catalogue.

⚠ **My inference about the cause was wrong, and Session 2 disproved it.** I wrote that the
shape looked like a blanket
`grant all on all functions in schema public to postgres, anon, authenticated, service_role`
re-run by a routine platform operation. **A blanket grant would have re-opened the revokes
written on 3, 5, 6, 9, 10 and 11 September as well. Every one of those holds** — measured
function by function. Two mechanisms were then tested and both are disproved:

| Hypothesis | Test | Result |
|---|---|---|
| A blanket platform re-grant, continuous | Check every revoke in the repo, by date | Only the 2 September ones are undone |
| The migration tooling re-grants after applying | Revoke through it, read the ACL back on a later connection | Revoke intact |

What remains is a **discrete past event around 2–3 September** that restored ACL state to a
point before that migration ran while the migration ledger moved forward. It fits every
observation — functions created after it keep their revokes, and `seed_launch_checklist`, the
one of the eighteen that a later migration re-revoked, is the one still closed — but it cannot
be proved from inside the database and is not claimed as proved.

**Nothing is re-granting continuously.** Which does not soften the conclusion below: an event
nobody can name or reproduce undid a verified security migration, and the defence has to be
one that does not depend on knowing what it was.

### Why this changes Session 2

The current scale:

| | |
|---|---|
| `SECURITY DEFINER` functions in `public` | **100** |
| …that `anon` can execute today | **35** |
| …that take arguments and `anon` can execute | **22** |
| trigger/event-trigger functions `anon` can execute | **16** |
| functions still carrying Postgres' untouched default ACL | 0 |

Eight of those are `SECURITY DEFINER`, browser-callable, and have **no path to `auth.uid()`
at all** — computed as a transitive closure over function bodies, not by guessing at helper
names (my first attempt did guess, and produced a false alarm on
`brand_kit_select_direction`, which gates correctly through `site_spec_entitlement_error`):

| Function | What a caller with only the anon key can do |
|---|---|
| `complete_choose_direction(uuid)` | **writes** — marks a checklist item done on *any* kit id |
| `seed_site_spec(uuid)` | **writes** — seeds site-spec rows for *any* kit id |
| `site_spec_default_target(uuid)` | reads a builder target for *any* kit id |
| `purchase_status_before(uuid, text)` | reads *any* purchase's status history |
| `brand_images_setting_int(text, int)` | reads **any** `app_settings` key as an integer — including the spend ceilings — and `app_settings` is a table with RLS on and no policies |
| `anon_token_hash()`, `brand_images_enabled()`, `rls_auto_enable()` | no authority needed, or inert as an RPC |

These are **pre-existing and not tenancy debt** — they were found while answering your
`SECURITY DEFINER` question, and they are all uuid-indexed, so exploiting them needs an id you
do not have. I have changed nothing.

**But the design conclusion is the one that matters for Session 2:**

> ⚠ `is_org_member()` cannot be defended by a `REVOKE`. Nothing in this database can.
> The authority check has to live **inside** the function body, and the enumeration test you
> asked for must cover **grants as well as policies** — otherwise it will pass on the
> morning after the platform re-opens everything.

The table-enumeration test in your Session 2 spec should therefore have a sibling that
asserts no `SECURITY DEFINER` function taking arguments is executable by `anon`, and it must
run in **CI**, not once inside a migration. A guard rail that only executes at migration time
verifies a moment, not a state — which is exactly what happened here.

---

## 2. THE LIVE ROW COUNTS

On 2 September: 2 profiles, 2 projects, 1 kit, 4 purchases. Today:

| | 2 Sept | today |
|---|---|---|
| `auth.users` / `profiles` | 2 | **3** |
| `projects` | 2 | **3** |
| `brand_kits` | 1 | **1** |
| `purchases` | 4 | **4** |

Everything else, measured:

```
brand_assets             28      content_items             3      user_uploads              0
notifications            24      generation_credits        3      usp_fingerprints          0
launch_checklist_items    8      project_briefs            3      check_rewrite_usage       0
brand_images              7      comp_grants               2      content_months            0
directions                6      site_specs                1      content_checkins          0
plan_grants               4      subscriptions             1      content_publications      0
                                                                  content_grounds           0
                                                                  content_image_allowance   0
                                                                  direction_assets          0
                                                                  funnel_events             0
                                                                  purchase_status_events    0
```

**The backfill is trivial and will stay trivial for about a week.** Three profiles, three
projects, one project each, no project without an owner, no profile without a project. One
organization per profile is three inserts and one `update projects set organization_id = …`.

⚠ **This is the cheapest the migration will ever be.** The eight Content tables are empty
because the content chantier shipped four days ago and nothing has run through it; the moment
one cabinet uses it they will not be.

---

## 3. WHAT LANDED AFTER 2 SEPTEMBER

**19 tables and 22 columns**, across 46 migrations. The split that matters is not new-vs-old,
it is **which of them can reach an organization through a foreign key that already exists.**

### 3a. Free — they reach an org through `brand_kits → projects` (11 tables)

Once `projects.organization_id` exists, every one of these is correct with **no new column**.
Their policies already resolve through `projects`; only the leaf comparison changes.

| Table | Path to the org |
|---|---|
| `brand_images` | `brand_kit_id → brand_kits → projects` |
| `content_items` | `brand_kit_id → brand_kits → projects` |
| `content_months` | `brand_kit_id → brand_kits → projects` |
| `content_checkins` | `brand_kit_id → brand_kits → projects` |
| `content_preferences` | `brand_kit_id → brand_kits → projects` |
| `content_image_allowance` | `brand_kit_id → brand_kits → projects` |
| `user_uploads` | `brand_kit_id → brand_kits → projects` |
| `content_grounds` | `month_id → content_months → brand_kits → projects` |
| `content_publications` | `content_item_id → content_items → brand_kits → projects` |
| `brand_assets` | `brand_kit_id → brand_kits → projects` — **but see §5** |
| `notifications` | `brand_kit_id → brand_kits → projects` — **but see §5** |

### 3b. Free — no tenancy at all (6 tables)

Reference data and Eklio's own instruments. They must **never** gain an `organization_id`;
giving one to `funnel_events` would make Eklio's funnel a customer's data.

`asset_catalog`, `color_names`, `content_registers`, `funnel_steps` (catalogue) ·
`anon_generation_counters`, `brand_image_daily_spend`, `funnel_events` (Eklio's own)

### 3c. Needs a decision, not a column (2 tables)

| Table | Today | The question |
|---|---|---|
| `check_rewrite_usage` | `user_id → profiles`, a daily per-person quota | Is the Check rewrite ceiling **per clinician** or **per practice**? Per person is defensible and is what is built. **Name it rather than migrate it by reflex.** |
| `content_publications` | reached through `content_items` | Already free (§3a); listed here because "who published this" becomes a real question with two members — the row records *that* it was posted, never *who* posted it. That is a new column when the practice UI exists, not now. |

### 3d. Columns added after 2 September

22 of them, and **none needs an `organization_id`**: every one hangs off a row that already
reaches a project. Two are worth naming because they interact with the org layer:

- **`projects.anon_token_hash` / `projects.anon_expires_at`** (10 Sept) — see §6, they
  conflict with `organization_id not null`.
- **`content_items.month_id` / `content_months.theme_source`** — inside the Content subtree,
  already covered by §3a.

---

## 4. THE POLICIES THAT NAME `auth.uid()`

**33 policies across 21 tables.** They come in exactly two shapes, and the difference is the
whole of Session 3's risk.

### Shape A — reaches the owner through `projects` (19 policies). Safe to migrate.

```sql
EXISTS (SELECT 1 FROM brand_kits bk JOIN projects pr ON pr.id = bk.project_id
         WHERE bk.id = content_items.brand_kit_id
           AND pr.user_id = (SELECT auth.uid()))
```

`content_items`, `content_grounds`, `content_publications`, `content_image_allowance`,
`content_checkins`, `content_months`, `content_preferences`, `user_uploads`,
`direction_assets`, `brand_images`, `directions` (×4), `generation_credits`, `plan_grants`,
`purchase_status_events`.

Each becomes correct by replacing one leaf: `pr.user_id = auth.uid()` →
`is_org_member(pr.organization_id)`. **They fail closed while wrong** — a member who is not
the owner sees nothing, which is visible and reported, not silent.

### Shape B — ⚠ compares a denormalised `user_id` on the row itself (14 policies)

```sql
(user_id = (SELECT auth.uid()))
```

| Table | Policies |
|---|---|
| `brand_assets` | select |
| `check_rewrite_usage` | select |
| `launch_checklist_items` | select, update |
| `notifications` | select |
| `site_specs` | select, update |
| `purchases` | select |
| `subscriptions` | select |
| `usp_fingerprints` | select |
| `projects` | select, insert, update, delete |

**These are the dangerous ones**, and §5 says why.

### Not in either list, and the precedent to copy

`projects`' children — `project_briefs`, `brand_kits` — do **not** name `auth.uid()`. They
call `owns_project(uuid)`, `SECURITY DEFINER`, written for the anonymous brief on 10
September. That is already the pattern your Session 2 spec asks for, already in production,
already guarded by a migration-time rail that counts child policies not resolving through it.
**`is_org_member` should be built as its sibling, and `owns_project` should end up calling
it** rather than the two coexisting.

---

## 5. ⚠ THE DENORMALISED `user_id` COLUMNS — THE ONES THAT STAY SILENT

Six tables carry **both** a `user_id` and a path to `projects`. The `user_id` is a copy, and
nothing in the database keeps the copy honest.

| Table | Also reaches a project via | Rows today | What happens with two members |
|---|---|---|---|
| `brand_assets` | `brand_kit_id` | **28** | Clinician B cannot see assets generated under the practice's kit. Policy returns rows — just the wrong set |
| `notifications` | `brand_kit_id` | **24** | Every notification belongs to whoever's id was written. B never sees the practice's |
| `launch_checklist_items` | `brand_kit_id` | **8** | The launch checklist is per-person, so two members see two different checklists for one kit |
| `site_specs` | `brand_kit_id` | **1** | B cannot open the site editor for a kit she can otherwise see |
| `purchases` | `project_id` | **4** | An owner's purchase is invisible to a clinician — probably *correct*, but by accident, not by decision |
| `brand_images` | `brand_kit_id` | **7** | Column present; **policy already goes through the kit**, so it is a trap that has not sprung |

**How I established each one.** Not by reading: by querying `pg_policies` for policy bodies
matching `user_id = ( SELECT auth.uid` with no `EXISTS` in them, then cross-checking against
`pg_constraint` for a foreign key path to `projects`. A table in both sets is denormalised and
policy-bound to the copy. `brand_images` is in the second set but not the first — the column
is there and the policy ignores it, which is the state the other five should be brought to.

**Why they are worse than shape A.** A shape-A policy that is wrong returns *nothing* and
someone files a bug. A shape-B policy that is wrong returns *a plausible subset* — her own
rows, correctly formed, just not the practice's. Nobody reports "I can see slightly less than
I should" as a bug; they report it as "the product is a bit empty".

**The recommendation for Session 3.** Do not migrate the `user_id` columns to
`organization_id`. **Drop them from the policies** and reach the org through the kit like
everything else. Keep the column only where it answers a different question than access —
`brand_assets.user_id` records *who generated this asset*, which is provenance and stays
useful with two members, and should be documented as provenance so nobody reattaches a policy
to it.

---

## 6. ⚠ A CONFLICT BETWEEN THE 2 SEPTEMBER SPEC AND WHAT SHIPPED ON 10 SEPTEMBER

The spec says:

> `projects.organization_id`, **not null**, backfilled one organization per existing profile

The anonymous brief shipped on 10 September made `projects.user_id` **nullable**. An
anonymous project has no user, therefore no organization, therefore cannot satisfy
`organization_id not null`.

**Today this costs nothing** — `anonymous_no_owner = 0`, measured. The feature is live but
no cold visitor has used it yet. **Tomorrow it is a hard failure on the first anonymous
brief.**

The spec is not wrong; it was written eight days before the feature that contradicts it. Two
resolutions, and I am not choosing between them in a report-only session:

1. **`organization_id` nullable, with a CHECK mirroring the one already on `projects`:**
   `organization_id is not null or anon_token_hash is not null`. This is the same shape as
   the existing `projects_owner_present_check` and needs no new concept — an anonymous brief
   belongs to a token until it belongs to someone. The claim at signup then sets
   `organization_id` alongside `user_id`, in the one statement that already exists.
2. **Mint an organization at brief creation.** Keeps `not null`, but creates an org for every
   cold visitor who may never sign up, and the 30-day purge would have to delete orgs too.

**I recommend (1)**, because it reuses a constraint shape already in production and keeps the
anonymous row exactly as disposable as it is now. It is a change to your written spec, so it
is yours to confirm rather than mine to take.

---

## 7. THE SEVEN TABLES WITH RLS ON AND NO POLICIES

Not caused by the delay — but your Session 2 spec says "any new table without a policy fails
the suite", and these are what that test will find on its first run:

`app_settings` · `banned_phrases` · `brand_image_daily_spend` · `comp_grants` ·
`direction_asset_daily_spend` · `stripe_events` · `usp_stopwords`

Six are server-only by intent and correct in effect — RLS on with no policy returns zero rows
to `anon` and `authenticated`, everything to `service_role`, and raises nothing. **The effect
is right; the intent is nowhere.** The enumeration test should demand an explicit deny-all
policy rather than accept an implicit one, exactly as `funnel_events` and
`anon_generation_counters` already carry (`for all using (false)`).

**`comp_grants` is the one to look at twice.** It carries a `user_id` and no policy at all, so
it behaves as server-only — but it is the table that grants complimentary access, and nothing
in the schema says whether that was a decision.

---

## 8. THE BILL, IN ONE PARAGRAPH

Nine days added 19 tables and 22 columns. **Seventeen of the nineteen cost nothing** — eleven
reach an organization through a foreign key that already exists, six should never be tenanted
at all. **The real bill is fourteen policies on six tables that compare a denormalised
`user_id` to `auth.uid()`**, and those predate 2 September as often as they follow it:
`site_specs`, `purchases` and `launch_checklist_items` were all built before the boundary. The
delay did not create the pattern; it added `brand_assets` and `notifications` to it, which are
now the two largest tables in the database.

And the thing that actually threatens Session 2 is none of the above: **a revoke that was
written, applied, verified, and is no longer in effect.** Build `is_org_member` so that a
restored grant cannot hurt it, and put the enumeration in CI where it runs every day rather
than in a migration where it ran once.

---

---

## 9. WHAT SESSION 2 DID ABOUT §1

The tenancy layer moved to Session 3; the function surface was closed first. Backend
`20260911170458_authority_moves_inside_the_function_body`:

| | before | after |
|---|---|---|
| `SECURITY DEFINER` functions `anon` can call | 35 | **18** |
| …of those, with no authority check anywhere | 8 | **1** |
| trigger / event-trigger functions `anon` can call | 16 | **0** |

The one remaining is `anon_token_hash()`, and it is named as the single exemption in both the
migration and the test: the RLS policies on `projects` call it, a policy executes as the
caller's role, and revoking it would lock every anonymous visitor out of her own brief.

Three functions gained an in-body check on the rule **the server is the server, and everyone
else must own the row** — `auth.role()` survives entry into a `SECURITY DEFINER` body where
`current_user` has already become the owner. `purchase_status_before` folds it into the
predicate rather than raising, because a raise would confirm that a uuid exists.

⚠ **One bug was caught before commit and it is the doctrine's own shape.**
`site_spec_default_target` is reached through `handle_new_brand_kit → seed_site_spec →
site_spec_seed_values` on *every* anonymous generation. Gating it with `brand_kit_is_owned`
(`auth.uid()`-only) compiles, passes, raises nothing — and silently returns `'generic'`
instead of her real builder target for every anonymous brief. It uses `owns_project`, which
honours the token. Found by asking who calls it, not by a test.

**The enumeration is in CI, not in a migration:**
`supabase/tests/20260911170458_function_surface.test.sql`, run by the existing `db-tests`
workflow on every push against a database rebuilt by replaying every migration. It fails the
build if any `SECURITY DEFINER` function is callable by `anon` or `PUBLIC` without an in-body
check, where "has a check" is a **transitive closure over function bodies** rather than a list
of helper names — the list-of-names version produced a false accusation against
`brand_kit_select_direction`, which gates correctly through `site_spec_entitlement_error`.

It carries a canary that creates a gateless anon-callable function and requires the rule to
catch it, and an anti-vacuous floor. Both were run against production inside a rolled-back
transaction before being committed.

⚠ **CI rebuilds from migrations, so it cannot see production drift.** It stops the *next*
function being written without a check. The in-body check is what holds when the grants move
underneath us, and that asymmetry is why both exist.

---

## 10. SESSION 3 — THE LAYER

**⚠ BUILT FROM THE BRIEF OF 11 SEPTEMBER, NOT FROM THE 2 SEPTEMBER DOCUMENT.**
`TENANCY_DECISION_2026-09-02.md` in this repository is still the 100-line stub written on 11
September, byte-identical on `main`, on the working branch and in every remote ref; no commit
has touched it since. The paste did not land. What this session was built from is the SESSION 2
specification in the chantier brief of 11 September — your own words, quoted there — plus the
amendment you confirmed in writing. Where the two could differ, they cannot: the schema shape
was settled by you directly (*"Your §6 option 1 is right"*, plus the one addition), so the core
of this session rests on an instruction, not on a reconstruction. Anything in the 2 September
document that this does not cover is still uncovered, and I cannot say what it is.

### 10.1 What landed

Three migrations, all applied live and replayed in CI.

| | |
|---|---|
| `20260911180620_organizations_and_membership` | the two tables, `is_org_member`, the backfill |
| `20260911180839_projects_organization_id` | the column, the derivation, the constraint |
| `20260911180918_server_only_tables_say_so` | seven silent tables made explicit |
| `supabase/tests/20260911180620_tenancy_layer.test.sql` | the fourth enumeration |

**Nothing in the product changed.** No policy was migrated, no screen moved, no query returns a
different row than it did yesterday. `tsc`, `next build`, eslint and 2,312 tests are green and
the frontend diff is two files: regenerated types, and a comment.

### 10.2 The shape

`organizations` — id, a **nullable** name, timestamps. Null is the normal case and means *never
named, because nobody has looked at it*. A fabricated name (the email local part, "Sarah's
practice") would be a value the product could not justify if it ever surfaced.

`organization_members` — `(organization_id, user_id)` primary key, `role` checked against
exactly `owner` and `clinician`. A third role is a decision, not a string.

**One owned organization per person, enforced by a partial unique index** rather than by care.
The claim has to answer "which organization?" in a single statement, and a scalar subquery that
can return two rows raises `21000` at runtime — which this repository has already been bitten
by once, in `orphaned_purchases`. The index makes the second row impossible instead of making
the query defensive. It is reversible the day one person owns two practices, and the claim
would then need the choice made explicitly, which is the correct consequence.

`is_org_member(uuid)` — `SECURITY DEFINER`, and that is load-bearing twice. The SELECT policy
on `organization_members` calls it and it reads `organization_members`; as an invoker function
that is *infinite recursion detected in policy*. And, per the standing rule, **who calls it**:
RLS policies, under `authenticated` with a uid or `anon` with none. It returns false for a null
argument and false with no session, never "any organization".

### 10.3 ⚠ The claim, together or neither — and why no call site was touched

The requirement was that the claim set `user_id` and `organization_id` together or neither. The
obvious implementation is to read the organization in `claimAnonBrief` and pass both. That is a
second round trip, a race, and a value the frontend would then be trusted to get right.

Instead, **two mechanisms in the database, each sufficient on its own**:

1. A `BEFORE INSERT OR UPDATE` trigger derives `organization_id` from `user_id` in the same
   statement. `insert into projects (user_id, name)` — the shape both existing call sites use,
   in `app/app/actions.ts` and `app/api/briefs/route.ts` — comes out tenanted, unchanged.
2. The CHECK refuses the half-written row anyway. **Verified with the trigger disabled:** a
   claimed project forced to a null practice raises `23514` and the whole UPDATE writes
   nothing, so she keeps her token rather than losing the brief to a half-claim.

The test proves they are two mechanisms rather than one wearing a second name — it disables the
trigger and requires the constraint to bite on its own.

⚠ **This was not the plan when the session started.** The plan was a `SECURITY DEFINER` claim
RPC. Reading the two call sites first is what changed it: both insert a project with `user_id`
and nothing else, so the CHECK as specified would have **broken project creation for every
signed-in user** on the first insert. The requirement did not change; where it is enforced did.

### 10.4 A hole closed at the moment the column appeared

Adding a writable `organization_id` to `projects` opens something that did not exist before: an
authenticated caller can set it to a **stranger's** organization and drag their project into
someone else's practice — which, once Session 4 reads the column, makes her brief visible to
people she has never met.

The same trigger closes it. Whatever the browser sends is overwritten with the owner's own,
so no policy had to be touched and none of the fourteen moved. `service_role` **may** still
name an organization, and that is deliberate: it is the seam Session 4's invitation needs,
because a clinician's project belongs to the practice rather than to the clinician's personal
organization. `auth.role()` is what tells them apart, and it survives entry into a
`SECURITY DEFINER` body where `current_user` has already become the owner.

### 10.5 The fourth enumeration

Every table in `public` must fall into one of four classes, three of them computed:

| Class | How | Count |
|---|---|---|
| the layer | named | 4 |
| **tenanted** — reaches `projects` through foreign keys that already exist | computed closure | 22 |
| **per person, by decision** | named, with the reason, in the test | 3 |
| **never tenanted** — reference data and Eklio's own instruments | named | 31 |

A new table that reaches a project needs nothing. A new table that reaches nobody **fails CI**
until somebody writes its name into one of the two lists and says why. The cost of an
untenanted table is one sentence of justification, paid at the time, by the person who knows.

The three per-person tables are `check_rewrite_usage` (a daily ceiling on one person's
rewrites: two clinicians are two people at two screens, and a per-practice ceiling would make
the second one's afternoon depend on the first one's morning), `subscriptions` (per-seat
billing is explicitly not October; it moves when that is designed, deliberately, not by drift)
and `comp_grants` (Eklio's own act, granted to a person, never to a practice).

⚠ **The closure follows `auth.users` as well as `public.profiles`, and the first version did
not.** That version silently classified `comp_grants` — whose `user_id` references
`auth.users` directly — as owned by nobody, and would have filed it under reference data. It
compiled, it ran, it produced a list. A plausible answer, which is this codebase's
characteristic failure, caught here only because the count looked one short.

The lists also cannot rot: a name whose table no longer exists, or whose table has since gained
a path to `projects`, fails the test.

### 10.6 Seven tables that now say what they allow

`app_settings`, `banned_phrases`, `brand_image_daily_spend`, `comp_grants`,
`direction_asset_daily_spend`, `stripe_events`, `usp_stopwords` had RLS on and **not one
policy**. The effect was already right — zero rows to the browser, everything to
`service_role`, nothing raised — but it reads identically to a forgotten policy. Each now
carries `for all using (false) with check (false)`, the idiom `funnel_events` has had since it
was built. Behaviour is unchanged.

This was not cosmetic: without it the enumeration would have shipped with seven standing
exemptions on its first run, and a list of seven exemptions is where the eighth hides.
`comp_grants` in particular now records a decision — a comp grant is Eklio's act, taken outside
the product; the person it benefits sees the access, never the grant.

### 10.7 ⚠ THE THING THIS SESSION FOUND THAT MATTERS MOST

**The backend's CI has been failing in the migration replay, and Session 2 shipped an
enumeration into it without checking.**

`db-tests` run #100 — Session 2's own push, carrying
`20260911170458_function_surface.test.sql` — went red. Not in a test: in `supabase db reset`,
inside the guard rail of `20260910144421_content_months_theme_source.sql`, which probes its
CHECK with

```sql
insert into content_months (...) select bk.id ... from brand_kits limit 1;
exception when others then v_ok := true;  -- "no kit to test against"
```

On a fresh replay there are no `brand_kits`. The SELECT returns no rows, the INSERT writes
nothing, and **nothing raises** — measured: `rows=0, exception_seen=false`. `v_ok` stays false
and the migration aborts. The author saw the empty-database case and reached for the wrong
mechanism.

The consequence is the part worth keeping: **the function-surface enumeration has never run in
CI, and neither would this session's.** A defence written into a pipeline nobody reads is a
defence that exists only in the commit message. It is fixed — the guard now asserts the
constraint in `pg_constraint` and probes with a `gen_random_uuid()` brand_kit_id, which works
because a CHECK is verified during the insert while a foreign key is an AFTER trigger, so the
CHECK raises first and no kit is needed.

⚠ Corrections are new migrations, **except this one, which cannot be**: nothing later can stop
an earlier migration's `DO` block from raising during a replay. No DDL changed and the live
database is untouched by the edit.

**A guard that depends on seed data asserts the seed, not the constraint.** The sibling at
`20260911133504` is skipped entirely on an empty database (`if v_user is not null`) — vacuous
in CI rather than failing. It is left alone; it did its work against the live database when it
was applied. But it is the same family, and the family is worth naming.

**And then the tests ran.** 75 files, for the first time, and 13 failed.

`20260911170458_function_surface.test.sql` **passed** — Session 2's enumeration is now actually
enforced rather than merely committed.

**The tenancy enumeration failed, correctly, on its first run.** `RLS is off on:
direction_asset_daily_spend`. The table is created by `20260901074421`, which never enables row
level security, and `rls_auto_enable` is only codified eleven migrations later by
`20260901190000` — so a clean replay produces the table with RLS **off**, and §10.6's deny-all
policy sits on a table that does not enforce policies. **Live it is on**, by a route that is not
in this repository. Drift in the safe direction, which is why nobody noticed: production is
correct and the source of truth is wrong. Nothing about reading would have found it — the
dashboard looks right, the policy is in a migration, the effect in production is right. Closed by
`20260911182533`; a no-op live, not a no-op on a rebuild.

That is the answer to "why enumerate at all", earned rather than argued, on the first run.

**The remaining twelve are pre-existing and none is caused by this session.** They are diagnosed
row by row in `FINDINGS.md`: stale expectations after deliberate changes (a budget raised, a
constraint added, two function signatures moved), one test that depends on tie-breaking between
two rows written in the same transaction with the same `created_at`, and four not yet diagnosed.
One of them is mine from the acquisition chantier — `consume_anon_generation` gained a `p_kind`
argument in `20260910210435` and its test still calls the one-argument form. I changed a
signature four sessions ago and the suite could not tell me.

Not fixed here: twelve files across four chantiers is a separate piece of work, and this session
was the tenancy layer. **13 → 12 is the number to watch.** Any number above zero that includes
`tenancy_layer` or `function_surface` is a regression; the rest is inherited debt with a name.

### 10.8 What Session 4 inherits

- The fourteen shape-B policies, unchanged and still comparing a denormalised `user_id`.
  §5 stands: **drop the column from the policy**, reach the org through the kit.
- The nineteen shape-A policies, each one leaf away: `pr.user_id = auth.uid()` →
  `is_org_member(pr.organization_id)`.
- `owns_project` should end up calling `is_org_member` rather than the two coexisting — and
  it must keep its anonymous-token branch, or every cold visitor loses her own brief.
- The `service_role` seam in `projects_bind_organization` is where the invitation writes a
  clinician's project into the practice rather than into their personal organization.

---

*Session 1 complete and corrected. Session 2 complete. Session 3 complete, built from the
brief of 11 September because the 2 September document is still not in the repository.
Session 4 migrates the fourteen policies; Session 5 is the audit.*
