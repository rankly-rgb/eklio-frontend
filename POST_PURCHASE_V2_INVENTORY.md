# POST_PURCHASE_V2_INVENTORY.md

Facts gathered before writing any code for the post-purchase-v2 chantier (Session 1). Every claim below is
either quoted from `FRONTEND_CONTRACT.md` (backend repo), read directly from the live database
(`fobgdsupyfslxbswfuay`, us-east-1), or found in one of the two repos' own code/migrations with
file:line or migration-filename citations. Nothing here is inferred or assumed. This extends
`POST_PURCHASE_INVENTORY.md` (the 2 September chantier's own inventory, still accurate for what it
covers) rather than repeating it — read that file too.

---

## 0. Branch state (brief §0.1)

Both repos were already on the branch this session was told to develop on
(`claude/nifty-dirac-7isjqb`), created from `main`/`origin/main` with **zero divergence** — `HEAD` and
`origin/main` are byte-identical in both repos at session start:

- **eklio-frontend**: `HEAD` = `origin/main` = `3a8b520` ("Merge remote-tracking branch 'origin/main'
  into claude/post-purchase-space"). Working tree clean.
- **eklio-backend**: `HEAD` = `origin/main` = `30bf7b3` ("Add 'Since you were here' activity for home
  (Lot 9)"). Working tree clean. (Local `main` ref was locally stale at an older commit — a fetch caching
  artifact, not real divergence; `origin/main` is authoritative and matches `HEAD`.)

Per this session's own harness instructions, development happens on `claude/nifty-dirac-7isjqb` in both
repos rather than a newly created `claude/post-purchase-v2` — the branch is already fresh off `main`, so
this satisfies the brief's intent (a clean starting point) without violating the harness's explicit
"never push to a different branch" rule. **No `claude/post-purchase-v2` branch was created.** Flagging
this naming difference now so later sessions don't go looking for a branch that doesn't exist.

No `CHANTIER_LOG.md` and no `POST_PURCHASE_V2_INVENTORY.md` existed at session start — confirming this is
genuinely the first session of this new chantier. The session number was not stated; given the total
absence of any v2 artifact and that Session 1's job is investigation-only (ending in a stop, not code),
proceeding as Session 1 carries no risk of stepping on a later session's work.

---

## 1. `brand_assets`, `asset_catalog`, `launch_steps` (actually named `launch_checklist_items`)

### 1.0 Naming disagreement to report

**The brief calls it `launch_steps`; the live table is named `launch_checklist_items`.** No table or view
named `launch_steps` exists anywhere in the live schema. Every fact below about "launch steps" is about
`launch_checklist_items`, the RPCs `seed_launch_checklist` / `get_launch_progress` / `set_launch_step`, and
the `LaunchChecklist` UI already built in the 2 September chantier (`components/checklist/launch-checklist.tsx`).
This is a naming difference only, not a missing feature — the table, its RLS, and three RPCs all exist and
are live and working.

### 1.1 `asset_catalog` — live schema and full seed (34 rows)

```sql
create table public.asset_catalog (
  key         text    not null,
  "group"     text    not null,
  label       text    not null,
  description text    not null,
  kind        text    not null,
  width       integer,
  height      integer,
  min_tier    text    not null default 'starter',
  sort_order  integer not null default 0,
  primary key (key),
  constraint asset_catalog_kind_check check (kind in
    ('svg','png','json','css','ase','html','zip','md')),  -- widened twice since original ('svg','png')
  constraint asset_catalog_min_tier_check check (min_tier in ('starter','practice','signature'))
);
```
Defined `supabase/migrations/20260903090000_brand_asset_storage.sql`; `kind` CHECK widened by
`20260903210000_asset_catalog_kind_expansion.sql` and `20260903250000_document_assets.sql`.

**Every one of the 34 seeded rows has `min_tier = 'starter'`** — no row has ever been seeded at
`'practice'` or `'signature'`, and **`min_tier` is not enforced anywhere** (see §1.3). Groups in use:
`identity` (9), `color` (3), `web` (6), `social` (9), `print` (2), `document` (4).

Full list (key / group / kind / dims / sort_order):

| key | group | kind | dims | sort |
|---|---|---|---|---|
| wordmark_svg_dark | identity | svg | — | 1 |
| wordmark_png_dark | identity | png | — | 2 |
| wordmark_svg_light | identity | svg | — | 2 |
| palette_sheet_png | color | png | 1200×600 | 3 |
| og_image_1200x630 | web | png | 1200×630 | 4 |
| wordmark_svg_mono_black | identity | svg | — | 5 |
| wordmark_svg_mono_white | identity | svg | — | 6 |
| wordmark_png_light_1200 | identity | png | 1200×— | 7 |
| wordmark_png_light_2400 | identity | png | 2400×— | 8 |
| monogram_svg | identity | svg | — | 9 |
| monogram_png_512_primary | identity | png | 512×512 | 10 |
| monogram_png_512_paper | identity | png | 512×512 | 11 |
| monogram_png_512_transparent | identity | png | 512×512 | 12 |
| favicon_16 | web | png | 16×16 | 13 |
| favicon_32 | web | png | 32×32 | 14 |
| apple_touch_icon_180 | web | png | 180×180 | 15 |
| icon_512 | web | png | 512×512 | 16 |
| manifest_values_json | web | json | — | 17 |
| avatar_400 | social | png | 400×400 | 18 |
| palette_ase | color | ase | — | 19 |
| tokens_json | color | json | — | 20 |
| colors_css | color | css | — | 21 |
| post_statement_1080 | social | png | 1080×1080 | 22 |
| post_question_1080 | social | png | 1080×1080 | 23 |
| post_notes_1080 | social | png | 1080×1080 | 24 |
| post_signature_1080 | social | png | 1080×1080 | 25 |
| story_1080x1920 | social | png | 1080×1920 | 26 |
| cover_linkedin_1584x396 | social | png | 1584×396 | 27 |
| cover_facebook_1640x624 | social | png | 1640×624 | 28 |
| business_card_front | print | png | 1125×675 | 29 |
| business_card_back | print | png | 1125×675 | 30 |
| email_signature_html | document | html | — | 31 |
| email_signature_png | document | png | 640×220 | 32 |
| site_setup_md | document | md | — | 33 |
| brand_kit_zip | document | zip | — | 34 |

RLS: `asset_catalog_select_all` — `SELECT` to `authenticated`, `qual: true` (readable by any signed-in
user; it describes the product, not a specific kit).

**None of these 34 keys is a photograph.** `LOT 5`'s seven new slots (`hero`, `ambient_a`, `ambient_b`,
`post_bg_1..3`, `texture`, plus the optional `ornament`) do not exist in this catalog and are explicitly a
*different* mechanism per the brief (`brand_images`, a new table — see §4), not new `asset_catalog` rows.

