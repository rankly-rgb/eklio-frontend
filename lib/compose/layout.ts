import { CLEARANCE, LINE_HEIGHT, TYPE } from "@/lib/compose/constants";
import { blockWidth, emsOf, measure, round2, widthOfEms, wrap } from "@/lib/compose/measure";
import { inkOnTintFor, tintFor } from "@/lib/compose/palette";
import type { Band, Box, FontRole, Line, Palette, Placed, Stroke } from "@/lib/compose/types";

/*
 * ── HOW THE `content` BAND IS READ ──────────────────────────────────────
 *
 * The brief names four bands and says one carries text or illustration, never
 * both. Three of them are unambiguous: `eyebrow` is mono only, `headline` is
 * display only, `footer` is the handle and the mark.
 *
 * `content` is the diagram — and a diagram has labels. The rule that governs
 * inside it is therefore the CLEARANCE, not a prohibition: 40px between any
 * glyph box and any drawn stroke, everywhere, with no exception and no
 * opacity. That is the reading this engine implements, and the collision suite
 * is what holds it to it.
 *
 * ── AND EVERY HELPER HERE REFUSES RATHER THAN SHRINKS PAST A FLOOR ──────
 *
 * `fitText` returns `null` when the text cannot be set inside its box at or
 * above the floor. It never returns a smaller size. The caller's answer to
 * `null` is to shrink the illustration, then to cut words, then to break to a
 * carousel — in that order, in `resolve` below.
 */

export type TextFit = { lines: string[]; size: number; height: number; width: number };

/**
 * The largest size in `range` at which `text` fits inside `maxW` × `maxH`.
 *
 * ⚠ STEPS OF 1px, DOWNWARD, AND IT STOPS AT `floor`. A binary search would be
 * faster and would also make the result depend on the search path when two
 * sizes both "fit"; this walks down and takes the first that does, which is one
 * answer for one input, which is what determinism means here.
 */
export function fitText(
  text: string,
  family: FontRole,
  maxW: number,
  maxH: number,
  range: { min: number; max: number; floor?: number }
): TextFit | null {
  const floor = range.floor ?? range.min;
  for (let size = range.max; size >= floor; size -= 1) {
    const lines = wrap(text, family, size, maxW);
    const height = round2(lines.length * size * LINE_HEIGHT);
    if (height <= maxH && blockWidth(lines, family, size) <= maxW) {
      return { lines, size, height, width: round2(blockWidth(lines, family, size)) };
    }
  }
  return null;
}

/** A measured block turned into positioned lines. `y` is the top of the first em box. */
export function linesFrom(
  fit: TextFit,
  x: number,
  y: number,
  w: number,
  family: FontRole,
  weight: number,
  fill: string,
  anchor: "start" | "middle"
): Line[] {
  return fit.lines.map((text, i) => ({
    text,
    size: fit.size,
    family,
    weight,
    fill,
    anchor,
    box: {
      x,
      y: round2(y + i * fit.size * LINE_HEIGHT),
      // ⚠ THE BOX IS THE MEASURED WIDTH, NOT THE COLUMN WIDTH. A centred line
      // in a 900px column does not occupy 900px, and pretending it does would
      // make the clearance test reject layouts that are fine — and, worse,
      // would make a caller "fix" them by moving things that were never close.
      w: round2(anchor === "middle" ? measure(text, family, fit.size) : measure(text, family, fit.size)),
      h: round2(fit.size * LINE_HEIGHT),
    },
  }));
}

/**
 * Centre a line's box inside `container` when it is anchored middle.
 *
 * Kept separate from `linesFrom` because the anchor decides the SVG attribute
 * and this decides the BOX, and those two being computed in one place is how
 * they drift apart.
 */
export function centreLines(lines: Line[], container: Box): Line[] {
  return lines.map((l) => ({
    ...l,
    box: { ...l.box, x: round2(container.x + (container.w - l.box.w) / 2) },
  }));
}

/* ── Tinted fields ───────────────────────────────────────────────────── */

export const FIELD_RADIUS = 18;

