import { describe, expect, it } from "vitest";
import { render, verticalFill } from "@/lib/compose/engine";
import { cardPalette } from "@/lib/compose/palette";
import { groundFor } from "@/lib/compose/grounds";
import { allowedGrounds, planGrounds } from "@/lib/content/month/grounds-plan";
import { composeCard } from "@/lib/content/month/compose-card";

/*
 * LE PORTILLON SUIT LA RÈGLE DE COMPOSITION (2026-11-05). Une carte à phrase sans
 * dessin apparié entre au mois sur photo : « zéro carte vide » admet ce fond seul.
 */
const KIT = { primary: "#B4674A", secondary: "#C08A3E", light: "#F4EEE3", dark: "#2B2A27", paper: "#FAF6EE" };
const payload = { statement: "A layoff can unsettle where you feel you belong." };

describe("une carte à phrase sans dessin, sur photo", () => {
  it("le plan des fonds lui doit une photo", () => {
    expect(allowedGrounds("single_statement", null)).toEqual(["photo"]);
    expect(planGrounds(["single_statement", "single_statement", "carousel"], ["grief-two-paths", null, null])[1]).toBe("photo");
  });

  it("le moteur la pose sur une photo choisie par son texte — la même à la relecture", () => {
    const input = { archetype: "single_statement", payload, headline: "Life after work", eyebrow: "E", footer: "Ember · LMFT 1", palette: cardPalette("c", KIT, false), ground: groundFor(KIT, "photo") };
    const a = render(input).svg;
    const b = render(input).svg;
    const photo = /data-photo="([^"]+)"/.exec(a)?.[1];
    expect(photo).toBeTruthy();
    expect(/data-photo="([^"]+)"/.exec(b)?.[1]).toBe(photo);
    expect(a).not.toContain("data-library");
  });

  it("composeCard l'accepte, et la garde finale (zéro carte vide) passe sur le SVG", () => {
    const card = composeCard({
      illustration: null, ground: groundFor(KIT, "photo"), archetype: "single_statement", payload,
      palette: cardPalette("c", KIT, false), eyebrow: "BEHIND THE PRACTICE", headline: "Life after work",
      footer: "Ember consulting · LMFT 123456", licenceMention: "LMFT 123456",
    } as never);
    expect(card.svg).toContain("data-photo");
  });

  it("sans photo, la même carte est refusée : la garde n'a pas bougé", () => {
    expect(() =>
      composeCard({
        illustration: null, ground: groundFor(KIT, "cream"), archetype: "single_statement", payload,
        palette: cardPalette("c", KIT, false), eyebrow: "BEHIND THE PRACTICE", headline: "Life after work",
        footer: "Ember consulting · LMFT 123456", licenceMention: "LMFT 123456",
      } as never)
    ).toThrow();
  });
});

describe("le remplissage vertical vise aussi les cartes sans dessin (F131)", () => {
  const FLOOR = 2 / 3;
  const base = { eyebrow: "A SOFT INVITATION", footer: "Ember consulting · LMFT 123456", palette: cardPalette("c", KIT, false), ground: groundFor(KIT, "photo") };

  it("une phrase sans dessin sur photo : titre ancré en bas, surtitre en haut, deux tiers tenus", () => {
    const r = render({ ...base, archetype: "single_statement", payload, headline: "Life after work" });
    expect(r.composition.idiom).toBe("photo_statement");
    expect(verticalFill(r.composition.placed)).toBeGreaterThanOrEqual(FLOOR);
    expect(r.svg).toContain("LMFT 123456");
  });

  it("la couverture de carrousel aussi : elle n'est plus exemptée", () => {
    const r = render({ ...base, archetype: "single_statement", payload, headline: "Life after work", slide: 0 });
    expect(r.composition.idiom).toBe("carousel_cover");
    expect(verticalFill(r.composition.placed)).toBeGreaterThanOrEqual(FLOOR);
  });
});
