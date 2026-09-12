# Home v3 — zone → source

LOT 0 of the home-v3 chantier. Every number, string and image on `/app` traced
to the read that produces it. A zone with no row here does not render.

This table is the contract the chantier is checked against. It replaces a
visual check on data truth: no screenshot proves a number is real, and this
does.

Read path, in order, both already on the screen before this chantier:

- `loadHome(supabase, user.id)` — `lib/data/home.ts`, shared with `GET /api/home`.
- `loadHomeCanvas(supabase, home)` — same file, this screen only.

## Header row

| Zone | Source |
| --- | --- |
| Mono date line | `homeHeaderDate(now)` — `Intl`, `America/New_York`. No row. |
| Serif line (practice name) | `brand_kits` → `BrandKit.practiceName`, via `loadBrandKitByProject`. |
| Grey sub-line | Product copy, static, in Eklio's voice. Not data. |
| Quote slot | `project_briefs.usp_statement` — the USP she edited and confirmed. Labelled `FROM YOUR POSITIONING`. Collapses when null. |
| Ring `4 of 7` + percentage | `get_launch_progress` RPC → `LaunchProgress.resolvedCount / .total`. |

## Hero canvas

| Zone | Source |
| --- | --- |
| Wordmark | `BrandKit.practiceName`. |
| Page names | `site_spec_get` RPC → `preview.pages[].label`, her enabled pages in their own order. |
| Eyebrow / H1 / subline / CTA label | `site_spec_get` → `spec.hero.overline / .headline / .subhead / .cta_label`. |
| Colours and typefaces | `site_spec_get` → `preview.tokens`, laid on as `--s-*` by `siteTokenVariables`. |
| Photograph | `brand_images` row for slot `hero`, `current` and with a `storage_path`, signed for 300s. Deterministic gradient via `<PhotoSlot>` when absent. |
| Vertical overlay line | `brand_kits.directions[selected].tone_keywords` — exactly three words, database-constrained. |
| Overlay scrim | Solved against her `dark_neutral` with `relativeLuminance`/`contrastRatio` (`lib/brand/color.ts`). See the note below. |

### Stats row

| Tile | Source |
| --- | --- |
| `N Brand assets` | `get_brand_asset_manifest` RPC → `summarizeManifest().currentCount`. |
| `N Pages ready` | `preview.pages.length`. |
| Third tile — `Rebuilt <N>` | `summarizeManifest().lastUpdated`, the most recent current asset's `created_at`. Collapses when null. |

The third tile replaces the mockup's `+42% Brand clarity`, which Eklio cannot
measure. Chosen over image-slot count and colour count because both of those
already appear in "Brand at a glance" two rows down, and a tile repeating a
number one screen-height away is a decoration, not a fact.

## Next step

| Zone | Source |
| --- | --- |
| `NEXT STEP` / `1 OF 7` | `pickNextAction` — unchanged rule. Index of the chosen step in `checklist.items`, over `.total`. |
| Title, body | `get_launch_progress` → `step.label`, `step.description`. |
| Copyable text | `LaunchStepDetail` — `personalStatement`, `shortBio`, `emailSignatureText`, or `spec.hero.cta_target_url`, per step. Absent block when the step has none. |
| Asset row | `get_brand_asset_manifest` entry for the step's asset key: name, `format · width×height`, and `current` for the check. Absent when the step names no asset. |
| `Mark as done` / `Skip for now` | `set_launch_step` RPC, via the existing `LaunchStepActions`. |

## Right rail

| Zone | Source |
| --- | --- |
| Seven checklist rows | `get_launch_progress` → `items[].label` / `.status`. The same seven rows and the same RPC as `/app/launch`. |
| Quick tools | Four static links to routes that exist. Not data. |
| Quote card | `project_briefs.positioning` — her own positioning paragraph. Labelled `FROM YOUR POSITIONING`. Collapses when null. |
| Meta footer | `brand_kits.directions[selected].name`; `specialties.label` for `project_briefs.specialty_ids`, lowest `sort_order`; `project_briefs.city` / `.state`. Each part collapses on its own. |

## Week strip

| Zone | Source |
| --- | --- |
| Seven day letters and dates | `buildWeekStrip(month, todayKey)` — Sunday-to-Saturday window containing today. |
| Dot under a day | `content_items.scheduled_for` via `get_content_month`. |
| `POSTS ON THE …` line | The same `scheduled_for` values, formatted. Collapses when the week carries none. |

## Sub-grid

