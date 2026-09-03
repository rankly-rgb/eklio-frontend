# WORKLOG.md

Append-only. One entry per lot (or per discrete piece of work outside the lot numbering, like the
usp-options fix below). What was built, what was verified and how, what could not be verified and why.

---

## 2026-09-03 — usp-options 500 (blocker fix, precedes Lot 4.4 onward)

**What was wrong.** `POST /api/briefs/{id}/usp-options` returned `500` in ~515ms with the generic
`{"error":"Something didn't go through on our side. Your answers are saved."}`. 515ms is too fast for a
real model round trip — confirmed by reading the code, not guessing: `getAnthropicClient()`
(`lib/ai/client.ts`) throws **synchronously, before any network call**, when `ANTHROPIC_API_KEY` is
unset. That throw is called directly inside `generateUspOptions`'s model-call step
(`lib/generation/usp-options.ts:349`), with no internal try/catch, so it reaches the route's outer catch
immediately. The user's own hypothesis (missing key in Vercel's Preview environment) matches the evidence
exactly.

On top of the missing key, the frontend made the failure worse: `components/brief/positioning-screen.tsx`'s
initial-load effect ignored whatever the server actually said and always showed a fixed string —
*"We couldn't find positioning options that were truly yours just now."* — which is guardrail-shaped
language for a config problem that has nothing to do with her answers.

**What was fixed.**
- `lib/ai/client.ts`: `getAnthropicClient()` now throws a named `AnthropicNotConfiguredError`, not a
  generic `Error` — so callers can tell "not configured" apart from a real API failure
  (`Anthropic.APIError`) or a bug.
- `lib/api/handler.ts`: new `generationErrorResponse(context, error)` — classifies into three outcomes:
  `AnthropicNotConfiguredError` → `503`, `code: "generation_unavailable"`, an honest "that's on us, not
  your answers" message; `Anthropic.APIError` → `502`, `code: "model_call_failed"`, "try again"; anything
  else → the existing generic `serverError` (500), unchanged.
- `app/api/briefs/[id]/usp-options/route.ts`: its catch block now calls `generationErrorResponse` instead
  of `serverError`.
- `components/brief/positioning-screen.tsx`: the initial-load effect now shows `body?.error` when the
  server sent one, falling back to the old generic string only when it didn't (a response with no parseable
  body at all). The network-level `catch` (fetch itself failed, no response) got its own honest
  "couldn't reach the server" message instead of reusing the content-judgment phrasing.
- `lib/generation/tone-cards.ts`: same underlying cause reaches here too (`getAnthropicClient()` inside its
  own retry loop), but that loop already catches everything internally and falls back to "standard
  openings" — already an honest, deliberate UX, not a lie. The only real gap was retrying a guaranteed
  failure 3 times for no benefit; added a short-circuit on `AnthropicNotConfiguredError` specifically.
- `app/api/briefs/[id]/generate/route.ts` / `lib/generation/pipeline.ts` (the 3-directions pipeline): not
  changed. Its job-status field (`lib/generation/job.ts`) deliberately never sends error text to the
  client at all ("Message court, destiné aux logs serveur — jamais renvoyé au client") — the visible
  failure state ("That didn't go through. ... Your answers are saved.") is already honest without naming a
  cause, so it isn't the same bug. `AnthropicNotConfiguredError` having a proper `.name` already improves
  the existing `track("generation_failed", {reason: pipelineError.name})` analytics call for free — no
  further change needed there.

**Confirmed, not assumed:** a failed regenerate attempt does not burn one of the two extra rounds — traced
`usp_regenerate_count`'s only writer (inside the try block, after a successful `generateUspOptions` call)
and confirmed an exception never reaches it. This was already true before the fix; verified rather than
changed.

