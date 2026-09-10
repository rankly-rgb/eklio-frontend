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

**`CRON_SECRET` must be set** or every cron route refuses: without it `authorizeCron` logs
`[cron] CRON_SECRET absente — appel refusé` and returns a denial. The purge in row one is
housekeeping and is allowed to be late — an expired brief is already unreadable, because
`projects_select_own` refuses it on the deadline regardless of whether the row is gone — so a
missed run is not a data leak. It is still a table that grows.

**Verify it took.** Vercel → the project → Settings → Cron Jobs. Four entries, and
`/api/cron/content-month` is not among them. After the first 05:00 UTC run, the anon-briefs
job shows a 200 in its log.

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
- **The first invoice.** Every cost figure in `ACQUISITION_WALK.md` §12 is arithmetic on
  measured prompt sizes, not billed usage — no request has been made to the Anthropic API from
  any session that built this. Compare the first day's bill against **$0.0871 × the day's
  reveal count** and correct the ceilings from the real number.
