# POST_PURCHASE_INVENTORY.md

Facts gathered before writing any code for the post-purchase chantier. Every claim below is either
quoted from `FRONTEND_CONTRACT.md` (backend repo), read directly from the live database
(`fobgdsupyfslxbswfuay`, us-east-1), or found in this repo's own code with file:line. Nothing here is
inferred or assumed.

---

## 1. Color roles on `site_specs`

Confirmed in `FRONTEND_CONTRACT.md` §3 and §"The PATCH response" (real captured envelope).

**Six roles**, in display order:

| # | key | paints | a contrast fix may move it |
|---|---|---|---|
| 1 | `primary` | buttons, links, active states | yes |
| 2 | `secondary` | supporting headings and surfaces | yes |
| 3 | `accent` | small marks only — never a large fill | yes |
| 4 | `paper` | **the whole page** — largest surface | **no, never** |
| 5 | `light_neutral` | tinted bands and cards *on top of* the page | **no, never** |
| 6 | `dark_neutral` | body copy, dark-section fill | yes |

**Four derived variants**, in `preview.tokens`, not in `spec`, not patchable, no editor control:

| key | derivation | use |
|---|---|---|
| `primary_text` | `primary` darkened only as far as 4.5:1 on `paper` requires | headings/links in primary |
| `secondary_text` | same, for `secondary` | supporting headings |
| `accent_text` | same, for `accent` | small highlighted words |
| `cta_ink` | white if white reads on `primary`, else `dark_neutral` darkened until it does | the CTA button's label only |

Rule, everywhere: **text → use the variant. Fill (background/button/band/rule/border/chip) → use the brand
color.** Ten of eighteen shipped brand colors need no variant and the variant equals the brand color
verbatim — treat "always different" as wrong; compare, don't assume.

`paper` and `light_neutral` are **never the same job**: `paper` ← `palette.paper`, `light_neutral` ←
`palette.light`, both come straight from the direction palette, neither is derived, and a `suggested_fix`
never touches either — only `primary`, `secondary`, `accent`, `dark_neutral` can be a fix target, because
darkening a *surface* to fix one pair silently breaks every other pair measured against it.

Real example (CLAY & SAND): `primary #B4674A`, `secondary #C08A3E`, `accent #6E3320`, `paper #FAF6EE`,
`light_neutral #F4EEE3`, `dark_neutral #2B2A27`, `primary_text #A35D43`, `secondary_text #92692F`,
`accent_text #6E3320` (same as accent — a real case of variant = brand color), `cta_ink #10100F`.

---

## 2. `brand_kits.directions[]`, `brand_kits.tier`, `plans`, and the paid check

### `brand_kits.directions[]` — exact shape, from a live row

```json
{
  "id": "warm-ground",
  "name": "Warm Ground",
  "recommended": true,
  "rationale": "Terracotta and a soft serif suit a new practice that wants to sound human first.",
  "about_excerpt": "I work with adults who are tired in a way sleep doesn't touch...",
  "tone_keywords": ["steady", "plainspoken", "warm"],
  "palette": { "primary": "#B4674A", "secondary": "#C08A3E", "light": "#F4EEE3", "dark": "#2B2A27", "paper": "#FAF6EE" },
  "typography": { "heading_font": "Fraunces", "body_font": "Nunito Sans", "google_fonts_url": "https://fonts.googleapis.com/..." },
  "hero": { "overline": "LMFT · PORTLAND, OR", "headline": "You don't need it figured out to start.", "subhead": "Therapy for adults carrying something they never named.", "cta_label": "Book a consult" },
  "rendering": { "cta_shape": "pill", "cta_style": "solid", "nav_surface": "light" }
}
```

Confirms `FRONTEND_CONTRACT.md` §6: palette carries exactly `{primary, secondary, light, dark, paper}`,
`accent` optional (absent in this real row). CHECK-enforced: exactly 3 directions, distinct ids, 3 distinct
heading fonts, `name` ≤20/1-2 words, `rationale` 60–95, `hero.headline` ≤46, `hero.subhead` ≤60,
`tone_keywords` exactly 3.

### `brand_kits.tier` — exists, but is not "current entitlement"

Full column list (live schema): `id, project_id, direction_id, content, multi_builder_prompt, pdf_url,
share_slug, created_at, updated_at, tier (text, not null, default 'starter'), directions (jsonb),
selected_direction_id, voice_guide (jsonb), social_templates (jsonb), site_prompt, site_prompt_target,
ethics_check (jsonb), practitioner_line`.