/**
 * One cell of a diagram: a flat tinted field, a label, and a gloss.
 *
 * ⚠ THE TEXT IS INSET BY `glyphToFieldEdge` ON EVERY SIDE, which is also why
 * the field-to-stroke distance never needs to be 40: a glyph inside a field is
 * already 32px from that field's edge, so a field kept 48px from a stroke puts
 * its glyphs 80px from it. The constraint that has to be checked directly is
 * the one for text with no field behind it.
 */
export function cell(
  band: Band,
  box: Box,
  label: string,
  gloss: string,
  palette: Palette,
  tintIndex: number,
  /** Le plafond de hiérarchie, `display / 2`. Voir `Ctx.secondaryMax`. */
  secondaryMax: number,
  /** Quand ce champ est une bulle, le côté vers lequel sa queue pointe. */
  tail?: "left" | "right"
): Placed[] | null {
  const pad = CLEARANCE.glyphToFieldEdge;
  const innerW = box.w - pad * 2;
  /*
   * ⚠ LA QUEUE MANGE LE BAS DU CHAMP, DONC ELLE MANGE DE LA HAUTEUR UTILE.
   * Elle est tracée à l'intérieur de la boîte (voir `Placed`), ce qui garde
   * tous les dégagements justes — à condition que le texte ne descende pas
   * dedans. C'est le même nombre des deux côtés : `svg.ts` retient
   * `min(28, h × 0.12)` pour la queue, et `cell` le retire ici.
   */
  const tailDrop = tail ? Math.min(28, box.h * 0.12) : 0;
  const innerH = box.h - pad * 2 - tailDrop;
  if (innerW <= 0 || innerH <= 0) return null;

  // ⚠ AN EMPTY GLOSS IS A VALID CELL, NOT A BROKEN ONE. That is how the
  // overflow resolver's second step — cut words — reaches a diagram: it strips
  // the supporting line and re-composes. A cell that refused an empty gloss
  // would make that step impossible and send every tight card straight to a
  // carousel.
  const hasGloss = gloss.trim().length > 0;
  /*
   * ⚠ THE LABEL GETS EVERYTHING THE GLOSS DOES NOT NEED AT ITS OWN FLOOR, not
   * a fixed share. A 55% split was the first version and it refused cells that
   * had room: a 64px inner height gave the label 35px, one pixel under what a
   * 30px line needs, while 23px of the gloss's share sat unused.
   */
  const glossFloorHeight = hasGloss ? TYPE.gloss.floor * LINE_HEIGHT + 8 : 0;
  const labelRange = { ...TYPE.label, max: Math.min(TYPE.label.max, secondaryMax) };
  if (labelRange.max < labelRange.floor) return null;
  const labelFit = fitText(label, "sans", innerW, innerH - glossFloorHeight, labelRange);
  if (!labelFit) return null;

  const lines = linesFrom(
    labelFit, box.x + pad, box.y + pad, innerW, "sans", 600, inkOnTintFor(palette, tintIndex), "start"
  );

  if (hasGloss) {
    /*
     * ⚠ SA PROPRE GAMME, PAS CELLE DU MONO. La glose est composée dans la sans
     * du kit depuis toujours ; elle empruntait seulement les TAILLES du mono,
     * plafonnées à 28px. Sous un plancher de vignette à 30, aucune glose ne
     * pouvait donc passer, et le résolveur les supprimait toutes.
     */
    const glossRange = {
      min: TYPE.gloss.min,
      max: Math.min(TYPE.gloss.max, secondaryMax),
      floor: TYPE.gloss.floor,
    };
    if (glossRange.max < glossRange.floor) return null;
    const glossFit = fitText(gloss, "sans", innerW, innerH - labelFit.height - 8, glossRange);
    if (!glossFit) return null;
    lines.push(
      ...linesFrom(
        glossFit, box.x + pad, round2(box.y + pad + labelFit.height + 8), innerW,
        "sans", 400, inkOnTintFor(palette, tintIndex), "start"
      )
    );
  }

  return [
    { role: "field", band, box, fill: tintFor(palette, tintIndex), radius: FIELD_RADIUS, ...(tail ? { tail } : {}) },
    { role: "text", band, box, lines },
  ];
}

/* ── Strokes ─────────────────────────────────────────────────────────── */