### 1.2 `brand_assets` — live schema

```sql
create table public.brand_assets (
  id           uuid primary key default gen_random_uuid(),
  brand_kit_id uuid not null,
  user_id      uuid not null,
  key          text not null,
  kind         text not null,
  width        integer,
  height       integer,
  byte_size    integer not null,
  storage_path text not null,
  fingerprint  text not null,
  created_at   timestamptz not null default now()
);
```
RLS: `brand_assets_select_own` — `SELECT` to `authenticated`, `qual: user_id = auth.uid()`. **No `status`,
`superseded_at`, or `change_summary` column exists today** — LOT 4's version-history requirement
(`superseded_at`, `change_summary text`) is a genuinely new migration, not something already there under a
different name.

### 1.3 The three asset RPCs — signatures and bodies (all in `20260903090000_brand_asset_storage.sql`)

- **`get_brand_asset_manifest(p_brand_kit_id uuid, p_current_fingerprint text) → jsonb`** — refuses
  `payment_required` if unentitled; otherwise left-joins `asset_catalog` against `brand_assets` on
  `(brand_kit_id, key, fingerprint = p_current_fingerprint)` and returns one row per catalog entry:
  `{key, group, label, description, kind, width, height, min_tier, current: boolean, asset:
  {storage_path, byte_size, created_at} | null}`. `min_tier` is returned but **never compared against
  anything inside this function** — the migration's own comment says this gating "happens in
  eklio-frontend against the caller's current entitled tier, not here," and no frontend code reads it
  either yet (confirmed — no component currently reads `asset_catalog.min_tier`). `p_current_fingerprint`
  is caller-supplied and trusted as-is, never recomputed server-side.