| Zone | Source |
| --- | --- |
| Recent updates | `sync_notifications` RPC → `kind`, `payload`, `created_at`, `read_at`. Three rows maximum. |
| — relative time | `created_at`. |
| — state dot | `read_at === null`. |
| Brand at a glance — colours | `directions[selected].palette`, five roles. |
| — typefaces | `directions[selected].typography.heading_font` / `.body_font`. `Aa` rendered in her display face. |
| — imagery | Count of `brand_images` rows that are `current` with a `storage_path`. |
| — tone words | `directions[selected].tone_keywords`. |
| Upcoming content | `get_content_month` → `items[]` with a `scheduled_for` on or after today. |
| — thumbnail | `brand_images` row for the item's `image_slot`, signed. Gradient when absent. |
| — `Post N — <date>` | Position in the month's scheduled order, and `scheduled_for`. |
| — caption | `content_items.caption`. |
| — status pill | `content_items.status` through the existing `STATUSES` vocabulary. |

## Zones that collapse, and why

- **Quote slots (both)** when `usp_statement` / `positioning` is null. No
  placeholder and no Eklio house quote: attributing a sentence to her practice
  that she did not write is the substitution this chantier exists to refuse.
- **Third stats tile** when nothing has been rendered yet — `lastUpdated` is
  null and there is no rebuild to date.
- **Next step's asset row and copy well**, independently, when the chosen step
  carries neither.
- **`POSTS ON THE …`** when no scheduled item falls in the visible week.
- **Recent updates** entirely when `sync_notifications` returns nothing.
- **Meta footer parts** individually — a kit with no specialty chosen shows
  direction and city.

## Two things the prompt asserts that the repo does not carry

1. **The scrim is not measured from the photograph's pixels.**
   `measureRegionLuminance` (`lib/kit/render/luminance.ts`) takes a decoded
   `Buffer` and runs `sharp`; it belongs to the asset render pipeline, and
   nothing persists the value it produces — `brand_images` has no luminance
   column. Measuring it on this read path would mean downloading and decoding
   the hero photograph on every home render, or an additive migration. Both are
   outside this chantier. The scrim is instead *solved* against her own
   `dark_neutral` using the pure, linearized WCAG helpers in
   `lib/brand/color.ts`, so the overlay clears 4.5:1 by construction whatever
   the photograph underneath is. Deterministic and honest, but solved against
   her palette, not measured from her picture.

2. **There is no success token.** `styles/tokens.css` carries no green, and its
   own header forbids adding a value that does not come from one of the eight
   reference screens. The status pill uses the existing `STATUSES` vocabulary
   and the linen token. The mockup's green `READY` pill is not reproduced in
   green.

## Defects in the reference itself

The mockup is a GENERATED IMAGE, not an authored design. Its measurements are
reliable for **position, proportion and structure**; they are NOT a type scale,
and it contains outright errors. Two are known:

**The mockup's app header measures ~59px.** `--header-h` is 72px, and all eight
reference screens in `design/reference/` draw it at 72. The image is wrong, the
token is right, and the header was left alone.

**The mockup's week strip draws EIGHT day columns.** Its letter row reads
`S S M T W T F S` above seven real dates (8 through 14). A week has seven days,
and `buildWeekStrip` renders exactly seven — Sunday through Saturday, the window
containing today.

The implementation is right and the reference is wrong on this one. It is
recorded here rather than in a commit message because this file is what a
session reads before touching the week strip: an eighth column is not a missing
feature to restore, and matching the mockup there would mean drawing a day that
does not exist.


## Measured differences deliberately NOT adopted

Found by measuring `design/reference/home-v3/mockup.png` at 1:1 (scale
confirmed against two known tokens: `--text-body` 16px on the header sub-line,
`--text-card-title` 22px on the stats value). **These are not unfixed defects.
They were read, judged and refused on source.**

| Zone | Image measures | Ships as | Why not adopted |
| --- | --- | --- | --- |
| Header serif line | cap 33px → ≈46px | `--text-question` 40px | No token between 40 and 46 |
| Hero canvas headline | cap 32px → ≈44px | `clamp(24px, 3.4vw, 38px)` | Her site's inline type, no token scale applies |
| Next-step card title | cap 20px → ≈28px | **`--text-tone` 25px** | Moved to the one token that sits between 22 and 28 |

The reason is the same for all three: **adopting the image's type sizes means
leaving the token scale for one screen, on the authority of a generated image
whose header height this same file records as wrong.** A pixel measurement off
that image settles where a thing sits; it does not settle how big the type is.
The rule applied instead: where an existing token sits between what shipped and
what the image measures, move to it and name it; where none does, ship
unchanged.

## What measurement caught that eye comparison did not

The by-eye pass (`1ad3443`) added a **border around the emphasised checklist
row**. The mockup has none: sampling a vertical slice through that block's top
edge goes straight from page background `(251,249,246)` to linen `(246,241,232)`
with no darker line between. The border was invented by the comparison, not
read from the reference, and it shipped for three commits before the file could
be measured. Removed.

That is the argument for committing the visual contract **before** a chantier
rather than after: an eye comparison against a pasted image can add something
that is not there and be perfectly confident about it. Five other differences
came out of the same measured pass; this one was a regression, and only the
file could have found it.
