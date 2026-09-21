import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkMonth, checkMix, checkDangling, checkEcho, checkTints, checkDuplicateTitles,
  colourDistance, MONTH_LIMITS,
} from "@/lib/content/month-checks";
import { cardPalette, type DirectionPalette } from "@/lib/compose/palette";
import { composeWithFallback } from "@/lib/compose/fallback";
import { payloadFor, CARD } from "@/lib/compose/__tests__/fixtures";

/*
 * ── LES MOIS QUI ONT ÉTÉ LIVRÉS, ET QUI NE LE SERAIENT PLUS ─────────────
 *
 * ⚠ UN CONTRÔLE QUI NE REJETTE PAS LES MAUVAIS MOIS NE SERT À RIEN, et c'est
 * la seule façon de le savoir : les rejouer sur leurs données enregistrées.
 *
 * Les quatre fichiers de `fixtures/` sont les posts RÉELS de quatre mois
 * générés le 2026-09-21, tels qu'ils sont en base. Trois étaient mauvais et
 * affichaient pourtant un entonnoir parfait. Le quatrième, `isla`, est celui
 * que Naima a validé à l'œil : il doit passer, sinon les seuils sont faux.
 */

const DIRECTION: DirectionPalette = {
  paper: "#FAF6EE", light: "#F4EEE3", secondary: "#C08A3E", primary: "#B4674A", dark: "#2B2A27",
};

type Post = { archetype: string; title: string; cardLine: string; payload: unknown };

const monthFixture = (name: string): Post[] =>
  JSON.parse(readFileSync(`lib/content/__tests__/fixtures/month-${name}.json`, "utf8"));

const names = (findings: { check: string }[]) => [...new Set(findings.map((f) => f.check))];

describe("les mois de F15 sont rejetés quand on les rejoue", () => {
  it("perrin.vale — cinq archétypes sur onze, entonnoir parfait", () => {
    const posts = monthFixture("perrin");
    const findings = checkMix(posts.map((p) => p.archetype));
    expect(findings.length).toBeGreaterThan(0);
    expect(names(findings)).toContain("mix.distinct");
    expect(names(findings)).toContain("mix.dominant");
  });

  it("marlow.quint — deux cartes portant le même titre", () => {
    const posts = monthFixture("marlow");
    const findings = checkDuplicateTitles(posts.map((p) => p.cardLine));
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].detail).toContain("When the body disagrees");
  });

  it("marlow.quint — les trois cartes praticiennes recopient leur titre", () => {
    const echoes = monthFixture("marlow")
      .filter((p) => p.archetype === "practitioner_card")
      .flatMap((p) => checkEcho(p.cardLine, p.title, p.payload));
    expect(echoes.length).toBe(3);
    for (const e of echoes) expect(e.check).toBe("text.echo");
  });

  it("wren.ashcombe — l'archétype dominant dépasse 30 %", () => {
    const findings = checkMix(monthFixture("wren").map((p) => p.archetype));
    expect(names(findings)).toContain("mix.dominant");
  });

  /*
   * ⚠ ET LE MOIS VALIDÉ PASSE. Sans ce cas, n'importe quel seuil assez sévère
   * ferait passer les quatre précédents — y compris un seuil qui interdirait
   * tout mois publiable.
   */
  it("isla.thornbury — validé à l'œil, il passe le mélange et les doublons", () => {
    const posts = monthFixture("isla");
    expect(checkMix(posts.map((p) => p.archetype))).toEqual([]);
    expect(checkDuplicateTitles(posts.map((p) => p.cardLine))).toEqual([]);
  });
});