- **`request_brand_asset_upload(p_brand_kit_id uuid, p_key text, p_fingerprint text) → jsonb`** — refuses
  `payment_required` if unentitled, `not_found` if `p_key` isn't in the catalog, `invalid_format` if
  `p_fingerprint` doesn't match `^[0-9a-f]{16,128}$` (a **structural** check only — lowercase hex, safe as
  a path segment, never validated as "the true current fingerprint"). Returns `{bucket: 'brand-assets',
  storage_path: '{brand_kit_id}/{fingerprint}/{key}.{kind}'}` — a path, not a signed URL (Postgres cannot
  mint Supabase Storage signatures; the frontend calls `createSignedUploadUrl()` itself against this path
  under the caller's own session — see §5).
- **`record_brand_asset(p_brand_kit_id, p_key, p_fingerprint, p_storage_path, p_byte_size, p_width?,
  p_height?) → jsonb`** — same entitlement/catalog/fingerprint checks, plus recomputes the expected
  storage path server-side and refuses (`invalid_field`) any mismatch with the caller-supplied
  `p_storage_path`. `insert ... on conflict (brand_kit_id, key, fingerprint) do update` — idempotent
  re-renders update the same row rather than duplicating it.

**Neither `request_brand_asset_upload` nor `record_brand_asset` checks `min_tier` either.** Confirmed by
grep across every migration: `min_tier` appears only in the CHECK constraint, the manifest's passthrough,
and two comments. **`min_tier` gating is entirely unbuilt** — same conclusion the September inventory
already reached and explicitly deferred; still true today.

### 1.4 How `fingerprint` is currently computed — `lib/kit/asset-fingerprint.ts` (frontend)

```ts
export function computeAssetFingerprint(input: AssetFingerprintInput): string {
  const payload = stableStringify({ ...input, rendererVersion: RENDERER_VERSION });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
```
`AssetFingerprintInput` hashes: the twelve token hexes (`primary`…`cta_ink`) + both font names,
`practiceName`, `hero: {overline, headline} | null`, `socialTemplates` (raw), `practitionerLine`,
`practiceDetails` (raw), `bookingUrl`. Plus `RENDERER_VERSION` (currently `1`), spread into the hashed
payload — a manual version bump covers "the renderer's output changed" without adding a new field.
SHA-256 hex digest over a key-sorted (`stableStringify`) JSON payload.

**Deliberately narrower than a naive "everything in the brief" list**, per the file's own comment: only
fields some *renderer* actually reads are hashed; a field nothing consumes yet is added "the same lot that
adds a renderer reading" it. `license_number` is named as an example of a field that doesn't exist in the
schema at all (only `license_types.label` does). This is the same discipline LOT 5's brief explicitly
calls for with `image_fingerprint` (narrower than the full brief list, direction+colours+specialty+city/
state+`IMAGE_PROMPT_VERSION` only, never practice name or headline) — `asset-fingerprint.ts` is direct
prior art for that pattern, not a new idea LOT 5 introduces.

### 1.5 `launch_checklist_items` — live schema, RLS, seed list, RPCs

```sql
create table public.launch_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  key text not null,
  label text not null,
  description text,
  done_at timestamptz,
  skipped_at timestamptz,       -- added 20260903260000
  sort_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_kit_id, key)
  -- + CHECK: not (done_at is not null and skipped_at is not null)
);
```
RLS: `SELECT`/`UPDATE` owner-scoped (`user_id = auth.uid()`); `INSERT`/`DELETE` both hard-denied
(`with check (false)` / `using (false)`) — seeding happens only via a `SECURITY DEFINER` path.

**Current live seed** (`seed_launch_checklist`, 8 rows per kit, `choose_direction` auto-completed and
excluded from progress counts):

| key | label | sort |
|---|---|---|
| choose_direction | Choose your creative direction | 0 |
| site_setup | Put your brand on your site | 1 |
| update_directory | Update your Psychology Today profile | 2 |
| google_profile | Claim or update your Google Business Profile | 3 |
| social_setup | Set up Instagram and Facebook | 4 |
| email_signature | Install your email signature | 5 |
| booking_link | Put your booking link everywhere | 6 |
| first_post | Publish your first post | 7 |

This is **seven items** once `choose_direction` is excluded — matching the brief's "Seven steps today,
presented as an accordion" for LOT 8 exactly (`/app/launch/[stepKey]`, one screen per step). No mapping
gap here.

`get_launch_progress(p_brand_kit_id) → {items: [{key,label,description,status:'done'|'skipped'|'todo'}],
resolved_count, total}` (excludes `choose_direction`). `set_launch_step(p_brand_kit_id, p_key, p_status)`
refuses `p_key = 'choose_direction'`, writes `done_at`/`skipped_at` idempotently.

---

## 2. The monthly content model

**Table**: `public.monthly_presence_content`, defined `supabase/migrations/20260827105000_monthly_content_calendar.sql`.

```sql
-- effective shape after 20260827105000 (reshapes an earlier table in place)
user_id uuid not null, brand_kit_id uuid not null,
month date, day_of_month int not null check (between 1 and 31),
type text not null check (= any (array['post','story'])),
title text check (char_length(title) <= 34),
caption text, visual_spec jsonb, published_at timestamptz,
status text check (in ('locked','draft','ready','published')) default 'locked',
unique (brand_kit_id, month, type, day_of_month),
check (status <> 'locked' or (caption is null and visual_spec is null)),
check ((status = 'published') = (published_at is not null))
```

RLS — confirmed unchanged since the September inventory:
```sql
create policy monthly_presence_content_select_own for select using (user_id = auth.uid());
create policy monthly_presence_content_insert_denied for insert with check (false);
create policy monthly_presence_content_update_denied for update using (false);
create policy monthly_presence_content_delete_denied for delete using (false);
```
Writes happen **only** via `service_role` (table comment: "Written by the frontend with service_role;
clients read their own rows only") through `ensure_month_skeleton(p_user_id, p_month)` (SECURITY INVOKER —
must run as `service_role` since the client policy refuses INSERT). No RPC exposes a client write path at
all. **Zero rows exist in the live database.** No generator currently calls `ensure_month_skeleton` in
production — same "built, never turned on" state the September `FINDINGS.md` already logged.

**Archetype/type model**: only `type ∈ {'post','story'}` — no `archetype` column, so none of the brief's
five archetypes (`statement | question | notes | signature | story`) exist as data today. (They do exist
as *asset catalog keys*: `post_statement_1080`, `post_question_1080`, `post_notes_1080`,
`post_signature_1080`, `story_1080x1920` — four post archetypes plus story, already rendered as static
per-direction template assets, unrelated to this table.)

**Answering the brief's exact question — "whether any table stores a post as an editable row or only as
generated output":** `monthly_presence_content` stores posts/stories as *rows*, but they are not
*editable* — RLS denies every write to `authenticated`, full stop. There is no partial mechanism to build
on; a caption edit, a tag, alt text, a `scheduled_for` date, or a `Mark as posted` toggle all require a
write path this table structurally refuses today.

**Recommendation, not yet built**: given (a) zero live rows, (b) a schema that doesn't carry `archetype`,
`tags`, `alt_text`, `category`, `image_slot`, or `scheduled_for`, and (c) RLS that hard-denies the
`UPDATE`/`INSERT` LOT 6 needs for autosave and `Mark as posted`, reusing `monthly_presence_content` would
mean widening its CHECK constraints, changing its RLS posture from deny-all to owner-write, and bolting on
five new columns — at which point it is not meaningfully "the same table" the September chantier built.
The brief's own contingency ("If the inventory in step 0 found no table, create `content_items`") is the
cleaner path: a fresh table matching the brief's exact shape, and `monthly_presence_content` stays
retired/superseded rather than contorted. **This is a decision for Session 4 (LOT 6), not this session** —
recorded here as the fact pattern that decision rests on, not as a decision itself.

---

## 3. `consume_generation_credit`, `plans`, and every current caller

### 3.1 `plans` — live contents (unchanged from the September inventory)

| tier | label | price | directions_limit | regenerations_limit |
|---|---|---|---|---|
| free | Free | $0 | 3 | 1 |
| starter | Starter | $79 | 3 | 3 |
| practice | Practice | $149 | 3 | 6 |
| signature | Signature | $249 | 3 | 12 |

No per-month column or concept anywhere on `plans` or `generation_credits` — everything here is a
lifetime/per-project counter (`directions_generated`, `regenerations_used`), never reset monthly. LOT 5's
`MAX_IMAGES_PER_KIT_PER_MONTH` has **no existing analog to extend** — it is new, full stop.

### 3.2 `consume_generation_credit(p_brand_kit_id uuid) → boolean` — current definition

Defined `20260830062227_entitlement_and_generation_credits.sql`, **replaced** by
`20260901182419_comp_grant_entitlement.sql` (current). Full current body confirmed live (§ backend agent
report). Ownership-scoped (`auth.uid()` must own the kit's project), reads `plans.directions_limit` /
`regenerations_limit` via `generation_credits.plan_tier`, widens (never shrinks) the regeneration ceiling
if an active `comp_grants` row exists for the user, then does a single atomic `UPDATE ... WHERE
(directions_generated = 0 OR regenerations_used < v_regen_limit) RETURNING true` — race-safe by
construction (two simultaneous callers cannot both win). Returns `false` on any refusal (unauthenticated,
not the owner, over cap) rather than raising.

**Only real call site in the whole frontend repo**: `app/api/briefs/[id]/generate/route.ts:154-157`,
inside `POST /api/briefs/[id]/generate`, called immediately before the model call inside `after()`. On
`credited === false`: job marked `failed`/`payment_required`, 402 returned, model never invoked.

**`release_generation_credit(p_brand_kit_id uuid) → boolean`** (new since September,
`20260903190000_release_generation_credit.sql`): resets both counters to 0, but only while
`brand_kits.directions is still null` — refunds a spend from a run that produced nothing, can never
refund a delivered result. Only call site: `app/api/briefs/[id]/generate/route.ts:216-220`, in the
pipeline's failure handler. A release failure itself is only `console.error`'d, non-fatal.

**Confirmed, repo-wide grep, both repos: these are the only two functions that touch `generation_credits`
counters, and the frontend has exactly one call site each.** This is the "exactly two paths reach a
credit" invariant LOT 5/7 must extend to exactly four total (add image regeneration and ethics rewrite),
never more.

### 3.3 `comp_grant_credits(p_user_id) → integer` and `comp_grants`

Internal only — `revoke execute ... from public, anon, authenticated`. Never callable by a client role
directly; only consulted from inside `consume_generation_credit`. Not relevant to LOT 5/7's new credit
paths beyond "this is the pattern for an admin-granted override," noted for completeness.

### 3.4 No kill switch / feature flag exists anywhere today

Grep across every migration in both repos for `kill_switch`, `feature_flag`, `ENABLED` returns **zero
matches**. LOT 5's `IMAGE_GENERATION_ENABLED` has no existing mechanism to extend — this will be a new
env-var-gated check in the frontend route handler (per the brief's own placement: "enforced in the
database... and a global env kill switch" — the cap is DB-side, the kill switch is env-side, consistent
with there being no prior art for either specifically as a *global* switch).

---

## 4. Prior art directly relevant to LOT 5 — `direction_assets`, dormant

**This was not asked for by name in the brief's step-0.3 list, but it is the single most important finding
for LOT 5 and belongs here rather than in `FINDINGS.md`, because LOT 5 needs to know about it before
designing `brand_images`.**

A table `direction_assets` (`supabase/migrations/20260901074421_direction_assets.sql`) already exists,
already wired into `brand_kit_reveal_get` (§ backend agent report, full function body), and already
implements — for a **different, pre-payment** purpose — almost exactly the mechanism LOT 5 needs to build
for `brand_images`:

```sql
create table public.direction_assets (
  id uuid primary key default gen_random_uuid(),
  brand_kit_id uuid not null references public.brand_kits(id) on delete cascade,
  direction_index smallint not null check (between 0 and 2),
  kind text not null default 'ambiance' check (kind = 'ambiance'),
  status text not null default 'pending' check (in ('pending','claimed','ready','failed')),
  palette_hash text, storage_path text, url text,
  cost_cents integer, reserved_cents integer, claimed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (brand_kit_id, direction_index, kind)
);
```

Purpose, per the migration's own comment: **each of a brief's three free directions gets one photoreal
"ambiance" image, generated via `gpt-image-1`, shown in place of the CSS-gradient placeholder once
ready** — this is the exact placeholder→photograph swap pattern LOT 5.4 describes for the seven paid
slots, already built once for the free reveal.

It ships a full claim/reclaim/budget-cap RPC trio:
- **`direction_assets_claim(p_brand_kit_id, p_direction_index, p_palette_hash, p_cost_estimate_cents,
  p_daily_cap_cents, p_reclaim_after default 10 min) → jsonb`** — reserves against a **daily** spend cap
  (`direction_asset_daily_spend(spend_date, reserved_cents, actual_cents)`, one row per day, atomic
  `UPDATE ... WHERE reserved_cents + estimate <= cap`), returns `{claimed, reason: 'claimed' |
  'reclaimed' | 'already_ready' | 'already_failed' | 'busy' | 'budget_exceeded', asset_id, claim_token}`.
  A stale claim (older than `p_reclaim_after`, checked against `clock_timestamp()` not `now()` —
  explicit comment on why the distinction matters inside one transaction) can be retaken **without**
  double-reserving budget.
- **`direction_assets_mark_ready(p_asset_id, p_claim_token, p_url, p_storage_path, p_cost_cents)`** /
  **`direction_assets_mark_failed(p_asset_id, p_claim_token)`** — settle a claim, token-checked so a
  reclaimed job's original (stale) caller can't clobber the reclaimer's result.

**Critically: no frontend code calls any of these three RPCs.** Repo-wide grep in eklio-frontend for
`direction_assets_claim`, `direction_assets_mark_ready`, `direction_assets_mark_failed` finds **only**
`types/supabase.ts` (the generated RPC type stubs) and one `WORKLOG.md` mention citing it as prior art for
an unrelated fix. **`ambiance_url` in `brand_kit_reveal_get`'s response is `null` for every kit today,
always** — the whole mechanism is schema-only and dormant, exactly the "built, never turned on" pattern
already logged twice in `FINDINGS.md` for `monthly_presence_content` and the retention TODOs. This is a
new instance of that same pattern, not yet written down anywhere — **added to `FINDINGS.md`** (see
bottom of this document) since it is out of this chantier's stated scope (the reveal, pre-payment, is
explicitly untouched) even though it directly informs how LOT 5 should be built.

**Recommendation for Session 3 (LOT 5), not a decision made here**: `brand_images`'s schema and RPCs
should follow this exact claim/reclaim/daily-cap shape rather than reinventing it — the concurrency
hazard (two requests racing to generate the same slot), the budget-cap-before-spend requirement, and the
"stale claim can be reclaimed without double-billing" problem are all identical between a per-direction
ambiance image and a per-slot brand image. The one structural difference: LOT 5 needs **seven** slots per
kit (not one), a `pending` status distinct from `claimed` isn't currently modeled the same way (
`direction_assets` starts rows at `'pending'` via `insert ... on conflict do nothing`, so this is
actually already compatible), and LOT 5's cap is **per-kit-total and per-kit-per-month**, not a shared
global daily cap — the cap *shape* differs even though the claim mechanics can be reused directly.

