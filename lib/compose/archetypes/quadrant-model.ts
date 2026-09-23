import { CLEARANCE, figureShare, TYPE } from "@/lib/compose/constants";
import { cell, columns, fitText, linesFrom, rows } from "@/lib/compose/layout";
import { mirrored, profile, variantOf } from "@/lib/compose/illustrations";
import { round2 } from "@/lib/compose/measure";
import type { Placed } from "@/lib/compose/types";
import { parseItems, type ArchetypeModule, type Item } from "@/lib/compose/archetypes/types";

export type QuadrantModel = { axis_x: string; axis_y: string; items: Item[] };

/**
 * Four cells around a drawn cross, with the two axes named.
 *
 * ⚠ THE AXIS NAMES ARE MONO AND SIT OUTSIDE THE STROKES' CLEARANCE, not on
 * them. A label riding a line is the single most common way this layout goes
 * wrong, and it goes wrong invisibly: it reads fine at the size a designer
 * looks at it and collides at the size it ships.
 */
/** Every stroke on this card, so the clearance arithmetic has one number to read. */
const STROKE = 4;

export const quadrantModel: ArchetypeModule<QuadrantModel> = {
  key: "quadrant_model",
  illustrationZone: "content",
  tintCount: 4,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    if (!p || typeof p.axis_x !== "string" || typeof p.axis_y !== "string") return null;
    const items = parseItems(p.items, 4, 4);
    return items ? { axis_x: p.axis_x, axis_y: p.axis_y, items } : null;
  },

  compose({ payload, palette, content, figureScale, secondaryMax }) {
    const placed: Placed[] = [];

    /*
     * ── ⚠ EN GOUTTIÈRE, COMME LE CYCLE, ET POUR LA MÊME MESURE ──────────
     *
     * Le profil était posé en BANDEAU au-dessus de la grille, donc il
     * disputait aux quatre cases la HAUTEUR — la seule dimension dont cette
     * carte manque. Le résolveur descendait l'illustration cran par cran
     * jusqu'à ce qu'elle tienne, et elle finissait à **4,4 % de la bande** là
     * où les références en couvrent 9,2 : la tête devenait un crochet.
     *
     * Une notation indépendante a mesuré ce 4,9 %, et `MIN_FIGURE_EXTENT` le
     * refuse désormais — ce qui, en bandeau, faisait replier l'archétype que
     * la même notation avait classé meilleure carte-diagramme du lot. Le
     * plancher avait raison, le remède était ailleurs.
     *
     * Une gouttière coûte de la LARGEUR, que cette carte a : la tête y tient
     * sur toute la hauteur, et les quatre cases se partagent le reste.
     */
    const gutterW = round2(content.w * figureShare(figureScale) * 0.8);
    if (gutterW < 220) return null;

    const gridBox = {
      x: round2(content.x + gutterW + CLEARANCE.fieldToField),
      y: content.y,
      w: round2(content.w - gutterW - CLEARANCE.fieldToField),
      h: content.h,
    };
    if (gridBox.w < 300) return null;

    const half = STROKE / 2;
    const headW = round2(Math.min(gutterW, content.h * 0.58));
    const head = {
      x: round2(content.x + (gutterW - headW) / 2),
      y: round2(content.y + (content.h - headW) / 2),
      w: headW,
      h: headW,
    };
    /*
     * ⚠ LE PROFIL REGARDE D'UN CÔTÉ OU DE L'AUTRE. Deux cartes `quadrant_model`
     * dans un même mois portaient exactement la même tête ; l'orientation se
     * déduit de la clef de palette, donc elle est propre à la carte et stable
     * d'un rendu à l'autre.
     */
    const drawn = profile(head, palette.ink, STROKE);
    const flip = variantOf(palette.key) === 1 ? mirrored(drawn, head) : null;
    placed.push({
      role: "figure",
      band: "content",
      box: head,
      strokes: flip ? flip.strokes : drawn,
      ...(flip ? { transform: flip.transform } : {}),
    });

    /*
     * Les deux axes restent NOMMÉS — ce sont eux qui disent comment lire la
     * grille — posés au-dessus et au-dessous de la tête, dans la gouttière,
     * à un dégagement complet du tracé.
     */
    const nameRange = { min: TYPE.mono.min, max: Math.min(TYPE.mono.max, secondaryMax), floor: TYPE.mono.floor };
    if (nameRange.max < nameRange.floor) return null;
    const xFit = fitText(payload.axis_x, "mono", gutterW, 40, nameRange);
    const yFit = fitText(payload.axis_y, "mono", gutterW, 40, nameRange);
    if (!xFit || !yFit) return null;

    const above = round2(head.y - half - CLEARANCE.glyphToStroke - yFit.height);
    const below = round2(head.y + head.h + half + CLEARANCE.glyphToStroke);
    if (above < content.y || below + xFit.height > content.y + content.h) return null;

    placed.push({
      role: "text",
      band: "content",
      box: { x: content.x, y: above, w: gutterW, h: round2(below + xFit.height - above) },
      lines: [
        ...linesFrom(yFit, content.x, above, gutterW, "mono", 500, palette.ink, "start"),
        ...linesFrom(xFit, content.x, below, gutterW, "mono", 500, palette.ink, "start"),
      ],
    });

    const [top, bottom] = rows(gridBox, 2);
    const boxes = [...columns(top, 2), ...columns(bottom, 2)];
    for (let i = 0; i < 4; i += 1) {
      const built = cell("content", boxes[i], payload.items[i].label, payload.items[i].gloss, palette, i, secondaryMax);
      if (!built) return null;
      placed.push(...built);
    }

    return placed;
  }
};