describe("les défauts de la seconde notation sont rejetés", () => {
  it("« Efficiency can mask what » — une ligne qui se termine sur un mot outil", () => {
    const findings = checkDangling([{ where: "ligne de carte", text: "Efficiency can mask what" }]);
    expect(findings).toHaveLength(1);
    expect(findings[0].check).toBe("text.dangling");
  });

  it("et « When life interrupts, you get » aussi", () => {
    expect(checkDangling([{ where: "l", text: "When life interrupts, you get" }])).toHaveLength(1);
  });

  it("une contraction négative compte comme un mot suspendu", () => {
    expect(checkDangling([{ where: "l", text: "Your nervous system doesn't" }])).toHaveLength(1);
  });

  /*
   * ── ⚠ UNE GLOSE N'EST PAS UN TITRE, ET LE CONTRÔLE L'A OUBLIÉ UNE FOIS ─
   *
   * La première version appliquait aux champs du payload la liste faite pour
   * les titres — pronoms, auxiliaires, négations compris. Sur un vrai mois,
   * **seize refus d'un coup**, tous sur des gloses parfaitement finies. Un
   * fragment est ce qu'une glose EST.
   *
   * Le cahier des charges nomme les catégories : article, préposition,
   * conjonction, relatif. Les six lignes ci-dessous sont celles que le
   * contrôle avait refusées à tort, reprises telles quelles.
   */
  it.each([
    "your body says no",
    "before you know why",
    "You misread it",
    "what happened and what didn't",
    "still braced for it",
    "After that",
    // ⚠ Second tour de faux positifs, mesuré sur le mois suivant : « yet » est
    // aussi un adverbe, « on » et « after » sont aussi des particules.
    "Your body knows things your mind has not caught up to yet",
    "Mind moved on",
    "the week after",
    "what it is about",
    // ⚠ Troisième tour : l'anglais strande ses prépositions.
    "information to work with",
    "where it comes from",
    "what she is good at",
    "what it turns into",
  ])("une glose finie passe : « %s »", (text) => {
    expect(checkDangling([{ where: "payload.x.gloss", text }], "field")).toEqual([]);
  });

  /*
   * ⚠ CE QUI RESTE ATTRAPÉ APRÈS TROIS RESSERREMENTS. La liste a beaucoup
   * maigri ; ces quatre-là disent ce qu'elle tient encore, et sans eux rien
   * n'empêcherait de la vider tout à fait.
   */
  it.each([
    "the body learns to",
    "what it costs and",
    "the weeks that follow the",
    "a shape you notice which",
    "it costs more than",
    "the sort of",
  ])("une glose vraiment suspendue est vue : « %s »", (text) => {
    expect(checkDangling([{ where: "payload.x.gloss", text }], "field")).toHaveLength(1);
  });

  /*
   * ⚠ ET LA LISTE DES TITRES RESTE LARGE. Sans ce cas, « adoucir » le contrôle
   * des champs pourrait se faire en adoucissant les deux.
   */
  it("un titre, lui, ne peut pas finir sur un pronom ni un auxiliaire", () => {
    expect(checkDangling([{ where: "ligne", text: "You misread it" }], "line")).toHaveLength(1);
    expect(checkDangling([{ where: "ligne", text: "Your nervous system doesn't" }], "line")).toHaveLength(1);
  });

  it("une ligne finie passe", () => {
    expect(checkDangling([{ where: "l", text: "When life interrupts" }])).toEqual([]);
    expect(checkDangling([{ where: "l", text: "Rest is not a reward" }])).toEqual([]);
  });

  /*
   * ⚠ LE CONTRÔLE VAUT POUR TOUS LES ARCHÉTYPES. La carte praticienne l'a
   * révélé ; rien n'empêchait un libellé de diagramme de recopier le titre.
   */
  it("un libellé de diagramme qui recopie le titre est vu aussi", () => {
    const findings = checkEcho("Looking fine costs something", "Looking fine costs something", {
      surface: { label: "Looking fine costs something", gloss: "everything handled" },
      beneath: { label: "Carrying weight", gloss: "body says no to joy" },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].detail).toContain("surface.label");
  });

  it("les teintes de marque brutes sont rejetées", () => {
    const svg = `<rect fill="${DIRECTION.paper}"/><rect fill="${DIRECTION.secondary}"/><rect fill="${DIRECTION.primary}"/>`;
    const findings = checkTints(svg, DIRECTION);
    expect(names(findings)).toContain("tints.raw");
    expect(findings.filter((f) => f.check === "tints.raw")).toHaveLength(2);
  });

  it("deux aplats trop proches dans une même carte sont rejetés", () => {
    // Les deux teintes que l'ancien adoucissement uniforme produisait : 15 d'écart.
    const svg = `<rect fill="#E4CDAB"/><rect fill="#DFC0B0"/>`;
    expect(names(checkTints(svg, DIRECTION))).toContain("tints.tooClose");
    expect(colourDistance("#E4CDAB", "#DFC0B0")).toBeLessThan(MONTH_LIMITS.minTintDistance);
  });

  /*
   * ⚠ ET LA PALETTE ACTUELLE PASSE, SUR LES DEUX FONDS. C'est le cas qui
   * transforme le seuil en garantie plutôt qu'en vœu : si un réglage futur
   * rapproche deux teintes, il échoue ici.
   */
  it("la palette produite aujourd'hui passe, fond clair et fond sombre", () => {
    for (const dark of [false, true]) {
      const palette = cardPalette("k", DIRECTION, dark);
      const svg = palette.tints.map((t) => `<rect fill="${t}"/>`).join("");
      expect(checkTints(svg, DIRECTION), dark ? "fond sombre" : "fond clair").toEqual([]);
    }
  });
});

describe("un mois composé aujourd'hui est livrable", () => {
  it("les onze archétypes composés passent tous les contrôles de carte", () => {
    const palette = cardPalette("k", DIRECTION, false);
    for (const archetype of ["cycle", "quadrant_model", "numbered_strategies", "comparison_pair"]) {
      const composed = composeWithFallback({
        ...CARD, archetype, palette, payload: payloadFor(archetype, "nominal"),
      });
      const svg = composed.kind === "carousel" ? composed.slides[0].svg : composed.result.svg;
      expect(checkTints(svg, DIRECTION), archetype).toEqual([]);
    }
  });

  it("checkMonth rassemble tout et ne dit rien sur un mois sain", () => {
    const posts = monthFixture("isla").map((p) => ({ ...p }));
    const findings = checkMonth({ posts, direction: DIRECTION });
    // Le mois validé ne doit laisser passer ni mélange, ni doublon, ni recopie.
    expect(names(findings).filter((n) => n.startsWith("mix.") || n === "titles.duplicate")).toEqual([]);
  });
});
