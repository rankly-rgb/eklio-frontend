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
