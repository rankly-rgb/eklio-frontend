import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { checkEthics, hasBlockingViolation } from "@/lib/ethics/rules";

/*
 * ── F38 — LA NÉGATION IMMÉDIATE EXEMPTE, CELLE À DISTANCE NON ───────────
 *
 * Le 2026-09-24, un mois généré est sorti à 29 posts sur 30 : la gâchette SQL
 * a refusé « there is no guarantee that six weeks will change anything », qui
 * est de la copy CONFORME — l'anti-promesse que l'ACA C.3.a cherche à obtenir.
 * Les trente contrôles du mois étaient verts et dix échanges avaient abouti ;
 * le refus est arrivé à l'`insert`, donc après la dépense. 0,54 $.
 *
 * Ce côté-ci exemptait déjà la tournure (`isProhibitiveMention`) ; la base ne
 * connaissait pas la notion. `parity.test.ts` était pourtant vert — il compare
 * des NOMS de motifs, et une exemption n'est pas un motif. C'est sa limite
 * exacte, et la raison de ce fichier : il tient les deux côtés sur le
 * COMPORTEMENT.
 *
 * Décision de Naima, 2026-09-26 : c'est ce motif-ci qui est juste. La base a
 * été alignée dessus (migration 20260926090000), et sur ce seul point.
 *
 * Son jumeau, qui écrit les MÊMES phrases en toutes lettres :
 *   eklio-backend/supabase/tests/20260926090000_immediate_negation.test.sql
 *
 * ⚠ CE FICHIER A MANQUÉ UNE JOURNÉE, et c'est instructif. Le `git rm` de son
 * prédécesseur a échoué, le `&&` a court-circuité son écriture, et la suite est
 * passée au vert — parce qu'un fichier de test absent ne fait rien échouer.
 * Le jumeau SQL tournait seul, et la parité annoncée n'existait qu'à moitié.
 *
 * ⚠ CE QUI EST VÉRIFIÉ N'EST PAS « l'exemption marche » MAIS « elle ne
 * s'étend pas ». Trop large, elle ouvrirait la promesse elle-même : il
 * suffirait d'un « no » quelque part dans une légende de trois cents mots.
 * Les cinq positions sont donc éprouvées séparément, et quatre doivent
 * continuer à bloquer.
 */

type Probe = readonly [position: string, text: string, expect: "block" | "pass"];

const PROBES: readonly Probe[] = [
  ["nue", "I guarantee relief.", "block"],
  ["nue", "This is a clinically proven method.", "block"],
  ["nue", "Limited spots available this month.", "block"],
  ["nue", "My clients say they feel lighter afterwards.", "block"],

  ["immédiate", "There is no guarantee that six weeks will change anything.", "pass"],
  ["immédiate", "Therapy comes without guarantees. What it offers is a place to look.", "pass"],
  ["immédiate", "No guaranteed outcome exists in this work.", "pass"],
  ["immédiate", "I hold no success rate, because a number would flatten it.", "pass"],
  ["immédiate", "There are no limited spots and no reason to hurry.", "pass"],
  ["immédiate", "No weekend certification stands behind this.", "pass"],

  ["à distance", "No one can cure your anxiety.", "block"],
  ["à distance", "Not a single clinically proven method exists here.", "block"],
  ["à distance", "No matter what, we guarantee results.", "block"],

  ["phrase d'avant", "I make no promises. I guarantee relief.", "block"],
  ["phrase d'avant", "Nothing here is a promise. This is a clinically proven method.", "block"],

  ["après", "I guarantee relief, or not.", "block"],
  ["après", "Limited spots available, no pressure.", "block"],
];

describe("les cinq positions de négation", () => {
  it.each(PROBES)("[%s] « %s »", (position, text, expected) => {
    const actual = hasBlockingViolation(checkEthics(text).violations) ? "block" : "pass";
    expect(
      actual,
      position === "immédiate"
        ? "un terme immédiatement nié est conforme (F38)"
        : "une négation qui n'est pas immédiate n'exempte rien — sinon la promesse passe"
    ).toBe(expected);
  });

  it("les cinq positions sont toutes éprouvées", () => {
    expect(new Set(PROBES.map(([p]) => p)).size).toBe(5);
    expect(PROBES.filter(([, , e]) => e === "pass").length).toBeGreaterThanOrEqual(6);
    expect(PROBES.filter(([, , e]) => e === "block").length).toBeGreaterThanOrEqual(10);
  });

  /*
   * ⚠ L'EXTRAIT CITÉ EST LA PREMIÈRE OCCURRENCE NON NIÉE, pas la première tout
   * court : c'est lui que la praticienne lit dans le message.
   */
  it("une promesse posée après une négation immédiate est toujours vue", () => {
    expect(
      hasBlockingViolation(checkEthics("No guarantee here, but we guarantee results.").violations)
    ).toBe(true);
  });

  /*
   * ⚠ ET LE COÛT DE LA RÈGLE EST ÉCRIT, PAS TU. « I am not the best therapist
   * in Portland » est un désaveu explicite, donc conforme, et il reste bloqué
   * des DEUX côtés : entre `not` et `best` il y a `the`, et l'exemption n'admet
   * que des blancs et des guillemets. Élargir aux déterminants modifierait le
   * motif du code, que la décision de F38 disait de reprendre tel quel. F39.
   */
  it("une négation séparée par un déterminant reste bloquée, et c'est assumé", () => {
    expect(
      hasBlockingViolation(checkEthics("I am not the best therapist in Portland.").violations)
    ).toBe(true);
  });
});

