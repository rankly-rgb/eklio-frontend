# DECISIONS.md

Every judgment call made instead of asking, going forward from the "stop reporting between steps" change.
One entry: the question, what was chosen, why. Not a place to relitigate — a record for review.

---

### 2026-09-03 — Local verification, given no Docker and no Supabase REST access

**Question.** The instruction was to build a local loop via `supabase start` + `next dev` + Playwright
against `localhost`. Testing revealed neither Docker nor Supabase's REST endpoint (nor the open web at
all) is reachable from this sandbox — confirmed with curl against three different hosts, all returning the
identical `403 connect_rejected` egress-policy denial (see WORKLOG.md). So the plan as written cannot run
as written. What's the best available substitute?

**Chosen.** Two-tier local verification instead of one full loop:

1. **Database/RLS/RPC layer** — a real local PostgreSQL 16 server (already installed on this machine,
   just not running), with hand-built minimal `auth` and `storage` schema stubs (a `users` table shaped
   like Supabase's, a `storage.objects`/`storage.buckets` pair, an `auth.uid()` function reading a session
   variable) so the actual migration files can replay unmodified and the actual SQL test suite
   (`supabase/tests/*.test.sql`) can run unmodified, matching what CI already asserts against a real
   Supabase-provided Postgres image — just locally, and against a schema I built rather than one Supabase
   ships. This is NOT a claim that it's identical to Supabase's real `auth`/`storage` schemas in every
   internal detail — only that it's compatible enough to replay this repo's own migrations and tests,
   which are the things actually being verified.
