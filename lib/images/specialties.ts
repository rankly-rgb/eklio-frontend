/*
 * ── THE SPECIALTY OBJECT REGISTER ───────────────────────────────────────
 *
 * The one honest axis of variation between one therapist's photographs and
 * another's. A brand studio whose seven images are identical for every client
 * is visibly a template; the specialty is what the brief already asked her,
 * so it is what varies.
 *
 * ── TWO HARD RULES, AND THE ARMCHAIR THAT TAUGHT THEM ───────────────────
 *
 * 1. EVERY VALUE IS A STILL LIFE OF OBJECTS AND MATERIALS. No furniture as
 *    the subject, ever, and never a chair of any kind. The map this replaced
 *    was six-tenths chairs, and its fallback — "a single armchair beside a
 *    window" — produced the therapy category's most-used stock image, which
 *    reads melancholy rather than calm.
 * 2. THE FALLBACK IS THE NEUTRAL REGISTER, never furniture. A lookup miss
 *    must degrade to something good. That is the whole lesson: the old map
 *    was keyed on labels written from imagination ("couples therapy",
 *    "eating disorders", "substance use" — none of which the brief can emit),
 *    so `Self-esteem` missed and fell into the armchair without a sound.
 *
 * NEVER CLINICAL. No pill bottles, no scales, no food, no bottles, no
 * journals opened to writing, nothing that depicts a condition. The register
 * evokes a room, never a diagnosis — and the same words are repeated in the
 * prompt's exclusion sentence, because a rule kept only in a comment is not
 * kept.
 *
 * ── NEVER LIGHT, TIME, WEATHER, LENS OR CAMERA ──────────────────────────
 *
 * A register names OBJECTS AND MATERIALS ONLY. The master art direction owns
 * the light — one warm late-afternoon rake from the upper left, for every
 * image — and every register that also mentions light is a contradiction
 * waiting to be generated. That is defect 2 in miniature: the per-state light
 * register fighting the master is exactly how the first photograph ended up
 * with a grey window under a warm cast.
 *
 * Five registers were written with that vocabulary in them and have had it
 * removed: `anxiety` ("early light"), `trauma` ("sunlit"), `depression`
 * ("bright… never dim"), `self_esteem` ("warm light across the wall") and
 * `parenting` ("never bright primary plastic" → "never primary-coloured
 * plastic"). Two of them AGREED with the master, and went anyway: a rule that
 * holds only where it happens to be convenient is not a rule, and the next
 * register written from the same instinct would not agree.
 *
 * `parenting` is the one where the banned word meant something else — "bright"
 * described the PLASTIC, not the room. The reword keeps that meaning exactly.
 * A test cannot tell the two senses apart, and a rule with a carve-out for
 * "but I meant it differently" is the rule the next author will also claim.
 *
 * `lib/images/__tests__/specialties.test.ts` refuses any register carrying
 * that vocabulary. It scans registers only — the hero brief's "plain sunlit
 * wall" is composition, not a register, and it stays word for word.
 *
 * ── KEYED ON THE CATALOGUE ID, NOT THE LABEL ────────────────────────────
 *
 * `self_esteem`, not `Self-esteem`. The id is stable, lowercase, and free of
 * the punctuation and casing that made the previous lookup miss. It also
 * means her label never travels anywhere near the model.
 */

/**
 * Every specialty the brief can emit, taken from the catalogue itself
 * (`public.specialties`, seeded by eklio-backend's
 * `20260827100000_catalog_reference_data.sql`) — NOT from imagination, which
 * is what produced the armchair.
 *
 * Verified against the live catalogue on 2026-09-06. Re-derive with:
 *
 *   select id from public.specialties order by sort_order;
 *
 * `lib/images/__tests__/specialties.test.ts` parses that migration directly
 * whenever eklio-backend is checked out beside this repo, and fails if the
 * two lists have drifted.
 */
export const BRIEF_SPECIALTY_IDS = [
  "anxiety",
  "burnout",
  "trauma",
  "couples",
  "grief",
  "depression",
  "life_transitions",
  "relationships",
  "parenting",
  "self_esteem",
  "identity",
  "adhd",
] as const;

/**
 * What the photograph is OF, per specialty. Substituted into a slot's brief
 * wherever it carries the `{subject}` token.
 *
 * The eight registers the product owner wrote are used as written, except
 * where they named light — see the rule above. The other four are written to
 * match their voice.
 */
export const OBJECT_REGISTER_BY_SPECIALTY: Record<string, string> = {
  anxiety: "a linen throw folded over a bench arm, a stoneware cup, a single sprig in a bud vase",
  burnout:
    "a folded linen cloth over a windowsill, a stoneware mug set down beside it, a low bowl of smooth river stones",
  trauma:
    "a plain plaster wall, a woven basket, one trailing plant; grounded, uncluttered, nothing sharp",
  couples:
    "two stoneware cups on a wooden tray, two folded linen napkins; the pair implied, never depicted",
  grief:
    "a shelf edge with dried eucalyptus, a folded wool blanket, a small closed wooden box; restrained, never funereal",
  depression:
    "a plaster wall with a jute mat, a ceramic pitcher holding one budding branch, a folded wool throw; generous and open, never sparse",
  life_transitions:
    "a shelf half-arranged: a woven basket, a folded linen cloth, a small ceramic dish; unhurried, nothing in disarray",
  relationships:
    "a woven runner across a wooden surface, one shared stoneware bowl, two folded linen cloths at either end; the pair implied, never depicted",
  parenting:
    "a low shelf of muted wooden blocks and a folded felt mat; never primary-coloured plastic",
  self_esteem:
    "a mirror-free vanity corner: a ceramic dish, a folded linen cloth, a single stem in a bud vase",
  identity:
    "a shelf edge holding three small ceramic vessels of different heights, a folded textile, a single dried stem; distinct pieces at ease together",
  adhd: "an ordered desk corner, a ceramic pen cup, a closed notebook, generous negative space",
};

/**
 * The register every miss degrades to, and the register a kit with no named
 * specialty gets. Objects, never furniture — rule 2 above, made structural.
 */
export const NEUTRAL_OBJECT_REGISTER =
  "the corner of a low wooden table carrying a matte ceramic vase of dried branches, two cloth-bound books, and a stoneware cup";

/** The object register for a specialty id, or the neutral one. Never throws, never furniture. */
export function objectRegisterFor(specialtyId: string | null): string {
  if (!specialtyId) return NEUTRAL_OBJECT_REGISTER;
  return OBJECT_REGISTER_BY_SPECIALTY[specialtyId.trim().toLowerCase()] ?? NEUTRAL_OBJECT_REGISTER;
}
