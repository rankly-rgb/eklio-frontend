# DECISIONS.md

Every judgment call made instead of asking, going forward from the "stop reporting between steps" change.
One entry: the question, what was chosen, why. Not a place to relitigate — a record for review.

---

### 2026-09-03 — Local verification, given no Docker and no Supabase REST access

**Question.** The instruction was to build a local loop via `supabase start` + `next dev` + Playwright
against `localhost`. Testing revealed neither Docker nor Supabase's REST endpoint (nor the open web at
all) is reachable from this sandbox — confirmed with curl against three different hosts, all returning the
identical `403 connect_rejected` egress-policy denial (see WORKLOG.md). So the plan as written cannot run
as written. What's the best available substitute?

**Chosen.** Two-tier local verification instead of one full loop:

1. **Database/RLS/RPC layer** — a real local PostgreSQL 16 server (already installed on this machine,
   just not running), with hand-built minimal `auth` and `storage` schema stubs (a `users` table shaped
   like Supabase's, a `storage.objects`/`storage.buckets` pair, an `auth.uid()` function reading a session
   variable) so the actual migration files can replay unmodified and the actual SQL test suite
   (`supabase/tests/*.test.sql`) can run unmodified, matching what CI already asserts against a real
   Supabase-provided Postgres image — just locally, and against a schema I built rather than one Supabase
   ships. This is NOT a claim that it's identical to Supabase's real `auth`/`storage` schemas in every
   internal detail — only that it's compatible enough to replay this repo's own migrations and tests,
   which are the things actually being verified.
