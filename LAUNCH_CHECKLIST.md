# LAUNCH CHECKLIST

Everything that must be true on **production** the morning the cold emails go out.
Started 2026-09-10, seeded from what was scattered across `ACQUISITION_WALK.md`,
`WEEKEND_REVIEW.md`, `FINDINGS.md`, `DELIVERY.md` and `CHANTIER_LOG.md`.

**How to read a row.** *Set* is what to change. *Where* is the exact surface. *Verify* is an
observation you can make **after** the change that would come out differently if it had not
taken — never "it should be fine now". *State today* is what I could check from this session;
where I could not check, it says so rather than guessing.

Nothing here is a deploy. Where a deploy is required, the row says so.

---

## 0. STATUS AT A GLANCE

| # | Item | State today | Blocks launch? |
|---|---|---|---|
| 1 | `ANON_TOKEN_SECRET` in Vercel | **cannot verify from here** | No — but see the row |
| 2 | Supabase email confirmation off | **cannot verify from here** | No |
| 3 | The five spend ceilings | ✅ **verified live** | Yes |
| 4 | `ANTHROPIC_API_KEY` present | **absent in this session**; unknown in Vercel | **Yes — nothing generates without it** |
| 5 | `OPENAI_API_KEY` present | **absent in this session**; unknown in Vercel | **Yes — no brand images without it** |
| 6 | `content-month` cron still disarmed | ✅ **verified in `vercel.json`** | Yes |
| 6b | `anon-briefs` purge cron **newly armed** | ✅ **verified in `vercel.json`** | Yes |
| 7 | Seven brand images at prompt version 7 | ❌ **all seven are stale** | **Yes — the kit page shows none** |
| 8 | The funnel records anything at all | **untested in production** | No — but you are flying blind until it is checked |
| 9 | Stripe payment methods limited to cards | **cannot verify from here** | **Yes — see the row** |
| 10 | The rehearsal has been run | not yet | **Yes — it is the only test of the live keys** |
| 11 | ACL rollback of 2–3 Sept — **known unknown, not chased** | cause unknown; bounded by in-body gates + CI | No — read the row if the grants check goes red |

---

## 1. `ANON_TOKEN_SECRET`

**Why it is first and why it is easy to miss.** Forgetting it is **not an outage**. The
anonymous brief works without it, no page breaks, no error appears, nothing reminds you. What
you lose is the cheap rejection of a forged cookie *before* it reaches the database — the
cookie that sits in front of the spend path. The database is the authority either way
(`public.anon_token_hash()` matches a stored hash or reads nothing), so this is defence in
depth, not the defence.

**Set.** A random 32-byte secret. Generate one:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

**Where.** Vercel → the Eklio project → Settings → Environment Variables → add
`ANON_TOKEN_SECRET`, **Production** only, then **redeploy**. It is read at request time
(`process.env[SECRET_ENV]` in `lib/anon/token.ts`), not inlined at build, but a Vercel
serverless function does not see a new variable until the next deployment.

