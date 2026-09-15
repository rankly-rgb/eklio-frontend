import { describe, expect, it } from "vitest";
import {
  licenseAllowedInState,
  normalizeState,
  titlesIssuedIn,
} from "@/lib/brief/license-state";
import { stepIssue, type StepDraft } from "@/lib/brief/flow";
import { checkUnbackedClaims, allowedClaimsFrom } from "@/lib/ethics/claims";
import type { LicenseTypeState } from "@/lib/catalog/types";
import { FIXTURE_DRAFT } from "@/lib/brief/fixtures/catalog";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * LA SONDE : ÉTAT = OR, TITRE = LMHC, ET TOUT DOIT PASSER AU ROUGE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Défaut trouvé sur le chemin de production réel : la prose du profil
 * annonçait « I'm a Licensed Mental Health Counselor (LMHC) in Portland,
 * Oregon ». L'Oregon ne délivre pas de LMHC — le titre y est LPC.
 *
 * ⚠ ET LE MODÈLE N'AVAIT RIEN INVENTÉ. Le brief portait le couple :
 * `license_type_id = 'lmhc'`, `state = 'OR'`. Le défaut était en amont, dans
 * une absence — rien ne savait qu'un titre appartient à une juridiction.
 *
 * Trois couches doivent refuser, et ce fichier les prend une par une. La
 * quatrième — le trigger en base, qui est L'AUTORITÉ — est sondée dans
 * `eklio-backend/supabase/tests/20260915114500_license_state.test.sql`.
 *
 * ⚠ CHAQUE REFUS EST DOUBLÉ DE SON ACCEPTATION. Une matrice qui refuserait
 * TOUT passerait toute la moitié rouge de ce fichier sans en rater une ligne.
 */

/** Un extrait de la matrice réelle, suffisant et vérifiable à l'œil. */
const MATRIX: LicenseTypeState[] = [
  { license_type_id: "lpc", state_code: "OR", verified_at: null, verified_by: null },
  { license_type_id: "lcsw", state_code: "OR", verified_at: null, verified_by: null },
  { license_type_id: "lmft", state_code: "OR", verified_at: null, verified_by: null },
  { license_type_id: "lmhc", state_code: "NY", verified_at: null, verified_by: null },
  { license_type_id: "lcsw", state_code: "NY", verified_at: null, verified_by: null },
];

/*
 * ⚠ BÂTI SUR `FIXTURE_DRAFT`, PAS RECOPIÉ. Un brouillon réécrit ici fige la
 * forme du jour — et la forme bouge : la branche voisine ajoute
 * `site_platform_id` et `site_url` à l'étape 1. Une copie les ignorerait, et
 * ce serait « une copie à côté de la source », dans mon propre test, la
 * semaine où on répare trois défauts de cette famille.
 *
 * `FORWARD` porte les champs que CETTE branche n'a pas encore et que l'étape 1
 * exigera après fusion. Sans eux, ces tests passeraient ici et échoueraient
 * là-bas : la garde plateforme répondrait AVANT la garde titre/État, et on
 * mesurerait la mauvaise. Le `as` est ce qui les laisse passer tant que
 * `StepDraft` ne les déclare pas — il disparaît à la fusion.
 */
const FORWARD = { site_platform_id: "squarespace", site_url: null };

function draft(overrides: Partial<StepDraft> = {}): StepDraft {
  return {
    ...FIXTURE_DRAFT,
    ...FORWARD,
    practice_name: "Mike Consulting",
    specialty_ids: ["burnout"],
    city: "Portland",
    ...overrides,
  } as StepDraft;
}

/* ── COUCHE 1 : la règle ─────────────────────────────────────────────────── */