/**
 * A stroke's box is inflated by half its width on each side.
 *
 * Without that, a 6px line's box would be zero-height and a label sitting 41px
 * from its centre would measure as 41px of clearance while being 38px from its
 * edge. The clearance is about what a reader sees, which is the ink.
 */
function strokeBox(x1: number, y1: number, x2: number, y2: number, width: number): Box {
  const half = width / 2;
  return {
    x: round2(Math.min(x1, x2) - half),
    y: round2(Math.min(y1, y2) - half),
    w: round2(Math.abs(x2 - x1) + width),
    h: round2(Math.abs(y2 - y1) + width),
  };
}

export function line(x1: number, y1: number, x2: number, y2: number, colour: string, width = 4): Stroke {
  return {
    kind: "line",
    d: `M ${round2(x1)} ${round2(y1)} L ${round2(x2)} ${round2(y2)}`,
    box: strokeBox(x1, y1, x2, y2, width),
    stroke: colour,
    strokeWidth: width,
    fill: "none",
  };
}

export function circle(cx: number, cy: number, r: number, colour: string, width = 4): Stroke {
  const R = round2(r);
  return {
    kind: "circle",
    // An arc pair rather than `<circle>`: every stroke in this engine is a
    // `<path>`, so the parser has one shape to read rather than five.
    d:
      `M ${round2(cx - R)} ${round2(cy)} ` +
      `a ${R} ${R} 0 1 0 ${round2(R * 2)} 0 ` +
      `a ${R} ${R} 0 1 0 ${round2(-R * 2)} 0`,
    box: strokeBox(cx - r, cy - r, cx + r, cy + r, width),
    stroke: colour,
    strokeWidth: width,
    fill: "none",
  };
}

