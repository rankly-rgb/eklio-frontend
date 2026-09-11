# THE TENANCY DECISION — 2 SEPTEMBER 2026

**Author: Naina (project owner). Recorded in the repository on 2026-09-11.**

> ⚠ **THIS FILE IS INCOMPLETE, AND DELIBERATELY SO.**
>
> The instruction was to copy the 2 September document in **verbatim, changing not one word**,
> because a paraphrase in the repo is the failure mode itself. I agree, and that is exactly
> why the rest of this file is empty.
>
> **I do not have the document.** It is in neither repository — I grepped both for
> `organization`, `organization_members`, `is_org_member`, `brand_charter`, `cabinet`,
> `per-seat` and `tenancy` — and it has never been pasted into this session. What I have are
> the passages quoted in the chantier brief of 2026-09-11, and those are reproduced below
> **as quotations of that brief**, which is the only text I can actually attest to.
>
> Writing the rest from the brief's summary would produce a paraphrase wearing the word
> "verbatim", which is worse than a gap: a future session would read it as the source and
> stop looking for the real one. **Paste the document over this file and the gap closes.**

---

## WHAT I CAN ATTEST TO

The following are **verbatim quotations from the 2026-09-11 chantier brief**, which itself
quotes or restates the 2 September document. They are reproduced exactly; where the brief
restates rather than quotes, that is marked.

### The decision itself — restated in the brief, not quoted

> This builds on a decision already taken and written up on 2 September. **Do not re-decide
> it.** One app, not two. One codebase, two commercial paths. The reasoning — a duplicated
> paywall is this project's highest risk, and the growth path from solo to practice crosses
> the boundary — stands.

### The warning — quoted in the brief as a block quotation from the document

> The tenancy layer must land BEFORE the post-purchase chantier, not after.
> Every table added before the org layer is a table to migrate afterwards.

### The schema — quoted in the brief as a code block

```
organizations        id, name, slug, owner_user_id, brand_charter_kit_id, created_at
organization_members org_id, user_id (nullable until they sign up), role ('owner'|'clinician'),
                     status ('invited'|'active'|'removed'), invite_token, invited_email,
                     project_id, created_at, activated_at
```

### The rules that travel with it — from the brief

> `projects.organization_id`, not null, backfilled one organization per existing profile with
> that profile as `owner`.

> **`is_org_member(org_id)`, `SECURITY DEFINER`, one function, called everywhere.** One
> definition to read, one to test. Replace `user_id = auth.uid()` with it — do not add it
> beside.

> **Two roles. `owner` and `clinician`.** No `manager`, no `admin`, until a paying customer
> asks for one.

> Invisible to solo users. A solo therapist must notice nothing.

---

## AMENDMENTS MADE SINCE, WITH DATES

Recorded here because a decision document that does not carry its own amendments is how a
superseded clause gets re-implemented.

**2026-09-11 — `projects.organization_id` becomes nullable.** The 2 September text says `not
null`. It was written eight days before the anonymous brief shipped (backend
`20260910192157`), which made `projects.user_id` nullable: an anonymous project has no user,
therefore no organization. The amendment, confirmed by the project owner on 2026-09-11:

> Your §6 option 1 is right and it changes my written spec, which was drafted on 2 September,
> before the anonymous brief existed. `projects.organization_id` nullable, with
> `organization_id is not null or anon_token_hash is not null`.

**2026-09-11 — the claim is atomic.** Added by the project owner in the same message:

> **One addition: the claim sets `user_id` and `organization_id` together, in one statement,
> or neither.** A row with an owner and no organization is the same class of orphan as the
> purchase with no project — it will read plausibly and be wrong, and we have already paid for
> that lesson this week.

**2026-09-11 — the tenancy layer moves to Session 3.** The function surface takes priority,
because `is_org_member` cannot be defended by a `REVOKE` and neither can anything else. See
`TENANCY.md` §1 and backend `20260911170458`.

---

## WHAT IS EXPLICITLY NOT OCTOBER

From the 2026-09-11 brief, quoted:

> Per-seat billing (the database is the source of truth, Stripe the reflection, with a
> reconciliation that signals rather than corrects — at the first paying cabinet, not before),
> the ingestion of existing practice sites, and the practice UI. All three are written up
> already. None is October.
