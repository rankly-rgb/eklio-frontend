/*
 * ── THE ZONE SYSTEM, AS NUMBERS ─────────────────────────────────────────
 *
 * Everything the composition engine is allowed to know about space lives in
 * this file. Not as convention — as constants the layout reads and the tests
 * read back.
 *
 * ⚠ ONE BAND CARRIES TEXT OR DRAWING, NEVER BOTH.
 *
 * The single exception, and it is narrow: an object drawn CENTRED INSIDE a
 * shape that carries no text of its own, whose labels sit outside it. A loop
 * with an icon in the middle and its labels around the rim is the shape this
 * allows; "a faint illustration behind the copy" is the shape it forbids, and
 * that one is forbidden absolutely — there is no opacity at which a drawing
 * behind text is a considered decision rather than a way of avoiding one.
 *
 * ⚠ AND THE CLEARANCES ARE ENGINE CONSTRAINTS, NOT HOUSE STYLE.
 *
 * `layout.ts` refuses to emit a composition that violates them; it shrinks the
 * illustration, then the word count, then breaks to a carousel. A clearance
 * expressed as a guideline is a clearance that is met on the cards somebody
 * looked at.
 */

/** 1080 × 1350 — the 4:5 frame every card is composed in. */
export const CANVAS = { width: 1080, height: 1350 } as const;

/** The outer margin. Nothing is drawn or set outside it, ever. */
export const MARGIN = 72;

/** `eyebrow` — top band, mono only. */
export const EYEBROW_HEIGHT = 90;

/** `footer` — bottom band, handle and mark only. */
export const FOOTER_HEIGHT = 110;

/*
 * ── CLEARANCES, at 1080 wide ────────────────────────────────────────────
 *
 * All four are measured between BOXES, not between the things that drew them:
 * a glyph box is the em box of a set line, not its ink, because ink bounds
 * change with the string and a layout that depends on which letters were typed
 * is a layout that breaks on the next caption.
 */
export const CLEARANCE = {
  /** Between any glyph box and any drawn stroke. */
  glyphToStroke: 40,
  /** Between a glyph box and the edge of its own tinted field. */
  glyphToFieldEdge: 32,
  /** Between two adjacent tinted fields. */
  fieldToField: 48,
  /** Between the `footer` band and whatever sits above it. */
  aboveFooter: 64,
} as const;

/*
 * ── TYPOGRAPHIC FLOORS ──────────────────────────────────────────────────
 *
 * ⚠ THE OVERFLOW RESOLVER MAY NEVER CROSS THESE. When content does not fit,
 * the order is: shrink the illustration, then cut words, then break to a
 * carousel. Setting the body smaller is not on the list — a card nobody can
 * read on a phone has failed at the only thing it was for, and it fails
 * silently, which is worse than refusing to compose it.
 */
