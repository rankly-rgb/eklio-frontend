# THE REHEARSAL

One real purchase, on production, with a real card, before the first cold email goes out.

**Why a real card and not test mode.** Test mode proves the code path. It does not prove the
live Stripe keys, the live webhook endpoint and its signing secret, the live price ids, the
production `NEXT_PUBLIC_SITE_URL` that builds the resume link, the production Supabase
policies, or the cron schedule. Those are exactly the things that are wrong on launch morning,
and every one of them is only ever exercised once — by the first person to pay. **Be that
person.**

**What it costs.** $79 for Starter, refunded at the end, plus about $0.09 of model spend for
the anonymous walk. Use Starter: the path is identical and it is the cheapest of the three.

**Time.** Budget 45 minutes. Do not do this in the same hour the emails go out.

---

## BEFORE YOU START

Complete `LAUNCH_CHECKLIST.md` rows 1–8 first. This rehearsal *verifies* that checklist; it
does not replace it. In particular rows 4 and 5 (the two API keys) must already be true or
step 5 below will fail for a boring reason and cost you the run.

Have open, in separate windows:

1. The **Stripe dashboard**, on Payments, in **live** mode.
2. The **Supabase SQL editor** for `fobgdsupyfslxbswfuay`.
3. A terminal in the frontend repo, for `npm run funnel`.
4. **A browser you have never used on this site** — a fresh profile, or a private window that
   you will keep open for the whole run. ⚠ Not your normal browser: an existing session or an
   old `eklio_brief` cookie invalidates the entire anonymous half.
5. **A phone**, on cellular rather than your home wifi. Steps 4 and 11 need a genuinely
   different device and a genuinely different IP.

Write down the moment you start, in UTC. Several checks below are scoped to "today".

---

## THE BASELINE

Before touching anything, take the numbers you will compare against.

```bash
npm run funnel -- --days 1
```

```sql
select key, value from public.app_settings where key like 'anon\_%' order by key;
select count(*) from public.projects;
select count(*) from public.purchases;
```

Expect: the ceiling glance reads zero across the board, five `anon_*` rows at 150 / 3 / 750 /
45 / true, and the project and purchase counts you already have. **Keep this output.** Every
step below is a delta from it.

---

## PART ONE — THE ANONYMOUS WALK

### 1. Land cold

In the fresh browser, open the production site at its root. Do not sign in. Do not click
anything yet.

**Verify.** `npm run funnel -- --days 1` shows **Landed on the site: 1**.

⚠ **If it shows 0, stop and fix this before anything else.** The beacon is the only thing
measuring the top of the funnel, and every conversion number for the whole campaign is
divided by it. A zero here means the rest of the run tells you nothing.

### 2. Look at pricing, then start the brief

Open `/pricing`, then start a brief without creating an account.

**Verify.** `Looked at pricing: 1` and `Started the brief: 1`.

```sql
select id, user_id, anon_token_hash is not null as has_token, anon_expires_at::date
  from public.projects order by created_at desc limit 1;
```

`user_id` **null**, `has_token` **true**, and the expiry about 30 days out. Write down that
project id — call it **P**.

### 3. Answer all seven steps, on the phone for at least one of them

Do step 4 ("How you work") on the **phone**, in a browser where you paste the same URL. It
will not work — there is no cookie there — and that is the point of step 11. Come back to the
laptop and finish all seven.

Use "Write it for me" at least once and "Help me say it" at least once.

**Verify.** `Finished "How you work": 1` and `Reached the review: 1`.

```sql
select bucket, used from public.anon_generation_counters
 where day = (now() at time zone 'utc')::date order by bucket;
```

The `assist:` buckets have moved. The reveal buckets have not — nothing has generated yet.

### 4. Ask for the email link

On the review screen, use **email me a link**. Send it to an address you can open on the
phone.

**Verify.** The email arrives. Open it **on the phone**, on cellular. It should land you on
your own brief, on that device, without an account.

⚠ **This is the single most important check in Part One.** It is the only recovery path a
visitor has if she closes the laptop, and it exercises `NEXT_PUBLIC_SITE_URL`, the Resend key,
and `/brief/resume` all at once. If the link 404s or lands on *expired*, the address in
`NEXT_PUBLIC_SITE_URL` is wrong.

```sql
select event, props from public.funnel_events
 where event = 'email_sent' order by occurred_at desc limit 1;
```

The props carry `kind` and `delivered`. ⚠ They must **not** carry the address.

### 5. Generate

Back on the laptop, press **Build my brand**.

**Verify.** Three directions arrive. Then:

```bash
npm run funnel -- --days 1
```

`Pressed generate: 1`, `Saw three directions: 1`, and the glance shows **reveals 1 / 150**
with a spend of about `$0.04`.

