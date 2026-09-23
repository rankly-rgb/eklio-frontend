import { describe, expect, it } from "vitest";
import { validateCopy, archetypeInstruction } from "@/lib/content/generate/copy-batch";

/*
 * ── ⚠ ZÉRO CARROUSEL SUR QUATRE-VINGT-DIX POSTS LIVRÉS ─────────────────
 *
 * Mesuré le 2026-09-23 sur trois mois livrés. Chaque carrousel était tiré,
 * envoyé, **PAYÉ**, puis refusé sur `payload_shape`. Une sonde d'un seul appel
 * a montré ce que le modèle rendait :
 *
 *   {"cards": [...], "card_line": "...", "caption": "...", "alt_text": "..."}
 *
 * — `cards` au PREMIER niveau. `o.payload` était donc `undefined`, et
 * `parse(undefined)` rend `null`.
 *
 * ⚠ LE CARROUSEL EST LE SEUL ARCHÉTYPE DONT LA FORME EMPLOIE ELLE-MÊME LE MOT
 * « payload », pour les cartes qu'il empile. Le modèle a lu le deuxième et
 * aplati le premier. Les dix autres n'ont pas ce piège, et c'est pour ça que
 * personne ne l'a vu : l'enveloppe était décrite une fois, dans le préfixe, et
 * elle suffisait partout ailleurs.
 *
 * Deux corrections : la consigne montre l'enveloppe entière, et une sortie
 * aplatie est RELEVÉE plutôt que jetée — le contenu était juste, seules les
 * accolades étaient mal placées, et jeter un appel payé pour un niveau
 * d'imbrication est le défaut qu'on répare.
 */
const CARDS = [
  { archetype_key: "single_statement", payload: { statement: "Change moves the ground under a settled life." } },
  { archetype_key: "surface_and_beneath", payload: {
      surface: { label: "Holding on", gloss: "every day still runs" },
      beneath: { label: "Still braced", gloss: "nothing asked it to" } } },
  { archetype_key: "single_statement", payload: { statement: "Your body can learn a new ground." } },
];
const ENVELOPE = { card_line: "When the ground shifts", caption: "c".repeat(200), alt_text: "a", rationale: "r" };

describe("un carrousel aplati n'est pas jeté", () => {
  it("la forme correcte passe", () => {
    const r = validateCopy("carousel", JSON.stringify({ payload: { cards: CARDS }, ...ENVELOPE }));
    expect(r.ok).toBe(true);
  });

  it("la forme APLATIE passe aussi, et rend les mêmes cartes", () => {
    const r = validateCopy("carousel", JSON.stringify({ cards: CARDS, ...ENVELOPE }));
    expect(r.ok, `refusé sur ${r.reason}`).toBe(true);
    expect((r.payload as { cards: unknown[] }).cards).toHaveLength(3);
  });

  /*
   * ⚠ ET LE RELEVÉ EST ÉTROIT. Il ne devine rien : la forme doit parser telle
   * quelle. Un payload réellement mal formé reste refusé.
   */
  it("un payload vraiment mal formé reste refusé", () => {
    const r = validateCopy("carousel", JSON.stringify({ cards: [{ nope: 1 }], ...ENVELOPE }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("payload_shape");
  });

  it("deux cartes ne font pas un carrousel, aplati ou non", () => {
    const two = CARDS.slice(0, 2);
    expect(validateCopy("carousel", JSON.stringify({ cards: two, ...ENVELOPE })).ok).toBe(false);
    expect(validateCopy("carousel", JSON.stringify({ payload: { cards: two }, ...ENVELOPE })).ok).toBe(false);
  });

  it("la consigne dit où « cards » se pose", () => {
    const instruction = archetypeInstruction("carousel");
    expect(instruction).toContain('"cards" GOES INSIDE "payload"');
    expect(instruction).toContain('{"payload": {"cards": [...]}');
  });
});