export const TYPE = {
  display: { min: 64, max: 110 },
  /*
   * ⚠ LE PLANCHER EST MONTÉ DE 28 À 30, ET CE N'EST PAS UN ARRONDI.
   *
   * La lisibilité se mesure désormais à 390px — un post affiché sur toute la
   * largeur d'un téléphone dans le fil — et le seuil y est 10,5px effectifs.
   * `10,5 × 1080 / 390 = 29,08`, donc 30. Le plancher absolu du libellé EST
   * cette règle, exprimée à la taille où la carte est composée.
   *
   * Le maximum monte de 44 à 48 : avec le plafond de 3:1 retiré, un libellé
   * sous un grand titre a de nouveau la place de respirer.
   */
  label: { min: 32, max: 48, floor: 30 },
  /*
   * ⚠ LA GLOSE A SA PROPRE ÉCHELLE, ET ELLE N'EST PLUS DU MONO.
   *
   * Elle empruntait la gamme du mono — 22 à 28px — alors qu'elle est déjà
   * composée dans la sans du kit. Plafonnée à 28, elle ne pouvait pas franchir
   * les 30px du plancher de vignette : la règle de lisibilité, appliquée à la
   * lettre, RETIRAIT les gloses de tous les diagrammes. Le mois du
   * 2026-09-21b n'en portait aucune.
   *
   * Sa gamme est maintenant la sienne, au-dessus du plancher.
   */
  gloss: { min: 30, max: 40, floor: 30 },
  /*
   * Le mono ne sert plus qu'au surtitre et au pied de carte — du chrome, que
   * personne ne lit dans un fil. Son plancher est 22px, comme demandé.
   */
  mono: { min: 22, max: 30, floor: 22 },
  /*
   * ── ⚠ DEUX, ET PLUS TROIS, ET CE N'EST PAS LE MÊME OBJET ──────────────
   *
   * L'ancien `minDisplayRatio: 3` était un PLAFOND : tout texte secondaire
   * était écrasé au tiers du titre. Sur un titre posé à 64px — c'est-à-dire
   * un titre un peu long — le plafond tombait à 21px, sous le plancher du
   * libellé, et la carte était refusée. Le moteur a donc appris à ne plus
   * rien porter : ni glose, ni diagramme à plus de deux cases.
   *
   * Ce qui reste est une règle de HIÉRARCHIE, pas un écrasement : le titre
   * doit faire au moins deux fois le libellé. À 110px le libellé peut aller
   * jusqu'à 48 ; à 64px il tient encore ses 32. La carte respire des deux
   * côtés.
   */
  minTitleToLabelRatio: 2,
} as const;

/**
 * How much of the `content` band an illustration may cover — 25% to 45% of
 * THAT BAND, and 0% of every other one.
 *
 * ⚠ CLEARANCE WINS. When the two disagree, coverage is what gives: an
 * illustration at 24% with its clearances met is a card; one at 25% touching a
 * label is a mistake that happens to satisfy a percentage.
 */
export const FIGURE_COVERAGE = { min: 0.25, max: 0.45 } as const;

/**
 * La part MINIMALE de la bande que le tracé doit réellement couvrir.
 *
 * ⚠ CE N'EST PAS `FIGURE_COVERAGE.min`, ET LES DEUX NE MESURENT PAS LA MÊME
 * CHOSE. `FIGURE_COVERAGE` borne la boîte RÉSERVÉE au dessin ; celle-ci borne
 * ce que le dessin en OCCUPE. Un archétype pouvait donc réserver 45 % de la
 * bande et n'en noircir que 5 — c'est ce que faisait le profil du
 * `quadrant_model`, mesuré à 4,9 % quand les références tiennent 9,2 à 9,4 %.
 *
 * Sous ce plancher, la carte est refusée et le repli cherche une forme dont le
 * dessin tient sa place. Le dégagement prime toujours : une illustration
 * agrandie qui toucherait un glyphe est refusée avant d'être mesurée ici.
 */
export const MIN_FIGURE_EXTENT = 0.09;

/**
 * Les crans de l'échelle de résolution, du plus généreux au plus serré.
 *
 * ⚠ ELLE VIT ICI ET PLUS DANS LE MOTEUR, PARCE QUE `figureShare` DOIT LA LIRE.
 * Tant que l'échelle était privée à `engine.ts`, « le dernier cran » était une
 * valeur que personne ne pouvait citer : `figureShare` normalisait sur [0, 1]
 * alors que l'échelle s'arrête à 0.5, et la part ne descendait jamais sous
 * 35 %. Le cycle, qui a besoin de 25 % pour loger ses trois nœuds, n'avait
 * donc plus aucun cran où tenir — il se repliait sur `surface_and_beneath`,
 * dont le mois rendu était déjà saturé.
 */
export const FIGURE_SCALES = [1, 0.9, 0.8, 0.7, 0.6, 0.5] as const;

