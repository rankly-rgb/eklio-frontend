# PREVIEW_CHECKLIST.md

A literal runbook for verifying Lot 4.1–4.4's asset renderer on a deployed Vercel preview, from a
browser — no interpretation required, just what to click/type and what to write down. Written because
this sandbox cannot reach the preview URL at all (an organization-level network policy blocks outbound
web access here, confirmed against the proxy's own status endpoint — not a Vercel deployment-protection
thing, and not something to route around).

**Scope.** This file covers the browser half only: signing in, the brief, direction selection, and the
two asset renders. The database half (the `brand_assets` row, the object's real path in `brand-assets`,
and the cross-kit RLS refusal) is being verified separately, directly against the live project — nothing
here duplicates that.

**Credentials.** Use them only in the browser session. Do not paste them into this file, a commit, a test
fixture, or anywhere in either repo.

---

## Before you start

Open the browser's DevTools (F12 or Cmd+Opt+I) and keep two tabs of it visible throughout: **Network**
and **Console**. Every step below tells you which one to look at.

---

## Part 1 — Sign in

1. Go to the preview URL, then to `/login`.
2. Sign in with the test account's email and password.
3. **Write down:** did sign-in succeed and land you on `/app`? (yes/no)

---

## Part 2 — Start the brief and select a direction

1. On `/app`, click **"Start my brief"**.
   - This does `POST /api/briefs`, then takes you to `/app/briefs/<project-id>`. Note that
     `<project-id>` from the URL bar — you won't need it again, but it confirms the POST worked.
2. Fill in the 7 steps with any plausible test content — a real practice name matters (it's baked into
   the rendered wordmark), the rest can be anything reasonable. Use the app's own flow; nothing here
   should require guessing at fields you can just see on the page.
3. At the end of the brief, generation runs (tone cards, USP options, then the three directions — this
   calls a real LLM and spends real generation credits, which is what the 200-credit comp grant is for).
   Wait for the three directions to appear.
4. Pick one direction.
   - In the **Network** tab, find the request this makes: `POST /api/brand-kits/<kit-id>/direction`.
   - **Write down** its status code and body. Healthy looks like:
     ```
     200
     {"selectedDirectionId": "<some-id>"}
     ```
   - You should land on `/app/brand-kits/<kit-id>`. **Copy `<kit-id>` from the URL bar — you need it for
     everything below.**

### What this step alone already proves

If you're looking at the kit page with a `200` on that direction request, the font-cache warming hook
(`after()` in `app/api/brand-kits/[id]/direction/route.ts`) did not break selection — whether it
succeeded or failed internally, `after()` runs *after* the response is already sent, so a `200` here is
already the answer to "did the warming hook stop the selection." **Write down: 200 was returned, so
selection was not blocked.**