`brand_kits.tier` is **not documented anywhere in `FRONTEND_CONTRACT.md`** — a real gap in the contract,
not a disagreement (the contract never claims it doesn't exist, it's simply silent). Reported per the
brief's own rule.

`lib/data/brand-kit.ts:104` already selects `"*, projects!inner(user_id, name)"` — `tier` is present on
every loaded `kit.row` today. **No component currently reads it.** `lib/billing/entitlements.ts:18-20` is
explicit about why not:

> `brand_kits.tier` n'entre PAS dans ce calcul : c'est l'instantané du périmètre livré à la génération, pas
> le droit courant.

`lib/kit/tiers.ts:30-35` names three distinct tier concepts: the **purchased** tier (`purchases.tier`,
current entitlement, via `resolveEntitledTier()`), the **delivered** tier snapshot (`brand_kits.tier`, set
once at generation time, does not move on a later upgrade), and a module-internal scope parameter. **For
Lot 4's `asset_catalog.min_tier` gating (deferred, not built this lot), the source of truth when it is
eventually wired must be `purchases`/`resolveEntitledTier()`, not `brand_kits.tier`** — the codebase itself
already draws this line.

**Rule, confirmed 2026-09-03: when `min_tier` is eventually enforced, it compares against
`resolveEntitledTier()` — current entitlement — never against `brand_kits.tier`, which is a fixed snapshot
of what was delivered at generation time. The same sentence is repeated in the migration comment that adds
`asset_catalog.min_tier` (§4.2 of the brief).**

### `plans` — live contents

| tier | label | price | directions_limit | regenerations_limit | total runs |
|---|---|---|---|---|---|
| `free` | Free | $0 | 3 | 1 | 2 |
| `starter` | Starter | $79 | 3 | 3 | 4 |
| `practice` | Practice | $149 | 3 | 6 | 7 |
| `signature` | Signature | $249 | 3 | 12 | 13 |

Matches `FRONTEND_CONTRACT.md` exactly. This table governs generation-credit allowances (pre-payment),
not asset access.

### The paid check — confirmed in the database, confirmed server-only

`brand_kit_entitled(p_brand_kit_id) → boolean`. Single frontend wrapper: `lib/billing/entitlements.ts:166`
(`isBrandKitEntitled`), fails closed on any RPC error. Two call sites, both server-side:

- `app/app/brand-kits/[id]/page.tsx:46` — Server Component, `redirect()` to checkout if false.
- `app/api/brand-kits/[id]/pdf/route.ts:47` — route handler, HTTP 402 if false.

**No client component calls it or the RPC directly** — confirmed by repo-wide grep. Every other gated
route under `app/api/brand-kits/**` relies on the *database itself* refusing the write/read (the gated
seven RPCs in the contract) and surfaces that refusal as 402 rather than re-checking — this dual mechanism
is what `app/__tests__/brand-kit-entitlement.test.ts` enumerates and asserts (see §6 below). Stop-condition
0.4 ("the paid check turns out to live in a client component") does **not** apply.

---

## 3. `consume_generation_credit` and everything that calls it

Exactly one call site in the whole repo: `app/api/briefs/[id]/generate/route.ts:154-157`, inside
`POST /api/briefs/[id]/generate` (the initial direction-generation pipeline). Called after the `brand_kits`
row exists, immediately before the model call inside `after()`. `credited === false` → job marked
`payment_required`, HTTP 402.

**There is no other call site** — no tone-card regeneration, no USP regeneration, nothing else spends a
credit. This is the one function this entire brief must never reach (Lot 4's asset rendering, Lot 5's PDF,
Lot 7's ethics scan are all pure functions over existing data — none of them touch generation credits by
design, and this single call site is what a spy-based test asserts against).

---

## 4. The monthly content model — real, but empty

**Table**: `public.monthly_presence_content`. Columns: `id, month (date), status (text, default 'locked'),
created_at, updated_at, user_id, brand_kit_id, day_of_month (int), type (text), title, caption, visual_spec
(jsonb), published_at`.

