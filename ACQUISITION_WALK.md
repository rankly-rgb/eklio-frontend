# THE ACQUISITION WALK — Session 1

**What a stranger sees, walked on a phone, before the cold emails go out.**
Report only. Nothing in this session was changed.

Walked 2026-09-10 against the production build (`next build` + `next start`), Chromium at
**iPhone 13 (390×844, DPR 3)** and **iPhone SE (375×667)**. Numbers marked *measured* come
from that walk; numbers marked *read* come from the source, which for step counts and
required fields is exact.

---

## ⚠ WHAT I COULD NOT WALK, SAID FIRST

**`fobgdsupyfslxbswfuay.supabase.co` is blocked from this environment.** The agent proxy
closes the tunnel; a direct request answers 403 at the proxy. So **signup could not
complete**, and every screen behind the session — the seven brief steps, the review, the
positioning screen, the reveal, the checkout — could not be walked in a browser.

Those sections below are therefore **read from the source, not observed**. They are exact
about structure, step counts, required fields, redirects and copy, and silent about
rendering and speed. Where I could not see something I say so rather than describing it.

What that meant at the time: the phone rendering of the seven brief steps was unexamined.
**It has since been measured — see §9, added in Session 2.** The short answer is that the
brief does not assume a desktop.

---

## 1. THE CLIFF — what is demanded before anything is given

> **The first click after the cold email demands an email address and a password. She has
> received nothing at that point. Not a sample, not a preview, not one line of output.**

Both calls to action on the landing page — **"Build my brand"** (header) and **"Start my
brief"** (hero) — point at **`/signup`**. Neither points at the brief.

`proxy.ts` → `lib/supabase/middleware.ts` protects the prefix `/app`, and **the brief lives
at `/app/briefs/[id]`**. So there is no version of the brief a stranger can touch. The
paywall for *identity* sits in front of the whole product, and the paywall for *money* sits
much further back — which is the wrong way round for cold traffic.

It is worse than one wall, because signup is not the end of it:

| # | What she does | What she has received so far |
|---|---|---|
| 1 | Lands on `/` | A headline, a paragraph, a list of the 7 step names |
| 2 | Taps "Start my brief" → `/signup` | Nothing |
| 3 | Types an email address | Nothing |
| 4 | Types a password (min 8 chars) | Nothing |
| 5 | Taps "Create account" → `/signup/check-your-email` | Nothing |
| 6 | **Leaves the site.** Opens her inbox, finds the mail, taps the link | Nothing |
| 7 | Lands back on `/app`, taps **"Start my brief" a second time** | Nothing |

**Step 6 is the cliff.** A confirmation email on a phone, at night, between sessions, is
where cold traffic dies: she switches apps, the mail is in Promotions, and she does not come
back. Everything Eklio is good at is on the far side of it.

Note also that **"Start my brief" is the label on both step 2 and step 7**. She presses the
same button twice, several minutes apart, and only the second one starts a brief.

---

## 2. THE NUMBER

> **From the first click to the free reveal: 17 required interactions across 14 in-product
> screens, plus one off-site round trip through her email.**

Counted as things she must do:

| Screens | What |
|---|---|
| 1 | Landing |
| 2 | `/signup` — email, password, submit (3 interactions) |
| 3 | `/signup/check-your-email` |
| — | **her inbox — off-site** |
| 4 | `/app` — "Start my brief" |
| 5–11 | Brief steps 1–7 |
| 12 | Review |
| 13 | Positioning / USP screen |
| 14 | Reveal |

**The progress gauge says "7 of 7" on the review screen and there are still two screens
after it.** That is deliberate in the code — `app/app/briefs/[id]/review/page.tsx` says
*"pas une huitième étape, la jauge y reste à 7 sur 7"* — and it is defensible as design.
It is not defensible as a promise: the landing page sells "a seven-step brief" and the real
count from account to reveal is **ten screens**.

**The free reveal is genuinely free**, and that part is sound: `plans` gives tier `free`
`directions_limit = 3` and `regenerations_limit = 1`, so a prospect gets three directions
plus one regeneration before `consume_generation_credit` returns false and the 402 opens
checkout. The landing page's promise is kept.

---

## 3. EVERY REQUIRED FIELD, AND WHETHER IT IS REALLY REQUIRED

From `lib/brief/flow.ts`, `stepIssue()` — the only thing that blocks a step.

| Step | Blocking requirement | Needed to generate a brand? |
|---|---|---|
| 1 Practice | practice name | **Yes** — it is the name on the site |
| 1 Practice | license type | **Yes** — the site states it, and ethics copy depends on it |
| 1 Practice | ≥1 specialty | **Yes** — drives the object register and the copy |
| 1 Practice | city / state | **Not required.** Correct. |
| 2 Positioning | ≥1 card **or** 40 characters written | **Yes**, and the threshold is honest — it refuses "ok", not a paragraph |
| 3 Ideal client | ≥1 persona (max 3) | **Yes** |
| 4 How you work | ≥1 session-style card | **Yes** |
| 4 How you work | **referral quote ≥ 20 characters** | ⚠ **No.** See below. |
| 5 Voice | 1 tone card | **Yes** |
| 6 Look | ≥1 palette family | **Yes** |
| 6 Look | 1 type pairing | **Yes** |
| 7 Website | nothing — carries "Skip for now" | Correctly optional |

**The one field that is required by the form and not by the product: the referral quote.**

> `"Say a little more about what a colleague would say — twenty characters or more."`

It is the only free-text minimum anywhere in the brief that is *blocking*, and it is the
hardest question on the whole path — it asks a stranger, four steps in, to compose a
sentence in someone else's voice. Step 2 asks for free text too, but takes a card instead.
Step 4 takes a card **and** demands the sentence.

Everything else on step 4 (`not_a_fit`, modalities, prominence, prior career) is optional.
So one 20-character box is the only thing standing between her and step 5, and nothing
downstream fails without it.

