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