⚠ **If the glance still reads 0 reveals but the directions arrived, the counter is not being
consumed** — which means the cap is not protecting anything. Stop and fix.

**Check what it really cost**, once, so the estimate can be corrected later:

Open the Anthropic console and note the spend for the last few minutes. If it differs from
the glance by more than a factor of two, correct the rate:

```sql
update public.app_settings set value = to_jsonb(<measured usd per reveal>)
 where key = 'anon_reveal_cost_usd';
```

---

## PART TWO — THE ACCOUNT AND THE MONEY

### 6. Sign up from the reveal

Press a direction. You are not paid, so you land on checkout — which needs an account, so you
land on sign-up. Create one with an address you control.

**Verify, and this is the one that broke twice:**

```sql
select id, user_id, anon_token_hash, anon_expires_at
  from public.projects where id = 'P';
```

`user_id` is now **your new user**, and **both** `anon_token_hash` and `anon_expires_at` are
**null**. A half-claim is impossible by constraint, but check anyway — this is the seam
between the free half and the paid half of the product.

`npm run funnel -- --days 1` shows `Submitted the signup form: 1` and `Created an account: 1`.

### 7. Abandon the checkout once, on purpose

On the Stripe page, close it or press back.

**Verify.** You land on **"Nothing was charged."** Then:

```sql
select count(*) from public.purchases where project_id = 'P';
```

**Zero.** Nothing is written until the webhook.

### 8. Pay, with a real card

Go back to checkout, pick **Starter**, leave Monthly Presence **unticked**, and pay.

**Verify, in this order:**

1. The success page resolves within a few seconds from "Payment received" to **"You're all
   set."** ⚠ If it sits on the polling message for 45 seconds and then says confirmation is
   slow, **the webhook is not arriving** — check the endpoint URL and `STRIPE_WEBHOOK_SECRET`
   in Stripe before doing anything else. The money is taken and nothing is unlocked.

2. ```sql
   select tier, status, project_id, amount_cents, paid_at
     from public.purchases order by created_at desc limit 1;
   select project_id, plan_tier, directions_generated, regenerations_used
     from public.generation_credits where project_id = 'P';
   ```
   One `paid` row at `7900`, **`project_id` = P** (⚠ not null — a null here means the purchase
   opened no allowance, §14.6), and `plan_tier` = `starter` with the counters reset.

3. ```bash
   npm run funnel -- --days 1
   ```
   `Opened checkout: 1` and `Paid: 1`.

### 9. Try to pay twice

Go back to `/app/checkout?plan=starter&project=P` and press pay again.

**Verify.** You should read: *"You've already paid for this project's kit — it's unlocked.
Open it from your projects; nothing new was charged."* and Stripe should never open.

⚠ **If Stripe opens, close it immediately and do not complete it.** That means the guard shipped
in Session 4 is not deployed, and a real customer pressing twice pays twice with no way back —
there is no refund primitive in this product.

### 10. Choose a direction and open the kit

**Verify.** `Chose a direction: 1` in the funnel, the kit opens, and the pages match the
Starter scope (3 pages, no social templates).

⚠ **And check the brand images.** If the kit shows none, `LAUNCH_CHECKLIST.md` row 7 has not
been done — the seven stored images are at an older prompt version and the page filters them
out. That is a customer paying $79 and receiving a kit with no photography.

### 11. The second device, after paying

On the phone, sign in with the account you just made.

**Verify.** Your project and your paid kit are both there. This is the check that the purchase
belongs to the *account* and not to the browser.

**And check the sentence a stranger would get.** Still on the phone, sign out and open the
reveal URL from step 5. You should land on sign-in **with a line above the form** explaining
that a brief started without an account lives on the device it was started on, and that the
emailed link will bring it here. If that line is missing, the second-device dead end from
§14.5 is back.

---

## PART THREE — THE SUBSCRIPTION

### 12. Add Monthly Presence

From the app, subscribe to Monthly Presence ($39/month).

**Verify.**

```sql
select status, current_period_end, cancel_at_period_end, trial_end
  from public.subscriptions order by created_at desc limit 1;
```

`active` (or `trialing`), with a period end about a month out.

### 13. Cancel it from the billing portal

Open the billing portal from the app and cancel.

**Verify.** `cancel_at_period_end` becomes **true** and `status` stays `active` — she keeps
what she paid for until the period ends. ⚠ If the status flips to `canceled` immediately,
someone is losing a month they paid for.

---

## PART FOUR — PUT IT ALL BACK

Do this the same day. An un-reversed rehearsal becomes a fake customer in your numbers and a
real charge on your statement.

### 14. Refund the payment

**In Stripe**, refund the $79 in full.

**Verify** the webhook wrote it back:

