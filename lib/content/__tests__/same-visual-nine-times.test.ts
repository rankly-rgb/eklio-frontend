import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkIdenticalPayloads, MONTH_LIMITS } from "@/lib/content/month-checks";
import { PRACTITIONER_CARDS_PER_MONTH } from "@/lib/content/practitioner";

/*
 * ── ⚠ NEUF FOIS LA MÊME IMAGE, ET TOUS LES CONTRÔLES AU VERT ───────────
 *
 * Le 2026-09-23, le premier mois tiré sur une banque enfin remplie a passé
 * `checkMonth` en entier. La planche à 390px montre neuf cartes praticiennes
 * EN TÊTE, rigoureusement identiques : mêmes trois lignes venues du brief —
 * « EMDR / Oakland, CA / Taking new clients » —, même dessin de porte, seul
 * le titre changeait.
 *
 * ⚠ `mix.dominant` NE POUVAIT PAS LE VOIR : 9 sur 30 font exactement 30,0 %,
 * soit le plafond au centième près. Et `checkDuplicateTitles` ne pouvait pas
 * non plus : les neuf titres étaient différents. Le défaut était sous le
 * titre, dans le payload, où rien ne regardait.
 *
 * C'est F15 une fois de plus — l'entonnoir était vert et la planche mauvaise.
 * Deux corrections : la cause (la carte praticienne ne prend plus son tour
 * comme un archétype qui écrit quelque chose de neuf) et le filet (deux posts
 * au même payload sont le même visuel).
 */
const card = (title: string) => ({
  archetype: "practitioner_card",
  title,
  cardLine: title,
  payload: { lines: ["EMDR", "Oakland, CA", "Taking new clients"] },
});

describe("le même visuel ne paraît pas neuf fois", () => {
  it("neuf cartes identiques sont refusées, titres différents ou non", () => {
    const posts = ["A", "B", "C", "D", "E", "F", "G", "H", "I"].map(card);
    const found = checkIdenticalPayloads(posts);
    expect(found).toHaveLength(1);
    expect(found[0].check).toBe("mix.samePayload");
    expect(found[0].detail).toContain("9 posts au payload identique");
  });

  it("deux restent permises — la carte qui dit comment elle travaille", () => {
    expect(checkIdenticalPayloads([card("A"), card("B")])).toHaveLength(0);
    expect(checkIdenticalPayloads([card("A"), card("B"), card("C")])).toHaveLength(1);
  });

  /* Un payload vide n'est pas un doublon : c'est l'absence de payload. */
  it("un payload vide ou absent n'est jamais compté", () => {
    const empty = (t: string) => ({ archetype: "x", title: t, cardLine: t, payload: {} });
    const none = (t: string) => ({ archetype: "x", title: t, cardLine: t, payload: null });
    expect(checkIdenticalPayloads(["a", "b", "c", "d"].map(empty))).toHaveLength(0);
    expect(checkIdenticalPayloads(["a", "b", "c", "d"].map(none))).toHaveLength(0);
  });

  /*
   * ⚠ LE PLAFOND DU TIRAGE NE DÉPASSE PAS CELUI DU CONTRÔLE. Sinon le mois
   * tire ce que le contrôle refusera, et chaque essai se condamne lui-même.
   */
  it("le tirage ne peut pas produire ce que le contrôle refuse", () => {
    expect(PRACTITIONER_CARDS_PER_MONTH).toBeLessThanOrEqual(MONTH_LIMITS.maxIdenticalPayloads);
  });

  /*
   * ⚠ ET LE PLAFOND EST DANS `accept`, PAS DANS LA RONDE PAR FAMILLE. Posé
   * dans la ronde, il ne tenait que sur le PREMIER des deux tirages : le
   * rattrapage qui complète le mois demande un sujet sans nommer d'archétype,
   * et il en a repris huit sur l'essai suivant. Un plafond posé sur une seule
   * des deux portes n'est pas un plafond.
   */
  it("le plafond est posé là où les deux tirages passent", () => {
    const source = readFileSync("scripts/local-render/20-month.ts", "utf8");
    const accept = source.slice(
      source.indexOf("const accept = (topic: Topic, family: string): boolean => {"),
      source.indexOf("const clash = redundantAgainst(")
    );
    expect(accept).toContain("PRACTITIONER_CARDS_PER_MONTH");
    expect(accept).toContain("releasedEarly.push(topic.id);");
  });
});
