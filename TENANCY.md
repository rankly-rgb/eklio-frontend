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

**What I can state, and what I am inferring.** The restored grants are a fact, read from the
catalogue. The *cause* is an inference: the shape — PUBLIC plus all three Supabase roles,
across functions that no later migration touches — is what a blanket
`grant all on all functions in schema public to postgres, anon, authenticated, service_role`
produces. That statement is part of Supabase's standard privileges bootstrap and is re-run by
routine platform operations. I cannot prove from here which operation ran it.

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

*Session 1 complete. Nothing was changed. Awaiting the §6 ruling before Session 2.*