⚠ **Do not rotate it after launch.** A rotation does not invalidate outstanding cookies —
unsigned and old-signature tokens are deliberately still accepted (`isPlausibleAnonToken`
returns `true` for a token with no `.` suffix, precisely so a rotation cannot delete
someone's brief from her point of view) — but every token minted before the rotation stops
being *cheaply* verifiable. Set it once, before the first email.

**Verify it took.** A forged token with a *present but wrong* signature is the only input the
two states answer differently. A garbage token with no dot is accepted in both, by design.

```bash
# 43 chars, a dot, 22 chars — the shape mintAnonToken() produces, with a wrong suffix.
FORGED="$(printf 'a%.0s' {1..43}).$(printf 'b%.0s' {1..22})"
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Cookie: eklio_brief=$FORGED" \
  https://<your-domain>/api/briefs/00000000-0000-0000-0000-000000000000
```

- **`401`** → the secret is set. The signature failed, the caller resolved to `none`, and no
  database round trip happened.
- **`404`** → the secret is **absent**. The token was taken as plausible, the database was
  asked, and no row matched.

`GET /api/briefs/[id]` spends nothing — no model call, no counter. Do not use
`/generate` for this test: it would consume one of the day's reveal counts.

---

## 2. Email confirmation, off in Supabase

**Why.** She finishes a seven-step brief, sees three finished directions with her practice's
name on them, and signs up to keep them. If confirmation is on, the next thing she sees is
"check your email" instead of her work.

**Nothing is lost if you leave it on.** `signUp` returns the new user's id even when no
session is issued, so `claimAnonBrief` runs at signup either way and her brief is attached to
her account before she ever opens the email (`lib/actions/auth.ts`). This row is about the
seam in the moment, not about data.

**Set.** Turn **Confirm email** off.

**Where.** Supabase Dashboard → project `fobgdsupyfslxbswfuay` → Authentication →
Sign In / Providers → **Email** → *Confirm email* → off → Save.

**Verify it took.** Sign up on production with an address you have never used:

- **Off** → you land on `/app`, signed in.
- **On** → you land on `/signup/check-your-email`.

That redirect is decided by `data.session` in `lib/actions/auth.ts`, so it is a direct
readout of the setting, not a proxy for it.

---

## 3. The five spend ceilings

**Set.** They are already set. These are the shipped values, read back live on 2026-09-10:

| Key | Value | What it counts |
|---|---|---|
| `anon_generation_enabled` | `true` | the kill switch, both kinds |
| `anon_generation_daily_per_ip` | `3` | reveals, per hashed IP, per UTC day |
| `anon_generation_daily_global` | `150` | reveals, everyone, per UTC day |
| `anon_assist_daily_per_ip` | `45` | tone-cards / positioning / suggest / rephrase, per IP |
| `anon_assist_daily_global` | `750` | the same four, everyone |

At those values: a realistic day costs **$13.06** and needs 50 distinct IPs to fill; the worst
day anyone could construct costs **$61.12**; any one IP can cost at most **$2.38**. Derivation
and the $10 / $30 / $100 alternatives: `ACQUISITION_WALK.md` §12.3–§12.4.

**Where.** `public.app_settings` in Supabase. **No deploy** — the RPC reads them per call, so
an edit takes effect on the next request.

**Verify it took.**

```sql
select key, value from public.app_settings
 where key like 'anon\_%' order by key;
```

Five rows, exactly the values in the table above. **A missing row is not "unlimited" — it is
"no"**: `consume_anon_generation` refuses with `disabled` if any setting it needs is missing
or unreadable. So a typo here closes the tap rather than opening it, which is the safe
direction but will also look like an outage. If anonymous generation refuses everything on
launch morning, check these five rows first.

**Watch the day as it runs:**

```sql
select bucket, used from public.anon_generation_counters
 where day = (now() at time zone 'utc')::date
 order by used desc limit 20;
-- '@global' is the day's reveals; 'assist:@global' is the day's assist calls.
```

---

## 4. `ANTHROPIC_API_KEY`

**Why.** Every word Eklio writes. Three directions, the voice guide, the social copy, the
tone cards, the positioning options, "Write it for me", "Help me say it", and the Check
rewrites. Text is Anthropic; images are OpenAI; the split is by modality and is recorded in
`CHANTIER_LOG.md`.

**Set.** The Anthropic API key.

**Where.** Vercel → Settings → Environment Variables → `ANTHROPIC_API_KEY`, **Production**,
then redeploy.

**Verify it took.** Walk one brief on production as an anonymous visitor and press generate.
Three directions arrive → the key works. If it is absent the generation job fails and the
reveal screen shows a failure, not a hang.

A cheaper probe, no full brief: press **"Write it for me"** on the positioning field at
step 4. One `suggest` call, ~$0.009, and a sentence comes back or it does not.

⚠ **Never print the key, not partially, not in an error, not in a commit message.** It is
read from the environment only.

---

## 5. `OPENAI_API_KEY`

**Why.** The seven brand images per kit. Nothing else.

**Set.** The OpenAI API key.

**Where.** Vercel → Settings → Environment Variables → `OPENAI_API_KEY`, **Production**, then
redeploy. For the local regeneration in item 7, put it in `.env.local` at the repo root
(already covered by `.gitignore`) — **never in a tracked file**.

**Verify it took.** Item 7 is the verification: a regenerated slot either arrives or it does
not. There is no cheaper probe that does not cost an image.

⚠ `api.openai.com` was unreachable from the session that built this pipeline, so no image has
ever been generated from inside a Claude session. Item 7 has to be run by a human on a machine
that can reach it.

---

## 6. The crons

Four are armed and one is deliberately not. Read `vercel.json` — that file *is* the schedule.

| Path | Schedule | Intent |
|---|---|---|
| `/api/cron/anon-briefs` | `0 5 * * *` | **newly armed this chantier.** Purges anonymous briefs past their 30-day deadline |
| `/api/cron/nudges` | `0 14 * * *` | armed |
| `/api/cron/purge-deleted-kits` | `0 6 * * *` | armed |
| `/api/cron/purge-events` | `0 4 * * *` | **new this chantier.** 180-day retention on `funnel_events` |
| `/api/cron/trial-ending` | `0 15 * * *` | armed |
| `/api/cron/content-month` | *(absent)* | ⚠ **stays disarmed.** The route exists and is tested; nothing schedules it |

⚠ **`content-month` is the one to leave alone.** It is disarmed by **two independent locks**,
and both must be opened to arm it:

1. it is absent from `vercel.json`, so nothing calls it on a schedule; and
2. `CONTENT_GENERATION_ARMED` must be exactly the string `"true"` in the environment
   (`lib/content/generate/armed.ts`) — without it the route answers `503` even to a caller
   holding a valid `CRON_SECRET`. Any other value, including `"false"`, `"0"` and unset, is
   off.

Two locks rather than one because they fail differently: a schedule can be added by someone
reading `vercel.json` as configuration; the variable has to be set by someone who went
looking. Neither should change before launch.

**Verify the second lock:** Vercel → Settings → Environment Variables → `CONTENT_GENERATION_ARMED`
**is not listed at all**. Its absence is the correct state.

**`CRON_SECRET` must be set**, and since 2026-09-12 production **refuses to boot without it**
(`lib/env/required.ts`) — a deployment missing it now fails loudly at start instead of quietly
at 04:00. Before that lock, the absence was silent and this row could not detect it. The purge
in row one is housekeeping and is allowed to be late — an expired brief is already unreadable,
because `projects_select_own` refuses it on the deadline regardless of whether the row is gone
— so a missed run is not a data leak. It is still a table that grows.

⚠ **The observation that distinguishes present from absent.** Without `CRON_SECRET`,
`authorizeCron` returns **404**, not 401 — and in Vercel's panel a 404 reads as *"that route
does not exist"*, sending the operator after a deployment problem that is not there. The
response body is `{"error":"Not found."}` in **both** failure modes — variable absent, and
variable merely mismatched — so the body never discriminates. Two things do:

- the Vercel function log carries `[cron] CRON_SECRET absente — appel refusé` **only** when the
  variable is missing from the environment, never when it merely mismatches; and
- **the database side, which is the reliable instrument.** Every cron route reaches PostgREST
  on an authorised run — `purge-deleted-kits` does so even when it purges nothing, because its
  candidate `select` precedes any mutation. Supabase → `fobgdsupyfslxbswfuay` → Logs → API
  Gateway. An authorised run leaves a request there; a 404'd run leaves nothing at all.
  Supabase's retention is independent of Vercel's, which is exactly why it is the instrument.

**Verify it took.** Vercel → the project → Settings → Cron Jobs. **Five** entries, and
`/api/cron/content-month` is not among them. Then confirm a **scheduled** run — not a manual
one — actually reaches the database: after the next 04:00 UTC `purge-events`, read the Supabase
API Gateway log **the same day**. That window is a rolling ~24 hours and ignores a wider filter
without saying so (`FINDINGS.md`), so a scheduled run not read the same day cannot be read at
all.

---

## 7. The seven brand images, at prompt version 7

**State today: all seven are stale, and I checked.**

`IMAGE_PROMPT_VERSION` reached **7** in commit `9d68caa`, **2026-09-06 14:32:37 UTC**. The
seven stored images were generated between **09:38 and 14:11** the same day — every one of
them **before** the bump, at version 6 or earlier:

| slot | status | fingerprint | created |
|---|---|---|---|
| hero | ready | `da40a5d3a5e7` | 2026-09-06 09:38 |
| ambient_a | ready | `da40a5d3a5e7` | 2026-09-06 14:09 |
| ambient_b | ready | `da40a5d3a5e7` | 2026-09-06 14:10 |
| post_bg_1 | ready | `09b912f65759` | 2026-09-06 14:10 |
| post_bg_2 | ready | `09b912f65759` | 2026-09-06 14:11 |
| post_bg_3 | ready | `09b912f65759` | 2026-09-06 14:11 |
| texture | ready | `09b912f65759` | 2026-09-06 14:11 |

**What that means on screen right now.** `IMAGE_PROMPT_VERSION` is hashed into
`computeImageFingerprint`, and the kit page asks `get_brand_images` for the fingerprint it
computes *today* (`lib/data/kit-page.ts:194`, `lib/data/home.ts:403`). A row whose fingerprint
does not match is invisible. **So the kit page currently shows no brand images at all** —
not old ones, none. Seven paid-for images sit in storage that nothing will ever display.

**Set.** Regenerate all seven, one command per slot, through the real product path:

```bash
npx tsx scripts/brand-image/generate-one.ts --kit <brand_kit_id> --slot hero
# then: ambient_a, ambient_b, post_bg_1, post_bg_2, post_bg_3, texture
```

**Where.** A machine that can reach `api.openai.com`, from a clean checkout of `main`.

The script's preflight refuses to run from a checkout behind `origin/main`, one that disagrees
with it about `IMAGE_PROMPT_VERSION`, or one with uncommitted changes under `lib/images/` or
`scripts/brand-image/` — and it names the command that fixes each. ⚠ **Always `git stash
push`, never a discard** (`reset --hard`, `checkout --`, `clean -f`): a discard on that
machine would destroy work.

There is no `--all` and no loop. Seven runs, deliberately. It also refuses a `service_role`
key — it needs a signed-in therapist's session (`EKLIO_SESSION_ACCESS_TOKEN` /
`EKLIO_SESSION_REFRESH_TOKEN`, from `session-token.ts` beside it), because
`brand_kit_entitled()` and the storage policies are the security boundary and a service-role
run would prove nothing about either.