**Verified how:** read every code path end to end (not run against a live request — this sandbox cannot
reach the Vercel preview or Supabase's REST endpoint at all, see the entry below). New unit tests
(`lib/api/__tests__/handler.test.ts`) exercise `generationErrorResponse`'s three branches directly,
including a real `Anthropic.RateLimitError` instance, not a duck-typed stand-in. Full existing suite
(897 tests after this change), `tsc --noEmit`, `eslint`, all clean.

**Not verified:** that this actually fixes the real failure on the deployed preview — that needs the key
to actually be set in Vercel and a real request, neither of which this sandbox can do. Whether
`ANTHROPIC_API_KEY` is in fact missing from Vercel's Preview environment specifically (vs. some other
cause that happens to also be fast) is the user's own hypothesis, being checked from their side per their
message — this fix makes the failure honest and correctly classified regardless of which it turns out to
be, but doesn't itself prove the key is the cause.

---

## 2026-09-03 — Local verification capability (infrastructure, before Lot 4.4 continues)

See `DECISIONS.md` for the reasoning; summarized here as what was actually established:

- This sandbox cannot reach the open web, `vercel.com`, or **Supabase's own REST endpoint**
  (`fobgdsupyfslxbswfuay.supabase.co`) — all return the identical `403 connect_rejected` from the egress
  proxy. This directly contradicts the working hypothesis in the user's own message ("test curl against
  the Supabase project's REST endpoint... localhost is never blocked") for the REST endpoint specifically;
  localhost itself is confirmed unblocked (a plain connection-refused on an unlistened port, not a policy
  403).
- Docker is not available (`docker` binary present, no daemon reachable) — `supabase start` (what CI uses)
  cannot run here.
- A real PostgreSQL 16 server IS available locally (`apt`-installed, not started by default) — started for
  this session. This is NOT the same as Supabase's own Postgres image: it has no `auth`/`storage`/`extensions`
  schemas, no `auth.uid()`, no `storage.objects`/`storage.buckets` pre-built.

**Built** (eklio-backend, commits `452537e` and `cfe6639`): a hand-built stub `auth`/`storage` schema
(`scripts/local-verify-stub-schema.sql`) plus a wrapper (`scripts/local-verify.sh`) that rebuilds a local
database from zero, applies the stub, replays every migration in order, runs `seed.sql`, then every
`supabase/tests/*.test.sql` file, then the seed-mirror check — the same things CI asserts against a real
Supabase Postgres image, just locally. First run found and fixed two real bugs, both pre-existing in test
files from earlier in this session (not migrations): two tests asserted state that was true right after
their own migration but false after a *later* migration changed it, because the full suite runs against
the cumulative end state, not a snapshot per migration — a real gap in the earlier one-migration-at-a-time
live-DB dry-run technique. See eklio-backend's own commit for the specifics.

Then `scripts/local-verify-fixture.sql`: one account, one completed brief, one brand kit with three
directions and one selected, comp access granted — entirely synthetic, entirely local, never touches the
real deployed database or the real `nainarahal@gmail.com` test account. Verified for real against it
(not just asserted): `brand_kit_entitled()` → true, `get_brand_asset_manifest()` → both current catalog
rows with `current: false`, `request_brand_asset_upload()` → the correct storage path.