/*
 * ── ⚠ ET PLUS AUCUN APPELANT NE CHOISIT SA LECTURE ──────────────────────
 *
 * Entre le 24 et le 26 septembre, `checkEthics` portait une option
 * `reading: "as-database"` : les onze chemins qui écrivent en base
 * l'employaient pour être aussi stricts que la gâchette, qui n'exemptait rien.
 * L'alignement de la base rend cette lecture identique à la lecture par
 * défaut, et une option que personne ne fait varier n'est pas une garantie —
 * c'est une ligne qui ment sur ce qu'elle protège. La garantie est ce fichier
 * et son jumeau SQL.
 */
describe("une seule lecture", () => {
  it("aucun appelant ne passe d'option à checkEthics", () => {
    const out = execFileSync(
      "grep",
      ["-rn", "checkEthics(", "--include=*.ts", "--include=*.tsx", "lib", "components", "scripts"],
      { encoding: "utf8" }
    );
    const withOptions = out
      .trim()
      .split("\n")
      .filter((row) => !row.includes("__tests__"))
      .filter((row) => /checkEthics\([^)]*,\s*\{/.test(row));
    expect(
      withOptions,
      `appel(s) à checkEthics avec une option : ${withOptions.join(" | ")}`
    ).toEqual([]);
  });
});

/*
 * ── ⚠ UN JUMEAU SEUL N'EST PAS UNE PARITÉ ───────────────────────────────
 *
 * Ce fichier a manqué une journée entière. Son prédécesseur avait été supprimé,
 * son écriture a été court-circuitée par un `&&` dont le membre gauche a
 * échoué, et la suite est restée verte : un fichier de test absent ne fait rien
 * échouer, et le jumeau SQL tournait seul en annonçant une parité qui n'existait
 * qu'à moitié.
 *
 * La paire se vérifie donc elle-même. Le chemin est relatif au dépôt voisin, et
 * son absence est tolérée — un développeur peut n'avoir cloné qu'un dépôt — mais
 * s'il est là, il doit porter les mêmes phrases.
 */
describe("la paire de jumeaux est complète", () => {
  const TWIN = "../eklio-backend/supabase/tests/20260926090000_immediate_negation.test.sql";

  it("le jumeau SQL porte les mêmes phrases, quand le dépôt voisin est là", () => {
    if (!existsSync(TWIN)) {
      expect(TWIN, "dépôt voisin absent — rien à comparer").toBeTruthy();
      return;
    }
    const sql = readFileSync(TWIN, "utf8");
    const missing = PROBES.map(([, text]) => text).filter((text) => !sql.includes(text));
    expect(
      missing,
      `phrase(s) présente(s) ici et absente(s) du jumeau SQL : ${missing.join(" | ")}`
    ).toEqual([]);
  });

  /*
   * ⚠ ET DANS L'AUTRE SENS. Une sonde ajoutée au SQL et pas ici laisserait le
   * côté TypeScript plus permissif sans que rien ne le dise — c'est exactement
   * la forme du défaut que F38 a coûté.
   */
  it("et ce fichier porte toutes celles du jumeau", () => {
    if (!existsSync(TWIN)) return;
    const sql = readFileSync(TWIN, "utf8");
    const quoted = [...sql.matchAll(/\('[^']*',\s*'((?:[^']|'')+)',\s*'(?:block|pass)'\)/g)]
      .map((m) => m[1].replace(/''/g, "'"));
    expect(quoted.length, "aucune sonde lue dans le jumeau — le format a changé").toBeGreaterThan(10);
    const here = new Set(PROBES.map(([, t]) => t));
    const missing = quoted.filter((t) => !here.has(t));
    expect(
      missing,
      `sonde(s) du jumeau SQL absente(s) ici : ${missing.join(" | ")}`
    ).toEqual([]);
  });
});
