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
  schemas, no `auth.uid()`, no `storage.objects`/`storage.buckets` pre-built. [continued in next entry as
  that gets built]
