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
