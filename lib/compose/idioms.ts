import { CANVAS, LINE_HEIGHT, MARGIN, SERIF_FROM } from "@/lib/compose/constants";
import { EYEBROW, FOOTER } from "@/lib/compose/constants-bands";
import { fitTitle, type TextFit } from "@/lib/compose/layout";
import { measure, round2 } from "@/lib/compose/measure";
import { libraryDrawing, libraryVector, placeVector } from "@/lib/compose/library";
import type { Ground, GroundPalette } from "@/lib/compose/grounds";
import type { Box, FontRole, Line, Placed, Stroke } from "@/lib/compose/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES IDIOMES — DES RENDUS D'ARCHÉTYPES EXISTANTS (spec visuelle 2026-11-02)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Codés contre `spec.html` (valeurs exactes) et vérifiés contre ses PNG. Aucun
 * n'ouvre de surface de texte nouvelle : leurs chaînes sont les champs déjà
 * contrôlés (la phrase, le surtitre, la signature). Voir MAPPING.md.
 *
 *   9  grand dessin, fond plein : phrase seule sur teinte pleine (ocre ou
 *      terracotta) — dessin de 600px centré, titre Cormorant 138px centré ;
 *   10 citation, fond profond : phrase seule sur fond profond, en script
 *      (Parisienne) 168px, centrée — jamais sur une courbe ;
 *   13 couverture de carrousel : première diapositive sur photo — titre
 *      Cormorant 116px en bas, surtitre « … · 1/N », pastille de balayage.
 *
 * ⚠ TRANSPOSÉ, PAS COPIÉ. La spec centre son contenu en flexbox dans un cadre
 * 96 / 80 / 170 ; le moteur garde ses bandes (le pied commence à 1168px et rien
 * ne s'en approche à moins de 64px). Le centrage est calculé, l'équilibrage des
 * lignes aussi (`fitTitle`).
 */
export type Idiom = "big_drawing" | "quote_deep" | "carousel_cover" | "circle" | "photo_statement";

/**
 * Les idiomes que la spec pose avec du vide voulu : la citation centrée.
 *
 * ⚠ LA COUVERTURE N'EN EST PLUS (2026-11-05, F131). Son surtitre se posait juste
 * au-dessus du titre, au milieu de la carte : cartes 3 et 8 de mars 2027, à 44 et
 * 53 % de hauteur tenue, le haut vide. Le surtitre est maintenant en haut, le
 * titre ancré en bas ; la couverture passe le contrôle comme les autres.
 */
export const FILL_EXEMPT = new Set<string>(["quote_deep"]);

export function idiomFor(archetype: string, ground: Ground | undefined, slide?: number, hasDrawing = true): Idiom | null {
  if (!ground) return null;
  /*
   * ⚠ SANS DESSIN, SUR PHOTO (2026-11-05) : la couverture pour la diapositive 1,
   * et la même composition sans pastille pour une phrase seule — titre ancré en
   * bas, surtitre en haut. La mise en page ordinaire laissait le bas vide (cartes
   * 1, 26, 28, 29 de mars 2027, 30 à 37 % de hauteur tenue).
   */
  if (!hasDrawing) {
    if (archetype !== "single_statement" || ground !== "photo") return null;
    if (slide === 0) return "carousel_cover";
    return slide === undefined ? "photo_statement" : null;
  }
  if (archetype === "single_statement" && (ground === "ochre" || ground === "terra")) return "big_drawing";
  if (archetype === "single_statement" && ground === "deep") return "quote_deep";
  if (slide === 0 && ground === "photo") return "carousel_cover";
  /* 2 : une phrase seule sur crème — la photo dans un cercle, le titre centré dessous. */
  if (archetype === "single_statement" && ground === "cream" && slide === undefined) return "circle";
  return null;
}

/** Le haut et le bas de ce qu'un idiome peut occuper (la spec : 96px en haut ; le pied à 64px). */
export const IDIOM_TOP = 96;
export const IDIOM_BOTTOM = FOOTER.y - 64;
const INNER = { x: MARGIN + 8, w: CANVAS.width - 2 * (MARGIN + 8) };

function centred(fit: TextFit, top: number, family: FontRole, weight: number, fill: string): Line[] {
  return fit.lines.map((text, i) => {
    const w = round2(measure(text, family, fit.size));
    return {
      text,
      size: fit.size,
      family,
      weight,
      fill,
      anchor: "middle" as const,
      box: { x: round2((CANVAS.width - w) / 2), y: round2(top + i * fit.size * LINE_HEIGHT), w, h: round2(fit.size * LINE_HEIGHT) },
    };
  });
}

function left(fit: TextFit, x: number, top: number, family: FontRole, weight: number, fill: string, lineHeight = LINE_HEIGHT): Line[] {
  return fit.lines.map((text, i) => ({
    text,
    size: fit.size,
    family,
    weight,
    fill,
    anchor: "start" as const,
    box: { x, y: round2(top + i * fit.size * lineHeight), w: round2(measure(text, family, fit.size)), h: round2(fit.size * LINE_HEIGHT) },
  }));
}

/** La hauteur RÉELLE d'un bloc posé au pas `step` : la dernière boîte fait `LINE_HEIGHT` × la taille. */
const realHeight = (fit: TextFit, step: number) => round2((fit.lines.length - 1) * fit.size * step + fit.size * LINE_HEIGHT);

const textBox = (lines: Line[]): Box => {
  const x0 = Math.min(...lines.map((l) => l.box.x));
  const y0 = Math.min(...lines.map((l) => l.box.y));
  const x1 = Math.max(...lines.map((l) => l.box.x + l.box.w));
  const y1 = Math.max(...lines.map((l) => l.box.y + l.box.h));
  return { x: x0, y: y0, w: round2(x1 - x0), h: round2(y1 - y0) };
};

export type IdiomInput = {
  idiom: Idiom;
  statement: string;
  eyebrow: string;
  illustration: string | null;
  gp: GroundPalette;
};

/**
 * Le contenu d'un idiome (sans le pied, posé par le moteur). `null` : le texte
 * ne tient pas dans les bornes de l'idiome même au plancher — la carte est
 * refusée et le repli descend, jamais un titre qui déborde ou rapetisse sans fin.
 */
export function composeIdiom(input: IdiomInput): Placed[] | null {
  const { gp } = input;
  const span = IDIOM_BOTTOM - IDIOM_TOP;

  if (input.idiom === "big_drawing") {
    /* Titre Cormorant 138px (spec .xl), trois lignes au plus, jusqu'à 96px. */
    /*
     * Cormorant 138px (spec .xl) pour une phrase courte ; les phrases du mois
     * réel vont jusqu'à 24 mots — quatre lignes au plus, jusqu'à 80px (le seuil
     * Cormorant), puis refus. Mesuré sur décembre : à trois lignes / 96px, aucune
     * des phrases du mois n'entrait.
     */
    const fit = fitTitle(input.statement, "serif", INNER.w, span * 0.45, { min: SERIF_FROM, max: 138 }, 4, 1.02);
    if (!fit) return null;
    const gap = 54;
    const textH = realHeight(fit, 1.02);
    const side = round2(Math.min(600, span - textH - gap));
    if (side < 320) return null;
    const blockH = side + gap + textH;
    const top = round2(IDIOM_TOP + (span - blockH) / 2);
    const box = { x: round2((CANVAS.width - side) / 2), y: top, w: side, h: side };
    if (!input.illustration) return null;
    const strokes = libraryDrawing(input.illustration)(box, gp.ink);
    const lines = centred(fit, top + side + gap, "serif", 500, gp.ink).map((l, i) => ({ ...l, box: { ...l.box, y: round2(top + side + gap + i * fit.size * 1.02) } }));
    return [
      { role: "figure", band: "content", box, strokes },
      { role: "text", band: "headline", box: textBox(lines), lines },
    ];
  }

  if (input.idiom === "quote_deep") {
    /* Script 168px (spec .script), trois lignes au plus, jusqu'à 110px : sous, un script ne se lit plus. */
    /* Script 168px (spec), quatre lignes au plus, jusqu'à 96px (≈ 35px à 390 de large), puis refus. */
    const fit = fitTitle(input.statement, "script", INNER.w, span, { min: 96, max: 168 }, 4, 1.0);
    if (!fit) return null;
    const textH = realHeight(fit, 1.0);
    const top = round2(IDIOM_TOP + Math.max(0, (span - textH - 48 - 170) / 2));
    const lines = centred(fit, top, "script", 400, gp.ink).map((l, i) => ({ ...l, box: { ...l.box, y: round2(top + i * fit.size * 1.0) } }));
    /*
     * La citation n'a pas de dessin à côté d'elle (spec) : le dessin du post est
     * posé petit, centré sous la phrase — la carte reste attachée à son sens, et
     * le contrôle de non-vacuité le voit.
     */
    const under = round2(top + textH + 48);
    const side = round2(Math.min(170, IDIOM_BOTTOM - under));
    const placed: Placed[] = [{ role: "text", band: "headline", box: textBox(lines), lines }];
    if (side >= 110 && input.illustration) {
      const box = { x: round2((CANVAS.width - side) / 2), y: under, w: side, h: side };
      placed.push({ role: "figure", band: "content", box, strokes: libraryDrawing(input.illustration)(box, gp.soft) });
    }
    return placed;
  }

  if (input.idiom === "circle") {
    /*
     * Spec 2 : surtitre centré, photo ronde de 560px, titre Cormorant 96px centré
     * à 62px dessous. Le cercle rétrécit pour laisser au titre ses quatre lignes,
     * jamais sous 360px ; sinon refus. La photo n'est pas sous le texte : pas de voile.
     */
    const eyebrowSize = 26;
    const eyebrowText = input.eyebrow.toUpperCase();
    const ew = round2(measure(eyebrowText, "sans", eyebrowSize) * 1.2);
    if (ew > INNER.w) return null;
    const fit = fitTitle(input.statement, "serif", INNER.w, span * 0.4, { min: SERIF_FROM, max: 96 }, 4, 1.02);
    if (!fit) return null;
    const textH = realHeight(fit, 1.02);
    const eyebrowH = round2(eyebrowSize * LINE_HEIGHT);
    const side = round2(Math.min(560, span - eyebrowH - 34 - 62 - textH));
    if (side < 360) return null;
    const blockH = eyebrowH + 34 + side + 62 + textH;
    const top = round2(IDIOM_TOP + (span - blockH) / 2);
    const eyebrowLine: Line = { text: eyebrowText, size: eyebrowSize, family: "sans", weight: 500, fill: gp.soft, anchor: "middle", box: { x: round2((CANVAS.width - ew) / 2), y: top, w: ew, h: eyebrowH } };
    const circleBox = { x: round2((CANVAS.width - side) / 2), y: round2(top + eyebrowH + 34), w: side, h: side };
    const titleTop = round2(circleBox.y + side + 62);
    const lines = centred(fit, titleTop, "serif", 500, gp.ink).map((l, i) => ({ ...l, box: { ...l.box, y: round2(titleTop + i * fit.size * 1.02) } }));
    return [
      { role: "text", band: "eyebrow", box: eyebrowLine.box, lines: [eyebrowLine] },
      /* La place de la photo ronde : une figure SANS trait — le décor y pose l'image (`photoClip`). */
      { role: "figure", band: "content", box: circleBox, strokes: [] },
      { role: "text", band: "headline", box: textBox(lines), lines },
    ];
  }

  /* carousel_cover */
  const swipe = 112;
  const swipeBox = { x: CANVAS.width - MARGIN - 8 - swipe, y: round2(IDIOM_BOTTOM - swipe - 2), w: swipe, h: swipe }; /* − 2 : le contour (3px) déborde de 1,5px */
  const titleBottom = swipeBox.y - 40;
  const fit = fitTitle(input.statement, "serif", INNER.w, titleBottom - IDIOM_TOP - 120, { min: 80, max: 116 }, 4, 1.02);
  if (!fit) return null;
  const titleTop = round2(titleBottom - realHeight(fit, 1.02));
  const lines = left(fit, INNER.x, titleTop, "serif", 500, gp.ink, 1.02);
  /* Surtitre : Karla 26px, capitales espacées (spec .eyebrow), au-dessus du titre. */
  const eyebrowSize = 26;
  /* Le surtitre en haut de la carte, le titre ancré en bas : la hauteur est tenue (F131). */
  const eyebrowTop = IDIOM_TOP;
  const eyebrowText = input.eyebrow.toUpperCase();
  const eyebrowLine: Line = {
    text: eyebrowText,
    size: eyebrowSize,
    family: "sans",
    weight: 500,
    fill: gp.soft,
    anchor: "start",
    box: { x: INNER.x, y: eyebrowTop, w: round2(measure(eyebrowText, "sans", eyebrowSize) * 1.2), h: round2(eyebrowSize * LINE_HEIGHT) },
  };
  if (eyebrowLine.box.w > INNER.w || eyebrowTop < EYEBROW.y || eyebrowTop + eyebrowLine.box.h + 34 > titleTop) return null;
  /* La phrase seule ne se balaie pas : la même composition, sans pastille. */
  if (input.idiom === "photo_statement") {
    return [
      { role: "text", band: "eyebrow", box: eyebrowLine.box, lines: [eyebrowLine] },
      { role: "text", band: "headline", box: textBox(lines), lines },
    ];
  }
  /* La pastille : un cercle au trait, et la flèche du pack dedans. */
  const r = swipe / 2;
  const cx = swipeBox.x + r;
  const cy = swipeBox.y + r;
  const ring: Stroke = {
    kind: "path",
    d: `M ${round2(cx - r)} ${round2(cy)} A ${r} ${r} 0 1 1 ${round2(cx + r)} ${round2(cy)} A ${r} ${r} 0 1 1 ${round2(cx - r)} ${round2(cy)} Z`,
    box: { x: round2(swipeBox.x - 1.5), y: round2(swipeBox.y - 1.5), w: swipe + 3, h: swipe + 3 },
    /* Sur photo, le cercle est clair (spec : #CFC8BD) — l'encre du fond, pas la teinte secondaire, qui s'y confondait (1:1 mesuré). */
    stroke: gp.ink,
    strokeWidth: 3,
    fill: "none",
  };
  const arrowBox = { x: round2(cx - 26), y: round2(cy - 13), w: 52, h: 26 };
  const arrow = placeVector(libraryVector("mark-arrow-curve-right"), arrowBox);
  const arrowStroke: Stroke = { kind: "path", d: arrow.d, box: arrow.fitted, stroke: "none", strokeWidth: 0, fill: gp.ink, fillRule: "evenodd" };
  return [
    { role: "text", band: "eyebrow", box: eyebrowLine.box, lines: [eyebrowLine] },
    { role: "text", band: "headline", box: textBox(lines), lines },
    { role: "figure", band: "content", box: swipeBox, strokes: [ring, arrowStroke] },
  ];
}