**RLS**: owner-select-only (`user_id = auth.uid()`), INSERT/UPDATE/DELETE all `with check (false)` /
`using (false)` for every role — writes can only happen via `service_role` (which bypasses RLS), i.e. a
cron job or admin path, never a client write. **No RPC wraps this table** — confirmed against
`pg_proc`, nothing matching `%monthly%` or `%content%` exists beyond unrelated Postgres system functions.
Read is plain PostgREST `select`, same pattern as the pre-existing catalog tables.

**Zero rows exist in the live database right now.** `select distinct type` and `select distinct status`
both return empty. There is no generation pipeline currently populating this table in production — the
frontend code that reads it (`lib/data/calendar.ts`) is fully built, but nothing has ever written to it.

**Frontend shape** (`lib/data/calendar.ts:19-31`, Zod `calendarItemSchema`):
```ts
{ id, month, day_of_month, type: "post" | "story",
  status: "locked" | "draft" | "ready" | "published",
  title, caption, visual_spec, published_at }
```
Read via `calendar_summary(p_user_id, p_month)` RPC (`lib/data/calendar.ts:75-78`) →
`{ items: CalendarItem[], ready_count, locked_count }`.

**Free/paid split**: purely `item.status !== "locked"` (`isVisible()`, `lib/data/calendar.ts:101-103`).
Access itself is decided server-side when items are written, not by the frontend. **Blurred cards**:
`components/home/content-grid.tsx`, `LockedTile` (lines 186-239) — blurs a duplicated title layer,
keeps the real title as visible/accessible text underneath, opens `MonthlyPresenceModal` on click.

**"This month, in your brand"** appears at `app/app/content/page.tsx:29` (full 16-tile grid, via
`ContentGrid`) and inside `components/kit/brand-kit-view.tsx:177` (a status/upsell card only, not the grid)
— exactly the section Lot 3 says to kill from the brand kit page and Lot 8 says to replace on the content
page.

**Decided, 2026-09-03: this table stays empty.** A fully-coded, owner-RLS'd table that has never received
a row is a feature built and never turned on — a product finding, logged in `FINDINGS.md`, not a bug for
this chantier to fix. No write path, no generator, no seed data gets built here.

Lot 8 ships against both real states:
- Rows exist → the brief as written: first post/story in full and downloadable, the rest a legible locked
  calendar.
- Zero rows (every kit today) → an honest empty state in her brand: "Your first month is being prepared."
  plus the Monthly Presence card. No fabricated sample posts, no placeholder headlines, no lorem — showing
  invented content as though it were hers is worse than showing nothing.

Lot 4's four post assets (`post_statement_1080` etc.) keep the brief's own fallback: render from the
month's first four items when they exist, from the direction's sample copy when they don't — in the
fallback case the file is a template, described as such in the zip's `README.txt`.

---

## 5. The current PDF path — two independent hand-rolled PDF writers, no library

**`GET /api/brand-kits/[id]/pdf`** (`app/api/brand-kits/[id]/pdf/route.ts`) → `renderBrandKitPdf(kit)`
(`lib/kit/pdf.ts:211`) — a hand-written PDF 1.4 byte-stream generator (own `PageBuilder`/`assemble`
classes), base-14 fonts only (Helvetica/Times/Courier), hand-drawn hex color swatches. Explicit rationale
in the code (`lib/kit/pdf.ts:8-13`): a headless-browser renderer (Puppeteer/Playwright) would add ~300MB
to the deployment for what base fonts already cover.

**`GET /api/brand-kits/[id]/site-output/pdf?target=…`** — fetches the markdown from `site_output_get`
(`format=md`) and feeds it to a second hand-rolled function, `renderMarkdownPdf()` (`lib/kit/pdf.ts:340-401`,
regex-based markdown parsing into the same `PageBuilder`).

**`GET /api/brand-kits/[id]/site-output?format=md`** itself (`app/api/brand-kits/[id]/site-output/route.ts`)
is *not* a PDF route — it returns the raw markdown/text/json via `siteResponse()`. The PDF is a separate
route that renders that markdown server-side into real PDF bytes.

**No `satori`, `@resvg/resvg-js`, `sharp`, `puppeteer`, `playwright`, or headless Chromium exists in this
repo today** — confirmed in `package.json` and by repo-wide grep. Lot 4.1's font-cache/renderer and Lot 5's
PDF both introduce genuinely new dependencies; this is expected, not a second piece of work.