describe("licenseAllowedInState — la règle", () => {
  it("⚠ LMHC en Oregon est refusé", () => {
    expect(licenseAllowedInState("lmhc", "OR", MATRIX)).toBe(false);
  });

  it("et LPC en Oregon passe — sans quoi « tout refuser » serait vert", () => {
    expect(licenseAllowedInState("lpc", "OR", MATRIX)).toBe(true);
  });

  it("le même LMHC passe là où il est délivré", () => {
    expect(licenseAllowedInState("lmhc", "NY", MATRIX)).toBe(true);
  });

  it("la casse ne décide de rien — elle tape ce qu'elle veut", () => {
    expect(licenseAllowedInState("lmhc", "or", MATRIX)).toBe(false);
    expect(licenseAllowedInState("lpc", " or ", MATRIX)).toBe(true);
  });

  /*
   * ⚠ UN BRIEF INCOMPLET N'EST PAS UN BRIEF FAUX. L'écran 1 écrit champ par
   * champ : elle tape son État avant son titre, ou l'inverse. Refuser un état
   * intermédiaire bloquerait l'autosave sur une question non posée.
   */
  it("une moitié manquante ne refuse rien", () => {
    expect(licenseAllowedInState(null, "OR", MATRIX)).toBe(true);
    expect(licenseAllowedInState("lmhc", null, MATRIX)).toBe(true);
    expect(licenseAllowedInState("lmhc", "", MATRIX)).toBe(true);
    expect(licenseAllowedInState("lmhc", "Oregon", MATRIX)).toBe(true);
  });

  it("`titlesIssuedIn` distingue « pas de filtre » de « aucun titre »", () => {
    // null = la question n'est pas posée. L'écran montre tout.
    expect(titlesIssuedIn(null, MATRIX)).toBeNull();
    expect(titlesIssuedIn("X", MATRIX)).toBeNull();
    // Un Set vide = cet État ne délivre rien de notre catalogue. Différent.
    expect(titlesIssuedIn("TX", MATRIX)?.size).toBe(0);
    expect(titlesIssuedIn("OR", MATRIX)?.has("lpc")).toBe(true);
  });

  it("normalizeState n'accepte que deux lettres", () => {
    expect(normalizeState(" or ")).toBe("OR");
    expect(normalizeState("Oregon")).toBeNull();
    expect(normalizeState("O")).toBeNull();
    expect(normalizeState(null)).toBeNull();
  });
});

/* ── COUCHE 2 : l'étape 1 ────────────────────────────────────────────────── */

