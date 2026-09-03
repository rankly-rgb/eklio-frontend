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

---

## Lot 4.4 (finished) — email signature, site_setup_md, brand_kit_zip

This closes out the full remaining Lot 4.4 catalogue from POST_PURCHASE_BRIEF.md — every identity/web/
color/social/print/document asset it named is now built.

**What was built.**
- `lib/kit/render/email-signature.ts` — `renderEmailSignatureHtml` (table-based, every style inline, no
  flexbox/grid/external stylesheet/webfont — the things that actually survive Gmail's and Outlook's
  stripped HTML rendering; heading font offered only alongside a real Georgia/Times fallback stack) and
  `renderEmailSignaturePng` (the same content through satori/resvg, real Google Font, as a fallback image).
  Content: `practice_details` (name/license label+number/city/state) when the backend exposes it,
  `practitioner_line` as fallback, `spec.hero.cta_target_url` for the booking link — see DECISIONS.md.
- `lib/kit/render/zip.ts` — a hand-built ZIP writer (STORED entries, no DEFLATE — see DECISIONS.md for why),
  `buildZip(entries) -> Buffer`.
- `site_setup_md` registry entry — wraps the existing `site_output_get(..., 'md')` output (nothing new
  composed; the brief calls this "the existing derived output, listed so the manifest is complete").
- `brand_kit_zip` registry entry — iterates every OTHER key in `RENDERERS`, calls each, catches and logs a
  per-renderer failure without failing the whole zip, adds a hand-written README.txt (in her voice, one file
  per key/group, flat structure — see DECISIONS.md), zips the result.
- `RenderContext` extended with `practiceDetails`, `bookingUrl`, `siteSetupMd`; the asset route fetches
  `practiceDetails`/`bookingUrl` for every request (cheap, already-loaded `siteSpec` data, no extra RPC) and
  `siteSetupMd` only for `site_setup_md`/`brand_kit_zip` (the one extra RPC call, `siteOutputGet`, gated to
  the two keys that actually need it). `AssetFingerprintInput` extended with `practiceDetails`/`bookingUrl`
  (hashed, since email-signature renderers now read them) — `site_setup_md`'s OWN content is NOT fully
  covered by the fingerprint; see FINDINGS.md for the honest gap and why it isn't fixed here.
- Backend: one migration widens `kind` to add `md` (needed for `site_setup_md`) and inserts all four
  document-group catalog rows.

**Verified, and how.**
- Backend: `scripts/local-verify.sh`, 50/50 tests passing (including a probe that the widened kind
  constraint still rejects an unlisted value). Dry-run + apply against the live project, ledger corrected to
  `20260903250000`.