**What this tier proves and doesn't.** Proves: every RLS policy, every RPC's logic and refusals, every
migration's correctness, against a real Postgres engine — strong, real verification, not simulated. Does
NOT prove: anything requiring Supabase's actual Storage or Auth HTTP APIs (a real signed URL, an actual
object landing in a bucket, a real login) — those APIs aren't running anywhere reachable from this sandbox,
local or remote, for the same egress-policy reason curl couldn't reach them directly. For asset rendering
specifically, the renderer itself (satori + resvg + the Google Fonts fetch, which the earlier Lot 4.1–4.4
work already confirmed IS reachable) can still be verified for real, standalone, outside the Storage-
dependent upload/download/signed-URL path — see the Lot 4.4 entries below for how that's used going
forward. Anything that genuinely needs live Storage/Auth joins the existing Vercel-only-provable list
(`@resvg/resvg-js` on Vercel's runtime, real cold-start timing) for the user's batch review.

---

## 2026-09-03 — Lot 4.4: `palette_sheet_png`, `og_image_1200x630`

Built without the full Lot 4.4 catalogue (not in this session's context — see DECISIONS.md); these two
were named explicitly, on inferred specs also recorded in DECISIONS.md.

- `lib/kit/render/palette-sheet.ts` — the six colour roles as labelled swatches (role name + hex), 1200×600,
  fills the canvas edge-to-edge on purpose.
- `lib/kit/render/og-image.ts` — practice name, the selected direction's hero overline/headline, on the
  paper colour, 1200×630. Registry entry explicitly documents (and DECISIONS.md explains) why this one is
  never trimmed to ink bounds, unlike every other identity asset so far.
- `lib/kit/render/registry.ts` — both wired in; `RenderContext` gained a `hero` field (only
  `og_image_1200x630` reads it).
- `lib/kit/asset-fingerprint.ts` — extended to hash `hero.overline`/`hero.headline`, since
  `og_image_1200x630` is the first renderer whose output depends on copy beyond the practice name. Comment
  updated to say so, per its own instruction to extend it "the same lot that adds a renderer reading hero
  copy."

**Verified how:** the actual, unmodified production renderer functions, run directly via `tsx` (not
mocked) with fake-but-syntactically-valid `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` env vars.
This is not a workaround for a missing secret (nothing here needs a *real* key) — `getCachedFontBuffer`'s
Storage cache-check and cache-upload both fail against the fake host exactly as they would against any
unreachable one, are caught exactly as designed (`if (cached.data)` false → falls through to a real fetch;
upload failure is logged, non-fatal), and the *actual* Google Fonts fetch (real network, genuinely
reachable from this sandbox) still runs for real. Produced real PNGs from real font data through real
satori + real resvg, then looked at them — sent to the user, not just described. Backend: seeded via the
same live-DB dry-run-then-apply discipline as every prior migration, then confirmed against the local
fixture — `get_brand_asset_manifest()` returns all four current catalog entries with the right groups/
dimensions. 901/901 tests, `tsc --noEmit` clean, `eslint` clean, `next build` clean.

**Not verified:** the actual Storage round trip for either asset (needs live Storage API, same gap as
everything else in this tier) and, same as `wordmark_png_dark` before it, nothing new here changes the
still-open Vercel-only items (resvg on Vercel's runtime, real cold-start timing, and now also the actual
preview verification the user is running independently, per their last message before "stop reporting
between steps").

---

## 2026-09-03 — A failed directions pipeline was burning her free-tier allowance

Found while auditing the rest of the B2C path for the same class of bug as usp-options (per "bugs
anywhere on that path are yours to fix without asking") — traced `consume_generation_credit`, the RPC the
3-directions pipeline (`app/api/briefs/[id]/generate/route.ts`) spends before every run.

**The bug.** `consume_generation_credit` runs before the model call, unconditionally (has to, for
race-safety against two concurrent requests). Its counter logic: a project's first-ever call sets
`directions_generated` straight to `directions_limit` (3, on every plan including free); every later call
increments `regenerations_used`, capped by `regenerations_limit` (**1** on the free tier). A first attempt
that fails outright — the exact missing-`ANTHROPIC_API_KEY` scenario the usp-options fix addresses —
still spends the full 3, having produced zero directions. Her first legitimate retry is then charged
against a budget of 1 regeneration instead of getting a real first try. A second failure (the config-missing
case fails identically every time) locks her out of the entire free tier, permanently, having seen zero
directions — on the exact tier a brand-new signup is on.

**The fix (eklio-backend `68f7c6a`):** `release_generation_credit(p_brand_kit_id)` — resets both counters
to zero, but only while `brand_kits.directions` is still null, so a real delivered result is never
retroactively refunded (the database decides, not a flag). Same shape of problem
`direction_assets_claim` already solved elsewhere in this schema ("a fresh claim may retake the same
reservation rather than booking a second one").

`app/api/briefs/[id]/generate/route.ts`: called from the pipeline's own failure handler (inside `after()`,
alongside the existing `track("generation_failed", ...)` and job-status write), with the session client
(the RPC is `auth.uid()`-scoped, same as everything else this route reads before entering `after()`) — a
release failure is logged and non-fatal, same posture as every other best-effort write in that block.

**Verified how:** backend — the exact bug reproduced and the fix proven in
`supabase/tests/20260903190000_release_generation_credit.test.sql` (consume burns the full allowance,
release resets it because directions is still null, a second consume gets a genuine first attempt not a
regeneration; plus release refuses once directions exist, ownership scoping, unauthenticated refusal) —
against both the live database (dry run, confirmed zero currently-affected real projects, then applied)
and the local verification loop (44/44 tests). Frontend — `types/supabase.ts` regenerated (purely
additive diff, confirmed), `tsc --noEmit`/`eslint`/`next build` clean, 902/902 tests.

**Not verified:** the actual route wiring at runtime (needs a real failed pipeline run against live Auth —
same live-Storage/Auth gap as everything else in this session; the RPC itself and its exact refusal/reset
behavior IS verified for real, just not this specific route's call to it end to end).

---

## 2026-09-03 — POST_PURCHASE_BRIEF.md written to the repo

Wrote the user's full remaining brief (rest of the Lot 4.4 catalogue + Lots 3/5/7/6/8/2/9 in full detail)
verbatim into `POST_PURCHASE_BRIEF.md` at the repo root, committed and pushed as its own commit (`4a5abef`)
before resuming any other work, per the user's explicit instruction. Cleared the now-answered "rest of the
Lot 4.4 catalogue" entry in `QUESTIONS.md`, pointing future reads at the brief file instead. From here,
`POST_PURCHASE_BRIEF.md` is the source of record for the remaining delivery order — re-read it on a context
rollover rather than treating this as unrecoverable.

---

## Lot 4.4 (continued) — wordmark ink treatments: `wordmark_svg_light`, `wordmark_svg_mono_black`,
## `wordmark_svg_mono_white`, `wordmark_png_light_1200`, `wordmark_png_light_2400`

**What was built.** Five new identity assets, all reusing the existing `wordmark_svg_dark` layout with a
different ink: `renderWordmarkSvgWithInk()` (new, `lib/kit/render/wordmark.ts`) factors the shared satori
tree out from `renderWordmarkSvgDark`, and four public functions wrap it — `renderWordmarkLight` (ink
`tokens.paper`, never a literal white — same "on-brand ink" reasoning as the existing dark treatment),
`renderWordmarkMonoBlack`/`renderWordmarkMonoWhite` (ink literal `#000000`/`#FFFFFF` — deliberately NOT
brand-token-derived: "mono" means fixed, for single-colour print/engraving contexts that can't carry brand
colour at all). All three trim to ink bounds via the existing `trimToInk`, matching every other identity
asset. `wordmark_png_light_1200`/`_2400` reuse the SAME trimmed light SVG rasterized twice at different
target widths via a new `svgToPngAtWidth()` helper (`rasterize.ts`) — one satori render, two resvg passes,
not two independent renders (see DECISIONS.md for why this is a two-key split rather than one key with two
sizes). None of these needed an `asset-fingerprint.ts` change: their inputs (`tokens.paper`, font, practice
name, or nothing brand-derived at all for the mono treatments) were already hashed.

Backend: `20260903200000_wordmark_ink_treatments.sql` inserts the five `asset_catalog` rows (identity
group, `svg`/`png` kind, `starter` tier, sort_order 2/5/6/7/8 filling the gaps left around the existing
dark treatments). No RLS change — reference data under the existing `asset_catalog_select_all` policy, same
as every prior catalogue addition. Paired test asserts kind/width/height/group per key and that all five
are visible to an authenticated caller.

**Verified, and how.**
- Backend: `scripts/local-verify.sh` — full migration replay (56 migrations) + full SQL test suite, 45/45
  passing, seed mirrors clean. Dry-run in a `begin/rollback` transaction against the live project via
  `mcp__Supabase__execute_sql`, then applied for real via `apply_migration`, ledger version corrected to
  `20260903200000` to match the file's own timestamp.
- Frontend: `tsc --noEmit` clean, `eslint` implied clean (no new lint surface beyond the compiled file),
  full `vitest` suite 902/902 passing (no regressions). Ran the three new renderers directly via `tsx` with
  fake-but-valid `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (same technique as the dark
  wordmark — Storage cache-miss fails and falls through to the real, reachable Google Fonts fetch, logged
  non-fatally, exactly as coded) against a real font family (Fraunces) and a real Google Fonts CSS2 URL.
  Confirmed by direct inspection: `wordmark-light.png` renders "Warm Welcome Therapy" in the given paper
  ink, `wordmark-mono-black.png` in solid black, both visually correct on read-back. `wordmark-mono-white`
  produces a non-empty trimmed bbox (951×83, matching the other two treatments exactly, not the full
  960×240 canvas a trim-failure/ink-less render would produce) — confirming real ink was detected and
  trimmed, even though the PNG previews as blank against a white viewer background (expected: it's a white
  mark on a transparent ground). The two width variants: `wordmark-light-1200.png`/`-2400.png` came back at
  the exact requested widths with heights matching the trimmed aspect ratio to the pixel (105 and 209 for a
  951×83 source, i.e. exactly `round(83 * 1200/951)` and `round(83 * 2400/951)`), confirming
  `svgToPngAtWidth` scales correctly rather than cropping or distorting.

**Not verified:** live Storage upload/signed-URL round trip through the real `/api/brand-kits/[id]/assets/
[key]` route (same live-Storage/Auth gap noted throughout this session) — the renderer functions themselves
are verified with real output, the route's plumbing around them is unchanged from the already-shipped
`wordmark_png_dark` path.

---

## Lot 4.4 (continued) — monogram family, favicons/icon_512/avatar_400, manifest_values_json

**What was built.**
- `lib/kit/render/monogram.ts` — `monogramLetters()` (one or two initials, single-word-name exception),
  `renderMonogramSvg` (ink `tokens.primary`, no background, trimmed — `monogram_svg`), `renderMonogramPng512`
  (fixed 512×512, kept whole, three treatments driven by caller-supplied ink/background —
  `monogram_png_512_primary`/`_paper`/`_transparent`).
- `lib/kit/render/monogram-icon.ts` — `renderMonogramIconSvg`, the shared "monogram on primary, inset in a
  78% circle" geometry behind `favicon_16`, `favicon_32`, `apple_touch_icon_180`, `icon_512`, `avatar_400`.
  Two-pass render: measures the glyph's real ink bbox diagonal at a large reference size, then renders the
  final square at the font size that makes that diagonal exactly 78% of the canvas (see DECISIONS.md for
  why this is computed, not eyeballed). ONE svg render serves all three of apple_touch_icon_180/icon_512/
  avatar_400 (same letters/treatment, different raster width via `svgToPngAtWidth`), and a second single-
  letter render serves favicon_16/32.
- `manifest_values_json` — pure JSON, no satori/resvg involved: name, a ≤12-char `short_name` (PWA
  convention, trimmed to the nearest whole word), `theme_color`/`background_color` from tokens, icon refs.
- Registry wiring for all ten new keys in `lib/kit/render/registry.ts`.

Backend: `20260903210000_asset_catalog_kind_expansion.sql` widens `asset_catalog.kind` and
`brand_assets.kind`'s CHECK constraints from `('svg','png')` to add `json`/`css`/`ase`/`html`/`zip` (needed
now for `manifest_values_json`, and ahead of the color/document lots that will need the rest — widened once
rather than reopening the same constraint five more times), plus the matching widen of the `brand-assets`
bucket's `allowed_mime_types`. `20260903220000_monogram_and_web_icons.sql` inserts the ten catalog rows
(identity/web/social groups). No new RLS — same reference-data pattern as every prior catalogue addition.

**Verified, and how.**
- Backend: `scripts/local-verify.sh`, 47/47 tests passing, seed mirrors clean, both migrations replay
  clean against the local stub. The kind-expansion test explicitly probes all five new kinds AND confirms an
  unlisted kind (`'bogus'`) is still rejected — not just that the constraint got looser, but that it's still
  a real constraint. Dry-run in `begin/rollback` against the live project for both migrations, then applied
  for real, ledger versions corrected to `20260903210000`/`20260903220000`.
- Frontend: `tsc --noEmit` clean, full `vitest` suite 904/904 passing (the two new files were automatically
  picked up by the existing `renderer-not-in-client-bundle.test.ts`, which enumerates `lib/kit/render/*.ts`
  rather than naming files by hand — confirmed neither new file imports satori/resvg into a client bundle
  path). Ran every new renderer directly via `tsx` with the fake-env-var technique against real font data
  (Fraunces) and real practice-name input:
  - `monogramLetters("Warm Welcome Therapy")` → `"WW"` (correct: both first words happen to start with W —
    cross-checked against `monogramLetters("Solace")` → `"S"` and `monogramLetters(name, true)` → `"W"`, so
    this is confirmed to be the letter-selection logic working correctly on a coincidental test name, not a
    duplication bug).
  - `monogram_svg`: real trimmed output, primary-color ink, transparent ground — visually inspected,
    correct.
  - `monogram_png_512_primary`/`_paper`/`_transparent`: visually inspected, correct ink/background pairing
    per treatment, full 512×512 canvas kept (not trimmed).
  - `icon_512`/`apple_touch_icon_180`(sized only, not separately re-inspected)/`avatar_400`: visually
    inspected at 512px — the monogram sits with a clear, even margin inside the square, consistent with a
    78%-diameter inset (not touching or nearly touching any edge, not tiny/lost in the middle either).
  - `favicon_16`/`favicon_32`: rendered at their real target sizes AND at 128px (for human-legible
    inspection only — not a shipped size) from the same underlying vector; visually confirmed single-letter,
    correctly inset, legible even at the tiny real sizes given the trimmed proportions.

**Not verified:** live Storage/route round trip (same gap as every asset this session); the PWA manifest's
actual consumption by a real browser install prompt (the JSON shape follows the spec's documented fields,
not tested against a real "Add to Home Screen" flow — no browser automation against a live deployed origin
is possible from this sandbox).

---

## Lot 4.4 (continued) — `palette_ase`, `tokens_json`, `colors_css`

**What was built.** `lib/kit/render/color-exports.ts` — three pure data transforms of the same ten token
values (six roles + four derived variants), no satori/resvg: `renderTokensJson` (flat JSON, kebab-case
keys), `renderColorsCss` (`:root { --role: #hex; }`), and `renderPaletteAse` (hand-built Adobe Swatch
Exchange binary — same "write it by hand rather than add a dependency for a small stable format" reasoning
`lib/kit/pdf.ts` already established for PDF). `colors_css`/`tokens_json` deliberately use plain kebab-case
property names (`--primary`, not `--brand-primary`), not the internal `--brand-*` prefix `canvas-tokens.ts`
uses for Eklio's own UI — this file ships INTO someone else's stylesheet, where an unexplained `--brand-*`
namespace would be a stranger's naming convention landing in their project.

Backend: `20260903230000_color_export_formats.sql` inserts the three catalog rows (`color` group, kinds
`ase`/`json`/`css` — no new CHECK-constraint work needed, `20260903210000` already widened it). No new RLS,
same reference-data pattern as every prior catalogue addition.

**Verified, and how.**
- Backend: `scripts/local-verify.sh`, 48/48 tests passing, seed mirrors clean. Dry-run + apply against the
  live project, ledger corrected to `20260903230000`.
- Frontend: `tsc --noEmit` clean, full `vitest` suite 905/905 passing. The ASE file gets the strongest
  verification of anything built so far this lot: a hand-written byte-level parser (not a library) reads
  the actual rendered `.ase` buffer back — signature, version, block count, then EVERY block's name, RGB
  hex, and color type — and confirms all ten decode back to exactly the input hex values, AND that the
  running byte offset after the last block equals the buffer's total length exactly (proof no block-length
  field is miscalculated, which would otherwise silently corrupt every block after the first). `tokens.json`
  and `colors.css` inspected directly — correct keys, correct hex values, consistent naming between the two
  files.

**Not verified:** the `.ase` file has not been opened in a real Adobe product (no such tool is available in
this sandbox) — verification here is a correct-by-construction byte-level round trip against the documented
format, not a real Illustrator/Photoshop import. Flagged, not claimed.

---

## Lot 4.4 (continued) — social posts, story, covers, business cards

**Research first.** Before writing any renderer, dispatched a research pass on the content model backing
"the month's first four items… the selected direction's sample copy" (the brief's exact words for the four
social post archetypes). Findings, in full, are now in DECISIONS.md — short version: `monthly_presence_content`
is empty in production AND has no archetype column to map rows to templates by; `kit.socialTemplates` (a
kit-level 4-tuple: statement/question/notes/signature, each with `headline`/`body`/`palette_role`/
`typography_role`) is the only real content matching the four archetypes, and is what every renderer here
reads.

**What was built.**
- `lib/kit/render/social-posts.ts` — `renderStatementOrQuestionPost` (bottom-aligned headline, full-bleed
  tile), `renderNotesPost` (uppercase label headline + REAL body text if the template has any — never
  fabricated placeholder lines, unlike the on-screen preview's loading-state grey bars), `renderSignature`
  (centred headline + `practitioner_line`, parameterized `shape: "square" | "story"` so
  `post_signature_1080` and `story_1080x1920` share one function — see DECISIONS.md for why that's not a
  schema conflict). All three mirror the existing on-screen `SocialTile` preview's visual language
  (background from `tokens[palette_role]`, contrast via the same luminance test, font from
  `typography_role`) at export resolution rather than inventing a new design.
- `lib/kit/render/covers.ts` — `renderLinkedInCover`/`renderFacebookCover`, both keeping text clear of the
  platform's bottom-left avatar-overlay zone (see DECISIONS.md).
- `lib/kit/render/business-card.ts` — `renderBusinessCardFront` (mirrors the existing `BusinessCard`
  preview component's layout: practice name, primary hairline, `practitioner_line`) and
  `renderBusinessCardBack` (the standalone monogram on primary — brief specifies no back content, see
  DECISIONS.md). Both at 1125×675px (3.5×2in + 0.125in bleed at 300dpi), with hand-drawn crop marks
  spanning the bleed edge to the trim line.
- `RenderContext` extended with `socialTemplates`/`practitionerLine`; both threaded through the asset route
  (`app/api/brand-kits/[id]/assets/[key]/route.ts`) at both the fingerprint call and the renderer call.
  `AssetFingerprintInput` extended to hash both (a renderer now actually reads them — the file's own rule
  for when to extend); `asset-fingerprint.test.ts` updated with the new required fields plus three new
  cases (changes with `socialTemplates`, changes with `practitionerLine`, null vs. present distinguished).

Backend: `20260903240000_social_and_print_assets.sql` inserts the nine catalog rows (`social`/`print`
groups). No new kind, no new RLS — reference data under the existing policy.

**Verified, and how.**
- Backend: `scripts/local-verify.sh`, 49/49 tests passing, seed mirrors clean. Dry-run + apply against the
  live project, ledger corrected to `20260903240000`.
- Frontend: `tsc --noEmit` clean (caught and fixed two real type errors along the way — a heterogeneous
  `createElement[]` array losing its widened type when only the first element was known, in both
  `renderNotesPost` and `renderSignature` — fixed with an explicit `ReturnType<typeof createElement>[]`
  annotation rather than a cast). Full `vitest` suite 911/911 passing. Ran all nine renderers directly via
  `tsx` with the fake-env-var technique, real font data (Fraunces), and realistic fixture content (a
  four-template `SocialTemplates` tuple, a practitioner line). Every one inspected visually, not just by
  byte count:
  - `post_statement_1080`/`post_question_1080`: real headline, bottom-aligned, correct palette-role
    background and contrast-safe ink.
  - `post_notes_1080`: uppercase label plus the REAL body paragraph rendered (confirming the "no fabricated
    placeholder lines" decision actually took effect, not just that it compiled).
  - `post_signature_1080` and `story_1080x1920`: same centred headline + practitioner line, correctly
    composed into a square and a portrait canvas respectively from the one `shape` parameter.
  - `cover_linkedin_1584x396`/`cover_facebook_1640x624`: overline pill + practice name, visibly clear of
    the bottom-left corner (the avatar-overlay zone), not centred over it.
  - `business_card_front`: practice name top-left, primary hairline + practitioner line bottom-left, all
    eight crop-mark ticks present and correctly positioned at the four corners.
  - `business_card_back`: monogram centred on primary, ink correctly `cta_ink`, crop marks present.

**Not verified:** live Storage/route round trip (same gap as every asset this session); the two cover
images' actual behaviour once uploaded to real LinkedIn/Facebook profiles (the avatar-clearance zone is
sized from documented/observed platform overlay geometry, not confirmed against a live upload — no browser
automation against those platforms is possible from this sandbox).