---

## 5. Storage buckets and RLS

**Two buckets exist, both private, both from `supabase/migrations/20260903090000_brand_asset_storage.sql`:**

| bucket | public | size limit | allowed MIME types |
|---|---|---|---|
| `brand-assets` | false | 5 MB | `image/svg+xml, image/png, application/json, text/css, application/octet-stream, text/html, application/zip, text/markdown` (widened twice from the original `svg,png` pair as new asset kinds were added) |
| `fonts` | false | 10 MB | `font/ttf, font/otf, font/woff, font/woff2, application/font-sfnt` |

**No bucket exists yet for `brand-images` (LOT 5) or `user-uploads` (LOT 9)** — both are genuinely new.

**`brand-assets` policies** (all `to authenticated`, all scoped `bucket_id = 'brand-assets'`):
`brand_assets_storage_select_own_paid`, `..._insert_own_paid`, `..._update_own_paid` — every one gated by
`brand_kit_asset_path_owner(name)`, a helper that parses the object path's first `/`-segment as a UUID and
calls `brand_kit_entitled()` on it (the same single entitlement function everything else in this codebase
uses). **No DELETE policy exists** — deliberate, cleanup is `service_role`-only. **`fonts` has zero
policies at all** — RLS-enabled + no policy = deny-all to `anon`/`authenticated`; only `service_role`
reaches it. This is the "table without policies returns nothing, not an error" behavior the brief's
Database rules describe, already proven correct in production for a real bucket.