describe("stepIssue — l'étape 1 refuse le couple impossible", () => {
  it("⚠ OR + LMHC bloque « Continue », avec une phrase qui dit quoi faire", () => {
    const issue = stepIssue(
      "practice",
      draft({ license_type_id: "lmhc", state: "OR" }),
      null,
      MATRIX
    );
    expect(issue).toMatch(/isn't issued in the state/);
  });

  it("et OR + LPC passe", () => {
    expect(
      stepIssue("practice", draft({ license_type_id: "lpc", state: "OR" }), null, MATRIX)
    ).toBeNull();
  });

  /*
   * L'ordre des phrases compte : « il manque quelque chose » vient avant
   * « ce que tu as répondu ne peut pas être vrai ».
   */
  it("un champ manquant est nommé avant le couple", () => {
    expect(
      stepIssue("practice", draft({ practice_name: null, license_type_id: "lmhc", state: "OR" }), null, MATRIX)
    ).toMatch(/name/);
    expect(
      stepIssue("practice", draft({ license_type_id: "lmhc", state: "OR", specialty_ids: [] }), null, MATRIX)
    ).toMatch(/specialty/);
  });

  /*
   * ⚠ SANS MATRICE, AUCUN REFUS — jamais l'inverse. Ce module n'est pas
   * l'autorité : un appelant qui ne passe pas la matrice ne doit pas voir
   * tous ses couples refusés par un défaut de câblage.
   */
  it("un appelant sans matrice ne refuse rien", () => {
    expect(
      stepIssue("practice", draft({ license_type_id: "lmhc", state: "OR" }))
    ).toBeNull();
  });
});

/* ── COUCHE 3 : ce que le modèle a le droit d'écrire ─────────────────────── */

const LICENSES = [
  { id: "lpc", label: "LPC", description: "Licensed Professional Counselor" },
  { id: "lmhc", label: "LMHC", description: "Licensed Mental Health Counselor" },
  {
    id: "licensed_psychologist",
    label: "LP",
    description: "Licensed Psychologist",
  },
];

const DEGREES = [
  { id: "psyd", label: "PsyD", full_name: "Doctor of Psychology" },
  { id: "msw", label: "MSW", full_name: "Master of Social Work" },
];

describe("checkUnbackedClaims — le modèle ne peut rien ajouter", () => {
  const asLpc = allowedClaimsFrom("lpc", LICENSES);

  /* ⚠ LA PHRASE EXACTE PARTIE EN PRODUCTION. */
  const SHIPPED =
    "I'm a Licensed Mental Health Counselor (LMHC) in Portland, Oregon, and I work " +
    "with adults who are standing in the middle of a life they didn't plan for.";

  it("⚠ la phrase du rapport est refusée pour un brief qui dit LPC", () => {
    const found = checkUnbackedClaims(SHIPPED, asLpc);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((v) => v.severity === "block")).toBe(true);
    expect(found.every((v) => v.ruleId === "credential")).toBe(true);
    expect(found.map((v) => v.excerpt).join(" ")).toMatch(/LMHC|Licensed Mental Health/);
  });

  it("et la même phrase avec LE titre du brief passe", () => {
    const honest = SHIPPED.replace(
      "Licensed Mental Health Counselor (LMHC)",
      "Licensed Professional Counselor (LPC)"
    );
    expect(checkUnbackedClaims(honest, asLpc)).toEqual([]);
  });

  it("un brief sans licence n'autorise aucun titre", () => {
    const none = allowedClaimsFrom(null, LICENSES);
    expect(checkUnbackedClaims("I'm an LPC.", none).length).toBeGreaterThan(0);
  });

  it("un diplôme non saisi est refusé", () => {
    expect(checkUnbackedClaims("I hold a PhD in clinical psychology.", asLpc).length)
      .toBeGreaterThan(0);
  });

  it("une certification est refusée — le brief n'a aucun champ pour en porter une", () => {
    for (const claim of [
      "I am certified in EMDR.",
      "I'm board certified.",
      "I completed a certification in Somatic Experiencing.",
    ]) {
      expect(checkUnbackedClaims(claim, asLpc).length, claim).toBeGreaterThan(0);
    }
  });

  /*
   * ⚠ L'ANCIENNETÉ EST TOUJOURS INVENTÉE. Le brief ne porte aucun champ
   * d'années d'expérience, donc aucune valeur n'est légitime — y compris
   * écrite en toutes lettres, qui est exactement comment on contourne une
   * garde qui ne lirait que les chiffres.
   */
  it("une ancienneté est refusée, chiffres ET lettres", () => {
    for (const claim of [
      "I have 15 years of experience.",
      "With fifteen years in clinical practice, I...",
      "Over a decade of experience working with adults.",
      "20+ years practicing in Portland.",
    ]) {
      expect(checkUnbackedClaims(claim, asLpc).length, claim).toBeGreaterThan(0);
    }
  });

  /*
   * ⚠ ET CE QUI N'EST PAS UN CREDENTIAL PASSE. Une garde qui refuse la prose
   * ordinaire est une garde qu'on désactivera, et « EMDR » nommé comme une
   * modalité est au catalogue de l'étape 4 : décrire le travail est le sujet.
   */
  it("décrire le travail n'est pas revendiquer un titre", () => {
    for (const ok of [
      "We might use EMDR, at whatever pace you need.",
      "Sessions are 50 minutes. I mostly listen, and I don't rush you.",
      "My approach draws on CBT and somatic work.",
      "It usually takes longer than three sessions.",
    ]) {
      expect(checkUnbackedClaims(ok, asLpc), ok).toEqual([]);
    }
  });

  it("un texte vide ne trouve rien", () => {
    expect(checkUnbackedClaims("", asLpc)).toEqual([]);
  });
});