2. **App/frontend layer** — `next build`, `tsc --noEmit`, `eslint`, and the existing `vitest` suite,
   already fully working locally and already the app's own bar for "done." What this tier CANNOT do:
   exercise a real HTTP request through Supabase's actual Auth (GoTrue) or Storage API — those aren't
   running anywhere reachable from here. A `next dev` server pointed at the real remote Supabase project
   would hit the exact same egress block as `curl` did, for the exact same reason (the block is a
   network-layer policy on this sandbox's outbound connections, not specific to any one tool).

**Why not something else.** Considered: (a) standing up PostgREST/GoTrue/Storage-API as raw Go binaries
without Docker — technically possible, large effort, and still wouldn't be reachable if attempted the same
way `next dev` would reach it (moot, since the constraint is egress, not Docker, for that half); (b) using
`mcp__Supabase__create_branch` to get an isolated schema copy of the real project — doesn't solve the
actual blocker, which is that *this sandbox cannot make HTTPS requests to any Supabase-hosted endpoint at
all*, branch or not; (c) `mcp__Supabase__create_project`, a whole separate throwaway project — same
problem, plus it's still Supabase-hosted and thus still unreachable by curl/next dev from here, and it
would leave an actual billable cloud resource behind for no benefit.

**What this means for verification going forward.** Every lot gets: full migration replay + SQL test suite
against the local stub Postgres (real, not simulated), full `vitest`/`tsc`/`eslint`/`next build` locally
(real), and careful code-path tracing for anything that would need a live HTTP round trip through
Supabase's Auth/Storage or a browser (documented per-lot as "not verified: needs live Auth/Storage" rather
than silently assumed fine). Those items join the existing "only provable on Vercel" list
(`@resvg/resvg-js` on Vercel's runtime, real cold-start timing) for the user's batch review — not a new
category, just a wider one than originally scoped, because the constraint turned out to be wider (REST
API blocked too, not just the open web).

---

### 2026-09-03 — usp-options fix: status codes for the two new error classes

**Question.** What HTTP status codes should a "not configured" vs. a "model call failed" response carry?

**Chosen.** `503 Service Unavailable` for `AnthropicNotConfiguredError` (the service is genuinely,
knowably not available right now — closer to the RFC's actual meaning than a generic 500), `502 Bad
Gateway` for a real `Anthropic.APIError` (this app is a client to an upstream that failed). Both keep the
existing `serverError`'s plain 500 as the fallback for anything unclassified, so "unknown bug" doesn't
start looking like a well-understood, expected condition.

**Why.** A distinct status lets a future caller (a retry wrapper, a status-code-based UI branch, an
uptime check) tell these apart without parsing message text — which is the same principle the frontend
fix depends on (`code` field, not just message string matching).

---

### 2026-09-03 — `og_image_1200x630` is not trimmed to ink bounds, despite the Lot 4.4 rule

**Question.** The trim-to-ink-bounds rule ("every identity asset... zero padding") names two exceptions:
`avatar_400` and the favicons. `og_image_1200x630` isn't one of them — should it be trimmed anyway?

**Chosen.** No. Trimming stays off for this one too, added as a third exception.

**Why.** The rule's own purpose is "droppable into a Squarespace header without cropping first" — that
reasoning doesn't apply here. An Open Graph image's entire function is being displayed at a platform-
claimed fixed size (its name literally is that size): Twitter, Facebook, LinkedIn, Slack unfurls all read
the `og:image` meta tag and render it at 1200×630 (or crop/pad to fit that ratio if the actual file
differs) — a trimmed, irregular-aspect-ratio file would be cropped unpredictably by whichever platform
displays it, which is a worse outcome than the padding the trim rule exists to avoid elsewhere. The
canvas is designed to be filled edge-to-edge on purpose (full-bleed background, not a sparse mark on
empty space), so this isn't fighting the rule so much as recognizing this asset was never the shape the
rule was written for.

**Where this lives in code.** `lib/kit/render/registry.ts`'s `og_image_1200x630` entry calls `svgToPng`
(the untrimmed path), not `trimToInk` — same mechanism `avatar_400`/favicons will use, just triggered by
a different reason, documented at the call site.

---

### 2026-09-03 — Building `palette_sheet_png` and `og_image_1200x630` without the full Lot 4.4 catalogue

**Question.** The user referenced "the catalogue I gave you" for Lot 4.4's identity/web/color assets, but
that catalogue (exact keys, dimensions, descriptions) is not in this session's context — likely from
before a context compaction. The user separately named these two specific assets and asked for them as
PNGs. Wait for the full list, or proceed on what's concretely specified?

**Chosen.** Proceed with these two now, on reasonable inferred specs, each recorded here. Continue
building further identity/web/color assets only for ones inferable with similar confidence (a
"typography specimen," a "letterhead," ordinary category items with an obvious shape); flag anything
whose exact spec genuinely can't be guessed safely in `QUESTIONS.md` rather than invent it.

**Why.** Stopping to ask contradicts the explicit instruction this session is now operating under
("stop reporting between steps and stop waiting for me"); the two named assets are concrete enough to
build confidently (dimensions are in one of the two names outright); the risk of inferring wrong on
something this reversible (a PNG spec, not a schema or an architecture choice) is low and cheap to
correct later, unlike the four things that actually warrant stopping.

**The inferred specs, so they're on record:**
- `palette_sheet_png` — 1200×600, six equal-width swatches (200px) for the six color roles in the brief's
  documented order (primary, secondary, accent, paper, light_neutral, dark_neutral), each labeled with its
  role name and hex value in the kit's body font. Not trimmed to ink bounds in practice — the design fills
  the canvas edge-to-edge on purpose, so trimming is a no-op here, not a rule violation.
- `og_image_1200x630` — see the trim-exception entry above for why it isn't cropped. Content: practice
  name in the heading font, the selected direction's `hero.headline` as a supporting line, an overline
  pill in the primary color/cta_ink pairing (the same visual language `BrandCanvas` already uses
  elsewhere in the paid space) — full-bleed on the `paper` color.

---

### 2026-09-03 — `wordmark_png_light` split into two catalog keys, one per pixel width

**Question.** POST_PURCHASE_BRIEF.md names one item, "`wordmark_png_light` at 1200px and 2400px wide."
`asset_catalog` and the manifest/route contract are built around one row = one downloadable file with one
set of dimensions (see `get_brand_asset_manifest`'s shape — `width`/`height` are scalar columns, not an
array). Two sizes under one key would need either two rows sharing a key (breaks the primary key) or a
new "sizes" concept nothing else in the schema has.

**Chosen.** Two catalog keys: `wordmark_png_light_1200` and `wordmark_png_light_2400`. Matches the
pattern already established for every other size-varying item already in the catalogue by name
(`favicon_16`/`favicon_32`, `business_card_front`/`_back`) — a manifest entry is one file, two sizes are
two entries.

**Why.** Consistent with the schema as it already exists (no migration to the manifest shape itself), and
consistent with how the brief itself names other multi-size items — cheap to relabel later if the user
meant something else (e.g. a single endpoint that content-negotiates size), which nothing else in this
session's context suggests.

**Implementation note.** Both sizes rasterize the SAME trimmed light-ink SVG (one satori render, one
`trimToInk` call) at two different target widths via `svgToPngAtWidth` (new helper, `rasterize.ts`) —
satori's output is fully vectorized, so re-rasterizing at a different width is lossless with respect to
the vector, not a scaled-up raster. Height is derived from the trimmed aspect ratio at render time, not
stored as a fixed catalog value (same reasoning `asset_catalog_trimmed_dims_null` already established for
`wordmark_png_dark`).