---

## 4. DEAD ENDS AND ERROR STATES

### ⚠ 4.1 The signup error shows a therapist a JSON parser message

**This is the most serious finding in the walk, and it is on the first form in the funnel.**

`lib/actions/auth.ts:72` —

```ts
return { error: `We couldn't create the account: ${error.message}` };
```

Whatever the auth layer says is interpolated raw into user-facing copy. *Measured*, on this
environment's network failure, a prospect on a phone was shown:

> **We couldn't create the account: Unexpected token 'H', "Host not i"... is not valid JSON**

The specific upstream failure here is an artefact of this sandbox and **not** a product
defect. The screen that renders it is. Any Supabase hiccup, rate limit or outage in October
will show a clinician a parser error and no next step.

### ⚠ 4.2 …and it did so after 60 seconds of "One moment…"

*Measured:* **60.3 s** from tapping "Create account" to any feedback. The button swaps to
"One moment…" and there is no timeout, no reassurance and no way back. On a phone that is
indistinguishable from a frozen page. Again the 60 s is this network; the absence of any
client-side deadline is the product's.

### 4.3 Dead code that redirects to a route that does not exist

`app/app/actions.ts` → `createProject()` ends with:

```ts
redirect(`/app/projets/${project.id}/brief/1`);
```

**`app/app/projets/` does not exist** — the brief lives at `app/app/briefs/[id]`. The
function has **no callers**, so nothing reaches it today. It is a loaded gun in the
acquisition path: the next person who wires a "start" button to the obvious-looking action
ships a 404 into the funnel.

Its error messages are also **in French**, in a product for US therapists:
*"Donnez un nom à votre projet pour le retrouver facilement."*

### 4.4 Refresh, back button, link opened twice — read, not observed

- **Refresh mid-brief: her answers survive.** `useBriefAutosave` PATCHes each change and
  `progress_step` is written with it; `resumeStep()` reads `project_briefs.progress_step` as
  canonical. She returns where she left off. **This is the one thing on the path that is
  clearly right, and it is worth not breaking.**
- **The reveal link opened twice** is safe: `/api/briefs/[id]/generate` is a POST behind a
  button, and generation credit is consumed in one statement, so a second open of the reveal
  URL polls an existing job rather than starting one.
- **Back button** and **two devices** could not be observed. Flagged for the Codespace walk.

### 4.5 A missing env var takes down the landing page, not just the cron

*Measured:* with `RESEND_API_KEY` absent, `next start` boots and then answers **500 to every
route**, including `/` and `/pricing`. That is `assertRequiredEnv()` working exactly as
designed and I would not change it — but it deserves to be known before a campaign: a
Vercel project missing one variable does not degrade the emails, it takes down the ad
landing page.

---

## 5. CLAIMS THE PRODUCT CANNOT KEEP

### ⚠ 5.1 The retired tier names are on the live pricing page

`lib/billing/plans.ts` still ships these as visible bullets:

- **Brand Kit Plus** → *"Everything in **Starter**"*
- **Practice Suite** → *"Everything in **Practice**"*

A prospect reads "Everything in Starter" on a card called "Brand Kit Plus". The word
*Starter* appears nowhere else on the page.

**My tier-name sweep missed this and I can say exactly why.**
`app/__tests__/tier-names-in-metadata.test.ts` walks `join(ROOT, "app")` and checks
**metadata** — titles, descriptions, OG tags, email subjects. `lib/billing/plans.ts` is not
under `app/`, and feature bullets are not metadata. The guard I wrote was narrower than the
brief that asked for it ("every other page title, meta description, Open Graph tag, JSON-LD
offer and email subject that names a tier"). Visible body copy was never in its scope, and
it should have been.

### 5.2 The two pages describe two different funnels

- **Landing:** *"Answer a seven-step brief. Get three complete directions… Start my brief."*
  → brief first, reveal free.
- **Pricing FAQ, "What happens after I pay?":** *"You fill in a guided brief, we generate
  three creative directions, you pick one, and the full kit is built from it."* → brief
  after payment.

The code matches the landing page. The pricing FAQ describes a product that does not exist,
and it is the page a careful buyer reads hardest. Its three CTAs also jump straight to
`/app/checkout?plan=…`, i.e. **pay before seeing anything** — so the pricing page
simultaneously mis-describes the funnel and offers a route that skips the best thing Eklio
has.

### 5.3 Page counts disagree with each other

- Pricing, Brand Kit ($79): **"Website copy for 3 pages"**.
- The empty home screen, to a signed-in prospect: *"the copy for **four** pages"*.

### 5.4 "Every page you asked for… up to 8"

Practice Suite's tagline is *"Every page you asked for in the brief, including the blog"*;
its bullet is *"Website copy for every page you asked for, **up to 8**"*. If she asks for
nine, the tagline is false. Two sentences, same card, one contradicts the other.

### 5.5 Monthly Presence promises 12 posts to everyone

The pricing page sells **"12 social posts written in your voice"** and **"4 story
prompts"**. The generator writes `cadence × 4` posts — **4, 8 or 12** depending on the
cadence she chooses in preferences — and the number of `story` layouts falls out of register
rotation and the no-repeat rule; it is not fixed at four. A clinician on 1×/week gets four
posts and was sold twelve.

### 5.6 "Branded social template specs" vs "Branded social templates"

The card says **specs**; the comparison table on the same page says **templates**. Those are
different deliverables.

### ⚠ 5.7 The $39/month add-on is pre-checked — flagging, not deciding

`components/billing/checkout-form.tsx:43` — `useState(true)`. Monthly Presence is **ticked
by default** on the checkout for Brand Kit and Brand Kit Plus, and the pricing page says so
plainly: *"Added by default — keep it only if it earns its place."*

A pre-ticked recurring charge attached to a one-time purchase, sold to US consumers, is a
negative option. **This one needs a lawyer, not me** — FTC ROSCA and the Negative Option
Rule, and California's ARL, all have opinions about pre-selected recurring offers, express
informed consent and cancellation symmetry. I am flagging the mechanism and the exact line
of code; I am not judging whether it complies.

The mitigations already built are real and worth naming to whoever advises you: the
trial-ending notice ships and stamps only on confirmed delivery, the billing portal offers
`subscription_cancel`, and the pricing FAQ states the terms.

---

## 6. WHAT IS SLOW — measured

Production build, warm, served locally. Network latency to a real user is **on top of
these**; treat them as floors.

| Screen | TTFB | Load | Page height on a phone |
|---|---|---|---|
| `/` | 16 ms | **427 ms** | 916 px — **1.1 screens** |
| `/pricing` | 7 ms | 197 ms | 5 471 px — 8.2 screens |
| `/signup` | 7 ms | 104 ms | 664 px |
| `/login` | 16 ms | 113 ms | 664 px |

**Nothing on the public path is slow.** The one number that matters here is not a timing:
**the landing page is 1.1 screens tall.** A cold prospect scrolls once and is out of
content. There is no example of output, no sample kit, no before/after, nothing that shows
what $79 buys — the only proof of the product anywhere in the funnel is the `SAMPLE_PREVIEW`
mock, and it is on the **empty home screen**, behind the account wall, where only someone who
has already committed will ever see it.

### Mobile layout — measured

- **No horizontal overflow on any public page, at either phone width.** The LOT 11 mobile
  work held.
- **No console errors** on any public page.
- **Every primary call to action is 40 px tall** — 4 px under the 44 px minimum (WCAG 2.5.8,
  Apple HIG). That is "Start my brief", "Build my brand", "Get started" and all three
  "Choose …" buttons.
- **The header links are much worse:** "Pricing" is **45 × 22**, "Sign in" is **29 × 45**.
  Half the minimum in one dimension, at the top of the screen, where thumbs are least
  accurate.
- Smallest rendered text on the landing page is **11 px** ("FOR THERAPISTS IN PRIVATE
  PRACTICE").

---

## 7. MEASUREMENT — what exists today

> **You will not be able to answer "where did the other 197 go".** Not partially. At all.

**There is no analytics store.** `lib/analytics.ts` is 103 lines and its `track()` is:

```ts
console.info(`[analytics] ${event} ${JSON.stringify(properties)}`);
```

A structured log line. No table, no retention you control, no query. On Vercel, function
logs live for hours to a few days without a Log Drain configured. A week after the emails
land, the evidence is gone.

**And the funnel it covers starts after the hard part.** 39 event names exist; the earliest
is **`brief_started`**, emitted by `POST /api/briefs` — which only fires **after** signup,
after email confirmation, after landing on `/app`. Every step in §1 above is unmeasured:

| Step | Event today |
|---|---|
| Landing viewed | **none** |
| Pricing viewed | **none** |
| Signup started | **none** |
| Signup submitted | **none** |
| Confirmation email sent | **none** |
| Confirmation link clicked | **none** |
| Reached `/app` | **none** |
| `brief_started` | ✅ first event in the product |
| `brief_step_completed` | ✅ carries `step` |
| `brief_reviewed`, `generation_*`, `direction_chosen` | ✅ |
| **Checkout opened / completed** | **none** — `unlock_opened` is Monthly Presence only |

So the instrument covers the middle of the funnel and neither end. The two questions a cold
campaign actually asks — *how many landed*, and *how many paid* — have no event at all.

`purchases` and `subscriptions` are truth for the money, but they are an outcome table, not
a funnel: they cannot tell you what a payer did before paying, and they say nothing at all
about the 197.

**What is right about it and worth keeping in Session 2:** it is server-side, first-party,
single-writer, no vendor, no cookie, no banner — exactly the shape your Session 2
constraints ask for. The properties are already disciplined: ids, counts and machine reasons,
never free text, and the file says so in its own header. Session 2 is a **sink and a
schema**, not a rewrite.

---

## 8. WHAT I WOULD RANK FIRST — for Session 3, not now

Offered as a ranking, not as work. Ordered by where the walk says people are lost.

1. **The account wall in front of the brief.** Steps 2–7 of §1 exist to collect an email
   before anything is given. Everything else on this list is worth a few percent; this is
   worth a multiple.
2. **Email confirmation before the brief.** Even keeping the account, the off-site round
   trip at step 6 is the single break in the path.
3. **The landing page is 1.1 screens with no proof.** The product's best asset is a free
   reveal nobody can see.
4. **The signup error message** — a parser error on the first form is cheap to fix and
   embarrassing to ship into a campaign.
5. **The pricing page's contradictions** — retired tier names, the wrong funnel in the FAQ,
   12 posts, 3-vs-4 pages.
6. **Tap targets** — 40 px CTAs and 22 px header links, on a path that is phone-first.
7. **The required referral quote** — one blocking free-text box, four steps in, that nothing
   downstream needs.

Anything above the reveal costs a step before the free thing; that is where I would start,
and my ranking and your instinct agree on where the cliff is.

---

## APPENDIX — how this was walked

- `next build` + `next start -p 3110` against the production bundle.
- Chromium (pre-installed, `/opt/pw-browsers`) driven by `playwright-core`, installed in the
  session scratchpad — **not** added to `package.json`.
- `.env.local` written with the project's **publishable** anon key and URL only, plus a
  placeholder `RESEND_API_KEY` so the startup guard would let the server boot. `.env.local`
  is gitignored; nothing was committed.
- No production data was written. Two attempted signups (`walk-prospect*@example.com`, a
  domain reserved by RFC 2606 with no mail server) failed at the network before reaching
  Supabase; `auth.users` was checked afterwards and holds **0** such rows.
- Screenshots and raw measurements are in the session scratchpad, not the repo.


---

# §9 — THE SEVEN BRIEF SCREENS AT 390px

**Added in Session 2.** Rendered without a session at `/dev/brief-phone` — the real step
bodies in the real shell, from a fixture catalogue built to the live catalogue's measured
counts and longest labels. Measured in Chromium at iPhone 13 (390×844).

> **The headline: the brief does not assume a desktop.** Zero horizontal overflow on all
> seven steps, zero page errors. Everything below is a second-order problem, and none of it
> invalidates the rest of the chantier.

| Step | Height | Screens | Overflow | Taps < 44px | Text < 14px |
|---|---|---|---|---|---|
| 1 Practice | 1 612 px | 2.4 | 0 | **22** | 3 |
| 2 Positioning | 2 314 px | 3.5 | 0 | 2 | 3 |
| 3 Ideal client | 1 655 px | 2.5 | 0 | 0 | 3 |
| 4 How you work | **3 572 px** | **5.4** | 0 | 11 | 3 |
| 5 Voice | 1 311 px | 2.0 | 0 | 0 | 9 |
| 6 Look | 1 689 px | 2.5 | 0 | 0 | **20** |
| 7 Website | 1 612 px | 2.4 | 0 | 10 | 2 |

## 9.1 Step 4 is five and a half screens, and it is the one with the blocking free text

**How you work** is 3 572 px on a phone — more than twice step 5, and 60% taller than the
next-worst. It carries four card grids (8 session styles, 8 not-a-fit, **14 modalities**, 3
prominence options), a free-text box, and the prior-career fields.

It is also the step that will not let her past without composing a sentence in a colleague's
voice (§3, the referral quote). Five and a half screens of scrolling ending in the hardest
question on the path is where a thumb stops.

## 9.2 Every chip in the brief is 34 px tall

Not a step-specific defect — a component one. Licence chips, not-a-fit chips, primary-action
chips, modality chips: all **34 px**, 10 px under the 44 px minimum (WCAG 2.5.8, Apple HIG).
Step 1 alone has 22 of them, because there are ten licence types and twelve specialties.

They are wide enough (57–342 px); it is height alone. One padding change in the chip
component fixes every one of them, which is why this is cheap and worth doing before a
phone-first campaign.

`"Write it for me"` on step 2 is worse at **91 × 22** — a quarter of the minimum area, and
it is the affordance that rescues someone stuck on the free-text question.

## 9.3 The 11px text is the mono label, and mostly that is a design decision

The `MonoLabel` eyebrow and the "Step N of 7" counter render at 11 px on every step. Small,
but uppercase mono at tracking — a label, not prose — and consistent with the design system.
I would leave it.

The one I would not leave is **step 6**, where 20 items fall under 14 px because the palette
family names (`PLUM & BONE`, `CLAY & SAND`) use the same 11 px mono. That is the screen
where she is choosing between six colour families by name, on a phone, and the name is the
smallest text on it.

## 9.4 A null preview crashes step 6, and only the type knows

`StepBodyProps.preview` is typed `PreviewModel | null`. `components/preview/cards.tsx:41`
does `{ ...model.tokens, ...family.preview_tokens }` with no guard, so a null preview throws
`Cannot read properties of null (reading 'tokens')` and step 6 renders nothing.

Found by passing `null` to build this preview page, which is what the type says is allowed.
In production `brief_preview()` has always returned a model, so nothing has ever reached it
— but the type and the code disagree, and the type is the one a future caller will read.
Not patched: this session's four fixes were named, and this is not one of them.

## 9.5 How to look at it yourself

`/dev/brief-phone` — linked from nowhere, reads no database, calls nothing, and says
**Fixtures — nothing here is real** at the top. All seven bodies on one page, interactive,
so a filled-in state can be measured as well as an empty one.


---

# §10 — THE FIVE MOBILE FIXES, MEASURED BEFORE AND AFTER

Same harness as §9: `/dev/brief-phone`, Chromium, iPhone 13 (390×844).

| Step | Height before | after | Taps < 44px before | after |
|---|---|---|---|---|
| 1 Practice | 1 612 px | 1 692 px | **22** | **0** |
| 2 Positioning | 2 314 px | 2 357 px | 2 | **0** |
| 3 Ideal client | 1 655 px | 1 655 px | 0 | 0 |
| 4 How you work | **3 572 px** | **2 749 px** | 11 | **0** |
| 5 Voice | 1 311 px | 1 311 px | 0 | 0 |
| 6 Look | 1 689 px | 1 709 px | 0 | 0 |
| 7 Website | 1 612 px | 1 692 px | 10 | **0** |

**Targets under the touch minimum: 45 → 0.** Step 4: **5.4 screens → 4.1**, a 23% cut.
Still no horizontal overflow, still no page errors.

The other steps grew 40–80 px, which is the chips getting their 10 px back. That is the
trade and it is the right way round: a page that scrolls slightly further beats a target a
thumb misses.

## What changed

1. **The referral quote no longer blocks.** It was the only blocking free-text requirement
   in the brief, at the end of the longest step. `lib/generation/how-you-work-context.ts`
   already read it conditionally — nothing downstream ever needed it. The screen now says
   *Optional* and *"Skip it and we write from everything above."*
2. **The long tail folds.** Modalities show 6 of 14, session styles 4 of 8, not-a-fit 4 of
   8, each behind one *Show N more*. **A card already chosen always stays visible**, wherever
   it sits in the list — folding over a selection would hide it without deselecting it, a
   state nothing on screen would explain.
3. **Every chip is 44 px**, via `min-h` rather than `h`, so a long label wraps instead of
   clipping. Same change to the segmented control and the hand-rendered not-a-fit buttons.
4. **`tertiary` has a hit box** — `min-h-[44px]` and horizontal padding, with a matching
   negative margin so nothing shifts but the target. That is *Write it for me*, *Use my
   original*, and the prior-career disclosure, which was the last one left at 216 × 22.
5. **The palette names are `text-ui`, not 11 px mono.** Caps and tracking kept; only the
   size changed.
6. **Step 6 cannot crash on a null preview.** `components/preview/cards.tsx` now types
   `model` nullable — as its call site always was — and falls back to `SAMPLE_PREVIEW`. The
   swatches come from `family` and are right either way.


---

# §11 — THE BRIEF RUNS WITHOUT AN ACCOUNT

**Session 2.** The wall in §1 is down. What follows is what to know before the emails land.

## 11.1 What a stranger now does

| # | Then | Now |
|---|---|---|
| 1 | Land on `/` | Land on `/` |
| 2 | Tap "Start my brief" → **`/signup`** | Tap "Start my brief" → **step 1 of the brief** |
| 3 | Type an email | — |
| 4 | Type a password | — |
| 5 | Submit → "check your email" | — |
| 6 | **Leave the site, find the mail, come back** | — |
| 7 | Tap "Start my brief" *again* | — |

**Five steps and one off-site round trip removed before the first question.** She is asked
for an email address at the end of the brief and again at the reveal, as an offer she can
ignore.

## 11.2 The one that guards everything: token isolation

`projects.user_id` is nullable; a row can be owned by the SHA-256 of a token instead. The
browser sends the plaintext in `x-anon-token`, `public.anon_token_hash()` hashes it, and
every policy compares hashes — **the plaintext exists only in the cookie**, so a stolen dump
hands nobody a working session.

Proven in `20260910192157_anonymous_briefs.test.sql`, against the live database:

- Alice's token sees exactly one project and one brief: hers.
- **Bob's token cannot read or write Alice's brief**, even naming its id directly.
- **No token sees nothing.** Not incidental: null never equals anything, which is why a
  claimed row carries `null` and not `''`. A naive comparison would have shown every claimed
  project in the table to every visitor with no cookie.
- An **expired** brief is refused by the policy, before any purge runs.
- A token holder **cannot claim** her own brief from the browser, and cannot hand it to
  another token. Both raise `42501` rather than updating zero rows.

## 11.3 Expiry and purge — **30 days**

`projects.anon_expires_at`, enforced in the policy and swept by `/api/cron/anon-briefs`
(daily, 05:00 UTC, **armed** — it spends nothing).

**Why 30:** it is already the answer to *"how long does Eklio keep something nobody
claimed"* — `purge-deleted-kits` uses the same window for soft-deleted kits. One number is
easier to reason about, easier to state in a privacy notice, and harder to get wrong than
two. It is also exactly the life of the cookie that points at the row, so nothing survives
that could still be reached and nothing reachable is deleted.

The purge repeats its filter on the `DELETE` as well as the `SELECT`: between the two, a row
can be claimed by someone signing up, and deleting the brief of a person who has just made
an account is the worst thing that route could do.

## 11.4 Coming back three days later

**If the cookie survives** she lands on her brief at the step she reached — `progress_step`
is canonical and always was. That is retention for free, and it now happens without an
account.

**If the cookie is gone** — a different phone, a cleared browser, a private tab — the brief
is unreachable forever. That is where the email belongs, and it is the only place the
anonymous path asks for one:

> *"We'll email you one link. No account, no list — it just means a new phone or a cleared
> browser doesn't lose your work."*

Offered at the end of the brief and again at the reveal. It creates no account, subscribes
her to nothing, and **the address is not stored** — it goes to the transport and is gone.
Keeping it would turn a favour into a list, and this product has not asked her about a list.

`/brief/resume?t=…` writes the cookie and **redirects immediately to a clean path**, so the
token does not sit in her history, a screenshot, or a `Referer`. Opening the link does
**not** extend the deadline — a link that renewed itself would be the row that never
expires. Expired, purged and already-claimed all land on one screen, because the difference
is not something she can act on and naming it would say something about a brief that may not
be hers.

## 11.5 The spend guard — the shipped values

> ⚠ **This section was wrong when first written.** Its prose said global 150 and per-IP 3;
> its worked SQL example said 400 and 5. Below are the values actually in
> `public.app_settings` in production, read back from the live database, and the example
> carries those same numbers. Nothing here is illustrative.

Five rows in `app_settings`, checked and incremented in **one statement** by
`consume_anon_generation` — two statements would let two concurrent requests both read
"149 of 150", and a generation once started is money already spent. A refused per-IP attempt
**gives the global count back**, so one visitor refreshing cannot eat the day's ceiling for
everyone. **A missing or unreadable setting is "no", never "unlimited".**

| Row | Shipped value | What it counts | Why that number |
|---|---|---|---|
| `anon_generation_enabled` | **true** | both kinds | The kill switch. One switch, both ceilings |
| `anon_generation_daily_per_ip` | **3** | reveals, per hashed IP | Enough for a false start and a retry; a fourth in one day from one address is not a prospect |
| `anon_generation_daily_global` | **150** | reveals, everyone | ≈ $13/day at the measured realistic cost; see §12.3 |
| `anon_assist_daily_per_ip` | **45** | assists, per hashed IP | 15 per brief × the 3 briefs an IP may run. One short of the 17 she could physically press |
| `anon_assist_daily_global` | **750** | assists, everyone | 5 per reveal — the ratio a real population produces, measured |

Read them back yourself, any time:

```sql
select key, value from public.app_settings
 where key like 'anon\_%' order by key;