**Cost:** 3 slots at 7¢ + 4 at 5¢ = **$0.41** for the set, at the prices already recorded in
`brand_images.cost_cents`.

**Verify it took.** Two observations, and do both:

```sql
select slot, status, left(image_fingerprint, 12) as fp, created_at
  from public.brand_images
 where brand_kit_id = '<brand_kit_id>'
 order by created_at desc;
```

1. Seven rows with `status = 'ready'` and a `created_at` **after** the regeneration, all
   sharing a fingerprint that is **neither** `da40a5d3…` **nor** `09b912f6…`. Those two are
   the stale ones and must not be what you see.
2. Open the kit page in the app. **Seven images render.** This is the observation that
   matters: the page computes the fingerprint from live code, so if they render, the stored
   rows agree with the deployed prompt version by construction. If the page is still empty,
   the SQL passing means nothing was actually fixed.

---

## 8. The funnel actually records something

**Why it is here.** Every other row on this list is a setting. This one is a wire, and a
wire that is not connected fails exactly the way a working one looks: silently, with zeroes,
which read as "nobody came" rather than "nothing was recorded". On the morning the emails go
out, the difference between those two sentences is the whole point of having sent them.

**Set.** Nothing. It ships wired. `funnel_retention_days` is seeded at `180` and is the only
knob:

