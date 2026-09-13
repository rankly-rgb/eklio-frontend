# The launch checklist — inventory before wiring

LOT 0 of the checklist chantier. No writes. Two tables: the mechanism that
already exists, and what material each of the seven steps can actually show.

## Table A — the mechanism

| Question | Answer |
| --- | --- |
| **The toggle RPC** | `set_launch_step(p_brand_kit_id uuid, p_key text, p_status text)` — SECURITY DEFINER, `20260903260000_launch_checklist_first_week.sql`. Wrapped by `setLaunchStep()` (`lib/data/checklist.ts`), reached over `PATCH /api/checklist/[id]` with `{key, status}`, zod-validated against `LAUNCH_STEP_KEYS` and `todo｜done｜skipped`. The Next-step card calls it through `LaunchStepActions`; the accordion calls the same route directly. |
| **Deep-linking to one step** | **Already exists.** `app/app/launch/[stepKey]/page.tsx` serves `/app/launch/<key>` — breadcrumb, `Step N of 7`, label, description, `LaunchStepDetail`, `LaunchStepActions`, prev/next. An unknown key is a 404, deliberately, not a redirect. **No new route or parameter is needed; the rail rows simply have to link to it.** |
| **What the rail rows are today** | `<li>` holding two `<span>`s: an `aria-hidden` checkbox glyph and a label. No `<a>`, no `<button>`, no `<input>`. Not focusable, not clickable, not operable. `aria-current="step"` on the current row is the only semantics present. |
| **Where the ring's numbers come from** | `LaunchRing` reads `progress.resolvedCount / .total` off `home.checklist` — `loadLaunchProgress()` → `get_launch_progress`, rendered on the **server**. |
| **Do they recompute on a toggle?** | **No.** Only on a full server render — a navigation, or the `router.refresh()` that `LaunchStepActions` fires after its write. Nothing on the client recomputes them. |
| **Is `skipped` distinct from undone?** | Yes: `"todo" ｜ "done" ｜ "skipped"`. Rail: done = filled clay `rounded-check`; skipped = `bg-line` grey fill; todo = empty bordered square. Labels: done and todo in ink, skipped in `ink-3` with an `sr-only` "(skipped)". `resolvedCount` counts done **and** skipped. |

### The one real conflict, named before it is built

The accordion recomputes `resolved` from its own client state; the rail's ring
reads the server's `resolvedCount`. Both write the same RPC, so there is no
second source of truth for *state* — but they are two computations of the same
number in two places, and the rail's ring cannot move without a server
round-trip.

So an optimistic toggle in the rail, done naively, would leave the rail's rows
ahead of its own ring and ahead of the Next-step card until `router.refresh()`
lands. The chantier says to say so rather than ship it. **The fix is one client
owner for the home screen's checklist state** — a provider consumed by the
rows, the ring and the Next card alike, so all three move on the same optimistic
update and revert together on failure. Still one RPC, still one table.

## Table B — what each step can actually show

`✓` exists today · `GAP` does not exist anywhere · dimensions from
`asset_catalog`.

| # | key / label | Place | Copyable text | Asset | Gaps |
| --- | --- | --- | --- | --- | --- |
| 1 | `site_setup` — Put your brand on your site | **IN EKLIO** | The site instructions, via the site editor's own output panel ✓ | `site_setup_md` (md) ✓ | — |
| 2 | `update_directory` — Update your Psychology Today profile | **PSYCHOLOGY TODAY** | `personalStatement()` ✓ — board-safe, practitioner line + credential + location | `avatar_400` PNG 400×400 ✓ | **GAP** — structured fields. `modality_ids`, `specialty_ids`, `client_persona_ids`, `state` exist on `project_briefs` as **ids**, and nothing on this path resolves them to labels. Would need a `modality_cards` / `specialties` catalogue read. Not added here. |
| 3 | `google_profile` — Claim or update your Google Business Profile | **GOOGLE** | `personalStatement()` ✓ (the same line as #2) | `icon_512` ✓ square logo; `og_image_1200x630` ✓ cover | **GAP** — a Google-specific short description exists nowhere. Writing one is copy generation, which is the Ethics Guard's chantier, not this one. The step ships without that block. |
| 4 | `social_setup` — Set up Instagram and Facebook | **INSTAGRAM** | `shortBio(aboutExcerpt, 150)` ✓ | `avatar_400` ✓; `cover_facebook_1640x624` ✓ | **Instagram's 150-character limit: MET, by construction.** `shortBio` truncates on a word boundary and appends an ellipsis, so its return is ≤150 whatever the source length. |
| 5 | `email_signature` — Install your email signature | **YOUR EMAIL** | `emailSignatureText()` ✓ | `email_signature_html` ✓, `email_signature_png` ✓, `wordmark_png_dark` ✓ | — |
| 6 | `booking_link` — Put your booking link everywhere | **IN EKLIO** when unset | `spec.hero.cta_target_url` — **nullable, and seeded `null`** (`20260830061318_site_spec_paper.sql:538`) | — | **When null there is nothing to copy.** The step must say where to set it — the site editor — and show no well at all. Never an empty box. |
| 7 | `first_post` — Publish your first post | **INSTAGRAM** | `content_items.caption` ✓, `content_items.alt_text` ✓ (nullable) | `post_signature_1080` ✓ and the three other 1080 posts; the month's own item image when one exists | `alt_text` is null on everything written before the generator learned to produce one. Absent, not empty. |

### What this chantier will NOT write

No copy. The two gaps above — Psychology Today's structured fields and a Google
description — are strings that do not exist, and inventing them means the
Ethics Guard pipeline. They are recorded in `FINDINGS.md` and their steps ship
without those blocks.
