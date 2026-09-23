import { describe, expect, it } from "vitest";
import { cachedPrefix, CARD_LINE_MAX, CAPTION_MAX, ALT_TEXT_MAX, RATIONALE_MAX_WORDS } from "@/lib/content/generate/copy-batch";
import { CANVAS, CONTENT_MIN_AT_CANVAS, THUMB, TYPE } from "@/lib/compose/constants";
import { MODEL_WRITTEN_ARCHETYPES, CAROUSEL_INNER_ARCHETYPES, archetypeInstruction } from "@/lib/content/generate/copy-batch";
import type { BrandContext } from "@/lib/content/generate/copy-batch";

/*
 * ── AUCUN CHIFFRE ÉCRIT EN DUR DANS CE QU'ON ENVOIE AU MODÈLE ───────────
 *
 * ⚠ LA CONSIGNE A ENSEIGNÉ L'ANCIENNE RÈGLE PENDANT TROIS CORRECTIONS.
 *
 * Le bloc qui explique `card_line` disait encore « un libellé ne dépasse
 * jamais LE TIERS » et « 11,7px dans une vignette de 350px », longtemps après
 * que le rapport soit passé à la moitié et la mesure à 390px. Le modèle
 * recevait donc une consigne qui contredisait le moteur chargé de juger sa
 * réponse, et personne ne l'a vu : le texte d'un prompt ne casse aucun test.
 *
 * Ce fichier en casse un. Il relit le prompt RENDU et refuse tout nombre qui
 * ne se retrouve pas dans une constante du code.
 */

const BRAND: BrandContext = {
  practiceName: "A Practice",
  voice: "plain, warm, unhurried",
  offLimits: "",
  ethicsRules: [],
};

/** Tous les nombres qu'une constante du code justifie. */
const FROM_CONSTANTS = new Set<number>([
  CARD_LINE_MAX,
  CAPTION_MAX,
  ALT_TEXT_MAX,
  RATIONALE_MAX_WORDS,
  CANVAS.width,
  CANVAS.height,
  CONTENT_MIN_AT_CANVAS,
  THUMB.width,
  THUMB.minPx,
  TYPE.display.max,
  TYPE.display.min,
  TYPE.label.min,
  TYPE.label.max,
  TYPE.label.floor,
  TYPE.gloss.min,
  TYPE.gloss.max,
  TYPE.mono.min,
  TYPE.mono.max,
  TYPE.minTitleToLabelRatio,
  Math.floor(TYPE.display.max / TYPE.minTitleToLabelRatio),
]);

/**
 * Les nombres qu'un texte peut porter sans venir d'une constante de rendu.
 *
 * ⚠ CHACUN EST ICI POUR UNE RAISON NOMMÉE, sinon cette liste deviendrait la
 * porte par laquelle n'importe quel chiffre périmé rentre.
 */
const ALLOWED_PROSE = new Set<number>([
  // Les bornes de forme des archétypes — « 3 to 6 nodes », « 1 to 3 words ».
  // Elles viennent des validateurs de payload, qui sont eux-mêmes la source.
  0, 1, 2, 3, 4, 5, 6, 7, 8,
  // Les mesures citées dans les avertissements, qui racontent un fait passé
  // daté et ne pilotent aucun rendu : « 29 cartes sur 30 refusées ».
  9, 10, 13, 29, 45, 24,
]);

/*
 * ⚠ « (11 words) » N'EST PAS UNE RÈGLE, C'EST UN DÉCOMPTE.
 *
 * Les exemples conformes portent leur propre longueur entre parenthèses, pour
 * que le modèle voie ce que « au plus N mots » donne en pratique. Ce nombre
 * décrit le texte qui le précède : il ne peut pas être périmé, il peut
 * seulement être FAUX — et c'est un autre test qui le vérifierait.
 *
 * Il est retiré avant le balayage plutôt qu'ajouté à la liste des tolérés :
 * élargir la liste ouvrirait la porte à tous les 11 du prompt, y compris ceux
 * qui prétendraient régler quelque chose.
 */
const numbersIn = (text: string): number[] =>
  [...text.replace(/\(\d+ words?\)/g, "").matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w])/g)].map(
    (m) => Number(m[1])
  );

/*
 * ── ⚠ ON NE DEMANDE PLUS DE CARTE PRATICIENNE AU MODÈLE ────────────────
 *
 * Ce fichier parcourait `ARCHETYPE_KEYS`, la liste des onze. Elle n'est plus
 * la bonne : `practitioner_card` a quitté le schéma de sortie du modèle le
 * 2026-09-23, après qu'une de ses cartes a inventé « Rowan Mercier Therapy »
 * et « rowan@rowanmercier.com » sur le compte d'une autre praticienne.
 *
 * La bonne liste est `MODEL_WRITTEN_ARCHETYPES`, et les deux cas ci-dessous
 * tiennent la frontière : demander cet archétype au modèle lève, et aucun
 * carrousel ne peut l'empiler.
 */
describe("la carte praticienne ne s'écrit plus", () => {
  it("demander sa forme au modèle lève, plutôt que de rendre un schéma", () => {
    expect(() => archetypeInstruction("practitioner_card")).toThrow(/no shape written/);
  });

  it("elle ne figure ni dans les archétypes écrits, ni dans les volets d'un carrousel", () => {
    expect(MODEL_WRITTEN_ARCHETYPES).not.toContain("practitioner_card");
    expect(CAROUSEL_INNER_ARCHETYPES).not.toContain("practitioner_card");
  });

  it("et la consigne du carrousel ne la propose nulle part", () => {
    expect(archetypeInstruction("carousel")).not.toContain("practitioner_card");
  });
});

describe("le prompt ne porte aucun chiffre qui ne vienne du code", () => {
  it.each(MODEL_WRITTEN_ARCHETYPES)("%s", (archetype) => {
    const prefix = cachedPrefix(BRAND, archetype)
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

    const strays = numbersIn(prefix).filter(
      (n) => !FROM_CONSTANTS.has(n) && !ALLOWED_PROSE.has(n)
    );
    expect(
      [...new Set(strays)],
      `nombres du prompt qui ne viennent d'aucune constante : ${[...new Set(strays)].join(", ")}`
    ).toEqual([]);
  });

  /*
   * ⚠ ET LE PROMPT NE DOIT PAS CONTREDIRE UNE CONSTANTE EN TOUTES LETTRES.
   * C'est exactement la forme qu'avait le défaut : le mot « third » et le
   * nombre 350, tous deux faux, tous deux invisibles aux tests.
   */
  it("ne dit ni « third » ni une largeur de mesure autre que THUMB.width", () => {
    const prefix = cachedPrefix(BRAND, "cycle")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .toLowerCase();

    expect(prefix).not.toMatch(/\bthird\b/);
    expect(prefix).not.toMatch(/\ba third of\b/);
    // La seule largeur de vignette citable est celle où la lisibilité se mesure.
    for (const wrong of [320, 350, 360, 375, 400, 430]) {
      if (wrong === THUMB.width) continue;
      expect(prefix, `le prompt cite ${wrong}px`).not.toContain(`${wrong}px`);
    }
  });

  it("cite bien le rapport et la largeur en vigueur", () => {
    const prefix = cachedPrefix(BRAND, "cycle")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");
    expect(prefix).toContain(`1/${TYPE.minTitleToLabelRatio}`);
    expect(prefix).toContain(`${THUMB.width}px`);
    expect(prefix).toContain(`${CONTENT_MIN_AT_CANVAS}px`);
    expect(prefix).toContain(`AT MOST ${CARD_LINE_MAX}`);
  });
});