```sql
select value from public.app_settings where key = 'funnel_retention_days';
```

**Where.** `public.app_settings`, no deploy — same as the spend ceilings.

**Verify it took.** After the first deploy, and before the first email:

1. Open the landing page, then the pricing page, in a normal browser.
2. Walk one brief through to the reveal.
3. Then:

```bash
npm run funnel -- --days 1
```

Twelve named steps come back. **"Landed on the site" and "Started the brief" must be
non-zero.** If every row is zero, nothing is recording and the funnel is decoration — check
`SUPABASE_SERVICE_ROLE_KEY` first, since the writer is service-role only and the sink
swallows its own failures by design (a log line reading `[analytics] sink:` is where it says
so).

⚠ **A zero on a step you did not perform is not a failure.** Steps 8–12 require an account
and a card. Read the two you actually walked.

**And read the `orphaned` line while you are there.** It should say *every paid purchase names
its project*. A number there means somebody paid and got no allowance — the report prints the
two statements that fix it (`ACQUISITION_WALK.md` §14.6). A `?` means the read failed, which
is not the same as zero.

## 9. Stripe payment methods, cards only

**Why.** `createCheckoutSession` does not set `payment_method_types`, so the **Stripe
dashboard** decides which methods appear. If a delayed method is enabled — ACH, SEPA, bank
transfer — a payment that later fails produces this sequence, measured by reading the path in
Session 4 (`ACQUISITION_WALK.md` §14.1):