```

**If the numbers are wrong on the morning the emails land**, this is the edit — seconds, no
deploy, no build. The values below are the ones currently live, so pasting this block
unchanged is a no-op rather than a surprise:

```sql
-- Turn it off entirely. Closes BOTH kinds; nothing anonymous calls the model after this.
update public.app_settings set value = 'false'::jsonb
 where key = 'anon_generation_enabled';

-- Or move a ceiling. These four statements restate what is shipped today.
update public.app_settings set value = '150'::jsonb
 where key = 'anon_generation_daily_global';
update public.app_settings set value = '3'::jsonb
 where key = 'anon_generation_daily_per_ip';
update public.app_settings set value = '750'::jsonb
 where key = 'anon_assist_daily_global';
update public.app_settings set value = '45'::jsonb
 where key = 'anon_assist_daily_per_ip';
```

⚠ **Move the two global rows together.** They are one budget expressed twice: raising
reveals without raising assists starves the screens that lead to a reveal, and raising
assists alone buys nothing. The ratio is 5 assists per reveal (§12.2).

The counter resets by date, so raising a ceiling mid-day immediately admits whatever the new
number allows. Today's usage — reveal buckets are bare, assist buckets carry an `assist:`
prefix:

```sql
select bucket, used from public.anon_generation_counters
 where day = (now() at time zone 'utc')::date
 order by used desc limit 20;   -- '@global' and 'assist:@global' are the day's totals
