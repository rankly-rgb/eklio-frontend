# Eklio — frontend

A guided brief turns into a complete brand identity for a US therapist in
private practice: positioning, palette, typography, three creative directions,
a full brand kit with finished website copy, and a prompt ready to paste into
Squarespace, Lovable, Framer or Webflow.

The audience is licensed clinicians — LPCs, LMFTs, psychologists, LCSWs — whose
advertising is governed by ACA and APA principles and by their state board.
**Ethics compliance in generated copy is a correctness requirement here, not a
nicety.** See `lib/ethics/` before changing anything that produces copy.

This repo holds the Next.js frontend **and** the route handlers and server
actions that talk to Supabase, Anthropic and Stripe — those calls are strictly
server-side.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, RLS)
- Anthropic (Claude) — server-only generation, forced tool calls with strict schemas
- Stripe — hosted Checkout plus a webhook for subscription status
- Vitest for the ethics, generation and billing tests
- Deployment: Vercel

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without valid Supabase variables the pages compile, but anything routed through
`proxy.ts` (the file Next.js 16 renamed from `middleware.ts`) fails with an
explicit Supabase error — expected until `.env.local` is filled in.

## Environment variables

See `.env.example`. Never commit `.env.local`.

`NEXT_PUBLIC_*` variables are exposed to the client bundle: only the Supabase
URL, the anon key and the site URL belong there. The service-role key, the
Anthropic key and every Stripe value are server-only.

## Database

Migrations live in `supabase/migrations/` and are the source of truth for the
schema. `types/database.ts` is hand-written to mirror them; regenerate it with
`supabase gen types typescript` once the CLI is available.

Every table is owner-only under RLS. Ownership on child tables is transitive
through `projects` and re-checked in each policy. `orders` and `subscriptions`
have **no** client-writable policies on purpose — only the Stripe webhook writes
them, using the service-role client.

Apply them with the Supabase CLI (`supabase db push`) or by running the files in
filename order against the project.

## Architecture

```
app/
  page.tsx                          landing page and pricing
  terms/                            terms, carrying the ethics disclaimer
  login/, signup/                   email + password auth
  app/                              signed-in area, protected by proxy.ts
    projects/[id]/brief/[step]/     the 7-step brief
    projects/[id]/brief/review/     recap + live brand-sheet preview
    projects/[id]/directions/       three creative directions
    projects/[id]/checkout/         tiers + the Monthly Presence add-on
    projects/[id]/kit/              the brand kit deliverable
    projects/[id]/presence/         Monthly Presence content
  api/stripe/webhook/               Stripe webhook (signature-verified)
components/                         shared UI
lib/
  ethics/                           the compliance layer — read this first
  brief/steps.ts                    the brief, defined as data
  ai/                               generation: directions, kit, monthly presence
  billing/                          tiers, entitlements
  stripe/, supabase/                clients
  actions/                          server actions
supabase/migrations/                schema + RLS
types/database.ts                   types mirroring the migrations
proxy.ts                            session refresh + /app guard
```

### The ethics layer

Every string a practitioner could publish passes through `lib/ethics/`:

- `rules.ts` — `ETHICS_SYSTEM_RULES` is injected into every generation prompt,
  and `FORBIDDEN_PATTERNS` re-checks the output in code. Each pattern carries
  the ethics basis it enforces as a comment.
- `enforce.ts` — `generateWithEthicsGuard` validates structure, then ethics,
  regenerates with corrective feedback on a blocking violation, and throws
  `EthicsComplianceError` rather than returning copy that could be published.

Nothing that fails structural **or** ethics validation is ever persisted.

**If a legitimate string is blocked, add it to the compliant set in
`lib/ethics/__tests__/rules.test.ts` and narrow the pattern.** Never weaken a
pattern without a test row pinning the new behavior.

### Generation

All three generators (`lib/ai/directions.ts`, `kit.ts`, `monthly-presence.ts`)
share one shape: prompt built from `brief-context.ts`, a single forced tool call
with a strict schema, structural validation, then the ethics guard. Array
lengths are enforced in code, not in the schema — the API's JSON Schema subset
has no array-length constraints.

### Fonts

Typefaces must be known at build time, so nothing is loaded at runtime.
Generated font names are displayed as text. `lib/fonts.ts` loads Inter, IBM Plex
Mono and Fraunces; Fraunces stands in for Recoleta Bold until that license is
bought (instructions are in the file).

## Commands

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # serve the production build
npm run lint     # ESLint
npm run test     # Vitest (ethics, generation, billing)
```

## Deploying to Vercel

1. Import the repo from the Vercel dashboard.
2. Framework preset: Next.js (detected automatically).
3. Add the environment variables above for **Production** and **Preview**.
4. Point a Stripe webhook endpoint at `/api/stripe/webhook` and put its signing
   secret in `STRIPE_WEBHOOK_SECRET`. Subscribe to
   `checkout.session.completed` and `customer.subscription.*`.

## Not built yet (deliberate seams)

- **Monthly Presence scheduler and reminders.** Generation works and is
  ethics-guarded; the cadence that delivers it and the nudges that get people to
  actually publish are not built. Read the churn note at the top of
  `lib/ai/monthly-presence.ts` first — retention is the central risk on the
  subscription, and this loop is what addresses it.
- **Regeneration paywall.** Seam marked `TODO(Lot 5)` in
  `lib/actions/directions.ts`.
- **PDF export of the kit.** Seam documented in
  `components/kit/brand-kit-view.tsx`.
- **Public shareable kit page.** `brand_kits.share_slug` exists with no public
  RLS policy — add the policy deliberately when the time comes.
