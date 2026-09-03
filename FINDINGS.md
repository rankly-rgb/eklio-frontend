# FINDINGS.md

Things seen while working the post-purchase chantier that are outside its scope. Recorded, not fixed, not
built around. One line each: what, where, why it matters.

- `monthly_presence_content` is a fully-coded feature that was never turned on: the table exists with
  owner-only RLS, `lib/data/calendar.ts` and `components/home/content-grid.tsx` are fully built against it,
  and no RPC or route anywhere writes to it — it has zero rows in production. Matters because "This month,
  in your brand" and the Content page have always been rendering an empty state that looks like a bug
  rather than a deliberately-unlaunched pipeline; someone should decide when/how the generator gets built.
  (`POST_PURCHASE_INVENTORY.md` §4 has the full detail.)
