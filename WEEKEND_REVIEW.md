# WEEKEND REVIEW

**For Naima, Saturday morning, read cold.** Everything waiting on your eyes is here.
`CHANTIER_LOG.md` says what happened; this file says what needs you.

Written 2026-09-10. Frontend `main` `565f82c` → see the log for the head at read time.
Backend `main` `323d7b6`.

---

## ⚠ READ THIS FIRST — the Session 3 gate did NOT run, and it is not a judgment call

**You asked for the gate output in this file, in full. It does not exist, and I could not
produce it.** Not because I chose to stop — the new operating mode correctly removed that
option — but because the environment has no credentials at all:

```
ANTHROPIC_API_KEY            unset
OPENAI_API_KEY               unset
SUPABASE_SERVICE_ROLE_KEY    unset
RESEND_API_KEY               unset
.env.local                   does not exist (only .env.example)
```

`api.anthropic.com` answers **401** — reachable, no key. `api.openai.com` is under your
standing "do not attempt" and has no key either. There is no reversible option to take
here: a caption cannot be written without a model, and "take the reversible option" does
not apply to a missing secret.

**This also blocks the adversarial batch**, which you scoped as captions-only precisely
because it needs neither your money nor your taste — it still needs a key.

### What unblocks it

One of these, whichever suits you:

1. **Put the keys in this environment.** `ANTHROPIC_API_KEY` alone unblocks the
   adversarial batch (50–100 lines through the scanner, fractions of a cent) and the
   twelve captions. `OPENAI_API_KEY` additionally unblocks the three square grounds and
   the one vertical story ground — but that is image spend, and you may prefer to keep it.
2. **Run it in your Codespace.** The generator is not yet written (see below), so this
   needs me to write it first.

### What is blocked behind it

- The whole Session 3 gate: twelve on-image lines, twelve captions, alt text, ground and
  composed-post storage paths, the allowance ledger.
- The adversarial batch and its compliance report.
- Session 5's "first month at purchase" cannot be exercised end-to-end (it can be built
  and unit-tested, which is what I am doing).

**I did not write the generator blind.** Writing an unrunnable pipeline and presenting it
as done is the across-sessions assumption your scope rules forbid, and it would arrive at
the gate with nothing to show. Say the word and I will write it against the measured
capacities so it is ready to run the moment a key exists.

---

## DECISION 1 — What does the layout actually render? (blocks the generator)

**Where:** `scripts/content/measure-archetype-capacity.ts`, and the table in
`CHANTIER_LOG.md` under Session 3.

I measured what each satori layout physically holds, with the real typefaces, real
geometry and real English sentences. Floors across all six `type_pairings`:

| Archetype | Floor (characters) |
|---|---|
| `statement` | **144** |
| `question` | **168** |
| `signature` | **195** |
| `story` | **431** |
| `notes` | **472** |

**The problem:** `content_items.title` is capped at **34** characters and
`content_items.caption` at **2200**. The measured capacity is neither. Step 4 of your brief
says "pick the archetype from what the caption's length physically allows" — at 2200
characters no layout allows anything, and at 34 every layout is three-quarters empty.

**The decision you need to make:** what goes ON the image?

- **(a) A third field** — e.g. `content_items.on_image_text`, capped at 144 so it fits the
  tightest layout, with `caption` staying the long Instagram text. Cleanest; one migration.
- **(b) A defined slice of the caption** — the generator writes the first sentence to fit
  the chosen archetype. No migration; couples the two so editing the caption can silently
  break the image.
- **(c) Reuse `title`** — already exists, but 34 characters wastes 75% of a `statement`
  layout and makes the grid look thin.

**My recommendation: (a).** It is the only one where editing her caption cannot break her
image, and the cap makes the archetype choice trivial rather than a fitting problem.

**Blocked behind it:** step 4 of the generator, therefore the gate, therefore everything
downstream of the gate.

---

## DECISION 2 — Capacity varies 60% between typefaces, and she chooses the typeface

**Where:** same table.

`cormorant_source` holds **234** characters in the `question` layout where `caslon_inter`
holds **168**. Cormorant Garamond is a narrow face.

I have written the generator's contract as **respect the floor** (168), because the
generator does not get to choose her typeface and an average would overflow roughly half
of customers.

**This is already decided and is reversible in one commit** — I am telling you rather than
asking. If you would rather the generator read her actual pairing and use its real capacity
(more text for Cormorant customers, same for everyone else), that is a small change and a
better use of the space. I chose the floor because it is the version that cannot be wrong.

---

## FYI — the two pre-Content items were already done

You listed them as possibly outstanding. Both shipped in `c85eb1c`, before the Content
chantier began. No action needed; noted so you do not go looking.

- **The trial notice stamps only on confirmed delivery.**
  `app/api/cron/trial-ending/route.ts:213` — `if (!outcome.delivered)` returns before the
  stamp, leaving the row due so the next sweep retries. A missing `RESEND_API_KEY` is now
  `ok: false` in production, and `lib/env/required.ts` refuses to serve without it.
- **The tier-name sweep is done and enforced.** `app/pricing/page.tsx:45` builds the meta
  description from `ORDERED_PLANS`, so it reads "Brand Kit $79, Brand Kit Plus $149,
  Practice Suite $249". `app/__tests__/tier-names-in-metadata.test.ts` walks `app/`, bans
  the enum names in metadata and email subjects, fails the moment an `openGraph` or
  `ld+json` block appears, and carries a canary that re-feeds the exact old string.

