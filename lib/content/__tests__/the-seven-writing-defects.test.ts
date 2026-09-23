import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkMonth, writtenLinesIn, type PostUnderCheck } from "@/lib/content/month-checks";
import {
  completenessOf, undecidedIn, checkUnfinished, checkCarouselPanels,
  checkBorrowed, checkClinicalClaim, checkSellsSlots, checkStraightQuotes, checkAcronym,
} from "@/lib/content/writing-checks";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ── LE MOIS QUI PASSAIT TOUT, REJOUÉ SUR SES DONNÉES ────────────────────
 *
 * ⚠ `odile.marchetti`, 2026-10, EST LE MOIS QUI A PASSÉ `checkMonth` EN
 * ENTIER — quinze contrôles bloquants au vert — ET QUI A NOTÉ 1,4 SUR 5 EN
 * ÉCRITURE à la notation indépendante.
 *
 * `fixtures/month-odile.json` est exporté de la base, tel quel. Chaque cas
 * ci-dessous nomme le défaut que la notation a relevé et vérifie qu'il est
 * maintenant refusé. Un contrôle écrit sur un exemple commode prouve qu'il
 * marche sur l'exemple : c'est pour ça que les trente posts viennent d'ici.
 */
const posts: PostUnderCheck[] = JSON.parse(
  readFileSync("lib/content/__tests__/fixtures/month-odile.json", "utf8")
);

const written = writtenLinesIn(posts);

/*
 * ── LES VERDICTS DU JUGE, MESURÉS LE 2026-09-24 ─────────────────────────
 *
 * ⚠ CES VERDICTS ONT ÉTÉ DEMANDÉS, PAS ÉCRITS. `97-record-verdicts.ts` les a
 * obtenus en un appel de 0,00093 $ sur ces neuf lignes exactement. Un verdict
 * inventé prouverait que le test passe, pas que le juge tranche.
 *
 * ⚠ ET LE JUGE N'EST PAS D'ACCORD AVEC LA NOTATION SUR UNE LIGNE.
 *
 * « The block may be choice » : la notation indépendante l'a relevée comme
 * « ungrammatical (missing article) », et le juge la dit COMPLÈTE. Les deux
 * ont raison sur leur question — il manque un article, et la phrase ne
 * s'arrête pas avant son sens. Ce contrôle-ci mesure la complétude, pas la
 * grammaire, et forcer le verdict pour faire un compte rond reviendrait à
 * écrire le résultat qu'on voulait.
 *
 * Trois des quatre titres, donc, plus celui que le lexique tranche seul.
 */
const RECORDED_VERDICTS: Record<string, boolean> = {
  "Success masks an overdriven": false,
  "The thing that works costs": false,
  "High performance masks held": false,
  "The block may be choice": true,
  "When life changes without": false,
  // Les témoins : des lignes finies, que le juge confirme finies.
  "Rest is not a reward": true,
  "Body says no": true,
  "information to work with": true,
  "nothing left by Friday": true,
};

/** Ceux que le juge a effectivement refusés. */
const JUDGED_UNFINISHED = Object.entries(RECORDED_VERDICTS)
  .filter(([, ok]) => ok === false)
  .map(([line]) => line);

const names = (f: { check: string }[]) => [...new Set(f.map((x) => x.check))];
const detailsOf = (f: { check: string; detail: string }[], check: string) =>
  f.filter((x) => x.check === check).map((x) => x.detail);