export function polyline(points: Array<[number, number]>, colour: string, width = 4): Stroke {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    kind: "path",
    d: points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${round2(p[0])} ${round2(p[1])}`)
      .join(" "),
    box: strokeBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), width),
    stroke: colour,
    strokeWidth: width,
    fill: "none",
  };
}

/* ── Splitting the body band ─────────────────────────────────────────── */

export type BodySplit = { headline: Box; content: Box };

/**
 * Give the headline what it needs and the content the rest, keeping
 * `fieldToField` between them.
 *
 * ⚠ THE HEADLINE IS MEASURED FIRST AND THE CONTENT TAKES THE REMAINDER, never
 * the other way round. A diagram that took its share first would push the
 * headline down until it hit its floor, and the floor is the one thing that
 * does not move.
 */
export function splitBody(body: Box, headlineHeight: number): BodySplit {
  const gapBetween = CLEARANCE.fieldToField;
  return {
    headline: { x: body.x, y: body.y, w: body.w, h: round2(headlineHeight) },
    content: {
      x: body.x,
      y: round2(body.y + headlineHeight + gapBetween),
      w: body.w,
      h: round2(body.h - headlineHeight - gapBetween),
    },
  };
}

/** A box inset on every side. */
export function inset(box: Box, by: number): Box {
  return {
    x: round2(box.x + by),
    y: round2(box.y + by),
    w: round2(box.w - by * 2),
    h: round2(box.h - by * 2),
  };
}

/*
 * ⚠ THE LAST ROW AND THE LAST COLUMN END EXACTLY ON THE EDGE.
 *
 * `round2` on an equal share leaves the last one a hundredth of a pixel out,
 * in whichever direction the division rounded. A hundredth of a pixel is
 * nothing — except that when it rounds the wrong way, the last row ends 0.01px
 * past the content band and the footer clearance measures 63.99 instead of 64.
 * The engine then refuses the composition, correctly, for a reason that has
 * nothing to do with the layout. So the last one takes the remainder.
 */
export function columns(box: Box, n: number): Box[] {
  const gapBetween = CLEARANCE.fieldToField;
  const w = round2((box.w - gapBetween * (n - 1)) / n);
  const right = round2(box.x + box.w);
  return Array.from({ length: n }, (_, i) => {
    const x = round2(box.x + i * (w + gapBetween));
    return { x, y: box.y, w: i === n - 1 ? round2(right - x) : w, h: box.h };
  });
}

export function rows(box: Box, n: number): Box[] {
  const gapBetween = CLEARANCE.fieldToField;
  const h = round2((box.h - gapBetween * (n - 1)) / n);
  const bottom = round2(box.y + box.h);
  return Array.from({ length: n }, (_, i) => {
    const y = round2(box.y + i * (h + gapBetween));
    return { x: box.x, y, w: box.w, h: i === n - 1 ? round2(bottom - y) : h };
  });
}

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  UN TITRE ÉQUILIBRÉ, SANS MOT SEUL EN FIN — ET UN NOMBRE DE LIGNES BORNÉ
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Spécification visuelle du 2026-11-02 : « pas de mot seul en fin de ligne »,
 * « un nombre maximal de lignes par idiome, réduction si le texte déborde, refus
 * sous le plancher ». La spec l'obtient en CSS par `text-wrap: balance` ; le
 * moteur compose en SVG, donc c'est un CALCUL DE COUPURE : à nombre de lignes
 * égal à celui du découpage glouton, la coupure qui minimise la ligne la plus
 * longue (programmation dynamique sur les mots). Une coupure dont la dernière
 * ligne porte un mot seul est refusée ; la taille descend ; sous le plancher, le
 * titre est refusé — jamais posé avec une veuve.
 */
export function balancedLines(words: string[], family: FontRole, size: number, maxW: number, count: number): string[] | null {
  const n = words.length;
  if (count < 1 || count > n) return null;
  /*
   * Les largeurs par sommes cumulées : la somme des avances d'un segment est
   * celle de ses mots plus ses espaces — exactement ce que `measure` calcule,
   * sans reparcourir les caractères à chaque segment.
   */
  const prefix = [0];
  for (const w of words) prefix.push(prefix[prefix.length - 1] + emsOf(w, family));
  const space = emsOf(" ", family);
  const width = (i: number, j: number) => widthOfEms(prefix[j] - prefix[i] + space * (j - i - 1), size);
  // best[k][i] : la plus petite « plus longue ligne » pour poser words[i..] sur k lignes.
  const best: number[][] = Array.from({ length: count + 1 }, () => new Array(n + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: count + 1 }, () => new Array(n + 1).fill(-1));
  best[0][n] = 0;
  for (let k = 1; k <= count; k += 1) {
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = i + 1; j <= n - (k - 1); j += 1) {
        const w = width(i, j);
        if (w > maxW) break;
        // ⚠ La DERNIÈRE ligne (k === 1) porte au moins deux mots dès que le titre en a deux.
        if (k === 1 && j !== n) continue;
        if (k === 1 && n >= 2 && j - i < 2) continue;
        const rest = best[k - 1][j];
        if (rest === Infinity) continue;
        const worst = Math.max(w, rest);
        if (worst < best[k][i]) {
          best[k][i] = worst;
          cut[k][i] = j;
        }
      }
    }
  }
  if (best[count][0] === Infinity) return null;
  const lines: string[] = [];
  let i = 0;
  for (let k = count; k >= 1; k -= 1) {
    const j = cut[k][i];
    lines.push(words.slice(i, j).join(" "));
    i = j;
  }
  return lines;
}

/** Vrai si un bloc de plusieurs lignes se termine par un mot seul. */
export function endsWithLoneWord(lines: string[]): boolean {
  if (lines.length < 2) return false;
  return lines[lines.length - 1].trim().split(/\s+/).length < 2;
}

export function fitTitle(
  text: string,
  family: FontRole,
  maxW: number,
  maxH: number,
  range: { min: number; max: number; floor?: number },
  maxLines = Infinity,
  lineHeight = LINE_HEIGHT
): TextFit | null {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const floor = range.floor ?? range.min;
  for (let size = range.max; size >= floor; size -= 1) {
    const greedy = wrap(text, family, size, maxW);
    for (let count = greedy.length; count <= Math.min(maxLines, words.length); count += 1) {
      const lines = balancedLines(words, family, size, maxW, count);
      if (!lines || endsWithLoneWord(lines)) continue;
      const height = round2(lines.length * size * lineHeight);
      if (height > maxH) break;
      return { lines, size, height, width: round2(blockWidth(lines, family, size)) };
    }
  }
  return null;
}