2. **App/frontend layer** — `next build`, `tsc --noEmit`, `eslint`, and the existing `vitest` suite,
   already fully working locally and already the app's own bar for "done." What this tier CANNOT do:
   exercise a real HTTP request through Supabase's actual Auth (GoTrue) or Storage API — those aren't
   running anywhere reachable from here. A `next dev` server pointed at the real remote Supabase project
   would hit the exact same egress block as `curl` did, for the exact same reason (the block is a
   network-layer policy on this sandbox's outbound connections, not specific to any one tool).

**Why not something else.** Considered: (a) standing up PostgREST/GoTrue/Storage-API as raw Go binaries
without Docker — technically possible, large effort, and still wouldn't be reachable if attempted the same
way `next dev` would reach it (moot, since the constraint is egress, not Docker, for that half); (b) using
`mcp__Supabase__create_branch` to get an isolated schema copy of the real project — doesn't solve the
actual blocker, which is that *this sandbox cannot make HTTPS requests to any Supabase-hosted endpoint at
all*, branch or not; (c) `mcp__Supabase__create_project`, a whole separate throwaway project — same
problem, plus it's still Supabase-hosted and thus still unreachable by curl/next dev from here, and it
would leave an actual billable cloud resource behind for no benefit.

**What this means for verification going forward.** Every lot gets: full migration replay + SQL test suite
against the local stub Postgres (real, not simulated), full `vitest`/`tsc`/`eslint`/`next build` locally
(real), and careful code-path tracing for anything that would need a live HTTP round trip through
Supabase's Auth/Storage or a browser (documented per-lot as "not verified: needs live Auth/Storage" rather
than silently assumed fine). Those items join the existing "only provable on Vercel" list
(`@resvg/resvg-js` on Vercel's runtime, real cold-start timing) for the user's batch review — not a new
category, just a wider one than originally scoped, because the constraint turned out to be wider (REST
API blocked too, not just the open web).

---

### 2026-09-03 — usp-options fix: status codes for the two new error classes

**Question.** What HTTP status codes should a "not configured" vs. a "model call failed" response carry?

**Chosen.** `503 Service Unavailable` for `AnthropicNotConfiguredError` (the service is genuinely,
knowably not available right now — closer to the RFC's actual meaning than a generic 500), `502 Bad
Gateway` for a real `Anthropic.APIError` (this app is a client to an upstream that failed). Both keep the
existing `serverError`'s plain 500 as the fallback for anything unclassified, so "unknown bug" doesn't
start looking like a well-understood, expected condition.

**Why.** A distinct status lets a future caller (a retry wrapper, a status-code-based UI branch, an
uptime check) tell these apart without parsing message text — which is the same principle the frontend
fix depends on (`code` field, not just message string matching).

---

### 2026-09-03 — `og_image_1200x630` is not trimmed to ink bounds, despite the Lot 4.4 rule

**Question.** The trim-to-ink-bounds rule ("every identity asset... zero padding") names two exceptions:
`avatar_400` and the favicons. `og_image_1200x630` isn't one of them — should it be trimmed anyway?

**Chosen.** No. Trimming stays off for this one too, added as a third exception.

**Why.** The rule's own purpose is "droppable into a Squarespace header without cropping first" — that
reasoning doesn't apply here. An Open Graph image's entire function is being displayed at a platform-
claimed fixed size (its name literally is that size): Twitter, Facebook, LinkedIn, Slack unfurls all read
the `og:image` meta tag and render it at 1200×630 (or crop/pad to fit that ratio if the actual file
differs) — a trimmed, irregular-aspect-ratio file would be cropped unpredictably by whichever platform
displays it, which is a worse outcome than the padding the trim rule exists to avoid elsewhere. The
canvas is designed to be filled edge-to-edge on purpose (full-bleed background, not a sparse mark on
empty space), so this isn't fighting the rule so much as recognizing this asset was never the shape the
rule was written for.

**Where this lives in code.** `lib/kit/render/registry.ts`'s `og_image_1200x630` entry calls `svgToPng`
(the untrimmed path), not `trimToInk` — same mechanism `avatar_400`/favicons will use, just triggered by
a different reason, documented at the call site.

---

### 2026-09-03 — Building `palette_sheet_png` and `og_image_1200x630` without the full Lot 4.4 catalogue

**Question.** The user referenced "the catalogue I gave you" for Lot 4.4's identity/web/color assets, but
that catalogue (exact keys, dimensions, descriptions) is not in this session's context — likely from
before a context compaction. The user separately named these two specific assets and asked for them as
PNGs. Wait for the full list, or proceed on what's concretely specified?

**Chosen.** Proceed with these two now, on reasonable inferred specs, each recorded here. Continue
building further identity/web/color assets only for ones inferable with similar confidence (a
"typography specimen," a "letterhead," ordinary category items with an obvious shape); flag anything
whose exact spec genuinely can't be guessed safely in `QUESTIONS.md` rather than invent it.

**Why.** Stopping to ask contradicts the explicit instruction this session is now operating under
("stop reporting between steps and stop waiting for me"); the two named assets are concrete enough to
build confidently (dimensions are in one of the two names outright); the risk of inferring wrong on
something this reversible (a PNG spec, not a schema or an architecture choice) is low and cheap to
correct later, unlike the four things that actually warrant stopping.

**The inferred specs, so they're on record:**
- `palette_sheet_png` — 1200×600, six equal-width swatches (200px) for the six color roles in the brief's
  documented order (primary, secondary, accent, paper, light_neutral, dark_neutral), each labeled with its
  role name and hex value in the kit's body font. Not trimmed to ink bounds in practice — the design fills
  the canvas edge-to-edge on purpose, so trimming is a no-op here, not a rule violation.
- `og_image_1200x630` — see the trim-exception entry above for why it isn't cropped. Content: practice
  name in the heading font, the selected direction's `hero.headline` as a supporting line, an overline
  pill in the primary color/cta_ink pairing (the same visual language `BrandCanvas` already uses
  elsewhere in the paid space) — full-bleed on the `paper` color.

---

### 2026-09-03 — `wordmark_png_light` split into two catalog keys, one per pixel width

**Question.** POST_PURCHASE_BRIEF.md names one item, "`wordmark_png_light` at 1200px and 2400px wide."
`asset_catalog` and the manifest/route contract are built around one row = one downloadable file with one
set of dimensions (see `get_brand_asset_manifest`'s shape — `width`/`height` are scalar columns, not an
array). Two sizes under one key would need either two rows sharing a key (breaks the primary key) or a
new "sizes" concept nothing else in the schema has.

**Chosen.** Two catalog keys: `wordmark_png_light_1200` and `wordmark_png_light_2400`. Matches the
pattern already established for every other size-varying item already in the catalogue by name
(`favicon_16`/`favicon_32`, `business_card_front`/`_back`) — a manifest entry is one file, two sizes are
two entries.

**Why.** Consistent with the schema as it already exists (no migration to the manifest shape itself), and
consistent with how the brief itself names other multi-size items — cheap to relabel later if the user
meant something else (e.g. a single endpoint that content-negotiates size), which nothing else in this
session's context suggests.

**Implementation note.** Both sizes rasterize the SAME trimmed light-ink SVG (one satori render, one
`trimToInk` call) at two different target widths via `svgToPngAtWidth` (new helper, `rasterize.ts`) —
satori's output is fully vectorized, so re-rasterizing at a different width is lossless with respect to
the vector, not a scaled-up raster. Height is derived from the trimmed aspect ratio at render time, not
stored as a fixed catalog value (same reasoning `asset_catalog_trimmed_dims_null` already established for
`wordmark_png_dark`).

---

### 2026-09-03 — `monogram_png_512`'s three treatments split into three catalog keys

**Question.** Same shape of question as `wordmark_png_light` above: the brief names one item
("`monogram_png_512` … in three treatments: on primary, on paper, and transparent") but the schema is one
row per file.

**Chosen.** `monogram_png_512_primary`, `monogram_png_512_paper`, `monogram_png_512_transparent`. Same
reasoning, same precedent, recorded once above rather than repeated in full here.

---

### 2026-09-03 — the standalone `monogram_svg`'s one ink treatment: `tokens.primary`

**Question.** The brief gives `monogram_png_512` three ink/background treatments but only ever names one
`monogram_svg` — unlike the wordmark, which gets a dedicated key per ink (`_dark`, `_light`, `_mono_black`,
`_mono_white`). What single treatment does the standalone vector monogram get?

**Chosen.** Ink `tokens.primary`, no background, trimmed to ink bounds — a colored mark, droppable onto
anything, matching the "transparent" PNG treatment's ink logic exactly (same color, no fill), which is the
one of the three that a trimmed vector can actually represent (a fixed-background treatment inherently
needs a fixed canvas, which trimming would defeat).

**Why not `tokens.dark_neutral`, matching the wordmark's own default.** The wordmark's default is the ink
that sits on a light page (its most common use — page body text neighbourhood). A monogram's most common
standalone use is closer to a logomark reference for someone else's design work (a printer, a sign maker,
a social media manager building a template) — `primary` is the color that IS the brand, and is what
`monogram_png_512_transparent` (its closest sibling) already uses.

---

### 2026-09-03 — the 78%-inscribed-circle inset, computed geometrically rather than eyeballed

**Question.** The brief's rule for favicon_16/32, apple_touch_icon_180, icon_512, and avatar_400 —
"inset inside a 78% inscribed circle so a circular crop never clips it" — is a precise geometric
constraint. satori has no primitive for "fit this glyph inside a circle of a given size"; the obvious
shortcut is a hand-picked font-size constant that "looks about right."

**Chosen.** A two-pass render (`lib/kit/render/monogram-icon.ts`): pass 1 renders the monogram alone at a
large reference font size and measures its real ink bounding box via resvg's `innerBBox()` (the same
primitive `trimToInk` already uses elsewhere in this file); pass 2 scales the font size so that bbox
diagonal equals exactly 78% of the canvas diameter, then renders the real, final square. Deterministic —
same inputs, same two renders, same output every time; no LLM, no guess-and-eyeball constant to maintain
per font family.

**Why the diagonal, not width or height alone.** The inscribed-circle constraint is about a CIRCULAR crop
never clipping the mark — the smallest circle guaranteed to contain an arbitrary (possibly asymmetric)
glyph shape is bounded by its bounding-box diagonal, not its width or height alone. Using the diagonal is
the conservative choice in the direction the rule cares about (never clips), even though it means a
roughly-square glyph like "W" sits somewhat smaller than a single tall/narrow character would.

**What this does NOT solve.** satori centers the text's LAYOUT box, not the glyph's visual ink centroid —
for a one- or two-character monogram in a serif display face this is a few pixels of asymmetry (descender
weight, cap-height vs. x-height quirks), not a defect this renderer claims to have fixed. Same honesty bar
as `wordmark.ts`'s existing tracking note. Verified visually (not just by dimension) — see WORKLOG.md.

---

### 2026-09-03 — social posts render from `kit.socialTemplates`, not `monthly_presence_content`

**Question.** The brief says render `post_statement_1080`/`_question`/`_notes`/`_signature` "from the
month's first four items when they exist; from the selected direction's sample copy when they don't."
Researched both candidate sources before writing any renderer (dispatched a research pass rather than
guessing): `monthly_presence_content` (the real content-calendar table) is confirmed EMPTY in production
today and — this is the part that matters, not just "empty for now" — it has **no archetype/layout column
at all**. Its rows are `(month, day_of_month, type: 'post'|'story', title, caption, visual_spec jsonb
unshaped)`; nothing marks a row as "the statement one" vs. "the question one." `ensure_month_skeleton`
inserts 12 undifferentiated `post` rows and 4 `story` rows per month with no archetype tag. So "the
month's first four items" as literally specified would be four arbitrary early-day `post` rows with no
way to know which is meant to render as which template.

The other candidate, `directionSchema` (a Direction's own fields), has NO statement/question/notes/
signature copy at all — confirmed by reading it in full. The only real content in this schema matching the
four archetypes by name is `brand_kits.social_templates` (`kit.socialTemplates`), a kit-level 4-tuple the
generation pipeline writes once at kit creation and never varies by direction.

**Chosen.** Every social post renderer in this lot reads `kit.socialTemplates` only. The
`monthly_presence_content` branch is not implemented — there is no well-defined mapping from its rows to
an archetype to implement it correctly, and building a rule for a table currently empty in every kit today
(per FINDINGS.md) would be speculative, not a real feature. Lot 8 ("Monthly Presence, sold honestly") is
explicitly where this table's real shape and use get decided — an archetype column, if the row-to-template
mapping is ever actually needed, belongs there, in the same migration that gives Monthly Presence its
first real writer.

**Why not stop and ask.** Reversible: nothing here forecloses adding the `monthly_presence_content` branch
later — `kit.socialTemplates` stays the fallback either way. Not a secret, not destructive, not an
architecture commitment across a large surface — squarely inside "decide and keep going."

---

### 2026-09-03 — `post_signature_1080` and `story_1080x1920` share one content source, two canvases

**Question.** `socialTemplatesSchema`'s fourth entry (`layout: "signature"`) is typed `type: "story"` —
the schema itself only ever models "signature" as a portrait story tile, never as a square post. The brief
asks for BOTH `post_signature_1080` (1080×1080, square, one of the "Social" group's four posts) and
`story_1080x1920` (1080×1920, portrait, its own separate catalogue item) — which reads like a conflict:
where does a SQUARE signature post's content come from, if the schema only has a story-shaped one?

**Chosen.** Not a conflict — one piece of content (`kit.socialTemplates[3]`: a headline plus
`practitioner_line`), rendered into two canvases. `renderSignature()` (`lib/kit/render/social-posts.ts`)
takes a `shape: "square" | "story"` parameter and composes the same centred headline/practitioner-line
layout at 1080×1080 or 1080×1920. This matches how the on-screen preview already treats the `signature`
tile — a centred short statement, not something whose meaning changes with aspect ratio — and avoids
inventing a second, un-sourced content field for the square version.

---

### 2026-09-03 — business card back: the standalone monogram on primary

**Question.** The brief specifies `business_card_front`'s content in detail (via the existing `BusinessCard`
preview component, whose layout this renderer mirrors) but says nothing about `business_card_back`.

**Chosen.** The two-letter (or one-letter) monogram, centred, ink `cta_ink` on a `primary` fill — the same
visual language as `monogram_png_512_primary`, reused rather than invented fresh. A plain, common
back-of-card treatment (mark alone, no text) that needs no new content decision.

---

### 2026-09-03 — cover images keep content clear of the platform avatar overlay

**Question.** LinkedIn and Facebook both overlay the profile photo on the lower-left of a cover image at
render time — content placed there in the uploaded file gets covered. Nothing in the brief calls this out
explicitly.

**Chosen.** Both `cover_linkedin_1584x396` and `cover_facebook_1640x624` keep all text clear of a
bottom-left zone sized at 1.6× the cover's own height (a conservative estimate — LinkedIn's own avatar
overlay is roughly square and about that tall) — content sits right-of-centre instead. Better to under-use
the canvas than ship a file where the practice name is guaranteed to be hidden behind the practitioner's
own photo on the platform it's for.

---

### 2026-09-03 — email signature content: `practice_details` first, `practitioner_line` as fallback

**Question.** The brief wants "name, licence label and number, practice name..., city and state, booking
link" on the email signature. `license_number` doesn't exist on `project_briefs` (confirmed earlier,
`asset-fingerprint.ts`'s own comment) — but it DOES exist, optionally, on the site editor's
`practice_details` (`lib/site/types.ts`'s `PracticeDetails`), gated behind "condition of presence" (a
control is offered only once the backend actually exposes the key, per that type's own comment).

**Chosen.** Read `practice_details` when present (gives the richer name/license-label/license-number/city/
state breakdown); fall back to the already-composed `practitioner_line` (name + credential as one string)
plus the practice name alone when it isn't. Never fabricate a license number that isn't there — the field
is simply omitted from that line, exactly like every other optional field here.

**Booking link.** `spec.hero.cta_target_url` — the exact URL the site's own "Book a consult" button already
points to, not a new field invented for this asset.

---

### 2026-09-03 — `brand_kit_zip`: hand-built ZIP, STORED entries only, verified with the real `unzip`

**Question.** No zip library exists in this repo's dependencies. Hand-roll the format (matching the
existing PDF/ASE precedent) or add a dependency?

**Chosen.** Hand-built, `lib/kit/render/zip.ts` — same reasoning as PDF/ASE: the format is small, stable,
and well-documented, and every file going into it is already either compressed (every PNG) or small text,
so a dependency buys little. STORED entries only (no DEFLATE): avoids the one real correctness risk a
hand-rolled compressor would carry (getting the compressed stream's framing subtly wrong) for a cost of a
few kilobytes on the small text files — a PNG re-compressed a second time saves almost nothing anyway.
Fully spec-compliant, not a shortcut: STORED is part of the ZIP format itself.

**Verified independently, not just self-checked.** Built a test archive and ran it through the system
`unzip -l`/`unzip -t` (a real, independent implementation, not this session's own code) — confirmed correct
listing and "No errors detected in compressed data" on every entry, including a binary PNG. This caught a
real bug on the first pass: the DOS date field was computed one year off (1981 instead of the 1980 epoch,
a bit-shift error) — fixed and re-verified. Then ran the actual `brand_kit_zip` registry entry end to end
(all 34 other keys + README.txt, 552KB, 35 files) through the same `unzip` check.

**README structure.** Flat (no per-group subfolders) — one README.txt at the archive root describing every
file by key and where it goes, written once (not duplicated per asset_catalog group), since the zip always
bundles the full catalogue regardless of tier: the paywall gates the ROUTE, not which files a paid kit's
zip contains.

**A kit missing one input still ships a zip.** `brand_kit_zip`'s loop catches and logs a per-renderer
failure (e.g. a kit with no `practiceDetails` yet still renders `email_signature_html` from the
`practitioner_line` fallback and never actually fails, but the pattern exists for any renderer that
legitimately can't produce output) rather than failing the whole download — one missing file is a better
failure than none of them.

---

### 2026-09-03 — Lot 3: "Your site" needed no `<BrandCanvas>` change

**Question.** The brief says extend the `<BrandCanvas>` treatment to "Identity, Your site and Your words,
which Lot 1 did not reach." Identity and Your words genuinely had no saturated-in-her-colors treatment
before this lot. Your site already renders `<BrandPreview size="full">`, which manages its OWN
`--p-*` custom properties internally (`lib/brand/derive.ts`'s `previewCssVariables`) — a full takeover of
her fonts and colors, just not through the literal `<BrandCanvas>` component (which uses `--brand-*`,
scoped for the paid-space-wide canvas use case `canvas-tokens.ts`'s own header describes).

**Chosen.** Left "Your site" as it already was — full saturation via `<BrandPreview>`, no wrapping
`<BrandCanvas>` added. The brief's phrase is "the BrandCanvas TREATMENT" (the visual language: her colors
and fonts fully in control of a framed surface), not literally the component; `<BrandPreview>` already
delivers that, and predates this lot doing so. Two competing token systems (`--p-*` AND `--brand-*`) on the
same DOM subtree would be the kind of accidental complexity the two-prefix design was built specifically to
avoid (see `canvas-tokens.ts`'s header: "so the two never collide on a page that renders both").

---

### 2026-09-03 — Lot 3: no scroll-spy on the section nav; no per-request Playwright dependency

**Question.** The brief's sticky rail navigation implies a natural next step — highlighting the section
currently in view as someone scrolls (an IntersectionObserver-driven "active" state). And the whole
workspace redesign genuinely warrants a real rendered check, not just `tsc`/`next build`.

**Chosen.** Plain anchor links, no active-section tracking. No React testing-library/Playwright dependency
added to verify visually — the environment notes an existing pre-installed Chromium for this sandbox, but
this REPO has no Playwright package installed, and this session has no live Supabase credentials to drive
an authenticated page load past `/login` even if it did (this page requires an authenticated, entitled,
selected-direction kit — not reachable without secrets this session doesn't have).

**Why not build either anyway.** Scroll-spy logic I can't watch scroll is a coin flip on correctness — a
wrong "active" state is worse than an honest plain-link nav that unambiguously works. Adding a Playwright
devDependency and a fixture-authenticated flow to visually drive this ONE page is a nontrivial new piece of
test infrastructure this repo has never had (confirmed: zero `.test.tsx`/testing-library usage anywhere) —
disproportionate to add unilaterally for one lot's visual check when the existing, accepted verification
bar for UI in this session (per the very first DECISIONS.md entry) is `tsc`/`eslint`/`next build`/`vitest`
plus honest disclosure of what a real browser would still need to confirm. This joins that same disclosed
list rather than pretending to close it.

---

### 2026-09-03 — Lot 5: `pdf-lib` + `@pdf-lib/fontkit` added as dependencies

**Question.** The brief names this exact pairing by name ("`pdf-lib` + `fontkit`, no Chromium") for the
brand guide PDF. Neither was in this repo.

**Chosen.** Installed `pdf-lib@1.17.1` and `@pdf-lib/fontkit@1.1.1` (both current at install time). Not a
judgment call in the sense the other entries here are — the brief specifies the library by name for
exactly this purpose, so this is implementing what was asked, not choosing an alternative. Noted here only
because it's the first new runtime dependency this session has added (every prior format — PDF-1.4 base
pages, `.ase`, `.zip` — was hand-built specifically to avoid one).

`npm install` surfaced one pre-existing moderate advisory (`fflate`, a transitive dependency of `satori`,
unrelated to pdf-lib/fontkit) — not introduced by this change, and `npm audit fix --force` would bump
satori to a breaking major version, risking every Lot 4.4 renderer for a vulnerability in a code path
(`unzipSync` on malformed ZIP64 input) this app never exercises. Left alone; flagged here rather than run
silently.

---

### 2026-09-03 — Lot 5: found real layout bugs only by rendering and looking, not by any tool

**What happened.** The layout helper (`lib/kit/pdf/layout.ts`) and the fourteen-page composer
(`lib/kit/pdf/brand-guide.ts`) both passed `tsc`, `eslint`, and a real independent `pdftotext`/`pdfinfo`
check (installed `poppler-utils` specifically for this — see WORKLOG.md) on the first pass. Rasterizing
every page with `pdftoppm` and actually looking at them (not reading extracted text) found THREE real
bugs none of the above caught: a six-column swatch row whose labels overflowed into the next column
(`LIGHT NEUTRAL #F4EEE3DARK NEUTRAL #2B2A27` ran together in the text extraction — the tell), the cover
and Identity pages' large-heading-to-body-text gaps being too tight (baselines nearly touching, since a
big heading's own leading only clears its own descenders, not a comfortable gap before the next block),
and the closing page's "Made with Eklio" line sitting almost on top of the disclaimer above it (a raw
`page.drawText` call missing the same baseline-offset convention `PageFlow.text()` applies automatically).

**Chosen.** Fixed all three: `swatchRow` now truncates a label that would overflow its own column
(general fix, not just a shorter caller-supplied string); the cover/Identity/Type-applied pages' post-
heading gaps are now sized proportional to the heading's own font size, not a small fixed constant; the
type-scale loop's inter-step gap does the same; the stray `drawText` call now applies the same baseline
offset the layout helper's own `text()` method uses. Re-rendered and re-inspected after each fix.

**Why this is recorded as its own entry.** Not a design decision — a discipline point: a compiling,
type-checked, text-extractable PDF can still be visually broken, and this session's stated verification
bar ("open the rendered file and look at it") caught something the automated checks structurally cannot.
Worth a line so the pattern — render everything with a real tool, then ALSO look at the raster output, not
just the extracted text — carries into whatever visual output comes after this lot.

---

### 2026-09-03 — a real mistake: overwrote pre-existing, shipped ethics files without reading them first

**What happened.** Starting Lot 7, I used the Write tool to create `lib/ethics/rules.ts` and
`lib/ethics/__tests__/rules.test.ts` — WITHOUT first checking whether either path already existed. Both
did: a mature, already-shipped, three-level Ethics Guard (`ETHICS_SYSTEM_RULES` prompt injection,
`checkEthics`/`FORBIDDEN_PATTERNS` deterministic scanning, `enforceEthics` targeted-rewrite-and-persist,
`lib/ethics/guard.ts`, plus a ~240-line test suite covering both real violations and hand-picked false
positives) from an earlier chantier on this same branch's history. My `Write` call silently replaced 403
lines of that with a smaller, parallel implementation using a DIFFERENT six rule ids
(`outcome_guarantee`/`testimonial`/`scarcity`/`superlative_credential`/`clinical_claim`/
`unsourced_statistic`) than the real, database-backed ones (`timeframe`/`proven`/`client_voice`/
`credential`/`scarcity`/`diagnosis`). Running the test suite immediately surfaced it — `guard.ts` broke
with `checkEthics is not a function` — which is what caught this before it went any further.

**What I did about it.** `git checkout -- lib/ethics/rules.ts lib/ethics/__tests__/rules.test.ts`
immediately, restoring both to their committed state. Confirmed the full local test suite (930/930 at the
time) passing again. Then read the restored files in full, and `lib/ethics/guard.ts`, before deciding
anything else — the mistake was proceeding without reading first; the fix was not to repeat that.

**What this meant for Lot 5, already committed.** The brand guide PDF's "Ethics Guard" page (built earlier
in this same session, before this mistake) used a now-deleted `lib/ethics/rule-definitions.ts` — invented
content matching the WRONG six rule ids, since it was written without knowing the real system existed
either. Fixed as its own follow-up: `BrandGuideData` now takes real `ethicsRules` from `readCatalog(...)
.ethicsRules` (the exact same `ethics_rules` table rows `guard.ts`'s own `rulesBlock()` reads for prompts —
confirmed the real seeded content directly from the migration, not assumed), never a hand-written second
copy. Re-rendered and re-verified (poppler tools, page rasterized and read) after the fix.