```

**The IP is hashed with the date as salt** — enough to recognise a repeat visitor within a
day, useless the day after. A raw IP is personal data and this audience is reached from
France.

## 11.6 Two decisions I took and would flag

**The token's signature is advisory.** `ANON_TOKEN_SECRET` is optional: when it is set,
forged tokens are rejected without a database round trip, which matters because this cookie
sits in front of the spend path. When it is **absent**, verification is skipped and tokens
still work. As a hard startup requirement it would take the landing page down (§4.5); as a
hard check it would invalidate every outstanding cookie the moment the secret rotated,
losing every brief in flight. The database is the authority either way. **Setting it is
worth doing before launch; forgetting it is not an outage.**

**Email confirmation is out of the critical path without changing a Supabase setting.**
`signUp` returns the new user's id even when confirmation is on and no session is issued —
so the claim happens at signup, and her brief is attached to her account whether she is let
straight in or has to confirm first. Turning confirmation **off** in Supabase Auth is still
worth doing (she would land straight back on her work rather than on "check your email"),
but nothing is lost if you leave it on.

## 11.7 What stayed shut

`reachableWithoutAccount` opens exactly four patterns: the brief, its review, its positioning
screen, and the reveal. **The paid kit sections are not among them** — `/assets`,
`/site-editor`, `/handoff`, `/delivered` still require a session, because an account is the
only thing a purchase can attach to. A test enumerates both lists.

And letting a request through is not the same as letting it see something: every one of
those four resolves its caller and reads through RLS, where a request without a matching
token reads nothing.

---

# 12. THE WALL WENT UP IN FRONT OF A FORM THAT SAVED NOTHING

Written after the commit above, from a survey of `app/api/briefs/**` rather than from
memory. Two things were true at once, and neither showed up in `tsc`, in `next build`, in
eslint, or in 2,220 passing tests.

## 12.1 Six of nine routes still demanded an account

`POST /api/briefs`, `generate` and `email-link` were converted. The other six were not.
For a visitor with no account, that is what she met:

| Route | What she was doing | What she got |
|---|---|---|
| `PATCH /api/briefs/[id]` | **every keystroke — the autosave** | 401 |
| `POST /api/briefs/[id]/suggest` | "Write it for me" | 401 |
| `POST /api/briefs/[id]/rephrase` | "Help me say it" | 401 |
| `POST /api/briefs/[id]/tone-cards` | step 5 entire | 401 |
| `POST /api/briefs/[id]/usp-options` | the positioning screen | 401 |
| `POST /api/briefs/[id]/usp-confirm` | choosing her positioning | 401 |

The first line is the one that matters. The wall came down in front of a seven-step form
that **could not retain a single answer** — she would have typed her practice's name, seen
a save error, and left. The mobile work of the previous commit made "Write it for me"
tappable; it 401'd when tapped.

Every one of those files read correctly on its own. The defect was in what had **not** been
written, in three files nobody had reason to open. That is the class of thing a
source-walking test catches and a behaviour test cannot, so there is now one:
`app/api/briefs/__tests__/anonymous-surface.test.ts` walks the directory and asserts that no
route under `app/api/briefs` calls `authenticate()`, that all eight brief-reading routes
resolve the caller, and that the set of routes calling the model equals a declared list —
every member of which must consume a count. Nine files enumerated (anti-vacuous), one canary
proving the rule bites.

## 12.2 Four of five model calls were outside the spend ceiling

The same six routes include four that call the model. The ceiling shipped with `generate`
guarded `generate` alone.

Counting them against the **same** ceiling would have been worse than leaving them out: the
per-IP ceiling is 3, one honest brief spends about five assist calls, and her own first
brief would have refused her own reveal. So `consume_anon_generation` now takes a second
argument — `reveal` spends the ceilings it always did, `assist` spends a new pair under an
`assist:` bucket prefix. The reveal rows keep meaning exactly what they meant.

## 12.3 What one free reveal actually costs — measured

Not a range. Measured from the **production prompt builders** — `ETHICS_SYSTEM_RULES`, the
generation tool schema, `systemPrompt()`, `REPHRASE_SYSTEM_PROMPT`, `buildBriefContext` —
with each call's own `max_tokens` read from source. Prices are `claude-opus-5`: **$5.00 in
/ $25.00 out per MTok**.

| Call | in (tok) | out ≤ | realistic | worst |
|---|---|---|---|---|
| `suggest` — "Write it for me" | 1,698 | 1,000 | $0.0093 | $0.0335 |
| `rephrase` — "Help me say it" | 295 | 1,000 | $0.0030 | $0.0265 |
| `tone-cards` — step 5 | 1,158 | 2,000 | $0.0120 | $0.0558 |
| `usp-options` — positioning | 1,492 | 2,000 | $0.0158 | $0.0575 |
| `generate` — three directions | 2,803 | 8,000 | $0.0376 | $0.2140 |

"Realistic" is the schema's own output bounds — three directions plus voice guide and social
is ~3,400 characters, not 8,000 tokens. "Worst" is every response filling its ceiling.

**One visitor's whole walk — the free tier, three directions plus one regeneration, with
every assist she can reach:**

| | realistic | worst |
|---|---|---|
| assist calls | $0.0495 (5 presses) | $0.6578 (17 presses) |
| the reveal itself | $0.0376 (1 run) | $0.4280 (1 run + 1 regeneration) |
| **total** | **$0.0871** | **$1.0858** |

**One number, if you want one: 8.7 cents.** That is what a visitor who walks the whole
thing costs. $1.09 is what one determined person can reach by pressing every button its
maximum number of times and having every response fill its token ceiling — it is the
per-person catastrophe number, and the per-IP ceiling is what makes it unreachable at scale.

The $0.09–1.80 range I gave before was not wrong at the ends; it was useless because it
never said which end was the one to budget with.

## 12.4 The global cap, set from a daily budget

The budget instrument is the **global** pair, and it should be set from the realistic cost
— a ceiling against loss, as you put it, not against catastrophe. The per-IP pair is the
catastrophe instrument and is already tight.

| Daily budget | `anon_generation_daily_global` | `anon_assist_daily_global` | Realistic day | Worst day anyone could construct | Distinct IPs needed to construct it |
|---|---|---|---|---|---|
| **$10** | **114** | **570** | $9.93 | $46.45 | 38 |
| **$30** | **344** | **1,720** | $29.95 | $140.17 | 115 |
| **$100** | **1,148** | **5,740** | $99.96 | $467.79 | 383 |
| *shipped today* | *150* | *750* | *$13.06* | *$61.12* | *50* |

Read the last two columns together. The worst-case column assumes every visitor is
adversarial and every response fills its ceiling; the column beside it says how many
**distinct IP addresses** that would take, because the per-IP ceiling (3 reveals, 45
assists) caps any one address at **$2.38 a day**. A $100 budget is only a $468 exposure if
383 separate machines each spend the day grinding your free tier.

What is shipped sits between your $10 and your $30. To move it, edit the two global rows in
§11.5 together — reveals and assists at 1:5.

## 12.5 What is still not measured

Every figure above is arithmetic on measured prompt sizes, not billed usage: no request has
been made to the Anthropic API from this environment, and `ANTHROPIC_API_KEY` is still
absent. The input character counts are exact and read from source; `BRIEF_CONTEXT` (1,800
chars) and the six catalogue ethics rules (840 chars) are measured shapes rather than exact
strings, and the characters-per-token ratio is stated as 3.6, not measured. **The first
real invoice is the only thing that settles this**, and it should be compared against
$0.0871 × the number of reveals that day.

---

# 13. SESSION 3 — THE INSTRUMENTATION

One first-party, server-side event model, from first landing to paid kit. Named steps, one
table, one writer, and one way to read it that is not a SQL prompt at midnight.

## 13.1 What was there, and what it was worth

`lib/analytics.ts` was right about everything except where it put the data: server-side,
first-party, single-writer, no vendor, no cookie, no consent banner, properties disciplined
to ids and machine reasons. And then:

```ts
console.info(`[analytics] ${event} ${JSON.stringify(properties)}`);
```

On Vercel, function logs live hours to days without a Log Drain. A week after the emails
land, the evidence is gone. So this was a **sink and a schema**, not a rewrite — the file's
judgement was kept and its destination replaced.

## 13.2 The store

| | |
|---|---|
| `public.funnel_events` | one table, RLS deny-all, **no foreign keys** — an event is a fact about the past, and the 30-day anonymous purge must not erase the record that a hundred people started a brief |
| `public.funnel_steps` | the named funnel in order, so renaming or inserting a step is a row rather than a deploy |
| `record_funnel_events(jsonb)` | the one writer, service-role only |
| `funnel_report(from, to)` | the one reader |
| `purge_funnel_events()` | 180 days, from `app_settings` |

**"No content of her answers" is now a mechanism rather than a comment.**
`funnel_props_are_safe` is a CHECK on the column: flat object, at most 12 keys, no nesting,
no string over 64 characters. A new call site cannot forget it, and the migration proves it
bites on five shapes rather than asserting that it does. `safeProps` in the frontend mirrors
the same thresholds so a bad payload is trimmed rather than losing the whole event to a
constraint error.

**The retention purge fails *open*** — the opposite of the spend ceilings, deliberately. An
unreadable setting keeps the data. Fail towards the outcome you can still undo: a day of
unpurged rows costs storage, a day of wrongly purged rows costs the only copy.

## 13.3 How a visitor is followed, and how far

Two keys, both already in the product, **neither of them cross-site**:

- **`visitor_day`** — the same daily-salted IP hash the spend ceilings use. It joins landing
  → pricing → the start of the brief. **No cookie was added for this**, and it is useless
  the next day by construction.
- **`project_id`** — from the first brief answer onward, and it survives signup. This is the
  column that follows one person end to end.

⚠ **And its limits, stated wherever the numbers appear.** Two people behind one office
router are one `visitor_day`. One person who starts on cellular and finishes on wifi is two.
A walk that crosses midnight UTC is two. **Counts of events are exact; counts of visitors
are an estimate**, and both the SQL comment and the reader's footnote say so.

## 13.4 The named funnel

| # | Step | Event | Phase |
|---|---|---|---|
| 1 | Landed on the site | `landing_viewed` | reach |
| 2 | Looked at pricing | `pricing_viewed` | reach |
| 3 | Started the brief | `brief_started` | brief |
| 4 | Finished "How you work" | `brief_step_completed` where `step = 4` | brief |
| 5 | Reached the review | `brief_reviewed` | brief |
| 6 | Pressed generate | `generation_started` | reveal |
| 7 | Saw three directions | `generation_succeeded` | reveal |
| 8 | Submitted the signup form | `signup_started` | account |
| 9 | Created an account | `account_created` | account |
| 10 | Opened checkout | `checkout_opened` | paid |
| 11 | Paid | `purchase_completed` | paid |
| 12 | Chose a direction | `direction_chosen` | paid |

Six of these events did not exist before this session. Step 4 is why `funnel_steps` carries
`match_prop`/`match_value`: one event name holds several milestones, and finishing step 2 of
the brief is not a named step of the funnel while finishing step 4 is.

**Step 12 was originally seeded at position 8 and it was wrong.** Reading
`lib/reveal/use-select-direction.ts` — `if (!paid) { router.push(checkoutHref); return; }` —
an unpaid visitor pressing a direction never reaches the route at all. Choosing is how she
takes delivery of something already bought. Left at 8, the report would have shown a cliff
between "saw three directions" and "chose a direction" and sent someone to fix a step that
works exactly as designed, while hiding the two steps that actually stand between her and
paying. **A funnel in the wrong order does not fail loudly; it points at the wrong thing
forever.** Corrected in `20260910212828`.

## 13.5 The beacon, and the one decision I took

The first two steps are the landing page and the pricing page. **Both are static**, and they
are the two pages a cold-email campaign hits hardest. Emitting from the server component
would make them dynamic — paying for the measurement with the thing being measured.

So `POST /api/e` exists, and it is **the only place in this product where an event starts in
the browser**. What makes that acceptable is that its vocabulary is closed:

- two event names, `landing_viewed` and `pricing_viewed`, and nothing else;
- **no properties, no ids, no free text** — the body is one word;
- **no cookie read or written**, nothing stored in the browser;
- everything the row knows about who sent it — the daily-salted IP hash — is derived on the
  server from the connection, so a caller cannot claim to be anyone;
- rate-limited, and it answers `204` whatever happens.

The alternative considered and rejected was emitting from the proxy: it runs on every
request, including ones that render nothing, and would put a database write on the latency
path of the page people are arriving at. **The build output confirms `/` and `/pricing` are
still `○`.**

## 13.6 One way to read it

```
npm run funnel                    # the last 7 days
npm run funnel -- --days 1        # today so far
npm run funnel -- --from 2026-10-01 --to 2026-10-08
```

Ordered named steps, grouped by phase, with `events` / `visitors` / `projects`, share of the
first step, share of the previous step, and a bar. **The arithmetic lives in
`funnel_report`, never in the script**: two definitions of "conversion" would eventually
disagree, and the one you were not reading would be the one you believed.

**There is no screen, and that is the constraint, not an omission.** It is Eklio's data
about Eklio's funnel, not the practitioner's, and the moment a number from it appears in the
product it stops being measurement and becomes a claim about other people. A test walks
`app/**` and fails if any file so much as names `funnel_events`, `funnel_steps` or
`funnel_report` — with one named exemption, the retention cron, which deletes and never
reads.

## 13.7 Four things this turned up that I was not looking for

**1. Two *client* components were importing the server-only writer.**
`components/kit/asset-library-view.tsx` and `components/kit/in-situ/in-situ-panel.tsx` both
imported `@/lib/analytics`, whose header has read "SERVEUR UNIQUEMENT" since day one. It
compiled, because while `track()` was only a `console.info` nothing distinguished a server
call from a browser call. So `asset_filtered`, `asset_detail_opened` and
`asset_insitu_viewed` were being written to **the practitioner's own devtools console** and
nowhere else. `next build` only said so the moment `track()` opened a Supabase client.

They now use `lib/analytics-client.ts`, which does exactly what they always did and says so
in its name. **A phrase in a header comment is not a boundary**; there is now a test that is
one. None of the three is a funnel step — they describe what a paying customer does with her
asset library, not how someone becomes a customer — so nothing was lost by keeping the
behaviour identical.

**2. `cookies()`/`headers()` inside `after()` throw in a Server Component.** Documented in
`next/dist/docs/01-app/03-api-reference/04-functions/after.md`, and `checkout_opened` is
emitted from exactly such a component. Read inside the callback it would have thrown, been
swallowed by the sink's own catch, and left **funnel step 10 reading zero forever** — a
measurement bug that would have looked like a product finding. The request context is now
read in the caller's scope and passed in, which is the shape the docs prescribe.

**3. A module-level event buffer would have been a correctness bug, not an optimisation.**
One warm serverless instance serves many requests; a shared array drained on a timer would
stamp whichever request happened to flush onto every event in it, so **one visitor's IP hash
would land on a stranger's event**. One `after()` per event instead — each callback runs
inside its own request, which is exactly why `headers()` can be read there and be right.

**4. The sink reaches `service_role`, and `track()` is imported nearly everywhere.**
`lib/site/__tests__/routes.test.ts` walks the import graph and went red across seven entry
points. Exempted **by name**, with the four properties that make it safe — calls none of the
eight contract RPCs, writes only `funnel_events`, never reads, and receives no
caller-supplied identifier — and a note to delete the exemption if any of them stops
holding. Hiding it behind a dynamic import would have been gaming the guard rather than
respecting it.

## 13.8 What this still cannot tell you

- **Where a visitor came from.** No referrer, no campaign parameter, no UTM. A cold-email
  campaign to a known list does not need one to count arrivals; two campaigns in one week
  would. It is a column and a beacon field away, and it is not there yet.
- **Why she left.** The funnel says which step lost her, never what she was looking at when
  she decided. That is what §9's phone rendering is for.
- **Anything about a person.** By construction: no word she wrote can be in the table, no
  identifier follows anyone across a site boundary, and the visitor key is meaningless
  tomorrow.
- **Whether any of it is wired correctly in production.** Nothing has been deployed. The
  first thing to do after the first deploy is walk the brief once and run `npm run funnel
  -- --days 1`: twelve steps, and the ones you touched should be non-zero.
