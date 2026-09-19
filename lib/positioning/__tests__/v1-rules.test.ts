import { describe, expect, it } from "vitest";
import {
  capPositioning,
  compilePattern,
  rankPositioning,
  reviewPositioning,
  type PositioningFinding,
} from "@/lib/positioning/review";
import { FIRST_LINE_FINDINGS_SHOWN_FALLBACK } from "@/lib/positioning/cap";
import type { PositioningPattern, PositioningRule } from "@/lib/catalog/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * LES RÈGLES V1 — CE QUE JAVASCRIPT EN FAIT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ LE COMPORTEMENT DES DIX RÈGLES EST SONDÉ AILLEURS, contre les VRAIES
 * lignes : `eklio-backend/supabase/tests/20260918_positioning_rules_v1.test.sql`.
 * C'est là que ça doit vivre — les règles sont de la donnée, et un test qui les
 * recopierait ici mesurerait sa propre copie.
 *
 * Ce fichier sonde ce que ce test-là NE PEUT PAS voir : l'écart entre le `~*`
 * de PostgreSQL et la regex JavaScript. Le lecteur de l'application traduit
 * `\y` en `\b` et compile avec `iu` ; si cette traduction est fausse, la base
 * dit une chose et l'écran en montre une autre.
 *
 * ⚠ LE MOTIF CI-DESSOUS EST UNE COPIE, ET SON MAÎTRE EST LE SEED. Il est ici
 * parce qu'une sonde JavaScript a besoin de la chaîne ; le jour où il change en
 * base, ce fichier ment. C'est le prix de sonder un moteur d'expressions
 * régulières sans base de données, et il est écrit plutôt que caché.
 */
const CREDENTIAL_OPENS_THE_TEXT = String.raw`^[^.!?]{0,90}\y(LPC|LPCC|LMFT|LCSW|LMHC|LCPC|LMSW|Ph\.?D|Psy\.?D|licensed)\y`;

describe("⚠ l'ancrage ^ de credential_opens_the_text", () => {
  const re = compilePattern(CREDENTIAL_OPENS_THE_TEXT) as RegExp;

  it("compile, et SANS le drapeau m — donc ^ est le début du TEXTE, pas de la ligne", () => {
    expect(re).toBeInstanceOf(RegExp);
    expect(re.flags).toBe("iu");
    expect(re.flags).not.toContain("m");
  });

  /*
   * ⚠ LA QUESTION POSÉE, ET SA RÉPONSE : que se passe-t-il si elle colle son
   * profil avec son nom ou un titre en première ligne ?
   *
   * Rien de fâcheux, et la raison tient à `[^.!?]` : une classe NÉGATIVE
   * contient le saut de ligne. La fenêtre de 90 caractères traverse donc les
   * lignes et atteint le credential. Les trois premiers cas le prouvent.
   */
  it.each([
    ["le cas nu, credential en tête", "Jane Doe, LCSW, is a licensed clinical social worker practicing in Sacramento.", true],
    ["un NOM seul en première ligne", "Jane Doe\nLCSW\n\nThe argument never lands anywhere.", true],
    ["un TITRE de page en première ligne", "About My Practice\n\nI am a licensed therapist in Denver.", true],
    [
      "une adresse assez longue pour repousser le credential au-delà de 90 caractères",
      "Jane Doe\n1234 Alder Street, Suite 200, Sacramento, California 95814-2201\n(916) 555-0142\nI am a licensed therapist.",
      false,
    ],
    ["une phrase qui se termine AVANT le credential", "The argument never lands anywhere. I am a licensed clinical social worker.", false],
    ["aucun credential", "Something ended that you did not choose. Months have gone by.", false],
  ])("%s", (_nom, texte, attendu) => {
    expect(re.test(texte as string)).toBe(attendu);
  });

  /*
   * ⚠ ET CE QUE CHANGERAIT LE DRAPEAU `m`, sondé pour que personne ne l'ajoute
   * en croyant corriger quelque chose. Avec `m`, `^` désignerait le début de
   * CHAQUE ligne : la règle mordrait sur un credential situé n'importe où dans
   * le texte pourvu qu'il ouvre une ligne. Ce serait une AUTRE règle, beaucoup
   * plus large, et ce n'est pas celle qui a été écrite.
   */
  it("⚠ le drapeau m en ferait une autre règle — on ne l'a pas, et voici la différence", () => {
    const avecM = new RegExp(re.source, re.flags + "m");
    const tardif =
      "The argument never lands anywhere and it has been going on for a long while now, truly.\nJane Doe is a licensed therapist.";
    expect(re.test(tardif)).toBe(false);
    expect(avecM.test(tardif)).toBe(true);
  });

  /*
   * ⚠ LA FRONTIÈRE, ET LE PIÈGE RENCONTRÉ EN L'ÉCRIVANT. La première version
   * de cette sonde collait « licensed » directement après les x — sans
   * caractère non-mot entre les deux, `\b` n'a aucune frontière où s'accrocher
   * et le motif ne peut PAS correspondre, quelle que soit la fenêtre. La sonde
   * était fausse, pas le motif. Il faut donc une espace, et elle compte dans
   * les 90.
   */
  it("la fenêtre de 90 caractères est une vraie borne, à un caractère près", () => {
    expect(re.test("x".repeat(89) + " licensed")).toBe(true);
    expect(re.test("x".repeat(90) + " licensed")).toBe(false);
  });
});

