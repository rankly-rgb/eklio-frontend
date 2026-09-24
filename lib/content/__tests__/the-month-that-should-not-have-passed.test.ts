import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkMonth, familyFloor, FORMAT_FAMILIES, type PostUnderCheck,
} from "@/lib/content/month-checks";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ── ⚠ IL A ÉTÉ LIVRÉ VERT, ET IL NE PORTAIT PAS UNE SEULE PHRASE SEULE ──
 *
 * `pia.rosenthal`, 2026-10, trente posts, exporté de la base tel quel. Ce
 * fichier a d'abord affirmé qu'il PASSAIT, et c'était exact : au 2026-09-24,
 * aucun des contrôles ne disait rien de ce mois. Il était aussi le seul mois
 * vert enregistré, donc le seul garde-fou contre un jeu de contrôles qui
 * refuserait tout.
 *
 * ⚠ C'ÉTAIT LE GARDE-FOU ET LE DÉFAUT DANS LE MÊME FICHIER. Zéro phrase
 * seule sur trente posts : les dix autres bornes du mélange sont des
 * PLAFONDS — `mix.dominant`, `mix.loneSentence`, `mix.identical` — et
 * `mix.distinct` se contente de sept archétypes sur onze. Tout ce jeu ne
 * savait dire que « trop », jamais « pas assez », et le carrousel était le
 * seul format à avoir un plancher (F22). L'ordre de tirage avait été inversé
 * pour le sauver ; la phrase seule a pris sa place dans le trou.
 *
 * Le mois est donc gardé, et retourné : ce n'est plus l'exemple, c'est le
 * CONTRE-exemple. Ce qu'on lui demande maintenant est double — que le
 * plancher le refuse, et qu'aucun AUTRE contrôle ne le refuse. La deuxième
 * moitié est ce qui reste du garde-fou : un tour de vis ailleurs se verra ici
 * sous la forme d'un constat en trop.
 *
 * ⚠ IL RESTE À GELER UN MOIS VERT. Tant qu'il n'y en a pas, aucun fichier ne
 * prouve qu'un bon mois passe encore — seulement qu'un mauvais ne passe plus.
 */
const posts: PostUnderCheck[] = JSON.parse(
  readFileSync("lib/content/__tests__/fixtures/month-pia.json", "utf8")
);

const DIRECTION: DirectionPalette = {
  paper: "#FAF6EE", light: "#F4EEE3", secondary: "#C08A3E", primary: "#B4674A", dark: "#2B2A27",
};

const findings = () =>
  checkMonth({ posts, direction: DIRECTION, wanted: 30, modalities: ["EMDR"] });

describe("le mois livré le 2026-09-24 est refusé, et sur ce seul motif", () => {
  it("il porte bien trente posts", () => {
    expect(posts).toHaveLength(30);
  });

  /*
   * ⚠ LE PLANCHER EST CALCULÉ, PAS POSÉ. Trois familles, donc un tiers visé
   * chacune ; le plancher en est la moitié, soit cinq sur trente. `pia` en
   * porte deux — deux cartes praticiennes, et rien d'autre.
   */
  it("le plancher de format le refuse", () => {
    expect(familyFloor(30)).toBe(5);
    const statement = posts.filter((p) =>
      FORMAT_FAMILIES.statement.includes(p.archetype)
    ).length;
    expect(statement).toBe(2);
    expect(findings().map((f) => f.check)).toContain("mix.floor.statement");
  });

  /*
   * ⚠ ET C'EST LE SEUL CONSTAT. C'est ce qui reste du garde-fou : le jour où
   * un autre contrôle se met à parler ici, c'est lui qu'il faut regarder
   * d'abord, pas le mois.
   */
  it("et aucun autre contrôle n'a rien à dire", () => {
    expect(findings().map((f) => f.check)).toEqual(["mix.floor.statement"]);
  });

  /*
   * ⚠ ET IL PORTE SES DEUX CARROUSELS. Le plancher du carrousel, lui, a
   * toujours tenu : c'est le trou d'à côté qui s'est ouvert.
   */
  it("il porte au moins deux carrousels", () => {
    expect(posts.filter((p) => p.archetype === "carousel").length).toBeGreaterThanOrEqual(2);
  });

  it("et il ne porte aucune phrase seule", () => {
    expect(posts.filter((p) => p.archetype === "single_statement")).toHaveLength(0);
  });
});