describe("défaut 1 — la phrase qui s'arrête avant son sens", () => {
  /*
   * ⚠ AUCUN DES QUATRE N'ÉTAIT TRONQUÉ. Ils font 25, 26, 27 et 27 caractères,
   * tous sous la limite de trente : `clampCardLine` n'y a pas touché.
   */
  it("les titres fautifs font moins que la limite de coupe", () => {
    for (const t of JUDGED_UNFINISHED) {
      expect(t.length, `« ${t} »`).toBeLessThan(30);
    }
  });

  it("le lexique tranche « When life changes without » tout seul", () => {
    expect(completenessOf("When life changes without")).toBe("unfinished");
    const found = checkUnfinished(written);
    expect(detailsOf(found, "text.unfinished").join(" ")).toContain("When life changes without");
  });

  /*
   * ⚠ ET IL NE PRÉTEND PAS TRANCHER LES TROIS AUTRES. C'est le point : un
   * lexique qui se tairait serait faux, un lexique qui devinerait serait pire.
   */
  it("il rend « undecided » sur ce qu'il ne sait pas, et le dit", () => {
    expect(completenessOf("The thing that works costs")).toBe("undecided");
    expect(completenessOf("High performance masks held")).toBe("undecided");
    expect(completenessOf("The block may be choice")).toBe("undecided");
    expect(undecidedIn(written)).toContain("The thing that works costs");
    expect(undecidedIn(written)).toContain("Success masks an overdriven");
  });

  /*
   * ⚠ « an overdriven » N'EST PAS TRANCHABLE NON PLUS, et une règle qui
   * prétendait le faire a été retirée le jour même : elle attrapait aussi
   * « Rest is not a reward », « The choice », « the memo », « back at the
   * desk » — quatre lignes finies du MÊME mois. La différence est qu'un mot
   * est un adjectif et l'autre un nom, et aucune liste ne le sait.
   */
  it("« Success masks an overdriven » va au juge, il n'est pas deviné", () => {
    expect(completenessOf("Success masks an overdriven")).toBe("undecided");
    expect(completenessOf("Rest is not a reward")).not.toBe("unfinished");
  });

  it("avec les verdicts mesurés, les quatre refusés le sont", () => {
    const found = checkUnfinished(written, RECORDED_VERDICTS);
    const joined = detailsOf(found, "text.unfinished").join(" | ");
    for (const t of JUDGED_UNFINISHED) expect(joined).toContain(t);
  });

  /*
   * ⚠ ET LES TÉMOINS NE SONT PAS REFUSÉS. Sans eux, un juge qui répondrait
   * « incomplet » à tout ferait passer ce fichier en entier.
   */
  it("les lignes finies que le juge a vues ne sont pas refusées", () => {
    const witnesses = ["Rest is not a reward", "Body says no", "information to work with"];
    const found = checkUnfinished(
      witnesses.map((text) => ({ where: "témoin", text })),
      RECORDED_VERDICTS
    );
    expect(found).toHaveLength(0);
  });

  /*
   * ⚠ L'ERREUR PENCHE VERS LE PERMISSIF, ET TROIS TOURS DE FAUX POSITIFS
   * l'ont imposé. Ces lignes-là sont finies et l'ont déjà été refusées à tort.
   */
  it.each([
    "information to work with",
    "where it comes from",
    "what she is good at",
    "When the body says no",
    "Rest is not a reward",
    "After that",
    "the alarm goes off on Monday",
  ])("« %s » n'est pas refusée", (line) => {
    expect(completenessOf(line)).not.toBe("unfinished");
    expect(checkUnfinished([{ where: "x", text: line }])).toHaveLength(0);
  });

  it("un juge muet ne refuse rien", () => {
    expect(checkUnfinished([{ where: "x", text: "The thing that works costs" }], {})).toHaveLength(0);
  });
});

describe("défaut 2 — deux volets qui se répètent dans un carrousel", () => {
  it("les deux carrousels fautifs sont nommés", () => {
    const found = checkCarouselPanels(posts);
    const joined = found.map((f) => f.detail).join(" | ");
    expect(joined).toContain("Rest does not look productive");
    expect(joined).toContain("Your body knows what you deny");
    expect(names(found)).toEqual(["carousel.samePanel"]);
  });

  /*
   * ⚠ ET LES DEUX AUTRES CARROUSELS DU MÊME MOIS PASSENT. Un contrôle qui
   * refuserait les quatre ne dirait rien de ce qui distingue les deux.
   */
  it("les deux carrousels sains ne sont pas refusés", () => {
    const joined = checkCarouselPanels(posts).map((f) => f.detail).join(" | ");
    expect(joined).not.toContain("Achievement hides protection");
    expect(joined).not.toContain("Fine and safe");
  });
});

describe("défaut 3 — un titre d'ouvrage repris sans source", () => {
  it("van der Kolk est nommé, et la ligne citée", () => {
    const found = checkBorrowed(written);
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain("van der Kolk");
    expect(found[0].detail).toContain("keeps score");
  });

  it("le vocabulaire du métier n'est pas une citation", () => {
    expect(checkBorrowed([
      { where: "x", text: "Your window of tolerance narrows under load." },
      { where: "y", text: "The polyvagal view of shutdown." },
    ])).toHaveLength(0);
  });
});