/* ── Le tri et le plafond ────────────────────────────────────────────── */

function constat(ruleId: string, severity: "costly" | "minor"): PositioningFinding {
  return {
    ruleId,
    patternId: ruleId,
    severity,
    label: ruleId,
    description: "",
    exampleWeak: null,
    exampleStrong: null,
    excerpt: null,
    locus: "the whole text",
  };
}

describe("l'ordre et le plafond du rapport gratuit", () => {
  const dix = [
    constat("m1", "minor"),
    constat("c1", "costly"),
    constat("m2", "minor"),
    constat("c2", "costly"),
    constat("m3", "minor"),
  ];

  it("les costly passent devant, et l'ordre des motifs tient à l'intérieur", () => {
    expect(rankPositioning(dix).map((f) => f.ruleId)).toEqual(["c1", "c2", "m1", "m2", "m3"]);
  });

  it("⚠ ce qui est replié est COMPTÉ, jamais jeté en silence", () => {
    const { shown, hidden } = capPositioning(dix, 3);
    expect(shown.map((f) => f.ruleId)).toEqual(["c1", "c2", "m1"]);
    expect(hidden).toBe(2);
    expect(shown.length + hidden).toBe(dix.length);
  });

  it("un plafond au-dessus du nombre de constats ne replie rien", () => {
    expect(capPositioning(dix, 99)).toMatchObject({ hidden: 0 });
    expect(capPositioning(dix, 99).shown).toHaveLength(5);
  });

  it("⚠ et jamais zéro constat : un rapport vide n'est pas un rapport", () => {
    expect(capPositioning(dix, 0).shown).toHaveLength(1);
    expect(capPositioning(dix, -4).shown).toHaveLength(1);
  });

  /*
   * ⚠ 3 EST UNE DÉCISION, PAS UN REPLI COMMODE — « un rapport gratuit à trois
   * constats ouvre une conversation ; à dix, il humilie ». Le repli du lecteur
   * vaut donc la même chose que la donnée : une base momentanément muette rend
   * le rapport DÉCIDÉ, pas un rapport au hasard.
   */
  it("le repli vaut la décision, et reste sous le nombre de règles", () => {
    expect(FIRST_LINE_FINDINGS_SHOWN_FALLBACK).toBe(3);
    expect(FIRST_LINE_FINDINGS_SHOWN_FALLBACK).toBeLessThan(10);
  });
});

/* ── Les cinq formes, à travers le vrai lecteur ──────────────────────── */