---

## Standing constraints I am holding this weekend

Recorded so you can check I kept them.

- One month, ever, until you have read it. Not generated at all yet — see above.
- No composed image beyond that month.
- **No email to a real address.** If I exercise any notification path it goes to a sink.
- The cron is written and left **disarmed**; where the switch is will be recorded here.
- No production data deleted.
- The seven brand images are yours to run.
- Everything I show you comes from the production path, or is labelled a fixture in the
  same breath.

---

## DECISION 3 — I changed the typegen guard's premise (already done, reversible)

**Where:** `types/__tests__/generated-types-drift.test.ts`, `types/supabase.ts` header.

That test said **"THIS FILE IS NOT SAFELY REGENERABLE"** because tables and RPCs had been
written into `types/supabase.ts` by hand, and regenerating erased them. I regenerated both
copies for real, so everything that was manual now exists in the database and the generator
produces it. What still cannot be generated is the ADDENDUM (four `text`-under-CHECK unions
that `gen types` flattens to `string`).

So the test now says **"regenerate whenever you like, AND put the addendum back"**, its
lists are reframed as *what must survive a regeneration*, and it gained an assertion that
the retired monthly-content table never reappears — a regeneration run against a database
where the retirement had not been applied would bring it back silently.

**If you disagree with the reframing, it is one commit to restore.** I judged that keeping
a "do not regenerate" warning on a file I had just correctly regenerated would be worse
than the drift it was written to prevent — the file had gone four days without
`content_items` in it.

The regeneration also surfaced two real drifts, both fixed: three call sites passed `null`
for a defaulted RPC param (`gen types` types those `string | undefined`), and
`MonthlyPresenceStatus` was still exported for a table retired four commits earlier.

---

## DECISION 4 — I widened the a11y guard rather than duplicate an attribute (done, reversible)

**Where:** `app/__tests__/mobile-and-a11y.test.ts`.

That guard requires any component calling `fetch` to contain a literal `role="alert"`, so an
error is announced and not merely drawn. The new check-in card routes its error through
`<InlineError>`, **which already carries `role="alert"`** — so the behaviour was correct and
the grep had a false negative.

Satisfying it literally would have nested two alert roles: code written for the test rather
than for a screen-reader user. The guard now accepts either a literal `role="alert"` **or**
`<InlineError>`, and I added an assertion that `InlineError` really does announce, so that
second branch cannot outlive the component it rests on.

**Worth knowing:** no other `fetch`-ing component in the repo uses `InlineError` — they all
inline the attribute. The check-in card is the first to delegate. If you would rather the
codebase kept inlining it, revert the guard and add the literal; it is one commit.

---

## WHERE SESSION 4 STOPPED

Done and pushed:

- **The check-in card**, at the top of `/app/content` until `taking_clients` is answered.
  `components/content/check-in-card.tsx`, route `app/api/brand-kits/[id]/check-in`.
- **The data layer** it and the rest of Session 4 compose against —
  `getContentPreferences` / `setContentPreferences`, `getContentCheckin` /
  `setContentCheckin` / `checkinAnswered`, `approveContentMonth` in `lib/data/content.ts`.
- **Counts corrected** so proposals are not reported as her work, and
  **`approve_content_month`** so a month can be accepted in one gesture.

**Not built yet, in the order I would take them:**

1. **The preferences step** — first visit, editable from Settings. Data layer and RPC exist;
   it needs the form and a place to put it. The six registers come from `content_registers`
   with their safety rules, so the form can explain what each one is.
2. **The month as a plan on one screen** — the approve-in-one-gesture surface.
   `approveContentMonth` exists and is tested; nothing renders it yet. **This one is worth
   waiting for the gate**: designing the screen that shows twelve proposals before seeing
   twelve real proposals is how art direction goes wrong twice.
3. **Proposals rendering greyed on their dates** in the existing calendar, and `Ready` /
   `Posted` reading the corrected counts.

Session 5's unpaid parts (first month at purchase, the cron shipped disarmed) are untouched.

---

## Work log for the weekend

Appended as it happens, newest last. Detail lives in `CHANTIER_LOG.md`.

- **Session 3 —** types regenerated for real, both repos (Supabase's own generator; the CLI
  could not run here — no token, Docker unusable, `api.supabase.com` refused). Archetype
  capacities measured. **Gate blocked on credentials, see the top of this file.**
- **Session 4, backend —** `get_content_month` no longer counts proposals as her work
  (backend `20260910093929`); a separate honest `proposed` count added.
  `approve_content_month` written (backend `20260910094102`): one statement, scoped by
  `month_id` so a proposal dragged into next month still moves with its own plan,
  idempotent on replay.
- **Session 4, frontend —** data layer for preferences, the check-in and approval. Reads go
  direct (RLS already bounds them), writes go through the RPCs (their write policies are
  `false`). Frontend types regenerated; typegen guard reframed, see Decision 3.
- **Session 4, the check-in —** card + route, shown until `taking_clients` is answered. Two
  guards caught it and both were right; one of them I widened rather than satisfied, see
  Decision 4. Suite 1,984 green.
