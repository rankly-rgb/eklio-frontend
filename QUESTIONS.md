# QUESTIONS.md

Things that genuinely need the user — batched, not asked one at a time. Each written so it can be
answered without needing to reload context: the situation, the actual question, why it matters.

---

### The rest of the Lot 4.4 catalogue

Built `palette_sheet_png` and `og_image_1200x630` (the two named explicitly) on inferred specs, recorded
in `DECISIONS.md`. Two things genuinely can't be guessed safely, so building them risks real rework rather
than a cheap correction:

1. **`avatar_400` and "the favicons"** — named twice in this session (once as trim exceptions in the Lot
   4.4 message), which strongly implies they're real catalogue entries, but their *content* is the
   uncertain part, not just their dimensions. A wordmark doesn't fit a square avatar; the obvious fallback
   is a monogram (practice-name initial(s) on a colour background), but nothing in this session's context
   specifies how many letters, which colour role, or whether "the favicons" means one size or the usual
   set (16/32/180/etc.) with or without an `.ico`. Guessing the dimension is cheap to fix later; guessing
   the actual visual content of a mark meant to represent the whole practice is not.
2. **The rest of the catalogue's exact key/dimension/group list** — the user referred to "the catalogue I
   gave you," which isn't in this session's context (a compaction boundary, most likely). Everything built
   so far either came from an explicit name in a message (`wordmark_svg_dark`, `wordmark_png_dark`,
   `palette_sheet_png`, `og_image_1200x630`) or from something else in this repo confirming it (`type_pairings`
   for the font-warming script). There's nothing else in context to extrapolate from safely.

Pasting the catalogue section again (or just the missing keys/specs) unblocks both.