/**
 * La part de la bande de contenu que prend une illustration, à un cran donné
 * de l'échelle de résolution.
 *
 * ⚠ LE HAUT DE LA FOURCHETTE D'ABORD, ET LE BAS SEULEMENT SI LA PLACE MANQUE.
 * Cinq archétypes calculaient leur boîte de dessin à partir de
 * `FIGURE_COVERAGE.min` DIRECTEMENT, puis la multipliaient encore par
 * `figureScale`. Un dessin partait donc à 25 % au mieux, et tombait à 12 % au
 * premier cran — sous le plancher de la spécification avant même qu'un label
 * ait été posé. C'est la raison mécanique pour laquelle le mois rendu ne
 * portait que des « marques » : les objets étaient dessinés correctement, dans
 * des boîtes trop petites pour qu'on les voie.
 *
 * `figureScale` vaut 1 au premier essai : la part vaut alors `max`. Chaque
 * cran descend vers `min`, jamais en dessous — l'échec, s'il faut échouer, est
 * un repli vers un autre archétype, pas une illustration invisible.
 */
export function figureShare(figureScale: number): number {
  const lo = FIGURE_SCALES[FIGURE_SCALES.length - 1];
  const hi = FIGURE_SCALES[0];
  const t = Math.min(1, Math.max(0, (figureScale - lo) / (hi - lo)));
  return FIGURE_COVERAGE.min + (FIGURE_COVERAGE.max - FIGURE_COVERAGE.min) * t;
}

/**
 * At most three dark-ground cards in twelve.
 *
 * Expressed as a ratio rather than a count so the month's length can change
 * without the rule following it around; the planner reads it, the renderer
 * does not — a single card has no opinion about the month it is in.
 */
export const DARK_CARD_RATIO = 3 / 12;

/** Line height, as a multiple of the font size. One number, every band. */
export const LINE_HEIGHT = 1.18;

/**
 * ⚠ THE ENGINE VERSION IS PART OF EVERY CONTENT HASH.
 *
 * `rendered_assets.content_hash` covers (archetype + payload + palette +
 * typography + THIS). A cache that survives a change to the engine serves last
 * month's bug forever, and nobody would ever find out: the asset is there, it
 * looks like a card, and it is wrong in exactly the way that was fixed.
 *
 * Bump it whenever a change to this directory could move a pixel.
 */
export const ENGINE_VERSION = "compose/1";

/*
 * ── LA VIGNETTE, QUI EST L'ENDROIT OÙ LA CARTE EST VRAIMENT LUE ─────────
 *
 * Une carte est composée à 1080 et regardée à 390 : c'est la largeur d'un
 * post affiché sur toute la largeur d'un téléphone dans le fil. 350 était la
 * largeur d'une vignette de grille — plus petite, donc plus punitive, et ce
 * n'est pas là que le post est lu.
 *
 * ⚠ CE N'EST PAS UN PLANCHER DE PLUS, C'EST LE MÊME, LU À LA BONNE TAILLE.
 * Rien ici n'abaisse quoi que ce soit : la règle ajoute une condition, elle
 * n'en retire aucune. Une carte qui ne la tient pas n'est pas rapetissée, elle
 * est repliée (`lib/compose/fallback.ts`).
 *
 * Mesuré le 2026-09-21 sur le premier mois réel : six cartes composées sur
 * onze portaient du texte de contenu entre 6,5 et 10,4px à 350.
 */
export const THUMB = { width: 390, minPx: 10.5 } as const;

/**
 * Le plancher équivalent, à la taille où la carte est composée.
 *
 * ⚠ DÉRIVÉ, JAMAIS RECOPIÉ. `10,5 × 1080 / 390 = 29,08` → 30, qui est aussi
 * le plancher absolu de `TYPE.label` et de `TYPE.gloss`. Écrire « 30 » à la
 * main ici serait une seconde définition de la règle, et la première à bouger
 * gagnerait en silence.
 */
export const CONTENT_MIN_AT_CANVAS = Math.ceil((THUMB.minPx * CANVAS.width) / THUMB.width);