**Postgres cannot mint a Supabase Storage signed URL** (confirmed, `FRONTEND_CONTRACT.md` §10 and the
September inventory §7) — `request_brand_asset_upload` returns a *path*; the actual signed URL is
produced by the frontend calling `createSignedUploadUrl()`/`createSignedUrl()` under the caller's own
session, and the real authorization boundary is these `storage.objects` RLS policies, not the RPC. LOT 5's
`brand-images` bucket and LOT 9's `user-uploads` bucket should follow this same shape: an RPC that
validates and returns a path (never a URL), RLS policies on `storage.objects` doing the actual gating, no
`service_role` in any route handler.

**`ensure_rls` event trigger — confirmed live and exactly as the brief describes.** Fires
`on ddl_command_end` for `CREATE TABLE`/`CREATE TABLE AS`/`SELECT INTO`, runs `alter table ... enable row
level security` on every new `public`-schema table. This enables RLS with zero policies (deny-all to
`anon`/`authenticated`, full access to `service_role` which bypasses RLS entirely) — it does **not**
create any policy. Every new table this chantier adds (`notifications`, `content_items`, `brand_images`,
`user_assets`, `ethics_checks`) will get RLS auto-enabled the instant it's created, but still needs real
policies written in the same migration, exactly as the brief's Database rule already states.

