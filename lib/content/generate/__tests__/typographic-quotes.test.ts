import { describe, expect, it } from "vitest";
import { typographicQuotes, validateCopy } from "@/lib/content/generate/copy-batch";
import { checkStraightQuotes } from "@/lib/content/writing-checks";

/*
 * ── ⚠ DIX ESSAIS GELÉS SUR DIX REFUSÉS SUR UNE APOSTROPHE ──────────────
 *
 * Le modèle écrit « isn't », « don't », « life's » : c'est l'anglais tel qu'on
 * le tape, et aucune consigne ne l'en empêchera de façon fiable. Or U+0027
 * dans un empattement de display à 90 px rend un trait vertical nu.
 *
 * ⚠ CE N'EST PAS UN CONTOURNEMENT DU CONTRÔLE. Le contrôle existe pour qu'une
 * carte n'IMPRIME jamais un guillemet de machine à écrire ; le faire tenir par
 * une substitution déterministe est plus sûr que de le demander, et le
 * contrôle reste comme filet. Demander au modèle ce qu'une ligne de code
 * garantit est le mauvais partage du travail.
 */
describe("la ponctuation est typographique avant d'être dessinée", () => {
  it("l'apostrophe droite devient une apostrophe", () => {
    expect(typographicQuotes("EMDR doesn't erase what happened"))
      .toBe("EMDR doesn’t erase what happened");
  });

  it("les guillemets doubles s'apparient, ouvrant puis fermant", () => {
    expect(typographicQuotes('She said "fine" and meant it'))
      .toBe("She said “fine” and meant it");
  });

  it("ce qui est déjà typographique ne bouge pas", () => {
    const already = "EMDR doesn’t erase “what happened”";
    expect(typographicQuotes(already)).toBe(already);
  });

  /*
   * ⚠ LA NORMALISATION DESCEND DANS TOUT LE PAYLOAD, pas seulement le titre.
   * Sur le mois mesuré, les apostrophes étaient dans les gloses, les libellés
   * et les volets de carrousel autant que dans les lignes de carte.
   */
  it("elle atteint chaque chaîne du payload, aussi profonde soit-elle", () => {
    const raw = JSON.stringify({
      payload: { cards: [
        { archetype_key: "single_statement", payload: { statement: "It isn't the work, it's the bracing." } },
        { archetype_key: "single_statement", payload: { statement: "Your body doesn't read the calendar." } },
        { archetype_key: "single_statement", payload: { statement: "Rest that counts isn't earned." } },
      ] },
      card_line: "What your body doesn't say",
      caption: "c".repeat(50) + " isn't",
      alt_text: "a card that doesn't shout",
      rationale: "because it doesn't",
    });
    const result = validateCopy("carousel", raw);
    const all = JSON.stringify([result.payload, result.cardLine, result.caption, result.altText, result.rationale]);
    expect(all).not.toContain("'");
    expect(all).toContain("’");
  });

  /* Et le filet ne trouve plus rien à redire sur une sortie normalisée. */
  it("le contrôle ne refuse plus ce qui est passé par là", () => {
    const line = typographicQuotes("High functioning doesn't mean your nervous system got the memo.");
    expect(checkStraightQuotes([{ where: "x", text: line }])).toHaveLength(0);
  });
});