/* ── COUCHE 4 : un diplôme n'est pas un titre d'exercice ─────────────────── */

/*
 * ══════════════════════════════════════════════════════════════════════════
 * LA SONDE DEMANDÉE : UN BRIEF QUI PORTE PsyD NE PERMET PAS DE DIRE
 * « PSYCHOLOGIST »
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `license_types` portait `psyd` et `phd` À CÔTÉ des licences, et
 * `FULL_NAMES` appariait « Doctor of Psychology » ET « Licensed Psychologist »
 * au même sigle « PsyD ». Un brief qui disait PsyD autorisait donc le texte à
 * se déclarer psychologue — sur la foi d'un DIPLÔME, que n'importe quelle
 * université délivre et qu'aucun board n'accorde.
 *
 * « Psychologist » est un titre protégé dans les cinquante États. Il ne
 * s'obtient que par la licence `licensed_psychologist`.
 */
describe("un diplôme n'autorise pas le titre d'exercice qui lui ressemble", () => {
  /* Une LPC qui a un doctorat en psychologie : le cas exact du rapport. */
  const lpcWithPsyD = allowedClaimsFrom("lpc", LICENSES, "psyd", DEGREES);

  it("⚠ PsyD au brief ne laisse PAS le texte dire « psychologist »", () => {
    const found = checkUnbackedClaims(
      "I'm a psychologist in Portland, and I work with adults in transition.",
      lpcWithPsyD
    );
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((v) => v.severity === "block")).toBe(true);
    expect(found.map((v) => v.reason).join(" ")).toMatch(/titre d'exercice protégé/);
  });

  it("ni « Licensed Psychologist », ni « clinical psychologist »", () => {
    for (const claim of [
      "I am a Licensed Psychologist.",
      "As a clinical psychologist, I see adults.",
      "Our psychologists work with couples.",
    ]) {
      expect(checkUnbackedClaims(claim, lpcWithPsyD).length, claim).toBeGreaterThan(0);
    }
  });

  /*
   * ⚠ ET LE DIPLÔME, LUI, PASSE. Sans cette moitié, on aurait pu tout refuser
   * et appeler ça une garde : la sonde doit prouver que le PsyD saisi est
   * écrivable, sigle ET intitulé.
   */
  it("mais PsyD et « Doctor of Psychology » sont écrivables", () => {
    for (const ok of [
      "I'm an LPC with a PsyD.",
      "I hold a Doctor of Psychology.",
      "Nora Whitfield, PsyD, LPC.",
    ]) {
      expect(checkUnbackedClaims(ok, lpcWithPsyD), ok).toEqual([]);
    }
  });

  /*
   * ⚠ ET LA LICENCE, QUAND C'EST ELLE, OUVRE LE TITRE. Une praticienne qui a
   * choisi `licensed_psychologist` a le droit de se dire psychologue : une
   * garde qui le refuserait encore serait un mur, pas une règle.
   */
  it("la LICENCE de psychologue, elle, autorise le mot", () => {
    const psychologist = allowedClaimsFrom(
      "licensed_psychologist",
      LICENSES,
      "psyd",
      DEGREES
    );
    expect(
      checkUnbackedClaims("I'm a Licensed Psychologist in Portland.", psychologist)
    ).toEqual([]);
    expect(
      checkUnbackedClaims("I'm a psychologist, and I see adults.", psychologist)
    ).toEqual([]);
  });

  /* Un diplôme que le brief ne porte pas reste refusé, comme avant. */
  it("un diplôme NON saisi reste refusé", () => {
    const lpcOnly = allowedClaimsFrom("lpc", LICENSES);
    expect(checkUnbackedClaims("I hold a PsyD.", lpcOnly).length).toBeGreaterThan(0);
    expect(checkUnbackedClaims("I have an MSW.", lpcWithPsyD).length).toBeGreaterThan(0);
  });
});