---

## 6. Six colour roles and four derived variants on `site_specs`

Confirmed live, unchanged from the September inventory and from `FRONTEND_CONTRACT.md` §3:

`site_specs` columns: `primary_hex, secondary_hex, accent_hex, paper_hex, light_neutral_hex,
dark_neutral_hex` (the six roles) plus `primary_text_hex, secondary_text_hex, accent_text_hex,
cta_ink_hex` (the four derived variants — computed, not patchable, no editor control). **No `color_labels`
column exists today** — LOT 3's `color_labels jsonb` (six keys, one human name per role, e.g. "Ember ·
Terracotta · Mustard · Sand · Cream · Ink") is a genuinely new column on a table that otherwise has not
changed shape since September.

---

## 7. `lib/ethics/` — existing rule families (frontend)

Files: `lib/ethics/rules.ts` (the scanner), `lib/ethics/guard.ts`, `lib/ethics/enforce.ts`,
`lib/ethics/disclaimer.ts`, `lib/ethics/README.md`.

`checkEthics(text: string): EthicsCheckResult` (`rules.ts:408`) is the scanner (what the brief calls
`scanCopy` — the exported name is `checkEthics`, not `scanCopy`; a naming difference to carry into LOT 7,
which the brief itself refers to generically as "the `scanCopy` rule families"). `hasBlockingViolation`
(`rules.ts:426`) separates `block` from `warn` severity.

