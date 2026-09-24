import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkMonth, familyFloor, FORMAT_FAMILIES, MONTH_LIMITS, type PostUnderCheck,
} from "@/lib/content/month-checks";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ── ⚠ UN JEU DE CONTRÔLES QUI REFUSE TOUT NE VAUT PAS MIEUX QU'UN QUI
 *      N'EN REFUSE AUCUN ───────────────────────────────────────────────────
 *
 * Sept mois enregistrés sont des CONTRE-exemples : isla, marlow, perrin, wren,
 * odile, esme — tous refusés sur leurs données réelles — et `pia`, qui a été
 * livré vert et qu'on sait maintenant refuser (zéro phrase seule, trois
 * affirmations cliniques). Aucun ne dit si les seuils laissent encore passer
 * un bon mois.
 *
 * ⚠ CE FICHIER A ÉTÉ PERDU PENDANT UNE JOURNÉE, ET ÇA S'EST VU. `pia` était
 * à la fois le garde-fou et le défaut : le plancher par format l'a refusé, et
 * il n'est plus resté un seul mois vert dans le dépôt. Pendant cette journée,
 * rien ne prouvait qu'un mois conforme puisse encore sortir.
 *
 * `corin.aldhelm`, 2027-01, le remplace. C'est le premier essai de la mesure
 * de F34 — dix essais en parallèle, contrôles gelés, neuf tournés, huit
 * livrés — et il passe **tous** les contrôles actuels, y compris le motif
 * d'affirmation clinique renforcé APRÈS sa production. Deux des huit mois
 * livrés ne le passent pas : celui-ci n'a pas été choisi au hasard, il a été
 * choisi parce qu'il tient.
 *
 * ⚠ S'IL SE MET À ÉCHOUER, C'EST LE CONTRÔLE QU'IL FAUT REGARDER D'ABORD,
 * pas le mois : ce fichier existe pour que le prochain tour de vis se voie
 * ici avant de se voir en production.
 */
const posts: PostUnderCheck[] = JSON.parse(
  readFileSync("lib/content/__tests__/fixtures/month-corin.json", "utf8")
);

const DIRECTION: DirectionPalette = {
  paper: "#FAF6EE", light: "#F4EEE3", secondary: "#C08A3E", primary: "#B4674A", dark: "#2B2A27",
};

const findings = () =>
  checkMonth({
    posts, direction: DIRECTION, wanted: 30,
    modalities: ["emdr"], practiceName: "Corin Aldhelm Therapy",
  });

describe("le mois livré le 2027-01 passe, et doit continuer à passer", () => {
  it("il porte bien trente posts", () => {
    expect(posts).toHaveLength(30);
  });

  it("aucun constat, sur aucun contrôle", () => {
    expect(findings().map((f) => `${f.check} — ${f.detail.slice(0, 90)}`)).toEqual([]);
  });

  /*
   * ⚠ ET IL PORTE CE QUE `pia` N'AVAIT PAS. Le plancher par format existe
   * parce qu'un mois livré est sorti avec ZÉRO phrase seule sans qu'un chiffre
   * bouge ; celui-ci en porte neuf, et chaque famille tient son plancher.
   */
  it("chaque famille de format tient son plancher", () => {
    const floor = familyFloor(posts.length);
    for (const [family, keys] of Object.entries(FORMAT_FAMILIES)) {
      const held = posts.filter((p) => keys.includes(p.archetype)).length;
      expect(held, family).toBeGreaterThanOrEqual(floor);
    }
  });

  it("il porte ses carrousels", () => {
    expect(posts.filter((p) => p.archetype === "carousel").length)
      .toBeGreaterThanOrEqual(MONTH_LIMITS.minCarousels);
  });

  /*
   * ⚠ ET IL PASSE UN CONTRÔLE ÉCRIT APRÈS LUI. Le motif d'affirmation
   * clinique a été renforcé le lendemain de sa production, sur un défaut
   * relevé par une notation indépendante. Deux des huit mois livrés de la
   * même mesure ne le passent pas — un quart — et celui-ci le passe sans
   * retouche.
   */
  it("il ne promet aucun résultat, y compris au motif renforcé", () => {
    expect(findings().filter((f) => f.check === "text.clinicalClaim")).toEqual([]);
  });
});
