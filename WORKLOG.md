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