1. Stripe returns her to the success page with `payment_status: "unpaid"`.
2. She reads **"Payment received."**
3. Forty-five seconds later she reads **"Your payment went through."**
4. Hours later the payment fails, the purchase is written `failed`, and **nothing tells her.**
   There is no notification anywhere in `lib/stripe/` for that transition.

The product tells her twice that it worked and never corrects itself.

**Set.** In Stripe → Settings → Payment methods, for the account the live keys belong to:
enable **cards only** for now. Turn the delayed methods off.

**Where.** Stripe dashboard, **live** mode. No deploy, no code.

**Verify it took.** Open a real checkout (step 8 of `REHEARSAL.md`) and look at what Stripe
offers. Card fields, and nothing that says "pay by bank" or asks for an account number.

⚠ **This is a stopgap, and it should be named as one.** The honest fix is to notify on
`checkout.session.async_payment_failed` and to stop the success page claiming a payment went
through before the webhook says so. Turning the methods off makes the path unreachable
instead, which is the right trade for launch week and the wrong one forever.

---

## 10. The rehearsal

**Why.** Every row above this one is a setting you can check. The live Stripe keys, the live
webhook endpoint and its signing secret, the live price ids, the production site URL that
builds every resume link — none of those is checkable except by using them, and each is only
ever exercised by the first person who pays.

**Set.** Run `REHEARSAL.md`, end to end, on production, with a real card. Starter, $79,
refunded in Part Four. Budget 45 minutes and **do it the day before the campaign**, not the
morning of — the reveal you generate counts against that day's ceiling of 150.

**Where.** Production, in a browser you have never used on the site, plus a phone on cellular.

**Verify it took.** The last section of `REHEARSAL.md`: twelve funnel steps, all reading 1.

```bash
npm run funnel -- --days 1
```

A step reading 0 is a step that is not instrumented on production, whatever the code says.

---

## 11. KNOWN UNKNOWN — the ACL rollback of 2–3 September

**This row is not an action. It is a name for something that already happened once, recorded
so that a second occurrence is recognised in minutes rather than re-investigated from zero.**

Not being chased. It is written down because it cost a day, and because the thing it would
look like the second time — a grants check going red with no migration to explain it — is
otherwise indistinguishable from a mistake someone made that afternoon.

### What happened

`20260902*` revoked EXECUTE from `public`, `anon` and `authenticated` on eighteen
`SECURITY DEFINER` functions. On 11 September, seventeen of the eighteen were **granted
again** — the PUBLIC grant (`=X/postgres`) and the direct `anon` / `authenticated` grants
both back — with no migration in either repository that grants them, and the migration ledger
showing the revoking migration as applied. The eighteenth, `seed_launch_checklist`, is the
only one a *later* migration (`20260903260000`) re-revoked, and it is the only one still
closed.