**Six rule families** (`EthicsRuleId`, `rules.ts:77-83`): `timeframe`, `proven`, `client_voice`,
`credential`, `scarcity`, `diagnosis`. The rule *text* (label, description, forbidden example) lives in
the `ethics_rules` table (`id, sort_order, active, short_label, description, example_forbidden`), not in
code — only the *pattern-to-rule-id* mapping lives in `rules.ts`, by explicit design (comment on
`rules.ts:68-75`): the list and its wording live in the database so the BOARD-SAFE COPY badge's tooltip
and the enforcement path can never diverge from each other.

`guard.ts` and `enforce.ts` already implement a **regenerate-once-then-fall-back** pattern
(`enforceEthics`, `generateWithEthicsGuard<T>`, `buildRegenerationFeedback`) — this is directly relevant
prior art for LOT 7's rule "the rewrite's own output passes through `scanCopy` before it is displayed; if
it flags, regenerate once, then fall back to deterministic templates." The mechanism already exists for a
different call site; LOT 7 is very likely extending this file, not building the regenerate-then-fallback
logic from nothing.

---

## 8. The route-enumerating paywall test — current state

`app/__tests__/brand-kit-entitlement.test.ts`, unchanged in location since September.

`KIT_PAGES` (hand-maintained, not auto-discovered) currently has **three** entries — one more than the
September inventory recorded, confirming LOT 2's `/delivered` page (built in the intervening work) was
added correctly:
```ts
const KIT_PAGES = [
  "app/app/brand-kits/[id]/page.tsx",
  "app/app/brand-kits/[id]/site/page.tsx",
  "app/app/brand-kits/[id]/delivered/page.tsx",
];
```
`FREE` allowlist (unchanged): `delete`/`restore` routes, both justified. Auto-discovery (`routeFiles`,
recursive walk collecting every literal `route.ts` under `app/api/brand-kits/`) also unchanged. **Every
new page route this chantier adds under `app/app/brand-kits/[id]/**` — `assets`, `handoff`, plus any
others — must be added to `KIT_PAGES` by hand**, and per the September session's own decision
(2026-09-03, recorded in `POST_PURCHASE_INVENTORY.md` §6), the first new page route added should also add
a self-auto-discovering test over `app/app/brand-kits/[id]/**` so a forgotten page fails the suite instead
of shipping unguarded — that decision was **not yet acted on** (grep confirms no such auto-discovery
test exists yet over the pages tree; only the API-route side auto-discovers). Flagging this as still-open
work relevant to LOT 11's paywall-test extension step, in case whichever session builds LOT 4/5's new
page routes wants to close it then rather than waiting for LOT 11.

Note also: **routes outside `app/api/brand-kits/**` and `app/app/brand-kits/[id]/**` are not covered by
this test at all.** `/app/content`, `/app/launch/[stepKey]`, `/app/check`, `/app/settings` and their API
routes sit outside both the auto-discovery root and the hand-maintained array — LOT 11's "extend the
route-enumerating paywall test to every route added in this chantier" is a real widening of scope for this
test file, not just adding lines to the existing arrays.

---

## 9. The OpenAI brand-shots CLI

Lives at `scripts/brand-shots/` (frontend repo): `index.ts`, `openai.ts`, `env.ts`, `presets.json`. Wired
as `"brand-shots": "tsx scripts/brand-shots/index.ts"` in `package.json`.

Reads `OPENAI_API_KEY` via `getApiKey()` (`env.ts:36-56`) — a hand-rolled `.env.local` parser
(`loadEnvLocal`, no dependency) that only reads `OPENAI_API_KEY`, with real `process.env` values always
winning over the file; exits the process with a clear instruction message if the key is missing. Model
call: `scripts/brand-shots/openai.ts:39`, `model: "gpt-image-1"`, posted to
`https://api.openai.com/v1/images/generations`.

**Prompt pack**: `scripts/brand-shots/presets.json` — one `masterArtDirection` string plus five named
`presets` (`flatlay`, `card-macro`, `desk`, `texture`, `swatch`). The master art direction string already
contains, verbatim, almost the exact constraint language the brief quotes for LOT 5.3 ("No people, no
faces, no hands. No lotus flowers, brains, puzzle pieces, meditation imagery. No visible text... No
testimonials, ratings, or awards... Calm, precise, expensive; the opposite of a wellness template") — this
confirms the brief's instruction to reuse this discipline verbatim is reusing something that already
exists character-for-character in this repo, not something to draft fresh.

**This CLI generates the product's own marketing stills** (for eklio.com and Instagram — business-card
flat-lays, desk shots, paper texture), confirmed by `README.md:157-195` and repo-wide grep: nothing in
`app/` or `lib/generation/` calls it, and `OPENAI_API_KEY` is referenced nowhere else in the frontend repo
except this CLI and its README. **It is a separate, human-invoked tool, exactly as the brief instructs it
must remain** ("Do not import the CLI and do not merge it into the app").

