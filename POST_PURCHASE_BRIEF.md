# POST_PURCHASE_BRIEF.md

Written verbatim from the user's message of 2026-09-03, so it survives a context rollover without a
round trip. Everything below this line is the user's own words, unedited.

---

## Answer to your QUESTIONS.md — the rest of the Lot 4.4 catalogue

Filenames use a slug of the practice name. Trim to ink applies to wordmarks and the standalone monogram SVG only; everything with a fixed canvas keeps it.

**Identity, remaining**
- `wordmark_svg_light`, `wordmark_svg_mono_black`, `wordmark_svg_mono_white` — same construction as `wordmark_svg_dark`, different ink.
- `wordmark_png_light` at 1200px and 2400px wide, transparent ground.
- `monogram_svg`, `monogram_png_512` — one or two letters from the practice name (first letters of the first two words; a single word gives one letter), in three treatments: on `primary`, on `paper`, and transparent. Transparent means no ground with the mark in `primary` — not a coloured mark on an opaque square.

**Web**
- `favicon_16`, `favicon_32`, `apple_touch_icon_180`, `icon_512` — monogram on `primary`, inset inside a 78% inscribed circle so a circular crop never clips it. **At 16 and 32 use the first letter only**; both letters from 180 up. Say so in the zip README.
- `manifest_values_json` — name, short_name, theme_color (`primary`), background_color (`paper`), icon paths.

**Color, remaining**
- `palette_ase` — Adobe swatch exchange, six swatches named by role.
- `tokens_json`, `colors_css` — the six roles plus the four derived variants as custom properties.

**Social**
- `avatar_400` — monogram on `primary`, same 78% inscribed-circle rule.
- `post_statement_1080`, `post_question_1080`, `post_notes_1080`, `post_signature_1080` — the four archetypes already in the content model, 1080×1080. Render from the month's first four items when they exist; from the selected direction's sample copy when they don't, and in that case the zip README calls them templates, not her posts.
- `story_1080x1920`.
- `cover_linkedin_1584x396`, `cover_facebook_1640x624`.

**Print**
- `business_card_front`, `business_card_back` — 3.5×2in at 300dpi, 0.125in bleed, crop marks. Render RGB; note CMYK caveats in the README rather than attempting a conversion you cannot verify.

**Document**
- `email_signature_html` — table-based, inline-styled, survives Gmail and Outlook: name, licence label and number, practice name in her heading font with a web-safe fallback stack, city and state, booking link, a `primary` hairline. Plus `email_signature_png`.
- `site_setup_md` — the existing derived output, listed so the manifest is complete.
- `brand_kit_zip` — everything above plus `README.txt` naming each file, what it is for and where it goes, in her voice.

## Then, in this order

**Lot 3 — the brand kit becomes a workspace.** Six sections with a sticky left rail on desktop, a horizontal scroller on mobile: `Identity · Colors · Type · Your site · Your words · Your assets`. Each follows the same three-part pattern — **applied** (shown in use, in a canvas), **specified** (values in mono), **actionable** (copy, download, open the editor). Colors is not five rectangles: it is a canvas rendering a small page with each region labelled by its role, then the six swatches with their one-line jobs, then the seven contrast pairs with the existing Fix action. Type is a rendered specimen at real sizes using her own copy, never lorem. Extend the `<BrandCanvas>` treatment to Identity, Your site and Your words, which Lot 1 did not reach. Remove "This month, in your brand" from this page — content belongs on the Content page.

**Lot 5 — the brand guide PDF.** `pdf-lib` + `fontkit`, no Chromium. **Selectable text, both families embedded** — a PDF of stitched images fails this lot. Build one layout helper first (measured line breaking through fontkit, a text-flow function, a baseline grid) and compose all fourteen pages with it; do not position text page by page. Fourteen US Letter pages in her colours and fonts: cover · contents · identity (clear space in monogram-widths, minimum size, exact capitalisation) · identity misuse (five wrong examples, struck through) · colors by role · colors accessibility (the seven pairs) · type families and scale · the scale applied to her own copy · voice · Ethics Guard's six rules · the site mockup full width · the site structure and copy page by page · the social templates as embedded PNGs · using this kit. Footer: practice name left, page number right, mono 8pt in `dark_neutral` at 60%. No Eklio mark except one small line on the last page. The last page carries this disclaimer **verbatim**:
`Eklio drafts content for you to review, adapt, and approve before you publish it. It is built to respect ACA and APA advertising principles, but it is not legal, clinical, or ethical advice, and it is not a compliance certification. You remain responsible for making sure anything you publish meets the rules of your licensing board and your state.`

