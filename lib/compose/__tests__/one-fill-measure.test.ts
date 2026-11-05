import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { render, verticalFill, verticalFillOfSvg } from "@/lib/compose/engine";
import { cardPalette } from "@/lib/compose/palette";
import { groundFor } from "@/lib/compose/grounds";
import { planGrounds } from "@/lib/content/month/grounds-plan";

/*
 * F136 (2026-11-05) : une seule mesure du remplissage. Le harnais de planche lit
 * le SVG livré ; le contrôle du moteur lit la composition. Sur un même mois —
 * le journal de novembre (fixture), composé avec son plan de fonds — les deux
 * chemins rendent la même valeur, carte par carte.
 */
const KIT = { primary: "#B4674A", secondary: "#C08A3E", light: "#F4EEE3", dark: "#2B2A27", paper: "#FAF6EE" };
const raw = JSON.parse(readFileSync("lib/content/__tests__/fixtures/november-2026-journal.json", "utf8"));
const posts = ((raw.posts ?? raw) as Array<{ archetype: string; payload: unknown; cardLine?: string; title: string }>).filter((p) => p.archetype !== "practitioner_card");
const DRAWINGS = ["grief-two-paths", "grief-empty-chair", "ground-anchor", "mem-photo-frame", "cbt-balance-scale"];

describe("le harnais et le moteur mesurent le remplissage par la même fonction", () => {
  const grounds = planGrounds(posts.map((p) => p.archetype));
  let compared = 0;
  posts.forEach((p, i) => {
    it(`${i} ${p.archetype}`, () => {
      let r;
      try {
        r = render({ archetype: p.archetype, payload: p.payload, headline: p.cardLine ?? p.title, eyebrow: "BEHIND THE PRACTICE", footer: "Ember consulting · LMFT 123456", palette: cardPalette(`k${i}`, KIT, false), illustration: i % 4 === 3 ? undefined : DRAWINGS[i % DRAWINGS.length], ground: groundFor(KIT, grounds[i]) } as never);
      } catch {
        return; /* une carte que le moteur refuse n'a pas de remplissage à comparer */
      }
      if (p.archetype === "carousel") return;
      compared += 1;
      expect(verticalFillOfSvg(r.svg)).toBeCloseTo(verticalFill(r.composition.placed), 6);
    });
  });
  it("et la comparaison a porté sur des cartes", () => {
    expect(compared).toBeGreaterThan(20);
  });
});