describe("le lecteur applique bien les formes de la v1", () => {
  const regle = (id: string): PositioningRule =>
    ({
      id,
      short_label: id,
      description: "",
      example_weak: null,
      example_strong: null,
      sort_order: 1,
      active: true,
      is_example: false,
    }) as PositioningRule;

  const motif = (over: Partial<PositioningPattern> & { kind: string }): PositioningPattern =>
    ({
      id: "p",
      rule_id: "r",
      pattern: null,
      secondary_pattern: null,
      window_chars: null,
      min_chars: null,
      max_chars: null,
      severity: "costly",
      sort_order: 1,
      active: true,
      ...over,
    }) as PositioningPattern;

  /*
   * ⚠ `modality_before_person` EST LA SEULE `present_without` DE LA V1, et
   * c'est la forme la plus facile à écrire à l'envers. On la sonde donc sur les
   * trois cas qui la distinguent : A seul, A avec B, B seul.
   */
  it("present_without : les acronymes sans « you »", () => {
    const m = motif({
      kind: "present_without",
      pattern: String.raw`\y(CBT|DBT|EMDR|ACT|IFS|EFT|somatic experiencing|psychodynamic|person-centered)\y`,
      secondary_pattern: String.raw`\y(you|your)\y`,
    });
    const lire = (t: string) => reviewPositioning(t, [regle("r")], [m]).findings.length;

    expect(lire("I am trained in CBT, DBT, and EMDR, with certification in trauma-informed care.")).toBe(1);
    expect(lire("I'm trained in EMDR — I might ask what you notice physically.")).toBe(0);
    expect(lire("You have not slept properly in months.")).toBe(0);
  });

  it("absent_in_opening : la fenêtre de 320 caractères est une vraie borne", () => {
    const m = motif({
      kind: "absent_in_opening",
      pattern: String.raw`\y(you|your|you're|youre|yourself)\y`,
      window_chars: 320,
    });
    const lire = (t: string) => reviewPositioning(t, [regle("r")], [m]).findings;

    expect(lire("I am a Licensed Professional Counselor with twelve years of experience.")).toHaveLength(1);
    expect(lire("Something ended that you did not choose.")).toHaveLength(0);
    // Présent, mais trop loin : la règle mord quand même.
    expect(lire("x".repeat(400) + " you")).toHaveLength(1);
    expect(lire("x".repeat(400) + " you")[0]!.locus).toBe("the first 320 characters");
  });

  it("length : le seuil de 600 caractères, qui est une estimation et se change en base", () => {
    const m = motif({ kind: "length", min_chars: 600, severity: "minor" });
    const lire = (t: string) => reviewPositioning(t, [regle("r")], [m]).findings.length;

    expect(lire("I am a licensed therapist in Denver specializing in anxiety, depression, and trauma.")).toBe(1);
    expect(lire("x".repeat(700))).toBe(0);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ written_in_third_person — LES DEUX MOTEURS, CÔTE À CÔTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ce n'est pas la casse qui distingue la troisième personne — les deux moteurs
 * comparent sans égard à la casse (`~*` côté PostgreSQL, le drapeau `i` ici) —
 * c'est la POSITION : un profil à la troisième personne s'ouvre sur le nom.
 * D'où l'ancre et une fenêtre de quarante caractères.
 *
 * ⚠ ET C'EST LA FENÊTRE QUI PORTE LA POSITION, PAS LA FRONTIÈRE DE PHRASE. La
 * classe fut d'abord `[^.!?]` ; le point s'y fermait sur « Ph.D. » et la règle
 * ratait alors son cas PRINCIPAL — « Sarah Chen, Ph.D., is a licensed
 * psychologist » est la cliente type. Une règle qui rate son cas principal est
 * pire qu'absente : on croit qu'elle a regardé.
 *
 * Ce bloc est la moitié JavaScript de la preuve ; la moitié PostgreSQL vit
 * dans `eklio-backend/supabase/tests/20260918_positioning_rules_v1.test.sql`,
 * et les deux ont été mesurées sur la MÊME batterie de seize cas avant
 * chargement, sans un seul écart entre les moteurs.
 *
 * ⚠ CES MOTIFS SONT UNE COPIE, comme celui du `^` plus haut, et leur maître
 * est le seed.
 */
const THIRD_PERSON = String.raw`^[^!?]{0,40}\y(is|has|holds) (a |an )?(licensed|certified|board-certified|master)`;
const SUPERVISION = String.raw`\y(supervised by|under the supervision of|my supervisor|supervisor's)\y`;

describe("⚠ written_in_third_person : ce que JavaScript en fait", () => {
  const a = compilePattern(THIRD_PERSON) as RegExp;
  const b = compilePattern(SUPERVISION) as RegExp;

  it("les deux motifs compilent — donc `\\y` traverse dans les deux", () => {
    expect(a).toBeInstanceOf(RegExp);
    expect(b).toBeInstanceOf(RegExp);
  });

  it("⚠ pas de drapeau m — `^` est le début du TEXTE", () => {
    expect(a.flags).toBe("iu");
    expect(a.flags).not.toContain("m");
  });

  /*
   * ⚠⚠ LA SONDE QUI JUSTIFIE `[^!?]` PLUTÔT QUE `.`, ET LA SEULE DIVERGENCE
   * ENTRE MOTEURS QUE CE FICHIER AIT MESURÉE.
   *
   * Une classe négative contient le saut de ligne dans les DEUX moteurs ; le
   * point ne le contient qu'en POSIX. Sur un collage multiligne, `^.{0,40}`
   * donne `true` en PostgreSQL et `false` ici — la base dirait autre chose que
   * l'écran. La moitié PostgreSQL de cette mesure est dans le test SQL ; ce
   * qu'on prouve ICI est le côté JavaScript de la divergence.
   */
  it("⚠ `.` divergerait entre les moteurs sur un collage multiligne — `[^!?]` non", () => {
    const colle = "Sarah Chen\nPh.D.\nis a licensed psychologist in Sacramento.";
    const avecPoint = compilePattern(String.raw`^.{0,40}\y(is|has|holds) (a |an )?licensed`) as RegExp;
    expect(avecPoint.test(colle)).toBe(false); // PostgreSQL, lui, dit true
    expect(a.test(colle)).toBe(true); //          PostgreSQL dit true aussi
  });

  /*
   * ⚠ LES DEUX ÉCRITURES ÉCARTÉES AU PASSAGE. `[[:upper:]]` est une classe
   * POSIX que JavaScript ne connaît pas : il la lit comme une classe littérale
   * et casse. `\p{Lu}` compile ici mais PostgreSQL ne le connaît pas. La forme
   * ancrée n'a plus besoin d'aucune des deux — la sonde reste parce que la
   * question se reposera.
   */
  it("⚠ [[:upper:]] est refusé par JavaScript — le compilateur le dit au lieu de deviner", () => {
    expect(typeof compilePattern(String.raw`\y[[:upper:]][[:lower:]]+ is`)).toBe("string");
  });

  it.each([
    ["⭐ le titre à points — LA CLIENTE TYPE", "Sarah Chen, Ph.D., is a licensed psychologist.", true],
    ["une ouverture nom + credential", "Sarah Chen, LCSW, is a licensed clinical social worker.", true],
    ["le PRONOM en ouverture", "She is a licensed marriage and family therapist.", true],
    ["le PRÉNOM — ce que la v1 ratait", "Sarah is a licensed marriage and family therapist.", true],
    ["le prénom accentué EST vu", "José is a licensed therapist.", true],
    ["⚠ la casse n'est PAS contrainte (drapeau i)", "sarah is a licensed therapist.", true],
    ["la première personne n'est pas visée", "I am a licensed therapist in Denver.", false],
    [
      "⚠ CE QUE L'ANCRE ACHÈTE : une incise au MILIEU se tait",
      "The mornings are the hardest part of your day. My colleague is a licensed therapist.",
      false,
    ],
    [
      "⚠ LA SEULE LIMITE QUI RESTE : un en-tête long repousse le verbe hors de la fenêtre",
      "Sarah Chen, Ph.D., LMFT\n1234 Alder Street, Suite 200\nis a licensed psychologist.",
      false,
    ],
    [
      "⚠ CE QUE L'ANCRE N'ACHÈTE PAS : la même incise, quand elle OUVRE, mord",
      "My colleague is a licensed therapist.",
      true,
    ],
  ])("%s", (_quoi, texte, attendu) => {
    expect(a.test(texte as string)).toBe(attendu);
  });

  const regle = { id: "r", short_label: "l", description: "d", example_weak: null,
    example_strong: null, sort_order: 1, active: true, is_example: false } as unknown as PositioningRule;
  const motif = { id: "p", rule_id: "r", kind: "present_without", pattern: THIRD_PERSON,
    secondary_pattern: SUPERVISION, window_chars: null, min_chars: null, max_chars: null,
    severity: "minor", sort_order: 1, active: true } as unknown as PositioningPattern;

  /*
   * ⚠⚠ LA SONDE QUI COMPTE LE PLUS. Une associée texane DOIT écrire
   * « supervised by (nom) » — 22 TAC 681.91(m). La règle doit se taire devant
   * quelqu'un qui respecte la loi, sinon ce produit reproche l'obéissance.
   *
   * Le motif secondaire nomme la MENTION, pas le mot : `supervision` seul
   * faisait taire la règle sur le profil d'une superviseuse, ce qui est le
   * même dégât pris par l'autre bout — ne rien dire à quelqu'un dont le texte
   * est correct. La sonde juste après le vérifie.
   */
  it.each([
    ["« supervised by »", "Chen is a licensed professional counselor, supervised by Dana Ruiz, LPC-S."],
    ["« under the supervision of »", "Chen is a licensed professional counselor under the supervision of Dana Ruiz."],
    ["« My supervisor is… » — la mention écrite à l'envers", "My supervisor is a licensed psychologist."],
    ["le possessif « supervisor's »", "Chen is a licensed professional counselor. Her supervisor's name is Dana Ruiz."],
  ])("⚠ %s fait taire la règle — on ne reproche pas d'obéir à 22 TAC 681.91(m)", (_quoi, texte) => {
    expect(a.test(texte as string)).toBe(true);
    expect(b.test(texte as string)).toBe(true);
    expect(reviewPositioning(texte as string, [regle], [motif]).findings).toEqual([]);
  });

  it("⚠⚠ le profil d'une SUPERVISEUSE n'est PAS tu — elle n'est pas une supervisée", () => {
    const texte =
      "Sarah Chen, LCSW, is a licensed clinical social worker. I provide clinical supervision to associates.";
    expect(b.test(texte)).toBe(false);
    expect(reviewPositioning(texte, [regle], [motif]).findings).toHaveLength(1);
  });
});