**What Lot 7 actually is, now that the real system is understood.** Not a new scanning engine — one
already exists, is already wired into generation, and is well-tested. `checkEthics(text)` is the function
this session should build the two new UI surfaces on top of (the BOARD-SAFE COPY chip becoming clickable,
reading the real `brand_kits.ethics_check.flagged` data; a new "Check your own words" textarea calling
`checkEthics` directly on text SHE writes, distinct from the existing pipeline's AI-generated-copy gate).
No new rule taxonomy, no new file at `lib/ethics/rules.ts` — that name is taken, correctly, by something
better than what this session almost replaced it with.

**Why this is recorded in full, not summarized away.** The user's own rule for this session is honesty
about what was and wasn't done, mistakes included — restoring the files quickly is not the same as the
mistake not mattering. A `git status`/`ls`/`Read` before a `Write` to any path not already known to be new
would have caught this before it happened; that check is now something to do explicitly before creating
any file in an area of the codebase not already explored this session.

---

### 2026-09-03 — Lot 7: `checkEthics`'s excerpt-only output located by `indexOf`, not by extending the engine

**Question.** "Check your own words" needs to underline flagged SPANS in a textarea. The real, tested
`checkEthics(text)` returns each violation's matched `excerpt` string (`"...trim()"`-ed matched text) but no
character offset — by design, per its own comment ("un pattern ne remonte que sa première occurrence : le
but est de nommer le problème... pas d'en dresser l'inventaire exhaustif"). Extending it to also return an
offset would touch tested, shipped code in the exact area this session just made one costly mistake in.

**Chosen.** A small, presentation-only `segmentText()` helper (`components/kit/check-your-words.tsx`,
exported and tested against the REAL `checkEthics` output — not a hand-built fixture) locates each
violation's excerpt with `text.indexOf()` purely for display, splits the text into plain/flagged segments
around it, and never touches `lib/ethics/rules.ts` or `guard.ts`. `indexOf` finds the FIRST occurrence,
which matches the engine's own first-occurrence-only design — no mismatch between what's flagged and what
gets found to underline.

**Why not extend the engine instead.** Lower risk, smaller surface, and consistent with the actual failure
mode this session just hit: touching `lib/ethics/*` without a proven need is where the mistake happened.
Locating an already-known excerpt string is a strictly presentational problem: it doesn't need the engine
to change shape to solve it.

---

### 2026-09-03 — Lot 7: the BOARD-SAFE COPY badge and "Check your own words" both read the real `ethics_rules` catalog

**Question.** Both new surfaces need user-facing rule text (a label, a plain-English description) to show
alongside a flag. `EthicsViolation.reason` (the fallback string on each `FORBIDDEN_PATTERNS` entry) exists,
but reading it directly would be wrong twice over: it's meant as a fallback ONLY for when a rule is
missing from the database (`guard.ts`'s own `describe()` function: `rule?.description ?? violation.reason`
— the DB text is preferred), and several of these fallback strings are in French, left over from an
earlier chantier's own internal reasoning — never meant to reach a US practitioner's screen.

**Chosen.** Both new components take `ethicsRules: {id, label, description}[]` as a prop, populated from
`readCatalog(supabase).ethicsRules` in `page.tsx` (the exact same query shape `lib/kit/pdf/brand-guide.ts`'s
route now uses for the same reason, and the exact table `guard.ts`'s own `rulesBlock()` reads for prompts)
— a lookup by `rule_id`/`ruleId`, `reason`/`violation.reason` never displayed. Third correct reader of one
source, not a fourth invention of the content — the same principle the Ethics Guard PDF-page fix above
just re-established.

---

### 2026-09-03 — Lot 6: "Your first week" evolves `launch_checklist_items` in place, not a parallel `launch_steps` table

**Question.** The brief specifies a new table `launch_steps` (`brand_kit_id, step_key, status, completed_at,
updated_at`) with RPCs `get_launch_progress`/`set_launch_step` and seven exact steps. Research (before
writing anything, per the lesson from the Lot 7 mistake above) found a complete, already-shipped system
under a different name — `launch_checklist_items`
(`20260827104000_launch_checklist_items.sql`): RLS'd, idempotently seeded on kit creation, backfilled,
guard-railed, with a full frontend stack already wired into the home screen
(`lib/data/checklist.ts`, `app/api/checklist/[id]/route.ts`, `components/home/checklist-card.tsx`). It has
six items (missing two of the brief's seven: `social_setup`, `booking_link`), a `done_at`-only binary
status (the brief wants a `todo`/`done`/`skipped` tri-state), and one item — `choose_direction` — that
predates this chantier and isn't one of the seven at all.

**Chosen.** One additive migration
(`eklio-backend/supabase/migrations/20260903260000_launch_checklist_first_week.sql`): widen the `key` CHECK
to add `social_setup`/`booking_link`; add a nullable `skipped_at` column with a mutual-exclusion CHECK
against `done_at`; UPDATE (not delete-and-recreate) four existing keys' `label`/`description` to the
brief's wording, and rename `paste_site_prompt` → `site_setup` in place (`done_at` carried over — Lot 1
replaced the "paste your site prompt" flow with the site editor, so the row's underlying meaning — "get
your brand onto your actual site" — is unchanged, only its old name was stale); leave `choose_direction`
rows alone but exclude that key from both new RPCs' output (it stays for the pre-existing
`complete_choose_direction` trigger to keep writing to, never shown as one of "your first week"'s seven);
`CREATE OR REPLACE` `seed_launch_checklist` to seed all eight keys going forward, re-run once over every
existing kit for the backfill; add `get_launch_progress`/`set_launch_step` with the brief's exact RPC
names, both re-revoking EXECUTE from `anon` explicitly (belt-and-suspenders alongside Postgres's own
CREATE-OR-REPLACE-preserves-ACLs behavior, matching `20260902090000_revoke_internal_function_surface.sql`'s
own defensive style) and re-asserting the guard rail inline. Dry-run rehearsed against the live project
(`begin; ... rollback;`) before applying for real, then the ledger version corrected to the file's own
timestamp — the same live-apply discipline as every Lot 4.4 migration.

**Why not the brief's literal `launch_steps` table.** It and `launch_checklist_items` are the same feature
under two different names — building the second one would have shipped two checklists nobody asked for,
split the auto-completion trigger's target from the read path, and thrown away tested RLS for no reason.
The four stop conditions don't forbid evolving a table in place; they forbid destructive changes, and
nothing here drops a row, deletes progress, or is irreversible in a way that would matter if this call
is wrong — the DOWN section can't undo the reseed/relabel without deleting real `done_at`/`skipped_at`
progress, so it deliberately leaves the schema forward-compatible instead of attempting a rollback that
would itself be destructive.

---

### 2026-09-03 — Lot 6: home's card and the kit page's row share one `LaunchChecklist` component, but not the same context richness

**Question.** The brief asks for both "a compact progress row on the kit page" and "the primary card on
home", each step "showing the exact asset and exact text, never generic advice" — concretely, for example,
the email-signature step shows the actual signature block with a Copy button, and the social-setup step
shows a real ≤150-char bio with a counter. Building that twice (once per surface) would drift the moment
either one changed. But the two pages don't have the same data on hand for free: the kit page
(`app/app/brand-kits/[id]/page.tsx`) already calls `siteSpecGet` for the "Your site" card, so
`practice_details`/`hero.cta_target_url` (credential, location, booking link) cost nothing extra there;
home's aggregate (`lib/data/home.ts`) does not fetch the site spec today, and it is read on every visit to
the retention screen — adding an RPC call there for checklist copy alone is a real, recurring cost for a
detail view most visits won't open.

**Chosen.** One shared component, `components/checklist/launch-checklist.tsx` — the list, the
optimistic Mark-done/Skip-for-now write (via the same `PATCH /api/checklist/[id]` route both surfaces already
call), the progress bar, the "resolved === total" one-line collapse, and the per-step detail switch — takes
a `LaunchStepContext` whose richer fields (`practiceDetails`, `bookingUrl`) are optional. The kit page's
`LaunchProgressRow` passes the full context (it already has the site spec in hand). Home's `ChecklistCard`
passes `practiceDetails: null, bookingUrl: null` deliberately, with a comment explaining why, and those two
steps render their honest "finish this in the site editor" fallback there instead of the copy-paste block.
Nothing is invented to fill the gap — a real absence gets an honest, specific message pointing at where to
fix it, never a generic placeholder.

**Why not fetch the site spec on home too.** It would make every home load pay for a lookup whose payoff
(richer content on two of seven checklist steps, only visible if she expands them) is disproportionate to
its cost on the screen she'll load daily. The kit page already amortizes that cost for other cards; home
doesn't have that already-paid-for lookup to lean on.

---

### 2026-09-03 — Lot 6: per-step "generated" bio and email-signature block are deterministic string assembly, never new copy

**Question.** The brief's parenthetical for `social_setup` says "a generated bio ≤150 chars with a
counter" and for `email_signature` "the block, a Copy button". Both read, out of context, as if they might
call for writing new marketing copy on her behalf — which the standing rule (no model call anywhere in the
asset pipeline, the PDF, or the ethics scanner — deterministic, always) would forbid, and which nothing in
this chantier's pipeline does anywhere else.

**Chosen.** `lib/kit/launch-copy.ts` — three pure functions, unit-tested (`__tests__/launch-copy.test.ts`,
9 cases): `personalStatement()` joins fields the kit already has (practitioner line, license, city/state)
with an em dash, dropping anything missing; `shortBio()` truncates the kit's own `about_excerpt` to ≤150
chars at a word boundary with an ellipsis — a truncation of existing copy, not new copy; `emailSignatureText()`
assembles a plain-text block from the same already-on-file fields plus the booking URL. "Generated" here
means "derived deterministically from data already on the kit," matching the fingerprinted-asset pipeline's
own meaning of the word — never a model call, and nothing here writes anything back to the kit.

---

### 2026-09-03 — Lot 8: the "blurred card" the brief means turns out to already be more honest than assumed — research before redesign confirmed what to actually change

**Question.** The brief says "Delete every blurred card in the product" and describes fabricated sample
content as the thing being removed. Research (dispatched before writing anything, same discipline as Lot
6) found `components/home/content-grid.tsx`'s `LockedTile` — the one real blurred-card pattern in the
product — already shows a REAL title (from `monthly_presence_content.title`, which the backend
deliberately populates even on locked rows) both blurred inside the tile AND legibly in plain text right
below it for screen readers. So the blur was decorative and honest (a real title, not an invented one),
and the zero-row states already in place (`/app/content`'s "Nothing yet" card, home's section simply not
rendering) already showed no fabricated content anywhere. Nothing here was actually dishonest.

**Chosen.** Ship the brief's redesign anyway — it's still a real, specified visual change (blur → legible
reduced-opacity row with a small lock, not a big centered padlock over a colored block) and exact required
copy strings ("Your first month is being prepared.", the subscription card's line) neither of which existed
verbatim before. But the WORLDVIEW driving the implementation changed: this isn't "remove fabricated
content," it's "the honest empty/locked states already existed structurally, now they get the brief's exact
words and the brief's visual treatment." Recorded here so a future reader doesn't assume this lot fixed a
dishonesty bug — it didn't find one.

---

### 2026-09-03 — Lot 8: "downloadable" ships as a plain-text file, not a rendered image asset

**Question.** The brief: "the first post and first story in full and downloadable." Lot 4.4 built a full
deterministic image-rendering pipeline (satori/resvg) for kit assets, so "downloadable" could mean the same
kind of rendered PNG/SVG output. But `monthly_presence_content.visual_spec` — the column that would carry
that — is never written anywhere: `lib/generation/monthly.ts`'s `planMonth()` only ever returns
`title`/`caption`; no renderer, no template, no asset-catalog entry exists for monthly content today.

**Chosen.** "Downloadable" ships as a client-side `.txt` file (title + caption via a `Blob`/`<a download>`),
added to `OpenTile` in `content-grid.tsx`. Building a whole new visual-post rendering subsystem — new
templates, a new renderer, storage, caching — to make "downloadable" mean "an image" is a genuinely large
new feature, not a display-honesty fix, and isn't something this lot's brief asked for outright. If Eklio
ever wants rendered monthly-post images, that's its own lot with its own asset-catalog rows, matching how
every other rendered asset in this product got built.

---

### 2026-09-03 — Lot 2: "right after Stripe returns" means right after a direction is selected, not right after checkout

**Question.** The brief: the delivery ceremony is "reachable once, right after Stripe returns." Taken
literally, that would put `/delivered` between `checkout/success` and whatever comes next. But the
ceremony's own content — six real palette colors, a rendered site hero, an Instagram post, an email
signature, a business card — needs a SELECTED DIRECTION to exist at all; at the moment Stripe returns,
no direction has been chosen yet (that happens afterward, on the reveal screen). Literally wiring this to
"right after Stripe returns" would mean either rendering it before there's anything real to show, or
building a second gate to defer it — neither of which the brief describes.

**Chosen.** Spliced the ceremony in at the ACTUAL moment a brand becomes real: `lib/reveal/
use-select-direction.ts`'s success path, which used to `router.push('/app/brand-kits/[id]')` straight to
the workspace after a direction is selected, now pushes to `/app/brand-kits/[id]/delivered` first. That
page redirects to the workspace once the ceremony's been seen. This is the earliest point in the real
flow where "your brand, as of today" is actually true — everything the brief's copy describes exists by
then, nothing in the ceremony is a placeholder waiting to be filled in.

---

### 2026-09-03 — Lot 2: the ceremony is built entirely from the app's four existing motion primitives

**Question.** `app/globals.css`'s own header comment is explicit: "§3 : quatre mouvements, pas un de plus"
(four movements, not one more) — `route-enter`, `question-enter`, `reveal-rise`, `check-pop`. The delivery
ceremony needs a wordmark reveal, six colors arriving in sequence 120ms apart, and four surfaces fading up
together — new-looking motion that could easily have meant new `@keyframes`.

**Chosen.** Reused `.reveal-rise` (already `stagger-index`-driven, already tuned to `--stagger-reveal:
120ms` for exactly "arrive N × 120ms apart" — the reveal ceremony's own act-two.tsx already stages its
direction cards this exact way) for every beat: the wordmark at `--stagger-index: 0`, the six color bands
at 1–6 (arriving 120ms apart, literally), the four surfaces sharing one index (9) so they animate
together rather than staggered, the settling line at 14, the two actions at 16. No new keyframes anywhere
in this lot. `prefers-reduced-motion` needed no per-component handling either — the SAME global media
query that already collapses every animation in the app to near-zero duration
(`app/globals.css`'s `@media (prefers-reduced-motion: reduce)` block) covers `.reveal-rise` automatically,
confirmed by reading that rule rather than assumed.

The resulting total is closer to ~2.1–2.3s than the brief's literal "2.4s" — an exact 2.4s would have meant
either inventing new duration tokens or padding the sequence with dead stagger steps that do nothing but
wait; reusing the existing rhythm and landing close is truer to "a designer putting the work on the table"
than hitting a stopwatch number built from arithmetic no one asked to see.

---

### 2026-09-03 — Lot 2: the wordmark, the Instagram post, the signature, and the card are the real rendered assets, fetched the same way every other asset download already works

**Question.** "Wordmark draws in," "four surfaces fade up" (site hero, one Instagram post, the email
signature, the business card) — all four already exist as real, deterministic renderers from Lot 4.4
(`wordmark_svg_dark`, `post_statement_1080`, `email_signature_png`, `business_card_front`). The only
question was how to get them onto this new screen.

**Chosen.** The exact same client pattern `AssetDownloadButton` already uses: a same-origin `POST /api/
brand-kits/[id]/assets/[key]` fetch (session cookie carried automatically), rendering the asset if its
fingerprint is stale and returning a short-lived signed URL either way. `DeliveryCeremony` fetches all
four keys on mount and fades each `<img>` in as its URL arrives — never a second render path, never an
inline re-implementation of what the registry already produces. The site hero itself reuses `<BrandPreview
variant="thumbnail" shape="site">`, the same live React component every other brand-preview surface in the
app already renders from `direction`/`practiceName` — no fetch needed for that one, it was never a stored
asset to begin with.

---

### 2026-09-03 — Lot 2: `delivered_seen_at` is set before the ceremony renders, not after it finishes

**Question.** Should "seen" mean "the page loaded" or "she watched it through to the end"? The brief says
"No replay button" and "later visits redirect to the kit" — but doesn't say what counts as a visit if the
animation is interrupted (a refresh mid-sequence, a slow connection, closing the tab early).

**Chosen.** `mark_brand_kit_delivered` runs server-side, before the ceremony is returned to the browser at
all — the very first load sets `delivered_seen_at`, full stop. A refresh during the animation redirects to
the workspace instead of restarting it. This is the stricter, simpler reading of "no replay button": there
genuinely is no way to see it twice, not even by accident, and it avoids a second, fuzzier definition of
"watched" that would need its own client-side signal (an animation-end event, a timer) to be trustworthy.

---

### 2026-09-03 — Lot 9: "Since you were here" reuses `brand_assets`/`monthly_presence_content` timestamps, not `site_spec_diff`

**Question.** The brief: "`Since you were here` built from the existing diff and the asset fingerprint."
"The existing diff" most literally names `site_spec_diff`/`change_marks` — the "changed since you copied"
mechanism the site editor's staleness banner already uses. But that mechanism is keyed to a specific,
different event (`last_copied_spec_version`), not to a home visit; there was also no "last visited home"
marker anywhere in the schema at all (confirmed by research before writing anything) — this needed new
state regardless of which diff mechanism backed it.

**Chosen.** One new nullable marker, `brand_kits.home_content_seen_at`, and one RPC
(`home_recent_activity`) that reports two real signals since it — new `brand_assets` rows (each one IS a
fingerprinted render; a new row appearing IS a fingerprint changing — "the asset fingerprint," literally)
and `monthly_presence_content` items that moved to `ready`/`published` — then advances the marker. A
never-visited kit (null marker) reports nothing rather than its entire history, matching `mark_brand_kit_
delivered`'s own "first_view" idea of not treating "never" the same as "everything."

**Why not reuse `site_spec_diff`.** Doing so faithfully would mean adding a second baseline column to
`site_specs` (`home_seen_spec_version`, alongside the existing `last_copied_spec_version`) and a near-
duplicate of `site_spec_diff`'s `change_marks`-parsing SQL to avoid touching an already-shipped, tested
function's shape — real, avoidable surface for the same underlying spirit ("what's new since she was
here") that two already-timestamped tables already answer directly. Recorded as a deliberate scope call,
not silently narrower than what the brief's wording most literally names.

**A real caveat, not silently absorbed.** `home_recent_activity` MUTATES its own marker on every call —
reading it is not free of side effects. It only runs from `loadHome()`, which both the home page and
`GET /api/home` call identically (this codebase's own rule: "the screen and the route cannot diverge").
Nothing in this repo currently calls `GET /api/home` more than once per real visit, so this is safe today —
but if that route is ever polled by a future client (a mobile app, for instance) rather than loaded once
per visit, the marker will advance on every poll and "Since you were here" will under-report. Flagged in
FINDINGS.md rather than solved by re-architecting the mutating-RPC design pre-emptively for a client that
doesn't exist yet.

---

### 2026-09-03 — Lot 9: the typed practice-name confirmation is a client-side safety net, not a server-verified check

**Question.** `delete_brand_kit(kit_id)` — the brief specifies "typed confirmation of the practice name."
Should the RPC itself verify the typed string server-side, or is a client-side gate enough?

**Chosen.** Client-side only: `DeleteKitSection`'s modal disables the Delete button until the typed text
exactly matches `practiceName`, but `delete_brand_kit` itself only checks ownership (`auth.uid()` through
`brand_kits -> projects`) — the same split `ConfirmReset` (`components/site/reset-section.tsx`) already
uses for its own destructive confirmation, and the one this new modal's focus-trap/ARIA/Escape behavior
copies verbatim. The typed name's job is catching a wrong click or a moment of second-guessing, not
authorization — ownership is the real boundary, and it's already enforced independent of anything the
client sends. Replicating the name-match server-side would also require the RPC to reproduce `hydrate()`'s
practice-name fallback chain (`project_briefs.practice_name` else `projects.name`) in SQL — a second
implementation of a rule that already lives in exactly one place in the frontend.

---

### 2026-09-03 — Lot 9: deleting and restoring a kit are free actions, not gated on `isBrandKitEntitled`

**Question.** Every route under `app/api/brand-kits/[id]/...` is required, by the route-enumerating test,
to either call `isBrandKitEntitled` or rely on a database-level refusal, or be explicitly allowlisted as
free with a reason. Should deleting/restoring require a paid, entitled kit?

**Chosen.** No — added to the test's `FREE` allowlist instead. An unpaid kit, or one whose purchase was
later reversed, still needs to be deletable as ordinary account housekeeping; gating deletion on the same
paywall that gates the kit's CONTENT would mean a practitioner who wants to delete a kit she never finished
paying for, or whose payment was reversed, could not — the exact wrong failure mode for a "clean up after
yourself" action. Restoring gets the same allowlisting for the same reason: it undoes a free action, so it
has to be free too.

---

### 2026-09-03 — Lot 9: the 30-day storage purge is a real, registered cron this session never triggers

**Question.** "Storage purged after [30 days]" is explicit in the brief. Building and registering an
actually-scheduled destructive job (hard-deleting rows and Storage objects) sits close to the stop
condition around destructive database/storage actions — worth pausing on rather than building reflexively.

**Chosen.** Built it (`app/api/cron/purge-deleted-kits`, registered in `vercel.json` at `0 6 * * *`),
following `cron/monthly`'s exact established pattern (`authorizeCron`, `service_role`, idempotent,
externally scheduled) — but never invoked it, in this session, against the live project. The distinction
that matters: the stop condition is about actions taken directly, now, against real deployed data — not
about writing code whose eventual, scheduled, user-consented behavior (a kit she typed her own practice
name to confirm deleting, 30 days ago) is a purge. The same logic already governs every other cron in this
product (`cron/monthly` writes real content on a schedule this session doesn't fire either). Building it
and registering it is the deliverable the brief asks for; running it against production data was never in
scope for this session regardless.

---

### 2026-09-03 — Lot 8: fixed one live dead-route bug found along the way, left one dead-code instance of the same bug alone

**Question.** Research surfaced two places linking to the removed `/app/projets/...` route tree (retired
at "lot 1," per `brand-kit-view.tsx`'s own header comment): `app/app/checkout/success/page.tsx` (two
`Link`s, on the real post-purchase confirmation page) and `app/app/actions.ts`'s `createProject`/
`deleteProject` (two `redirect()` calls). Same root cause, different severity: `checkout/success` is a
real page a paying user lands on; `actions.ts`'s two functions are grep-confirmed unreachable — no
component anywhere imports `createProject` or `deleteProject`.

**Chosen.** Fixed `checkout/success`'s two links (now `/app`, which resolves the user's current
project/kit itself and picks the right next step, and `/app/content` for the subscribed case) — a real,
live bug on a page every paying customer reaches, mechanical and low-risk to fix. Left `actions.ts`
untouched and logged it in FINDINGS.md instead: it's dead code, not a live bug (nothing can 404 through
code nothing calls), and deciding whether to delete unused server actions outright is a separate judgment
call from "sold honestly" — not this lot's scope, and not free to bundle in without a closer look at
whether it's truly safe to remove.