**A technical tension to flag before Lot 5, not a stop condition**: Lot 5 requires *selectable text* with
*both fonts embedded*. `satori`/`@resvg/resvg-js` (Lot 4's renderer) rasterize to PNG — they cannot produce
selectable PDF text. The existing hand-rolled PDF writer only embeds base-14 fonts, not the therapist's
actual Google Fonts. Headless Chromium is explicitly not present and the codebase has already rejected it
once on deployment-size grounds. The natural fit for Lot 5, consistent with this repo's existing
no-headless-browser philosophy, is a PDF library that embeds custom TTF/OTF fonts directly (e.g. `pdf-lib`
+ `fontkit`) rather than either satori/resvg or a browser — flagging this now so Lot 5 doesn't start from
the wrong tool; will confirm before building it.

**Decided, 2026-09-03: `pdf-lib` + `fontkit`, confirmed.** `pdf-lib` has no layout engine, so a small
layout helper (measured line breaking through `fontkit`, a text-flow function, a baseline grid) gets built
first and all fourteen pages compose through it — no page-by-page hand positioning. Page 13 (social
templates) embeds the PNGs Lot 4 already renders; every other page is real, selectable, embedded-font text.
The brief's Lot 5 requirement is unchanged; only the tool is now decided.

---

## 6. The route-enumerating paywall test

`app/__tests__/brand-kit-entitlement.test.ts`. **Auto-discovers** every `route.ts` under
`app/api/brand-kits/**` via filesystem walk (`routeFiles()`, lines 78-84) — no manual registration needed
for a new API route in that tree. Each discovered route must satisfy one of three things or the test
fails: call `isBrandKitEntitled(` directly (regex `EXPLICIT_CHECK`), call one of the DB-refused RPCs and
surface the refusal as `siteResponse(...)`/402, or be listed in a hardcoded `FREE` allowlist with a
>20-character justification (currently empty).

**Two page paths are hardcoded**, not auto-discovered: `KIT_PAGES = ["app/app/brand-kits/[id]/page.tsx",
"app/app/brand-kits/[id]/site/page.tsx"]` (line 153) — each asserted to contain a guard + `redirect(` +
`"/app/checkout"`. **A new page route this brief adds (e.g. `/app/brand-kits/[id]/delivered`,
`/app/brand-kits/[id]/guide/print`) must be added to this array by hand** — the test's own auto-discovery
only covers `app/api/brand-kits/**`, not `app/app/brand-kits/**` pages. Extending this test (per the brief's
own rule to extend rather than route around) means: new API routes need nothing extra as long as they
guard correctly; new pages need a line added to `KIT_PAGES`.

**Decided, 2026-09-03: `KIT_PAGES` needing a manual line is itself a guard that can silently stop
guarding.** In the same commit as the first new page route this brief adds (Lot 5's `/guide/print`, per
the delivery order — Lot 2's `/delivered` lands later but is the same shape), add a test that enumerates
the actual page files under `app/app/brand-kits/[id]/**` and fails if one is absent from `KIT_PAGES`. A
forgotten page route then fails the suite instead of shipping unguarded.

The reveal page is separately asserted **unguarded** — deliberate, "the reveal is the sales pitch."

---

## 7. Storage buckets and RLS

**Zero storage buckets exist on the live project.** `select count(*) from storage.buckets` → `0`. No
policies exist on `storage.objects` or `storage.buckets` either (`pg_policies` for `schemaname='storage'`
returns empty). This is confirmed via direct query against the live database, not inferred from an absence
of documentation.

**This is stop-condition 0.4's first clause, and it is true: there is no storage bucket I may write to.**
See below.

**Decided, 2026-09-03: create two private buckets in the same migration as `brand_assets`/`asset_catalog`
(brief step 3, Lot 4.1–4.3), policies in that migration too. Shipped in
`20260903090000_brand_asset_storage.sql` (eklio-backend).**

- `brand-assets` — per-kit rendered files, path `brand-assets/{brand_kit_id}/{fingerprint}/{filename}`.
  Owner reads their own objects, nobody reads anyone else's. A per-object size cap and an allowed MIME
  list, not left open.
- `fonts` — the TTF cache, keyed family+weight. Server-side only — no client role (`anon`/`authenticated`)
  reads or writes it; shared across kits, holds no user data.

**Correction, 2026-09-03: the plan above ("writes only through the signed upload URL
`request_brand_asset_upload` issues") described a mechanism that does not exist, and shipped differently.**

**Postgres cannot mint a Supabase Storage signed URL.** `createSignedUploadUrl()` /
`createSignedUrl()` are calls against the separate Storage HTTP service, over a signing key that service
holds — nothing in the `storage` schema, and no extension installed on this project, can produce that
signature from inside a Postgres function. An RPC that "returns a signed upload URL" was never
implementable as written.

What actually shipped: the security boundary is **RLS policies on `storage.objects`**, not an RPC. A
policy helper, `brand_kit_asset_path_owner(name)`, parses the object path's first segment as the
`brand_kit_id` and calls `brand_kit_entitled()` — the existing, single definition of "paid for this kit,"
reused whole. These policies are what actually authorize a read or a write, and they hold for *any*
caller that reaches `storage.objects` under RLS — including `createSignedUploadUrl()`/`createSignedUrl()`
themselves. `request_brand_asset_upload` still exists, but it now returns a **path**, not a URL: it
validates the asset key and the fingerprint's shape and hands back `{bucket, storage_path}`, which
eklio-frontend then passes to `createSignedUploadUrl()` using the caller's own session to get an actual
signed URL. Two consequences worth carrying forward:

- The RPC's `brand_kit_entitled()` check is a courtesy — an early, clear `payment_required` refusal — not
  the boundary. Removing it would not open anything the storage policies don't already close.
- The defining test of the lot is a session that never calls any RPC and drives `storage.objects` directly
  under its own JWT: refused for a path under another kit's `brand_kit_id`, refused for its own kit while
  unpaid, allowed only for its own paid kit's path. That test exists
  (`supabase/tests/20260903090000_brand_asset_storage.test.sql`, eklio-backend) and is what actually proves
  the boundary, not the RPC-level tests alongside it.

Full detail, including the four implementation gotchas (defensive UUID-shaped path parsing, INSERT+UPDATE
granted together for idempotent re-renders, no client `DELETE` ever, the path — not
`storage.objects.owner` — as the authority), is in `FRONTEND_CONTRACT.md` §10 (eklio-backend).

Both buckets get the same treatment as `rls_auto_enable`'s test: proof that a non-owner reads zero objects
and the owner reads their own — a storage policy that silently returns nothing is the same failure mode as
a table without RLS policies.

---

## 8. Contract vs. this brief — points of note

Not outright contradictions (the contract never asserts something the brief contradicts), but places where
the contract is silent and the brief assumes specifics, recorded per the brief's instruction to report any
disagreement:

1. **`brand_kits.tier` is entirely undocumented in `FRONTEND_CONTRACT.md`.** Confirmed live (see §2). The
   contract discusses `plans.tier` and `generation_credits.plan_tier` (both project-scoped, pre-payment
   allowance concepts) but never mentions this column. Not a blocker — the brief's Lot 4 doesn't gate on it
   this lot — but worth knowing the contract's "this file is complete" claim is scoped to the site-spec
   editor specifically (its own first line), not to `brand_kits` as a whole.
2. **The monthly content model has no presence in `FRONTEND_CONTRACT.md` at all** — not the table, not
   `calendar_summary`, not the free/paid status model. Same scoping reason as above. Everything in §4 of
   this document came from direct database inspection and this repo's own code, not the contract.
3. **No disagreement found** on anything the contract *does* cover: color roles, derived variants, the
   entitlement check, `consume_generation_credit`, the PATCH envelope, or the directions[] shape all match
   what's live, exactly.

---

## 9. Stop-condition check (brief §0.4)

| condition | status |
|---|---|
| No storage bucket I may write to | **TRUE — stop condition met.** Zero buckets exist. |
| No Node runtime available for route handlers | False. Next.js App Router route handlers default to Node unless Edge is declared; none in this repo declare Edge, one (`app/api/stripe/webhook/route.ts`) explicitly declares `nodejs`. |
| `brand_kits.tier` has no read path in the app | False. `loadBrandKit()` already does `select("*, ...")` — `tier` is present on every loaded row today; it's simply unread by any component yet. Trivially readable. |
| The paid check lives in a client component | False. Confirmed server-only: one Server Component page, one route handler, both calling the single `isBrandKitEntitled()` wrapper. No client component touches it. |

**One of four conditions is true. Per the brief, stopping here rather than proceeding to Lot 1.**