**Whether `OPENAI_API_KEY` is reachable server-side in the actual deployed app (not just locally via
`.env.local`) could not be verified from this session** — no access to Vercel's environment variable
dashboard. The CLI's own pattern (`process.env.OPENAI_API_KEY`, `.env.local`-backed for local dev) is
proven correct and portable to a Node-runtime route handler, and `.env.local` is confirmed covered by
`.gitignore`. Per the brief's own instruction for LOT 5.5 ("If the key is missing, stop and tell me
exactly which line to add to which file, and wait"), Session 3 should confirm the key is actually set in
production before building the route handler that depends on it — this is not a stop condition for
*this* session, since nothing here needs the key yet, but it is a concrete open item for Session 3.

---

## 10. Contract vs. this brief — points of note (extends September's §8, no repeats)

1. **`launch_steps` vs. `launch_checklist_items`** — naming only, see §1.0. Not a contract disagreement
   (the contract doesn't name this table at all — it's outside the site-spec editor's scope, same
   reasoning as `brand_kits.tier` and the monthly content model in the September inventory).
2. **No disagreement found** between this brief and anything `FRONTEND_CONTRACT.md` covers. The contract
   remains scoped to the site-spec editor's twelve RPCs; nothing new in this session's investigation
   touches that surface.
3. **The dormant `direction_assets` mechanism (§4) is the one genuinely new structural fact this session
   surfaced that the brief doesn't anticipate by name** — it isn't a disagreement, but LOT 5 should be
   written with awareness of it rather than in ignorance of it.

---

## 11. Stop-condition check (brief §0.4)

| condition | status |
|---|---|
| Content items are not stored as rows anywhere | **Partially true, and the brief already anticipates it.** `monthly_presence_content` stores posts as rows but structurally refuses every client write (RLS `with check (false)` on INSERT/UPDATE), has zero live rows, and lacks half the columns LOT 6 needs. Not "no table at all," but not usable as-is either — see §2's recommendation. The brief's own contingency ("create `content_items`") covers exactly this case, so this is not being treated as a hard stop, only recorded as the fact pattern Session 4 needs. |
| No Node runtime available for route handlers | **False.** Unchanged from September: Next.js App Router route handlers default to Node; none in this repo declare `edge`; one (`app/api/stripe/webhook/route.ts`) explicitly declares `nodejs`. |
| The OpenAI key is not reachable server-side | **Unverified, not false.** The CLI proves the access pattern works locally; production configuration could not be checked from this session (no Vercel dashboard access). Flagged as an open item for Session 3, not a blocker for this session's investigation-only work. |
| `asset_catalog` has no seeded rows | **False.** 34 rows, all `min_tier = 'starter'` (see §1.1). |

**No condition is unambiguously true**, so there is nothing here that would have blocked proceeding to
code on stop-condition grounds alone. This session stops anyway, per the delivery order's own instruction
that Session 1 ends at "Stop here and tell me what you found, before any code" regardless of whether a
stop condition fired.

---

## 12. Open questions / decisions left for later sessions (not decided here)

- **LOT 6 (Session 4)**: build a new `content_items` table per §2's recommendation, or extend
  `monthly_presence_content`'s RLS/columns instead? This inventory documents the fact pattern; the
  brief's own wording already leans toward "new table," but the actual call belongs to whoever builds
  LOT 6.
- **LOT 5 (Session 3)**: should `brand_images`'s claim/cap RPCs be modeled directly on
  `direction_assets_claim`/`_mark_ready`/`_mark_failed` (§4), given how closely the concurrency and
  budget-cap problem matches? Recommended, not decided.
- **LOT 5 (Session 3)**: confirm `OPENAI_API_KEY` is actually set in the production environment before
  writing the route handler, per §9 and the brief's own LOT 5.5 instruction.
- **LOT 4 / LOT 5 (Sessions 2-3)**: `asset_catalog.min_tier` and `brand_images` access are both currently
  ungated by tier anywhere in the stack. If any new work this chantier wants tier-gating, the source of
  truth is `resolveEntitledTier()`/`purchases`, never `brand_kits.tier` — this rule was already
  established in September and is being carried forward, not re-litigated.

---

## FINDINGS.md addition made during this session

One new finding was appended to `FINDINGS.md` (not fixed, not built around, per this chantier's scope
rules): the dormant `direction_assets`/ambiance-image mechanism described in full in §4 above — a fully
built claim/reclaim/daily-cap system for photoreal per-direction images that no frontend code has ever
called, so `ambiance_url` is `null` for every kit in production today.