- Frontend: `tsc --noEmit` clean, full `vitest` suite 916/916 passing. `renderEmailSignatureHtml`'s actual
  markup inspected directly (correct nesting, correct inline styles, correct conditional omission of the
  booking-link row when absent) — NOT rendered through a real browser (no Playwright install in this repo;
  adding one wasn't in scope for a rendering task). `renderEmailSignaturePng` inspected visually — correct
  layout, real font, real content. The ZIP writer got the strongest verification of anything built this
  session: a real, independent tool (`unzip -l`/`unzip -t`, not this session's own code) confirmed a test
  archive's listing and integrity, catching and letting me fix a real bug (the DOS date field one year off).
  Then ran the ACTUAL `brand_kit_zip` registry entry end to end — all 34 other renderers plus README.txt,
  552KB, 35 files, `unzip -t` reporting no errors — and read the extracted README.txt back to confirm its
  content is accurate and correctly formatted.

**Not verified:** live Storage/route round trip (same gap as every asset this session); the email signature
HTML has not been pasted into a real Gmail or Outlook compose window (no such environment reachable from
this sandbox) — verification here is markup review against known-safe email-HTML patterns, not a live
client test.

---

## Lot 4.4 — COMPLETE

Every asset in POST_PURCHASE_BRIEF.md's Lot 4.4 catalogue now has a backend `asset_catalog` row and a
frontend renderer wired into the registry: 5 identity wordmark treatments (+2 from before this session),
4 monogram assets, 5 web/icon assets, 3 color exports, 7 social assets, 2 business card sides, 4 document
assets — 34 renderable keys total, all locally verified, all committed and pushed. Moving to Lot 3
(workspace UI) next, per the delivery order.

---

## Lot 3 — the brand kit becomes a workspace

**What was built.** `components/kit/brand-kit-view.tsx` rewritten into six navigable sections — Identity ·
Colors · Type · Your site · Your words · Your assets — each following applied/specified/actionable. No
backend migration this lot (pure frontend, reusing the Lot 4.4 asset catalogue and the site editor's
existing contrast/tokens RPCs).

- `components/kit/workspace-nav.tsx` — sticky rail on desktop (`position: sticky`), horizontal scroller on
  mobile (`max-lg:flex-row max-lg:overflow-x-auto`). Plain anchor links to each section's `id`; no
  scroll-spy (see DECISIONS.md for why).
- `components/kit/identity-section.tsx` — new. Applied: a live CSS approximation of the wordmark (real
  heading font/ink/practice name) plus the monogram, inside a `<BrandCanvas>`. Specified: the four ink
  treatments and the monogram letters, in words. Actionable: two `AssetDownloadButton`s (wordmark, monogram)
  plus a link down to Your assets.
- `components/kit/colors-section.tsx` — replaces `palette-section.tsx` (deleted). Applied:
  `LabeledRegionCanvas`, a real small-page composition (header band, heading, button, link, accent mark,
  body copy) with every one of the six roles tagged in place, not five rectangles. Specified: the existing
  swatch grid, unchanged. Actionable: all seven contrast pairs with a live Fix button, reusing
  `lib/site/contrast.ts`'s existing `isBelowAa`/`pairReading`/`pairNote`/`contrastSummary` helpers (the
  same logic the site editor's own `ContrastSection` uses — not reimplemented) and calling
  `site_spec_fix_contrast` directly, re-rendering from the RETURNED envelope only (same rule the editor's
  version documents: a fix moves one token, and every pair sharing it moves too).
- `components/kit/type-section.tsx` — new. A specimen at three real sizes (hero headline, hero subhead, an
  about-excerpt paragraph) using the direction's own copy — never lorem ipsum — inside a `<BrandCanvas>`.
- `components/kit/words-section.tsx` — the former inline "Voice & tone" block, now inside a `<BrandCanvas>`
  (the gap Lot 1 left, per the brief) — same two-column sounds-like/never-write content, her fonts and
  colors now carrying it instead of plain app styling.
- `components/kit/assets-section.tsx` + `components/kit/asset-download-button.tsx` — the new "Your assets"
  browser: fetches a manifest listing once, groups by catalogue group, one real download button per key
  (POSTs to the existing per-key route, opens the signed URL), plus a prominent "Download everything" for
  `brand_kit_zip`.
- "This month, in your brand" removed from this page entirely, per the brief — content belongs on the
  Content page. Its now-dead inputs (`socialTemplates`, `practitionerLine`, `entitled`,
  `monthlyCheckoutHref` props; the `getSubscription`/`isEntitledToMonthlyPresence` call in `page.tsx`)
  removed rather than left unused.

**A real architectural gap found and closed along the way.** The asset route's siteSpec-load +
fingerprint-compute logic existed only inside the per-key POST route — listing the manifest for "Your
assets" needed the exact same computation, and copying it a second time would have been the kind of drift
`asset-fingerprint.ts`'s own header warns against. Factored into `lib/kit/asset-context.ts`
(`loadAssetContext`), used by both the existing POST route (refactored) and a new GET
`/api/brand-kits/[id]/assets` route (listing only, no render/upload/sign side effect). Also caught and
fixed: `AssetManifestEntry.kind` in `lib/kit/asset-rpc.ts` was still typed `"svg" | "png"` from before Lot
4.4 widened the real catalogue to eight kinds — widened to match.

**Verified, and how.**
- `tsc --noEmit` clean, `eslint` clean (caught and fixed three real warnings: an unused `tokens` local left
  over from the asset-context refactor, an unused `MonoLabel` import, an unused `STORY_WIDTH` constant from
  the previous lot). Full `vitest` suite 925/925 passing (up from 916 — the route-enumerating paywall test
  and the service-role-forwarding test both auto-discovered the two new routes and passed without any
  manual registration, confirming both are real, filesystem-scanning tests, not a hardcoded list).
  **`next build` run twice** (once before, once after a self-caught layout bug — see below) — full
  production build succeeds, both new routes appear correctly in the route manifest
  (`/api/brand-kits/[id]/assets` GET, `/api/brand-kits/[id]/assets/[key]` POST unchanged).
- Caught reviewing my own layout code before commit (not by a tool): the sections wrapper div declared
  `flex-col gap-16` without `display: flex` on itself — dead utility classes, no visual effect, since each
  section already carries its own `mt-12`/`border-b`/`pb-12` spacing independently. Removed the dead
  classes rather than making them "work" and double-spacing every section.
- Manually traced every prop threaded from `page.tsx` through to each new/changed component, confirming
  types line up with what `site_spec_get`/`brand_kit_reveal_get`'s actual shapes provide (no invented
  fields).

**Not verified — and this is a real, disclosed gap, not an oversight:** this entire lot is UI, and none of
it has been seen rendered in an actual browser. This repo has zero `.test.tsx`/testing-library coverage
anywhere (checked before starting — this isn't new to this lot), and the live page requires an
authenticated, entitled, direction-selected kit — not reachable from this sandbox without real Supabase
credentials, which this session does not have and will not invent a workaround for. Verification here is:
correct types, a clean production build, correct data flow traced by hand, and faithful reuse of already-
proven business logic (`lib/site/contrast.ts`) rather than reimplementing it. The sticky-rail nav, the
labelled-region canvas's actual visual legibility, the live Fix button's real round trip, and the download
buttons' real click-through all still need a human in a browser — added to PREVIEW_CHECKLIST.md territory
for the user's own pass. This is the same category of gap this session has disclosed since its second
DECISIONS.md entry, now including UI as well as Storage/Auth.

---

## Lot 5 — the brand guide PDF

**What was built.**
- Added `pdf-lib`/`@pdf-lib/fontkit` as real dependencies (the brief names them explicitly — see
  DECISIONS.md) — this session's first, since every prior format (PDF-1.4 base, `.ase`, `.zip`) was
  hand-built specifically to avoid a new one.
- `lib/kit/pdf/layout.ts` — the shared layout helper, built once, used by all fourteen pages: `wrapText`
  (measured line breaking against the REAL embedded font's glyph widths via `PDFFont.widthOfTextAtSize`,
  which is fontkit-backed once a custom TTF is embedded — not a character-count heuristic like the old
  `lib/kit/pdf.ts`), a four-point baseline grid (`grid()`), `PageFlow` (a per-page y-cursor with `text`/
  `rule`/`swatchRow`/`advance`), and `BrandGuideDoc` (owns the `PDFDocument`, the three embedded font
  roles, and draws every page's footer — practice name left, page number right, mono 8pt at real 60%
  opacity — in one pass at `finish()`, since the total page count isn't known until every page exists).
- `lib/kit/pdf/brand-guide.ts` — the fourteen pages, composed with the helper, never positioned ad hoc:
  cover, contents, identity (clear space in monogram-widths, minimum size, exact capitalization), identity
  misuse (five real strikethrough anti-patterns), colors by role, colors accessibility (all seven pairs,
  reusing `lib/site/contrast.ts`'s existing `isBelowAa`/`pairReading` rather than reimplementing the AA
  logic a third time), type families and scale, the scale applied to her real hero/about copy, voice, Ethics
  Guard's six rules, the site mockup (new `lib/kit/render/site-mockup.ts`, a satori composition — nav bar,
  overline, headline, subhead, CTA — full-bleed, embedded as a real PNG, not vector text pretending to be a
  screenshot), the site structure page by page (iterates every enabled page/section generically off
  whatever `fields` the site spec actually has, not a hardcoded per-section-type list), the four social
  templates embedded as real PNGs (calling the actual Lot 4.4 renderers — `renderStatementOrQuestionPost`/
  `renderNotesPost`/`renderSignature` — not a second implementation), and "using this kit" with the
  VERBATIM disclaimer (reused from the existing `ETHICS_DISCLAIMER_TEXT` constant — already word-for-word
  the brief's quoted text, confirmed by direct comparison, so quoting it here is correctness by
  construction, not retyping-and-hoping) plus one small "Made with Eklio" line, the only Eklio mark on any
  page.
- `lib/ethics/rule-definitions.ts` — the six Ethics Guard rule families' id/label/why/example, as content
  only (no scanning logic) — built now, ahead of Lot 7, so the PDF page and Lot 7's real engine (not built
  yet) can share one source rather than the PDF hardcoding prose Lot 7 would otherwise restate.
- `GET /api/brand-kits/[id]/pdf` rewritten to assemble `BrandGuideData` (tokens, contrast, direction, voice
  guide, social templates, site pages, builder label, practitioner line) and call the new composer.
  `lib/kit/pdf.ts`'s old `renderBrandKitPdf` — the function this route used to call — deleted as dead code,
  along with its now-unused `swatches()` helper and `hexToRgb`/`ETHICS_DISCLAIMER_TEXT` imports;
  `renderMarkdownPdf` (the site setup sheet's own, unrelated PDF export) untouched, still backed by the
  same hand-rolled base-14-font engine (no reason to pay for pdf-lib on a document with no brand fonts to
  embed). `lib/kit/__tests__/pdf.test.ts` rewritten to test `renderMarkdownPdf` (the only thing left in
  that file) instead of the deleted function, keeping structural xref-table coverage rather than losing it.

**Verified, and how — this is the most thoroughly independently verified lot of the session.**
- `tsc --noEmit`/`eslint`/full `vitest` suite (930/930) all clean; `next build` succeeds, route unchanged
  in the manifest.
- Installed `poppler-utils` (`pdftotext`/`pdfinfo`/`pdfimages`/`pdftoppm`) specifically to verify PDF output
  with a REAL, independent tool — not this session's own code checking its own output. Confirmed via
  `pdfinfo`: exactly 14 pages, US Letter (612×792pt), for both an isolated layout-helper smoke test AND the
  full real-fixture render. Confirmed via `pdftotext`: every page's actual text is extractable —
  proof the text is real and selectable, not an image standing in for it (the brief's core requirement,
  "a PDF of stitched images fails this lot") — including a long paragraph wrapping correctly at real word
  boundaries against the embedded font's own measured widths. Confirmed via `pdfimages -list`: exactly the
  expected 5 raster images (1 site mockup on page 11, 4 social template thumbnails on page 13), each at
  its real declared dimensions.
- Then went further: rasterized every one of the 14 pages with `pdftoppm` and actually looked at each one.
  This caught three real visual bugs `tsc`/`pdftotext`/`pdfinfo` structurally could not have caught — see
  DECISIONS.md for the full account — fixed and re-verified by re-rendering and re-rasterizing after each
  fix, not assumed fixed from reading the diff.
- Extracted and visually inspected the site mockup and one social-template PNG directly (not just
  confirmed their presence) — both showed correct real content, fonts, and colors.

**Not verified:** the actual click-through from the live "Download PDF" link in a real browser (needs the
same authenticated session this whole session has never had access to) — the route itself is unchanged in
shape from the version that DID work end-to-end before this lot (same auth/entitlement/response pattern),
so this is a lower-risk gap than most, but it is still a real one: only the PDF BYTES themselves have been
proven correct, not the HTTP round trip serving them in production.

---

## Correction — the brand guide PDF's "Ethics Guard" page used invented rule content

While starting Lot 7, discovered (the hard way — see DECISIONS.md for the full account of the mistake that
led here) that a real, already-shipped Ethics Guard already exists in this repo, with its own six rule ids
and content sourced from the `ethics_rules` database table. The "Ethics Guard" page built earlier in this
session for Lot 5's PDF used a different, invented six-rule set that doesn't match it.

**Fixed.** `BrandGuideData.ethicsRules` now carries the real rows (`{id, label, description,
exampleForbidden}`, mapped from `readCatalog(supabase).ethicsRules` — `short_label`/`description`/
`example_forbidden`, the exact same fields `lib/ethics/guard.ts`'s own `rulesBlock()` reads for prompt
injection). The PDF route fetches the real catalog alongside the site spec it already loads. Deleted
`lib/ethics/rule-definitions.ts` (the invented content) entirely — no reader of the Ethics Guard page
should ever again get its content from anywhere but the database.

**Verified, and how.** `tsc`/`eslint`/full `vitest` suite (929/929) clean, `next build` succeeds. Re-ran
the same real-fixture render used for Lot 5's original verification with realistic `ethicsRules` data
(the actual seeded rows, confirmed via a research pass against the real migration in eklio-backend, not
guessed). `pdfinfo` confirms still 14 pages. Rasterized and looked at the Ethics Guard page again — clean,
correctly spaced, now showing "No timeframes," "No proven claims," "No client voice," "No inflated
credentials," "No scarcity," "No diagnosis of the reader" — the real six, with their real descriptions and
real forbidden examples. `pdftotext` over the whole document confirms none of the old invented rule names
("outcome guarantee," "superlative," "unsourced") appear anywhere.

**What's still open, going into Lot 7 proper.** The real `checkEthics`/`lib/ethics/guard.ts` system is
understood now, not yet extended. Lot 7's actual remaining work: make the BOARD-SAFE COPY chip clickable
(reading `brand_kits.ethics_check.flagged`, the real persisted verdict), and build the new "Check your own
words" textarea calling `checkEthics` directly on text the practitioner writes herself — see DECISIONS.md.

---

## Lot 7 — Ethics Guard's two new UI surfaces

Built on the REAL, already-shipped `checkEthics`/`lib/ethics/guard.ts` engine (understood only after the
mistake above) — no new rule taxonomy, no new scanning logic. Both surfaces read the real `ethics_rules`
catalog for user-facing text, never `EthicsViolation.reason` (an internal, partly-French fallback string —
see DECISIONS.md).

**What was built.**
- `components/kit/ethics-badge.tsx` — the BOARD-SAFE COPY pill is now a button; clicking it opens a panel
  listing all six real rules (`short_label`), each with a dot marking whether `brand_kits.ethics_check
  .flagged` caught anything against it for this kit's actual generated copy, and if so the excerpt that was
  originally written and rewritten past. Reads the real PERSISTED verdict only — never re-runs a check
  client-side to produce it.
- `components/kit/check-your-words.tsx` — a textarea for text she writes herself (a Psychology Today bio,
  anything outside what Eklio drafts), checked live against `checkEthics` — a pure function, so every
  keystroke re-checks with no network round trip and no model call. Flagged spans underline (red for
  `block`, muted for `warn`) via `segmentText()`, a small presentation-only helper that locates each
  violation's already-known `excerpt` string with `indexOf` — see DECISIONS.md for why this doesn't extend
  the engine itself to carry offsets. Below the text, each flag lists its real rule label and description.
- `app/app/brand-kits/[id]/page.tsx` now fetches `readCatalog(supabase)` alongside what it already loaded,
  passing `ethicsRules` (mapped `{id, label, description}`) and `kit.ethicsCheck` down to both new
  components via `BrandKitView` → `WordsSection`.

**Verified, and how.**
- `tsc --noEmit`/`eslint`/`next build` all clean. Full `vitest` suite 937/937 passing.
- `segmentText()` — the one genuinely new piece of logic here (everything else is either display-only
  composition or a direct call into the already-tested `checkEthics`) — has its own test file
  (`components/kit/__tests__/check-your-words.test.ts`), run against the REAL `checkEthics` output on real
  example strings, not a hand-built fixture: confirms segments always reassemble to exactly the original
  text (empty case included), confirms flagged segments' text always appears verbatim in the source, and
  confirms segment order matches the text's own order for multiple simultaneous flags.
- Manually traced `EthicsBadge`'s and `CheckYourWords`' prop flow from `page.tsx` down, confirming the real
  `ethics_rules` columns (`short_label`, `description`) are what's read, not the French `reason` fallback.

**Not verified:** the actual click-through in a browser (the popover opening/closing, live-as-you-type
checking, the underline rendering) — same authenticated-session gap as every other UI surface built this
session (see Lot 3's WORKLOG entry for the full accounting; this joins PREVIEW_CHECKLIST.md territory
alongside it).

## Lot 6 — "Your first week" (evolves the existing `launch_checklist_items`, not a new table)

Researched before writing any code, per the lesson from the Lot 7 mistake above: dispatched a research pass
that found the brief's `launch_steps` concept already shipped under a different name. Full reasoning and
the four-part decision in DECISIONS.md; this entry is what was built and how it was verified.

**Backend — `20260903260000_launch_checklist_first_week.sql`.**
- Widened `launch_checklist_items`'s `key` CHECK to add `social_setup`/`booking_link`. Added `skipped_at
  timestamptz`, mutually exclusive with `done_at` via a CHECK.
- UPDATEd (never deleted) four existing rows' `label`/`description`/`sort_order` to the brief's wording;
  renamed `paste_site_prompt` → `site_setup` in place, `done_at` carried over.
- `CREATE OR REPLACE seed_launch_checklist` now seeds all eight keys (`choose_direction` plus the seven),
  re-run once over every existing brand kit for the backfill. Re-revoked EXECUTE from
  `public, anon, authenticated` explicitly after the replace.
- New RPCs `get_launch_progress(p_brand_kit_id)` (returns the seven steps with `todo`/`done`/`skipped`
  status plus `resolved_count`/`total`, `choose_direction` excluded) and `set_launch_step(p_brand_kit_id,
  p_key, p_status)` (refuses `choose_direction`, refuses an unrecognized status, ownership-checked through
  `brand_kits → projects`, idempotent re-marking via `coalesce`). Both granted to `authenticated` only.
- Guard rails at the bottom of the migration: every kit has exactly 8 items; no row still carries
  `paste_site_prompt`; `seed_launch_checklist` still refused to `anon` — matching the existing migration's
  own style of self-checking assertions.

**Frontend.**
- `lib/data/checklist.ts` rewritten around the two new RPCs — `loadLaunchProgress`/`setLaunchStep`,
  replacing the old direct-table `loadChecklist`/`toggleChecklistItem`.
- `app/api/checklist/[id]/route.ts` — `[id]` now means the brand kit id (was the checklist item's own row
  id); body is now `{key, status}` (was `{done: boolean}`).
- `lib/kit/launch-copy.ts` — three pure, unit-tested functions (`personalStatement`, `shortBio`,
  `emailSignatureText`) that assemble per-step detail copy from data the kit already has. See DECISIONS.md
  for why this counts as deterministic assembly, not generation.
- `components/checklist/launch-checklist.tsx` — the shared list: progress bar, per-step expand/collapse,
  optimistic Mark done/Skip for now (rolls back and shows an error on a failed write, same convention as
  the old checklist card), a status dot per row (filled = done, muted = skipped, outline = todo), and the
  per-step detail switch (site editor link, personal statement with Copy, bio + counter + assets link,
  signature block + Copy + Gmail/Outlook paste instructions, booking link + Copy, template link). Collapses
  to one line — "Your brand is live in seven places." — once every step is done or skipped.
- `components/home/checklist-card.tsx` rewritten as a thin wrapper: card chrome, "Your first week" header,
  and the shared list. Passes `practiceDetails: null, bookingUrl: null` (documented in DECISIONS.md) — home
  doesn't fetch the site spec, so those two steps show their honest fallback there instead of the richer
  copy-paste block.
- `components/kit/launch-progress-row.tsx` (new) — the compact row on the kit page, collapsed by default
  to a bar + "X of 7", expands in place to the same shared list with the FULL context (the kit page already
  loads the site spec for the "Your site" card, so `practiceDetails`/`bookingUrl` cost nothing extra here).
- `app/app/brand-kits/[id]/page.tsx` now also calls `loadLaunchProgress` and extracts `practiceDetails`/
  `bookingUrl` from the site spec it already fetches (same fields `lib/kit/asset-context.ts` reads, not
  re-derived a second way).
- `types/supabase.ts` regenerated (`mcp__Supabase__generate_typescript_types` against the live, now-migrated
  project) to pick up `skipped_at` and the two new RPCs; the manual addendum block at the file's end was
  reapplied verbatim, diffed against the previous file to confirm only the intended six lines changed.

**Verified, and how.**
- Backend: `scripts/local-verify.sh` — migrations replayed clean, 51/51 SQL tests passing (50 pre-existing
  + this migration's own new test file, `supabase/tests/20260903260000_launch_checklist_first_week.test.sql`
  — fresh-kit seeding shape, idempotence, `get_launch_progress`/`set_launch_step` behavior including the
  done/skipped mutual exclusion and the choose_direction refusal, RLS/column-grant boundaries, and the
  anon-execute guard). The PRE-EXISTING test file for the original migration
  (`20260827104000_launch_checklist_items.test.sql`) needed its own counts/labels updated (six items →
  eight, four relabeled) since it runs against the fully-migrated schema, not a point-in-time snapshot —
  updated and re-verified rather than left red.
- Backend, live: dry-run (`begin; ... rollback;`) against the live project's REAL data (one real brand kit
  at the time) confirmed the migration and its guard rails pass before anything was applied for real; after
  applying, a follow-up read confirmed that real kit now has exactly 8 items, no stray `paste_site_prompt`
  row, a `site_setup` row, and its pre-existing `done_at` progress intact.
- Frontend: `tsc --noEmit`, `eslint`, `next build`, and the full `vitest` suite (951/951 — the 9 new
  `launch-copy.test.ts` cases included) all clean.
- `lib/kit/launch-copy.ts` — unit-tested directly (not through the UI): joining/omitting missing pieces in
  `personalStatement`, word-boundary truncation with the length cap actually enforced in `shortBio`, and
  line assembly/omission in `emailSignatureText`. Caught and fixed one real bug this way: a whitespace-only
  `practitionerLine` was passing the truthiness check and producing an empty string instead of `null`.

**Not verified:** the actual click-through in a browser — expand/collapse, the optimistic Mark done/Skip
toggle round-tripping through the real API route, the Copy buttons — same authenticated-session gap as
every other UI surface this session (see Lot 3's entry for the full accounting).

## Lot 8 — Monthly Presence, sold honestly

Researched before writing any code (a dispatched Explore pass covering every blur/lock pattern, the
Content page and its data flow, `monthly_presence_content` end to end, the subscription/entitlement
system, and existing tests) — full findings and why the actual redesign turned out narrower than the
brief's framing suggested are in DECISIONS.md. Short version: the one real "blurred card" was already
blurring a real title, not a fabricated one, and the zero-row states were already honest; this lot still
ships the brief's exact visual treatment and exact copy strings, which didn't exist verbatim before.

**What was built.**
- `components/home/content-grid.tsx` — `LockedTile` rewritten: no more `blur-[9px]`/centered padlock over a
  colored block. Now a plain bordered row at `opacity-50` (hover `opacity-70`) showing the date (`Sep 3`,
  a new `shortDate()` helper), the type (`Post`/`Story`), the real title in the direction's heading font,
  and a small `PadlockGlyph` (`size="sm"`, was the unsized/larger default) — still clickable to open the
  unlock modal. `tileSurface()`'s palette-tinted background helper is gone with it (nothing else used it).
  `OpenTile` gets a `Download` action next to its Ready/Draft/Published label, calling a new `downloadCaption()`
  helper (client-side `Blob` → `<a download>`, title + caption as a `.txt` file) — only when the item has a
  caption. See DECISIONS.md for why this is a text download, not a rendered image.
- `app/api/monthly-presence/checkout/route.ts` (new) — the same `createMonthlyPresenceCheckout` call
  `POST /api/content/[id]/unlock` already makes, without that route's item-ownership lookup — needed
  because a kit with zero content rows this month (the honest empty state) has no tile `[id]` to hang the
  existing route off, and the underlying checkout call never needed one.
- `components/presence/subscription-card.tsx` (new) — `MonthlyPresenceSubscriptionCard`, the brief's exact
  line (`Twelve posts, four stories, and the calendar — $39/month. Cancel anytime.` — price interpolated
  from `MONTHLY_PRESENCE.amountCents` via `formatUsd`, so it can't drift from the real pricing source), an
  `accent` "Add Monthly Presence" button hitting the new route, loading/error states. No countdown, no
  discount timer, no scarcity language anywhere in it.
- `app/app/content/page.tsx` — zero-row branch's copy changed to the brief's exact
  `"Your first month is being prepared."` (kit exists) — the "no kit yet" branch's different, correct copy
  is untouched. Renders `MonthlyPresenceSubscriptionCard` below the grid (content-rows branch) or below the
  empty-state card (zero-rows branch) whenever `!home.entitled`.
- `components/home/monthly-presence-card.tsx` (new) — `MonthlyPresenceCard`, home's version: a compact
  status line (zero rows → the same exact "being prepared" copy; content rows → `N of M ready for
  <Month>.` plus a link to `/app/content`), and the same subscription card below it when not entitled.
- `components/home/home-view.tsx` — the right-column slot now renders `MonthlyPresenceCard` once
  `home.checklist.resolvedCount === home.checklist.total` (Lot 6's "that transition is when the
  subscription gets sold" boundary), `ChecklistCard` otherwise. Resolves the FINDINGS.md item Lot 6 flagged
  about this exact slot going sparse once the checklist resolves.
- `app/app/checkout/success/page.tsx` — fixed two dead links to the removed `/app/projets/...` route tree
  (found during Lot 8's research, unrelated to Monthly Presence itself but on the same page): now `/app`
  and `/app/content`. See DECISIONS.md for why `app/app/actions.ts`'s matching dead links were left alone
  (unreachable dead code, not a live bug).

**Verified, and how.**
- `tsc --noEmit`, `eslint`, `next build`, and the full `vitest` suite (954/954) all clean. The new route
  (`/api/monthly-presence/checkout`) appears in `next build`'s route table.
- The pre-existing route-enumerating test (`app/__tests__/brand-kit-entitlement.test.ts`) discovers routes
  via `readdirSync`, not a hardcoded list — the new route is automatically covered by whatever it asserts,
  confirmed by it staying green with no changes needed on my part.
- Manually re-traced `LockedTile`'s and `OpenTile`'s prop flow and confirmed no leftover reference to the
  removed `tileSurface()`/`darkenLightness` import, and that `Palette`/`Typography` types are still used
  where still needed (`OpenTile`'s colored surface is untouched — only the locked tile's presentation
  changed).

**Not verified:** the actual click-through in a browser — the locked row's reduced-opacity/lock-glyph
rendering, the Download button producing a real file, the subscription card's checkout redirect actually
reaching Stripe, and the home-slot swap from checklist to Monthly Presence actually firing once a real
kit's checklist resolves. Same authenticated-session gap as every other UI surface this session.

## Lot 2 — the delivery moment

Backend: `brand_kits.delivered_seen_at` + `mark_brand_kit_delivered(uuid)` (`eklio-backend`, applied live,
ledger corrected — see that repo's own commit). Frontend built and verified as below; see DECISIONS.md for
four judgment calls (the real trigger point, reusing the app's four motion primitives with no new
keyframes, sourcing every surface from the real asset pipeline, and marking "seen" before rendering rather
than after).

**What was built.**
- `lib/data/brand-kit.ts` — `markBrandKitDelivered(supabase, brandKitId)`, calling the new RPC and
  returning `{ok, firstView}` (or `{ok: false}` on any error — same defensive shape as this file's other
  RPC callers).
- `app/app/brand-kits/[id]/delivered/page.tsx` (new) — same ownership/direction/entitlement guards as the
  workspace page, then `markBrandKitDelivered`; `firstView: false` (already seen, or a write failure)
  redirects to the workspace, never renders the ceremony twice. Fetches the site spec for the ceremony's
  six real color roles (same `SitePreviewTokens` source `brand-kit-view.tsx`'s `canvasTokens` already uses,
  not a re-derivation).
- `components/delivery/delivery-ceremony.tsx` (new) — `DeliveryCeremony`, the actual sequence: the
  wordmark (fetched as a real signed asset URL, same client pattern `AssetDownloadButton` already
  establishes), six color bands using `brandCanvasVariables(tokens)`'s `--brand-*` custom properties (not
  the `<BrandCanvas>` wrapper — its hairline/radius/shadow chrome is a framed-card treatment, wrong for a
  full-viewport page, so this calls the underlying `brandCanvasVariables()` function directly), four
  surfaces (the site hero via `<BrandPreview variant="thumbnail" shape="site">`, plus three real rendered
  assets — `post_statement_1080`, `email_signature_png`, `business_card_front` — fetched the same way as
  the wordmark), the settling line in `var(--brand-body)`, one primary "Open your brand kit" and one quiet
  "Download everything" (`AssetDownloadButton` with `assetKey="brand_kit_zip"` — the exact same button
  `assets-section.tsx` already uses for the same zip).
- `lib/reveal/use-select-direction.ts` — the direction-selection success path now pushes to
  `/app/brand-kits/[id]/delivered` instead of straight to the workspace (both the prefetch and the actual
  `router.push`).
- `app/__tests__/brand-kit-entitlement.test.ts` — added the new page to `KIT_PAGES`, the route-enumerating
  paywall test's list, per the standing rule that every new route gets covered there.

**Verified, and how.**
- Backend: `scripts/local-verify.sh` — 52/52 SQL tests (the new file covers first-call-sets-it,
  idempotence with the timestamp never moving, ownership refusal, a nonexistent kit id, and the anon-
  execute guard). Live dry-run (`begin; ... rollback;`) against the real project before applying;
  applied, ledger version corrected, then confirmed the one real live kit's `delivered_seen_at` is still
  null (the migration doesn't retroactively mark existing kits delivered — they get the real ceremony the
  next time they select a direction, which for an already-kitted practitioner won't happen again, so in
  practice this is display-only for kits created from here on; not a gap this lot needed to backfill).
- Frontend: `tsc --noEmit`, `eslint`, `next build`, and the full `vitest` suite (958/958) all clean. The
  new route (`/app/brand-kits/[id]/delivered`) appears in `next build`'s route table.
- Confirmed by reading `app/globals.css` directly (not assumed) that `@media (prefers-reduced-motion:
  reduce)` already collapses `.reveal-rise`'s animation duration/delay globally, before relying on it for
  the ceremony's reduced-motion behavior.
- Added the new page to the route-enumerating entitlement test and re-ran it in isolation (20/20 passing)
  before the full suite, to confirm it actually exercises the new file rather than trusting the addition.

**Not verified:** the actual ceremony in a browser — the visual timing/stagger reading as intended, the
four asset fetches actually resolving and fading in, the wordmark falling back cleanly to plain text if an
asset fetch fails, the redirect-on-replay actually firing on a second visit, and the full path from
selecting a direction through the ceremony to the workspace. Same authenticated-session gap as every other
UI surface this session — this one is a compounded case (three server-side redirects plus a client
animation plus three async asset fetches) that particularly deserves a real click-through before shipping.

## Lot 9 — home and housekeeping (final lot)

Researched before writing any code (a dispatched pass covering `change_marks`, any existing "last seen"
state, the asset-fingerprint comparison story, settings/typed-confirmation precedent, Storage layout and
the cron pattern, soft-delete precedent, every route this chantier added, and the route-enumerating test's
exact mechanism). Full findings shaped four scope decisions in DECISIONS.md — read those first; this entry
is what got built and how it was verified. "The brand card with her live mockup" and "the launch ring" were
already shipped (Lot 3's "Your brand" card, Lot 6's progress bar) — nothing new needed for either.

**Backend (`eklio-backend`, three migrations, applied live, ledgers corrected).**
- `20260903280000_delete_brand_kit.sql` — `deleted_at` on `brand_kits`; `delete_brand_kit`/
  `restore_brand_kit` (owner-scoped, idempotent); `list_deleted_brand_kits` (the caller's own kits still
  inside the 30-day window). Never touches `purchases`/`subscriptions` — deletion doesn't refund.
- `20260903290000_home_recent_activity.sql` — `home_content_seen_at` on `brand_kits`; `home_recent_activity`
  reports new `brand_assets` rows and newly-ready/published `monthly_presence_content` since the marker,
  then advances it. See DECISIONS.md for why this doesn't reuse `site_spec_diff`.

**Frontend.**
- `lib/data/brand-kit.ts` — `loadBrandKit`/`loadBrandKitByProject` now filter `deleted_at is null` (RLS
  itself stays unchanged — a deleted kit is still readable by its owner, which is how "Recently deleted"
  works at all); new `deleteBrandKit`/`restoreBrandKit`/`listDeletedBrandKits`/`loadHomeActivity` callers.
  `DeletedBrandKit.daysLeft` is computed server-side (not via `Date.now()` in a component) specifically to
  avoid a real React purity lint violation caught while building the "Recently deleted" row (`Cannot call
  impure function during render` — see below).
- `app/api/brand-kits/[id]/delete/route.ts` and `.../restore/route.ts` (new) — both added to the route-
  enumerating test's `FREE` allowlist rather than gated on `isBrandKitEntitled`: deletion and its undo are
  account housekeeping, not paid features (see DECISIONS.md).
- `components/kit/delete-kit-section.tsx` (new) — a "Housekeeping" section at the bottom of the kit
  workspace, typed practice-name confirmation, focus-trap/ARIA/Escape modal copied from `ConfirmReset`'s
  established pattern (`components/site/reset-section.tsx`). Wired into `brand-kit-view.tsx`, only when
  `practiceName` is non-null.
- `components/home/recently-deleted-section.tsx` and `since-you-were-here.tsx` (new) — both render nothing
  when empty, wired into `home-view.tsx`. `since-you-were-here.tsx` exports `ordinal()` (day → "3rd"/"11th"
  etc.), unit-tested including the 11/12/13 exceptions.
- `components/home/monthly-presence-card.tsx` — added "the next item and its date" (the first
  not-yet-published calendar item, its real title when visible or "Next" when still locked, its date and
  Post/Story kind) below the ready-count line.
- `lib/data/home.ts` — `HomeModel` gained `activity: HomeActivity` and `deletedKits: DeletedBrandKit[]`,
  both fetched in `loadHome()` (shared by the page and `GET /api/home` — see the mutating-RPC caveat in
  FINDINGS.md).
- `app/api/cron/purge-deleted-kits/route.ts` (new) — the other half of soft delete: kits deleted 30+ days
  ago get their `brand_assets` storage objects removed, then the row (cascades to everything else FK'd to
  it), following `cron/monthly`'s exact `authorizeCron`/`service_role`/idempotent pattern. Registered in
  `vercel.json` (`0 6 * * *`). Never invoked against the live project this session — see DECISIONS.md for
  why building and registering it is still in scope.
- `app/__tests__/brand-kit-entitlement.test.ts` — `delete`/`restore` added to `FREE` with real
  justification strings; a new, separate `describe` block covers `/api/monthly-presence/checkout` (outside
  `ROUTES_DIR`, gated by a different check — `isEntitledToMonthlyPresence`, not `isBrandKitEntitled` —
  so folding it into the existing enumeration would have been a false test, not real coverage).

**Verified, and how.**
- Backend: `scripts/local-verify.sh` — 54/54 SQL tests across both new migrations (delete/restore
  idempotence and ownership refusal, the 30-day window boundary and the practice-name fallback in
  `list_deleted_brand_kits`, and `home_recent_activity`'s old-vs-new filtering and null-marker-means-
  nothing-to-report behavior). One real test bug caught and fixed along the way: `now()` is fixed for an
  entire Postgres transaction, so a test relying on real elapsed time between two RPC calls in the same
  `begin;...rollback;` block silently compared a timestamp to itself — fixed with explicit `+ interval`
  offsets instead of `pg_sleep`. Both migrations dry-run rehearsed against the live project's real data
  before applying; ledger versions corrected afterward.
- Frontend: `tsc --noEmit`, `eslint`, `next build`, and the full `vitest` suite (973/973) all clean. Both
  new API routes and the purge cron appear in `next build`'s route table.
- The route-enumerating test extension was actually exercised, not just added: re-ran the full suite after
  each addition and confirmed the specific new assertions passed rather than trusting the diff.
- `since-you-were-here.tsx`'s `ordinal()` — unit-tested directly, including the 11/12/13 exceptions a naive
  `%10` rule would get wrong.
- One real ESLint rule violation caught before it shipped: `recently-deleted-section.tsx` originally called
  `Date.now()` directly during render (`react-hooks/purity`'s "Cannot call impure function during render"),
  which would produce a hydration mismatch. Fixed by computing `daysLeft` server-side in
  `listDeletedBrandKits` instead of client-side at render time.

**Not verified:** the actual click-through in a browser for any of this lot's UI — the delete confirmation
modal's typed-match gating, the focus trap, the restore flow, "Since you were here" and "Recently deleted"
actually rendering real data, the home-slot swap timing. The purge cron specifically has never run against
real data of any kind, live or local (local-verify's Postgres stub has no Storage to exercise the
`storage.remove()` call against) — its SQL-side logic (which kits are candidates) is implicitly exercised
by nothing directly; this is the one piece of Lot 9 with the least direct verification, flagged plainly
rather than claimed otherwise.