```sql
select status from public.purchases order by created_at desc limit 1;
select * from public.purchase_status_events order by occurred_at desc limit 3;
```

Status **`refunded`**, and a status-transition row recording it. ⚠ A refund that does not land
in `purchases` means the refund webhook is not wired — worth knowing before a real customer
disputes a charge.

### 15. Cancel the subscription outright

In Stripe, cancel the subscription immediately rather than at period end, so no $39 is ever
taken.

### 16. Delete the rehearsal data

⚠ **ORDER MATTERS, AND THE OBVIOUS ORDER IS WRONG.**
`purchases_project_id_fkey` is `ON DELETE SET NULL`, not cascade. Delete the project first and
the purchase survives with `project_id = null` — it stops matching `where project_id = 'P'`
and you are left with an orphan that `resolveEntitledTier` counts **for every project you
own**, because a null-project purchase is treated as applying to all of them (§14.6). A
tidy-up done backwards silently grants you a paid tier forever.

```sql
-- Check first. Never run a delete without reading what it will hit.
select id, name, user_id from public.projects where id = 'P';
select id, tier, status, project_id from public.purchases where project_id = 'P';

-- Then, in one transaction, PURCHASES BEFORE PROJECT.
begin;
  delete from public.purchases where project_id = 'P';
  delete from public.projects  where id = 'P';   -- cascades to brief, kit, images
  -- Both must be zero before you commit.
  select
    (select count(*) from public.purchases where project_id = 'P') as purchases_left,
    (select count(*) from public.projects  where id = 'P')         as projects_left;
commit;
```

Then confirm nothing was left floating — and you no longer have to remember to:

```bash
npm run funnel -- --days 1
```

The top block carries an `orphaned` line. It should read **"every paid purchase names its
project"**. If the teardown went backwards it will say so, name the row, and print the
statement that reattaches it.

⚠ **An orphan no longer grants anything** (that hole was closed in the same session that found
it), so a leftover row is not a security problem — it is somebody who paid and got nothing, or
in this case a rehearsal that did not finish putting itself back. Delete it:

```sql
select id, tier, status, created_at from public.purchases where project_id is null;
```

Leave the **user** in place; an extra account costs nothing and deleting auth rows has more
edges than it is worth.

### 17. Decide what to do about the funnel rows

Your rehearsal is now twelve events in `funnel_events` that look exactly like a real customer.
Two honest options:

- **Leave them and remember.** Fine if you rehearse days before the campaign — the report is
  windowed, so `--from` the campaign's first day excludes them.
- **Delete them.** Only if you rehearse the same day:

  ```sql
  delete from public.funnel_events
   where occurred_at >= '<the UTC instant you started>'
     and occurred_at <  '<the UTC instant you finished>';
  ```

⚠ **Do not "adjust" them.** A funnel you have edited is a funnel you cannot trust, and you
will be reading it under pressure.

### 18. Reset the counters, if you rehearsed on launch day

The reveal you generated counts against today's ceiling of 150.

```sql
select bucket, used from public.anon_generation_counters
 where day = (now() at time zone 'utc')::date;
-- Only if you rehearsed the same UTC day as the campaign:
delete from public.anon_generation_counters
 where day = (now() at time zone 'utc')::date and bucket like '%<your ip hash>%';
```

Simpler and safer: **rehearse the day before.** The counters reset at midnight UTC on their
own.

---

## WHAT A CLEAN RUN LOOKS LIKE

```
npm run funnel -- --days 1
```

```
  reveals      1 / 150   ························    0.7%   149 left
  refusals            0   nobody has been turned away today

  Landed on the site          1
  Looked at pricing           1
  Started the brief           1
  Finished "How you work"     1
  Reached the review          1
  Pressed generate            1
  Saw three directions        1
  Submitted the signup form   1
  Created an account          1
  Opened checkout             1
  Paid                        1
  Chose a direction           1
```

**Twelve steps, all 1.** If any step reads 0, that step is not instrumented on production
whatever the code says — and you will be blind to it for the whole campaign.

---

## THE FIVE THINGS THIS REHEARSAL IS REALLY FOR

Everything else is a bonus. These five are only ever tested by the first person to pay, and
each has already been wrong once:

1. **The webhook reaches production and its signature verifies.** Step 8. Otherwise the money
   is taken and nothing unlocks.
2. **`NEXT_PUBLIC_SITE_URL` is right.** Step 4. Otherwise every resume link in every email is
   dead, and the cap-refusal copy points at an exit that does not work.
3. **The claim happens.** Step 6. It has now been wrong twice, in two different directions.
4. **The beacon fires.** Step 1. Otherwise every percentage in the campaign is divided by zero.
5. **The brand images render.** Step 10. Otherwise a paying customer gets a kit with no
   photography and nothing in the product says why.