### What is established, by measurement

- The grants really were restored. Read from `pg_proc.proacl`, not inferred.
- **The revokes of 3, 5, 6, 9, 10 and 11 September all hold.** Checked function by function.
  Only the 2 September ones came undone.
- Functions created *after* the event keep their revokes.

### What is ruled out, by test

| Hypothesis | How it was tested | Result |
|---|---|---|
| A blanket `grant all on all functions in schema public …`, re-run continuously by the platform | Check every revoke in both repos, by date | **False.** It would have undone 3–11 September too; every one of those holds |
| `apply_migration` re-grants after applying DDL | Revoke through it, then read `proacl` back on a later connection | **False.** The revoke was intact |

⚠ **Both were my inferences from this repo's known signature — the permissive default — and
both were wrong.** The signature is real; the cause does not follow from it. Do not re-derive
a mechanism from the shape of the damage.

### What is NOT established

The cause. What fits every observation is a **discrete past event around 2–3 September** that
restored ACL state to a point before that migration ran while the ledger moved forward — a
restore, a branch reset, a rebuild. It cannot be proved from inside the database and is not
claimed as proved. Nobody is looking for it.

### Why this does not block launch

Because the damage it can do is now bounded by two things that do not depend on knowing what
it was:

1. **The authority check lives inside the function body**
   (`20260911170458_authority_moves_inside_the_function_body.sql`). A re-granted EXECUTE gives
   a caller the right to *run* the function; it does not give them the right to *pass its
   gate*. A recurrence is a lost lock, not an open door.
2. **CI enumerates the grants on every push**
   (`supabase/tests/20260911170458_function_surface.test.sql`, run by `.github/workflows/db-tests.yml`).
   A `SECURITY DEFINER` function that `anon` or PUBLIC can execute and that does not assert its
   own caller fails the build. One named exemption: `anon_token_hash`.

### If the grants check goes red and no migration explains it

**This has happened before. Read this row first.**

1. Do **not** re-derive the cause from the shape. Two mechanisms are already eliminated above;
   start past them.
2. Establish the blast radius before anything else: which revokes came undone, and **by date**.
   Only-2-September was the previous signature; a different date range is a different event.
3. Re-revoke. It is a second lock, not the lock — the in-body gates are the lock, and they are
   what to verify still stand.
4. Check the migration ledger against the catalogue. A ledger ahead of the schema is the
   fingerprint of a restore, and it is the one observation that would turn this from an
   unnamed event into a named one.
5. Add what you learn here. This row exists to accumulate.

---

## WHAT IS NOT ON THIS LIST YET

Named so the gap is visible, not because it is finished.

- **Stripe live keys and the four `STRIPE_PRICE_*` variables.** The payment path has its own
  document (`VERIFY-PAYMENT-PATH.md`) and its own verification. It belongs here; it is not
  written here yet.
- **`RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`.** The "email me a link" offer and
  every nudge run through them. `NEXT_PUBLIC_SITE_URL` in particular builds the resume link:
  wrong value, dead link in her inbox.
- **`SUPABASE_SERVICE_ROLE_KEY`.** Anonymous brief creation, the purge cron and the spend
  ceilings all use it. Nothing anonymous works without it.
- ~~**A paid purchase with no project attached.**~~ **Closed.** Three readers were counting an
  orphaned purchase as paid for every project the account owns; all three are now scoped, and
  the count is on the top block of `npm run funnel` with the statements to paste when it is
  not zero. `ACQUISITION_WALK.md` §14.6.

- **A campaign source on the funnel.** The instrument counts arrivals but not where they
  came from — no referrer, no UTM. One cold-email list to a known audience does not need it;
  two campaigns in one week would, and it is a column and a beacon field away.
- **The first invoice.** Every cost figure in `ACQUISITION_WALK.md` §12 is arithmetic on
  measured prompt sizes, not billed usage — no request has been made to the Anthropic API from
  any session that built this. Compare the first day's bill against **$0.0871 × the day's
  reveal count** and correct the ceilings from the real number.