**Lot 7 — Ethics Guard.** `lib/ethics/rules.ts`, deterministic regex and lexicon, no model call. Six families, each with `id`, `label`, `why` (one plain sentence), `patterns`, `suggestion`: `outcome_guarantee` (resolves, cures, will heal, guaranteed, for good, permanently) · `testimonial` (first-person client speech, "clients tell me", quoted praise) · `scarcity` (only N slots, limited spots, book before, last chance) · `superlative_credential` (best, leading, top-rated, #1, "expert in" with no credential behind it) · `clinical_claim` (proven method, "evidence shows" with no citation, a named modality plus a promised result) · `unsourced_statistic` (a digit with % or "out of" and no source in the sentence). `scanCopy(text) → { flags: [{rule_id, start, end, excerpt, why, suggestion}], level: 'clear'|'review' }`. Two surfaces: the existing `BOARD-SAFE COPY` chip becomes clickable and names which rules ran; and `Check your own words`, a textarea where she pastes her current Psychology Today bio, with flagged spans underlined and each one's rule, why and template-generated rewrite. Never a score, a grade, a percentage, or the words "compliant" or "approved". Snapshot test each family against its example and its near-miss ("clients often ask" must not trip `testimonial`).

**Lot 6 — Your first week.** Table `launch_steps` (`brand_kit_id, step_key, status 'todo'|'done'|'skipped', completed_at, updated_at`), unique on `(brand_kit_id, step_key)`, policies and their test in the creating migration, seeded on first read. RPCs `get_launch_progress`, `set_launch_step`. Seven steps, each showing the exact asset and exact text, never generic advice: put your brand on your site · update your Psychology Today profile (board-safe personal statement at that field's length, plus the avatar) · claim or update your Google Business Profile · set up Instagram and Facebook (avatar, cover, a generated bio ≤150 chars with a counter) · install your email signature (the block, a Copy button, the Gmail and Outlook paste paths) · put your booking link everywhere · publish your first post. A compact progress row on the kit page, the primary card on home with a `4 of 7` ring. Collapsible, `Mark done` and `Skip for now`, no modal, no tour. When all seven are done or skipped the card becomes one line — `Your brand is live in seven places.` — and the Monthly Presence card takes its place. That transition is when the subscription gets sold, not the day she paid.

**Lot 8 — Monthly Presence, sold honestly.** Delete every blurred card in the product. With content rows: the first post and first story in full and downloadable, the rest as a legible calendar (date, archetype, headline, in her fonts, reduced opacity, small lock glyph). **With zero rows — which is every kit today** — an honest empty state in her brand, `Your first month is being prepared.`, plus the subscription card. No fabricated sample posts, no placeholder headlines. The card reads `Twelve posts, four stories, and the calendar — $39/month. Cancel anytime.` No countdown, no discount timer, no scarcity.

**Lot 2 — the delivery moment.** Last, because it composes everything above. Route `/app/brand-kits/[id]/delivered`, reachable once, right after Stripe returns. A 2.4s sequence on her `paper`, collapsing instantly under `prefers-reduced-motion`: wordmark draws in · six colours arrive as bands 120ms apart · four surfaces fade up together (site hero, one Instagram post, the email signature, the business card) · everything settles under one line in her body font, `{practice_name} — your brand, as of today.` · one primary action `Open your brand kit`, one quiet `Download everything`. Record `brand_kits.delivered_seen_at`; later visits redirect to the kit. No replay button. No congratulations, no confetti — a designer putting the work on the table.

**Lot 9 — home and housekeeping.** Home becomes the return surface: the brand card with her live mockup, the launch ring, `This month` with the next item and its date, and `Since you were here` built from the existing diff and the asset fingerprint. Then `delete_brand_kit(kit_id)` — soft delete with `deleted_at`, typed confirmation of the practice name, a 30-day `Recently deleted` window, storage purged after it; deletion never refunds and the copy says so. Then extend the route-enumerating paywall test to every route added in Lots 2 through 9, and do the accessibility and mobile pass.

## Rules, unchanged

No model call and no image model in the asset pipeline, the PDF or the ethics scanner. Nothing calls `consume_generation_credit` for a download or a re-render. Every new table ships its RLS policies and their tests in the same migration. Never renumber an existing migration. Everything paid is gated in the database and covered by the route-enumerating test. No publish, deploy, share URL or public page. `paper` and `light_neutral` never collapse. American English, warm and plain, never hype. Respect `prefers-reduced-motion`.

## Autonomy, unchanged

Decide, record in `DECISIONS.md`, keep going. `WORKLOG.md` per lot: what you built, what you verified and how, what you could not verify. `FINDINGS.md` for what you saw and did not touch. `QUESTIONS.md` only for what genuinely needs me. Verify every lot yourself through the local loop before moving on — for anything visual, open the rendered file and look at it. Push at every lot boundary, tests green.

Stop only for: something destructive on the deployed database or storage; anything touching live Stripe or real money; a secret you do not have (never invent a workaround, never write one into a repo); or a decision that would make a large part of the work unrecoverable if I disagree.

Everything on that list runs without me. Go as far as you can.
