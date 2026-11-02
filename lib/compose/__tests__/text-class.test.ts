import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/brand/color";
import { floorFor, LARGE_TEXT_FLOOR, LICENCE_FLOOR, NORMAL_TEXT_FLOOR, shownPx, textClass } from "@/lib/compose/text-class";

/*
 * Le contraste se classe par taille de texte RENDU (WCAG AA : 4,5 courant, 3 grand
 * texte ≥ 24px, ≥ 18,66px en gras), vue à 390px de large. La licence : 4,5 toujours.
 */
describe("la classe d'une ligne se lit sur la taille posée", () => {
  it("un titre posé à 96px est du grand texte (34,7px affichés) ; réduit à 64px, il bascule (23,1px)", () => {
    expect(shownPx(96)).toBeCloseTo(34.67, 1);
    expect(textClass(96, 500, "headline")).toBe("large");
    expect(textClass(64, 500, "headline")).toBe("normal");
    expect(textClass(56, 700, "content")).toBe("large");
  });

  it("la mention de licence garde 4,5:1, même posée en grand", () => {
    expect(textClass(120, 400, "footer")).toBe("licence");
    expect(floorFor("licence")).toBe(LICENCE_FLOOR);
    expect(floorFor("normal")).toBe(NORMAL_TEXT_FLOOR);
    expect(floorFor("large")).toBe(LARGE_TEXT_FLOOR);
  });
});

/*
 * Les quatre encres de la spécification foncées à la session précédente, remesurées
 * sous leur classe, SANS changer une couleur. Le résultat est 0/4 et il se lit ici :
 * l'italique terracotta (grand texte) est à 2,94 et 2,52, sous 3:1 même en grand ;
 * la signature est la licence ; le texte de courbe (40px, 14,4px affichés) est du
 * texte courant.
 */
describe("les quatre encres de la spec, sous leur classe", () => {
  const cases = [
    { name: "signature #746A60 sur ocre pastel", ink: "#746A60", ground: "#F3E4C4", size: 25, band: "footer" },
    { name: "signature #746A60 sur terracotta pastel", ink: "#746A60", ground: "#F4DFD7", size: 25, band: "footer" },
    { name: "italique terracotta sur crème", ink: "#C97B63", ground: "#F7F4EE", size: 96, band: "headline" },
    { name: "italique terracotta sur terracotta pastel", ink: "#C97B63", ground: "#F4DFD7", size: 138, band: "headline" },
    { name: "texte de courbe #8A6A24 sur ocre pastel", ink: "#8A6A24", ground: "#F3E4C4", size: 40, band: "content" },
  ];
  it("aucune ne passe le plancher de sa classe — rien n'est restitué en changeant de classe", () => {
    const restored = cases.filter((c) => contrastRatio(c.ink, c.ground) >= floorFor(textClass(c.size, 500, c.band)));
    expect(restored.map((c) => c.name)).toEqual([]);
  });
});