describe("défaut 4 — l'affirmation clinique que rien ne lisait", () => {
  /*
   * ⚠ LA PHRASE EST UN TITRE, et `checkEthics` ne recevait que
   * `caption + altText + payload`. Le champ n'était lu par aucune règle.
   */
  it("« Efficiency can become trauma » est refusée", () => {
    const found = checkClinicalClaim(written);
    expect(found.map((f) => f.detail).join(" | ")).toContain("Efficiency can become trauma");
  });

  it("la ligne fautive est bien une LIGNE DE CARTE, pas un champ de payload", () => {
    const line = written.find((l) => l.text === "Efficiency can become trauma");
    expect(line?.where).toContain("ligne de carte");
  });

  it("décrire n'est pas promettre", () => {
    expect(checkClinicalClaim([
      { where: "x", text: "Burnout after leave is not failure. It is information." },
      { where: "y", text: "EMDR processes what happened and its meaning." },
    ])).toHaveLength(0);
  });
});

describe("défaut 5 — le volet qui vend un créneau", () => {
  it("les deux volets de clôture sont refusés", () => {
    const found = checkSellsSlots(written);
    const joined = found.map((f) => f.detail).join(" | ");
    expect(joined).toContain("October evening slots now open");
    expect(joined).toContain("Evening slots opening in October");
  });

  /*
   * ⚠ LA CARTE PRATICIENNE GARDE LE DROIT DE LE DIRE : ses lignes viennent du
   * brief que la praticienne a rempli, pas d'un modèle (F16).
   */
  it("la carte praticienne peut dire qu'elle prend des clientes", () => {
    expect(checkSellsSlots([
      { where: "x", text: "Evening slots open", archetype: "practitioner_card" },
    ])).toHaveLength(0);
  });
});

describe("défaut 6 — l'apostrophe droite", () => {
  it("les champs fautifs du mois sont comptés", () => {
    const found = checkStraightQuotes(written);
    expect(found.length).toBeGreaterThanOrEqual(13);
    expect(found[0].check).toBe("text.straightQuote");
  });

  it("l'apostrophe typographique passe", () => {
    expect(checkStraightQuotes([{ where: "x", text: "EMDR doesn’t erase what happened." }])).toHaveLength(0);
  });
});

describe("défaut 7 — le sigle fabriqué", () => {
  it("les trois sigles du mois sont refusés", () => {
    const found = checkAcronym(posts, ["EMDR"]);
    const joined = found.map((f) => f.detail).join(" | ");
    for (const a of ["EMP", "EMD", "FTG"]) expect(joined).toContain(a);
  });

  /*
   * ⚠ « EMD » EST NOMMÉ À PART. Sur la carte d'une praticienne EMDR, un sigle
   * à une lettre de sa modalité se lira comme une faute de frappe.
   */
  it("« EMD » est signalé comme étant à une lettre d'« EMDR »", () => {
    const joined = checkAcronym(posts, ["EMDR"]).map((f) => f.detail).join(" | ");
    expect(joined).toContain("à une lettre de « EMDR »");
  });

  it("une technique nommée du catalogue passe", () => {
    expect(checkAcronym(
      [{ cardLine: "x", archetype: "lettered_technique", payload: { acronym: "RAIN" } }],
      ["EMDR"]
    )).toHaveLength(0);
  });
});

/* ── ET LE MOIS ENTIER, PAR LA PORTE ────────────────────────────────── */

const DIRECTION: DirectionPalette = {
  paper: "#FAF6EE", light: "#F4EEE3", secondary: "#C08A3E", primary: "#B4674A", dark: "#2B2A27",
};

describe("⚠ le mois livré le 2026-09-23 est refusé par checkMonth", () => {
  const findings = checkMonth({
    posts, direction: DIRECTION, wanted: 30,
    modalities: ["EMDR"], completeness: RECORDED_VERDICTS,
  });

  it("les sept défauts sont nommés, chacun par son contrôle", () => {
    expect(names(findings)).toEqual(expect.arrayContaining([
      "text.unfinished",
      "carousel.samePanel",
      "text.borrowed",
      "text.clinicalClaim",
      "text.sellsSlots",
      "text.straightQuote",
      "text.acronym",
    ]));
  });

  /*
   * ⚠ ET LES QUINZE CONTRÔLES D'AVANT LE LAISSENT TOUJOURS PASSER. C'est la
   * mesure qui compte : le mois n'a pas changé, ce sont les contrôles qui
   * manquaient. Sans cette ligne on ne saurait pas si le refus vient des sept
   * nouveaux ou d'un seuil déplacé au passage.
   */
  it("aucun des contrôles d'avant ne s'est mis à refuser ce mois", () => {
    const before = new Set([
      "month.short", "mix.distinct", "mix.dominant", "mix.loneSentence",
      "mix.samePayload", "text.dangling", "text.echo", "identity.invented",
      "tint.tooClose",
    ]);
    expect(names(findings).filter((n) => before.has(n))).toEqual([]);
  });
});
