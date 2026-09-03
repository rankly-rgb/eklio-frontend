# QUESTIONS.md

Things that genuinely need the user — batched, not asked one at a time. Each written so it can be
answered without needing to reload context: the situation, the actual question, why it matters.

---

### Lot 8: should the free preview include a story, not just the first post?

The brief describes the honest content-row display as "the first post and first story in full and
downloadable, the rest as a legible calendar." The actual, already-shipped free-tier logic
(`ensure_month_skeleton` in eklio-backend, a prior lot's deliberate design, its own header comment
explains the reasoning) only ever unlocks ONE item for a non-subscriber — the first post of the
month — leaving all four stories locked along with the other eleven posts. A subscriber gets all
sixteen unlocked at once, so there's never a case where exactly "the first post and first story" are
open while the rest are locked; it's either one item free or the whole month.

Built to match the REAL current unlock logic rather than invent a second free story to satisfy the
brief's literal wording — changing which items are free is a monetization decision (how much of the
month a non-subscriber gets to see before paying), not a display-honesty one, and altering it wasn't
something this session decided on its own. If a story should also be free, that's a one-line change to
`ensure_month_skeleton`'s `case` in `20260827105000_monthly_content_calendar.sql` (add a
`d.type = 'story' and d.day = v_story_days[1]` branch) — flagging it here rather than making that call.

---

### The rest of the Lot 4.4 catalogue — RESOLVED

Answered in full by the user's message now recorded verbatim in `POST_PURCHASE_BRIEF.md`
(identity/web/color/social/print/document groups, exact filenames, dimensions, and construction
notes, including the monogram letter-count rule and the 78% inscribed-circle inset for
favicons/`icon_512`/`avatar_400`). No longer blocking. That file is now the source of record for
this and the rest of the delivery order — re-read it instead of asking again.