To know whether the warming itself *succeeded* (not just that it didn't break anything) needs the
platform's own logs, not the browser:

5. *(Optional, needs Vercel project access)* Open the Vercel dashboard → this deployment → **Functions** →
   find the invocation for `/api/brand-kits/[id]/direction` around the time you selected a direction.
   Look for either nothing unusual (warming succeeded silently, or hasn't logged yet), or a line starting
   with `[kit/render] could not schedule font-cache warming` or `[kit/render] font cache warm failed`
   (warming was attempted and failed, but was caught — selection still succeeded either way, which is the
   point of that log line existing). **Write down which, if you have access to check.**

---

## Part 3 — Render `wordmark_svg_dark` (this is the cold one)

**Why this call is guaranteed cold:** this is a fresh Vercel preview deployment — no request has ever hit
this route on this deployment before yours, so no lambda instance for it exists yet. Your first call
below is, by construction, a genuine cold start. You don't need to wait for anything or guess about an
idle timeout.

1. Stay on `/app/brand-kits/<kit-id>` (or any page on the same site — the call needs to be same-origin so
   your session cookie goes with it).
2. Open the **Console** tab and run:
   ```js
   const kitId = "<kit-id>"; // paste the id from Part 2
   const t0 = performance.now();
   const res = await fetch(`/api/brand-kits/${kitId}/assets/wordmark_svg_dark`, {
     method: "POST",
     credentials: "include",
   });
   const body = await res.json().catch(() => null);
   console.log("status:", res.status, "took:", Math.round(performance.now() - t0), "ms");
   console.log(body);
   ```
3. **Write down:**
   - the status code
   - the full `body`
   - the "took: N ms" number — **this is your cold-render timing. Reset `maxDuration` in
     `app/api/brand-kits/[id]/assets/[key]/route.ts` from this number, not the ~600ms sandbox one** (see
     that file's comment on `maxDuration` for how the current value was reasoned).

**Healthy response** (status 200):
```json
{ "url": "https://fobgdsupyfslxbswfuay.supabase.co/storage/v1/object/sign/brand-assets/<kit-id>/<fingerprint>/wordmark_svg_dark.svg?token=..." }
```

If you got that: **`@resvg/resvg-js` loaded on Vercel.** Trimming to ink bounds (Lot 4.4's decision) runs
through resvg's `innerBBox`/`cropByBBox` for *every* identity asset now, including this SVG one — so this
one call already answers the question that mattered most, even before you touch the PNG asset in Part 4.

If it is not healthy, see **"What a resvg failure looks like"** below before concluding anything.

---

## Part 4 — Render `wordmark_png_dark`

Same shape, different key:

```js
const kitId = "<kit-id>";
const t0 = performance.now();
const res = await fetch(`/api/brand-kits/${kitId}/assets/wordmark_png_dark`, {
  method: "POST",
  credentials: "include",
});
const body = await res.json().catch(() => null);
console.log("status:", res.status, "took:", Math.round(performance.now() - t0), "ms");
console.log(body);
```

**Write down** status, body, and timing, same as Part 3. This call may land on the same warm lambda
instance Part 3 used (faster) or a different cold one (Vercel's routing decides that, not you) — either
number is useful, just note which you think you're looking at.

**Healthy response** (status 200):
```json
{ "url": "https://fobgdsupyfslxbswfuay.supabase.co/storage/v1/object/sign/brand-assets/<kit-id>/<fingerprint>/wordmark_png_dark.png?token=..." }
```

---

## Part 5 — Confirm the manifest short-circuit (no separate manifest route exists)

There is only one route — it does the manifest check, the render, and the upload all in one call. The
way to *observe* the manifest working is to call the same key again and watch it skip straight to a
signed URL instead of re-rendering:

```js
const kitId = "<kit-id>";
const t0 = performance.now();
const res = await fetch(`/api/brand-kits/${kitId}/assets/wordmark_svg_dark`, {
  method: "POST",
  credentials: "include",
});
console.log("status:", res.status, "took:", Math.round(performance.now() - t0), "ms");
console.log(await res.json().catch(() => null));
```

**Write down** the timing. It should be noticeably faster than Part 3's number — no satori, no resvg, no
Storage upload, just a manifest lookup (`get_brand_asset_manifest`, sees `current: true` for this
fingerprint) and a fresh `createSignedUrl`. If it's just as slow as Part 3, that's worth flagging — it
would mean the manifest isn't finding the row it should.

---

## Part 6 — Download and inspect both files

For each of the two `url` values from Parts 3 and 4:

1. **Byte size:** open the URL directly in a new browser tab. In DevTools **Network** tab, find that
   request and read the **Size** / **Content-Length** column. Write it down per file.
2. **Dimensions:** in the Console, run (paste the actual signed URL):
   ```js
   const img = new Image();
   img.onload = () => console.log(`${img.naturalWidth} x ${img.naturalHeight}`);
   img.onerror = () => console.log("failed to load as an image");
   img.src = "<paste the signed url here>";
   ```
   This works for both the PNG and the SVG (browsers render SVGs as images too). **Write down** both
   dimensions.
3. Look at the image itself. **Write down:** does it show the practice name you entered, in a serif
   display font, trimmed tight with no padding around the letters (Lot 4.4's trim decision)? A wordmark
   with a lot of empty margin around it would mean the trim isn't taking effect on the deployed build even
   though it works locally — worth flagging on its own.

---

## What "resvg loaded" looks like from the outside

Two different failure shapes, and they mean different things:

- **A clean `500` with valid JSON**, body:
  ```json
  { "error": "Something didn't go through on our side. Your answers are saved." }
  ```
  This means the route ran, something inside the `try/catch` around rendering threw, and it was caught.
  This is what a resvg error *during a render call* looks like from the browser — the real cause is only
  in Vercel's function logs, under a line starting with `[api] assets:render`. **This is what to check
  the logs for if you see this shape.**

- **Anything that is NOT valid JSON** — the browser console showing a JSON-parse error on `res.json()`,
  or the Network tab showing an HTML error page instead of your app's response, or a Vercel-branded crash
  page/error id. This means the failure happened *before* my code's own error handling could run — most
  likely `@resvg/resvg-js` failing to load as a native module at all, which happens at import time, not
  inside any try/catch. **This is the "resvg genuinely doesn't work on Vercel" signature**, and unlike the
  clean 500 above, it would happen on literally the *first* call, every time, not intermittently.

**A slow-but-successful cold start is neither of these** — it still ends in the healthy `200` response
shown in Parts 3/4, it just takes longer (up to `maxDuration`, currently 15s). Don't read "it took 6
seconds" as a failure; read "it never returned, or came back red" as one. If a call runs past 15 seconds
with no response, that's a timeout, not a crash — the browser will typically show a `504` or the request
just hanging past that mark; that also goes in the "resvg (or something) is a real problem" bucket, not
the "slow cold start" one.

---

## If anything comes back red

Stop and report exactly what you saw — the status code, the full response body, and which of the two
failure shapes above it matches — rather than retrying or working around it. A resvg failure changes how
the rest of Lot 4.4's assets get built; better to know now than after twenty-five of them.

---

## Part 7 — Lot 3's workspace UI (added once Lot 4.4's full catalogue and Lot 3 both landed)

None of this has been seen rendered in a real browser — this sandbox has no live credentials to drive an
authenticated page load, and this repo has no Playwright/testing-library setup (checked before building
Lot 3, not skipped). Verification so far is `tsc`/`eslint`/`next build`/`vitest` plus hand-traced data flow
— real, but not the same as a human looking at it. This part is what to actually look at.

1. Open a paid, direction-selected kit at `/app/brand-kits/<id>`. **Write down:** do all six section
   headings appear in order — Identity, Colors, Type, Your site, Your words, Your assets?
2. **The rail nav.** On desktop width, is the left rail visible and does it stay in place while you scroll
   the page (`position: sticky`)? Click each link — does the page jump to the right section? On a narrow
   (mobile) viewport, does the same nav become a horizontally-scrollable row instead of a sidebar?
3. **Colors — the labelled canvas.** Does the small page mockup show a header band, a heading, a button, a
   link, a small accent mark, and body copy, each with a small tag naming its color role, positioned near
   it? Do the tags stay legible (not overlapping text, not cut off) at both desktop and mobile widths?
4. **Colors — the Fix button.** Find a pair below AA (or use a kit with one). Click **Fix**. **Write down:**
   does the button show "Fixing…", then does the swatch/ratio for THAT pair (and any others sharing the
   same token) visibly update without a page reload? Does the DevTools Network tab show a call to
   `site_spec_fix_contrast` returning 200?
5. **Your assets.** Does the list load (a brief "Loading your assets…" then real groups: Identity, Web,
   Color, Social, Print, Document)? Click **Download** on any one item — does a new tab open with the
   actual file? Click **Download everything** — does a `.zip` download, and does it actually contain files
   when opened?
6. **Type.** Does the specimen show real copy from the selected direction (not placeholder text) at three
   visibly different sizes?

If anything here is wrong, it's more useful to know exactly what broke (a screenshot, the failing
network request, the console error) than to describe it from memory — same standard as Parts 1–6.

---

## Part 8 — Lot 7's Ethics Guard UI

1. In "Your words," click the **Board-safe copy** pill. **Write down:** does a panel open listing six real
   rules (No timeframes / No proven claims / No client voice / No inflated credentials / No scarcity / No
   diagnosis of the reader)? If this kit's generated copy was ever flagged and rewritten, does the panel
   show which rule and what the original text said?
2. In "Check your own words," paste `This proven method eliminates panic attacks. My clients say they
   feel heard.` **Write down:** do two phrases underline (red)? Below the text, do two rule names and
   descriptions appear, matching the two underlined phrases? Clear the box — does everything disappear?
3. Paste something board-safe, e.g. `I work with adults navigating anxiety and burnout.` **Write down:**
   does it say "Nothing flagged" with no underlines?

---

## Part 9 — Lot 6's "Your first week" checklist

Same caveat as Part 7: not seen in a real browser. Verified so far is `tsc`/`eslint`/`next build`/`vitest`
plus a real dry-run-then-apply against the live database's actual data (see WORKLOG.md) — real, but the
click-through itself is unverified.

1. On the home screen, does the right-column card say **"Your first week"** (not "Launch checklist") with
   a progress bar and an "X of 7" count? Does `choose_direction` NOT appear anywhere in the list — only
   seven rows?
2. Click a row's label or its chevron. **Write down:** does it expand to show the step's description, then
   below it something specific to that step (not the same content for every row)? For **"Put your brand on
   your site"**, an "Open the site editor" button. For **"Install your email signature"**, either a
   copy-able signature block or an honest "finish your practice details" message, plus two lines of Gmail/
   Outlook paste instructions. Click the chevron again — does it collapse?
3. Click **Mark done** on a row. **Write down:** does the label immediately strike through and the count/bar
   update (before any network round trip completes)? Reload the page — did it stay done? Open DevTools
   Network — was the request `PATCH /api/checklist/<brand-kit-id>` with body `{"key":"...","status":"done"}`?
4. Click **Skip for now** on a different row. **Write down:** does it go muted (not struck through, that's
   the done state) and does "Skip for now" become "Undo skip"? Click **Undo skip** — does it return to plain
   text?
5. Open `/app/brand-kits/<id>` (the kit page). **Write down:** just under the header, is there a compact row
   also reading "Your first week" with its own "X of 7", collapsed by default? Click it — does it expand
   in place to the SAME seven rows and the SAME per-step detail as home's card (same done/skipped state,
   since both read the same underlying data)? On this page specifically, does the "Install your email
   signature" step show the REAL copy-able block (not the fallback message) — this page has the practice
   details home's card doesn't fetch?
6. If you can get a kit to all seven done/skipped (marking each one done is enough for this check), does
   BOTH the home card and the kit-page row collapse to the single line **"Your brand is live in seven
   places."**?

If anything here is wrong, it's more useful to know exactly what broke (a screenshot, the failing network
request, the console error) than to describe it from memory — same standard as every other part.

---

## Part 10 — Lot 8's Monthly Presence

Same caveat as Parts 7 and 9: not seen in a real browser. Every kit today has zero content rows (the
monthly cron hasn't run yet for a freshly purchased kit) — reaching a kit WITH content rows for real means
either waiting for the 1st of a month or manually calling `ensure_month_skeleton`/`POST /api/cron/monthly`
against a test kit; both parts of this checklist are worth walking.

**Zero rows (today's actual state for every kit):**

1. Open `/app/content`. **Write down:** does the card say exactly **"Your first month is being prepared."**
   (not "Nothing yet")? If this account isn't subscribed to Monthly Presence, does a second card appear
   below it reading exactly **"Twelve posts, four stories, and the calendar — $39/month. Cancel anytime."**
   with an **"Add Monthly Presence"** button?
2. Click **Add Monthly Presence**. **Write down:** does the button say "Opening checkout…", then does the
   page redirect to a real Stripe Checkout page (subscription mode, $39/month)? Check DevTools Network —
   was the request `POST /api/monthly-presence/checkout`?
3. On the home screen, once "Your first week" is fully resolved (see Part 9), does the right-column slot
   show a **"Monthly Presence"** card with the same "Your first month is being prepared." line, and the
   same subscription card beneath it if not subscribed?

**With content rows (needs a kit whose month has been seeded):**

4. Open `/app/content`. **Write down:** do LOCKED items render as a plain bordered row (NOT blurred) at
   reduced opacity, showing a date (e.g. "Sep 7"), "Post" or "Story", the real headline in the direction's
   heading font, and a small padlock in the corner? Click one — does the unlock modal still open?
5. Do UNLOCKED items show their full title and a **Download** link next to their Ready/Draft/Published
   label? Click **Download** — does a real `.txt` file save, and does it contain the title and caption?
6. On the home screen (checklist resolved), does the Monthly Presence card now read `N of M ready for
   <Month>.` with a **"See this month"** link to `/app/content`, instead of "being prepared"?

**The fixed dead links:**

7. Trigger a real Stripe checkout for a brand-kit purchase (test mode) and land on
   `/app/checkout/success`. **Write down:** does "Go to my project" go to `/app` (not a 404)? If Monthly
   Presence was included, does the second button go to `/app/content` (not a 404)?

If anything here is wrong, it's more useful to know exactly what broke (a screenshot, the failing network
request, the console error) than to describe it from memory — same standard as every other part.
