/*
 * ── LES ONZE RÉFÉRENCES DE COMPOSITION, ÉCRITES À LA MAIN ───────────────
 *
 * ⚠ CE FICHIER N'IMPORTE RIEN DE `lib/compose`, ET C'EST TOUT SON INTÉRÊT.
 *
 * Une référence produite par le moteur qu'elle sert à juger ne juge rien : elle
 * mesure la conformité du moteur à lui-même, et elle passe toujours. Chaque
 * composition ci-dessous est donc écrite depuis la SPÉCIFICATION seule — les
 * bandes, les dégagements, les budgets de mots, la fourchette de couverture —
 * avec ses propres constantes et ses propres tracés.
 *
 * Elles sont le contrat : même famille de composition, même genre
 * d'illustration, même logique de teintes, même densité. Pas une cible au pixel
 * près, et surtout pas un rendu produit : chaque fichier le dit en toutes
 * lettres dans son `<title>` et dans un `<desc>`.
 *
 * Voir `design/reference/posts/README.md` pour l'état du dossier au moment de
 * la reconstruction.
 */
import { mkdir, writeFile } from "node:fs/promises";

const OUT = "design/reference/posts";

/* ── La grille, telle que la spécification la décrit ─────────────────── */

const W = 1080;
const H = 1350;
const MARGIN = 72;

/** 40 glyphe↔trait, 32 glyphe↔bord de champ, 48 champ↔champ, 64 avant le pied. */
const CLEAR = { glyphToStroke: 40, glyphToFieldEdge: 32, fieldToField: 48, aboveFooter: 64 };

const EYEBROW_Y = 118;
const HEAD_TOP = 176;
const HEAD_SIZE = 104;
const HEAD_LEAD = 1.12;
const FOOTER_Y = 1272;

const INK = "#2B2A27";
const PAPER = "#FAF6EE";

/**
 * Des aplats ADOUCIS, pas les couleurs de marque.
 *
 * ⚠ LA SPÉCIFICATION LE DIT DEUX FOIS : « 2-3 teintes du kit adoucies en
 * aplats (pas les couleurs de marque saturées) ». Un or de marque à pleine
 * saturation derrière un libellé encre ne tient pas le contraste, et trois
 * champs saturés côte à côte font une carte qui crie.
 */
const TINTS = ["#F0E7D8", "#E7D3AE", "#EBC8B8", "#DCE0D3"];

const SANS = "Georgia, 'Times New Roman', serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";

/* ── Les primitives ──────────────────────────────────────────────────── */

type Box = { x: number; y: number; w: number; h: number };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Un tracé : trait continu, extrémités arrondies, sans remplissage ni ombre. */
const path = (d: string, width = 4) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" ` +
  `stroke-linecap="round" stroke-linejoin="round"/>`;

const field = (b: Box, tint: string) =>
  `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="18" fill="${tint}"/>`;

const text = (
  x: number,
  y: number,
  s: string,
  size: number,
  weight: number | string = 400,
  family = SANS,
  fill = INK
) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" ` +
  `font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;

/**
 * Un libellé et sa glose dans un champ teinté.
 *
 * Libellé 44px, glose 32px — tous deux au-dessus du plancher absolu de 30px à
 * 1080, et le titre à 104px tient la règle « titre ≥ 2 × libellé ».
 */
function cell(b: Box, label: string, gloss: string, tint: string): string {
  const px = b.x + CLEAR.glyphToFieldEdge;
  const py = b.y + CLEAR.glyphToFieldEdge;
  const parts = [field(b, tint), text(px, py + 40, label, 44, 600)];
  if (gloss) parts.push(text(px, py + 88, gloss, 32, 400));
  return parts.join("\n    ");
}

/** La bande de contenu : ce qui reste sous un titre de `lines` lignes. */
function contentBand(lines: number): Box {
  const headBottom = HEAD_TOP + lines * HEAD_SIZE * HEAD_LEAD;
  const top = headBottom + CLEAR.fieldToField;
  return { x: MARGIN, y: top, w: W - MARGIN * 2, h: FOOTER_Y - CLEAR.aboveFooter - 40 - top };
}

/** La part de la bande qu'une illustration occupe, dans la fourchette 25-45 %. */
const coverage = (band: Box, share: number) => Math.round(band.h * share);

function card(opts: {
  eyebrow: string;
  headline: string[];
  footer: string;
  body: string;
  note: string;
}): string {
  const head = opts.headline
    .map((l, i) => text(MARGIN, HEAD_TOP + 76 + i * HEAD_SIZE * HEAD_LEAD, l, HEAD_SIZE, 400))
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <title>référence reconstruite, pas un rendu produit</title>
  <desc>${esc(opts.note)} — reconstruite depuis la spécification écrite du système validé, sans passer par lib/compose.</desc>
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  ${text(MARGIN, EYEBROW_Y, opts.eyebrow, 24, 500, MONO)}
  ${head}
  ${opts.body}
  ${text(MARGIN, FOOTER_Y, opts.footer, 26, 400, MONO, "#6E675C")}
</svg>
`;
}

/* ── Les onze compositions ───────────────────────────────────────────── */

const FOOT = "@rowanmercier";

function singleStatement(): string {
  const b = contentBand(3);
  return card({
    eyebrow: "REST",
    headline: ["Rest is not a reward", "you earn after", "everything else"],
    footer: FOOT,
    note: "phrase seule, un mot en italique, une petite marque dessinée",
    // ⚠ Une marque, pas un objet : la spécification ne demande ici qu'une
    // respiration sous la phrase. C'est le seul archétype où l'illustration
    // ne porte pas le sens — parce que la phrase le porte seule.
    body: path(`M ${b.x} ${b.y + 24} C ${b.x + 66} ${b.y + 14} ${b.x + 154} ${b.y + 34} ${b.x + 220} ${b.y + 24}`),
  });
}

function quadrantModel(): string {
  const b = contentBand(2);
  const figH = coverage(b, 0.34);
  const cx = b.x + b.w / 2;
  const cy = b.y + figH / 2;
  const s = figH * 0.9;
  const X = (u: number) => Math.round(cx - s / 2 + s * u);
  const Y = (v: number) => Math.round(cy - s / 2 + s * v);
  const grid = { x: b.x, y: b.y + figH + CLEAR.fieldToField, w: b.w, h: b.h - figH - CLEAR.fieldToField };
  const cw = (grid.w - CLEAR.fieldToField) / 2;
  const ch = (grid.h - CLEAR.fieldToField) / 2;
  const at = (i: number): Box => ({
    x: grid.x + (i % 2) * (cw + CLEAR.fieldToField),
    y: grid.y + Math.floor(i / 2) * (ch + CLEAR.fieldToField),
    w: cw,
    h: ch,
  });
  const cells = [
    ["Sunday dread", "starts before the alarm"],
    ["Rest fails", "the body stays braced"],
    ["Still bracing", "nothing asked it to"],
    ["Sleep breaks", "waking at four"],
  ];
  return card({
    eyebrow: "BURNOUT",
    headline: ["Effort on one axis,", "relief on the other"],
    footer: FOOT,
    note: "modèle en quatre cases, un profil de tête au centre, quatre teintes",
    body: [
      path(
        `M ${X(0.2)} ${Y(1)} C ${X(0.1)} ${Y(0.7)} ${X(0.12)} ${Y(0.28)} ${X(0.4)} ${Y(0.14)} ` +
          `C ${X(0.62)} ${Y(0.06)} ${X(0.82)} ${Y(0.2)} ${X(0.79)} ${Y(0.38)} ` +
          `L ${X(0.72)} ${Y(0.47)} L ${X(0.82)} ${Y(0.61)} L ${X(0.7)} ${Y(0.65)} ` +
          `C ${X(0.75)} ${Y(0.7)} ${X(0.68)} ${Y(0.73)} ${X(0.72)} ${Y(0.77)} ` +
          `C ${X(0.76)} ${Y(0.85)} ${X(0.64)} ${Y(0.89)} ${X(0.56)} ${Y(0.89)} ` +
          `C ${X(0.5)} ${Y(0.93)} ${X(0.49)} ${Y(0.96)} ${X(0.49)} ${Y(1)}`
      ),
      text(X(0.98) + CLEAR.glyphToStroke, cy, "effort", 24, 500, MONO),
      text(b.x, b.y + 26, "relief", 24, 500, MONO),
      ...cells.map(([l, g], i) => cell(at(i), l, g, TINTS[i])),
    ].join("\n  "),
  });
}

function cycle(): string {
  const b = contentBand(2);
  const gw = Math.round(b.w * 0.42);
  const gy = b.y;
  const rr = Math.min(b.h * 0.16, gw * 0.26);
  const mr = gy + b.h / 2;
  const ma = b.x + gw / 2;
  const listX = b.x + gw + CLEAR.fieldToField;
  const listW = b.w - gw - CLEAR.fieldToField;
  const rows = ["Push harder", "Run empty", "Brace again"];
  const gl = ["the list gets done", "nothing left by Friday", "Monday asks the same"];
  const rh = (b.h - CLEAR.fieldToField * 2) / 3;
  return card({
    eyebrow: "THE LOOP",
    headline: ["The thought that", "keeps coming back"],
    footer: FOOT,
    note: "cycle, un fil noué qui descend la gouttière, trois teintes",
    body: [
      // Le fil : deux brins qui courent d'un bord à l'autre, un nœud au milieu.
      path(
        `M ${ma + gw * 0.28} ${gy} C ${ma + gw * 0.1} ${gy + b.h * 0.1} ` +
          `${ma + rr} ${mr - rr * 1.6} ${ma} ${mr - rr} ` +
          `C ${ma - rr * 1.5} ${mr - rr * 0.4} ${ma - rr * 1.2} ${mr + rr * 1.2} ${ma + rr * 0.3} ${mr + rr * 0.6} ` +
          `C ${ma + rr * 1.3} ${mr + rr * 0.1} ${ma + rr * 0.9} ${mr - rr * 1.1} ${ma - rr * 0.5} ${mr - rr * 0.2} ` +
          `C ${ma - rr * 1.8} ${mr + rr * 0.8} ${ma - gw * 0.2} ${gy + b.h * 0.9} ${ma - gw * 0.3} ${gy + b.h}`
      ),
      ...rows.map((l, i) =>
        cell({ x: listX, y: b.y + i * (rh + CLEAR.fieldToField), w: listW, h: rh }, l, gl[i], TINTS[i])
      ),
    ].join("\n  "),
  });
}

function surfaceAndBeneath(): string {
  const b = contentBand(2);
  const figH = coverage(b, 0.4);
  const half = (b.h - figH - CLEAR.fieldToField * 2) / 2;
  const fy = b.y + half + CLEAR.fieldToField;
  const water = fy + figH * 0.42;
  const cx = b.x + b.w / 2;
  const deepR = Math.round(figH * 0.415);
  const topR = Math.round(deepR / 2.1);
  const deepW = Math.round(deepR * 1.45);
  return card({
    eyebrow: "UNDERNEATH",
    headline: ["What it looks like,", "and what holds it"],
    footer: FOOT,
    note: "surface et profondeur, une forme qui traverse la ligne d'eau, deux teintes",
    body: [
      cell({ x: b.x, y: b.y, w: b.w, h: half }, "Handling it", "every deadline met", TINTS[0]),
      path(`M ${b.x} ${water} L ${cx - topR - 16} ${water}`),
      path(`M ${cx + topR + 16} ${water} L ${b.x + b.w} ${water}`),
      path(`M ${cx - topR} ${water} A ${topR} ${topR} 0 0 1 ${cx + topR} ${water}`),
      path(
        `M ${cx - topR} ${water} C ${cx - deepW} ${water + deepR * 0.45} ` +
          `${cx - deepW * 0.55} ${water + deepR * 1.3} ${cx} ${water + deepR * 1.35} ` +
          `C ${cx + deepW * 0.55} ${water + deepR * 1.3} ${cx + deepW} ${water + deepR * 0.45} ${cx + topR} ${water}`
      ),
      cell({ x: b.x, y: fy + figH + CLEAR.fieldToField, w: b.w, h: half }, "Running empty", "no memory of rest", TINTS[1]),
    ].join("\n  "),
  });
}

function comparisonPair(): string {
  const b = contentBand(2);
  const figH = coverage(b, 0.3);
  const cw = (b.w - CLEAR.fieldToField) / 2;
  const bh = Math.round(figH / 1.16);
  const bw = Math.min(cw, Math.round(bh * 1.9));
  const rest = { y: b.y + figH + CLEAR.fieldToField, h: b.h - figH - CLEAR.fieldToField };
  const rh = (rest.h - CLEAR.fieldToField) / 2;
  const bubble = (x: number, pointLeft: boolean) => {
    const r = Math.round(Math.min(bw, bh) * 0.22);
    const tx = pointLeft ? x + bw * 0.18 : x + bw * 0.82;
    const d = pointLeft ? -1 : 1;
    return [
      path(
        `M ${x + r} ${b.y} L ${x + bw - r} ${b.y} A ${r} ${r} 0 0 1 ${x + bw} ${b.y + r} ` +
          `L ${x + bw} ${b.y + bh - r} A ${r} ${r} 0 0 1 ${x + bw - r} ${b.y + bh} ` +
          `L ${x + r} ${b.y + bh} A ${r} ${r} 0 0 1 ${x} ${b.y + bh - r} ` +
          `L ${x} ${b.y + r} A ${r} ${r} 0 0 1 ${x + r} ${b.y} Z`
      ),
      path(
        `M ${tx} ${b.y + bh} L ${tx + d * bw * 0.07} ${b.y + bh + bh * 0.16} L ${tx + d * bw * 0.16} ${b.y + bh}`
      ),
    ].join("\n  ");
  };
  const L = [["Looks fine", "shows up on time"], ["Sounds steady", "answers every message"]];
  const R = [["Feels braced", "shoulders never drop"], ["Sleeps light", "awake before the alarm"]];
  return card({
    eyebrow: "TWO READINGS",
    headline: ["What it looks like,", "what it feels like"],
    footer: FOOT,
    note: "paire de comparaison, deux bulles qui se font face, deux teintes",
    body: [
      bubble(Math.round(b.x + (cw - bw) / 2), false),
      bubble(Math.round(b.x + cw + CLEAR.fieldToField + (cw - bw) / 2), true),
      ...L.map(([l, g], i) =>
        cell({ x: b.x, y: rest.y + i * (rh + CLEAR.fieldToField), w: cw, h: rh }, l, g, TINTS[0])
      ),
      ...R.map(([l, g], i) =>
        cell(
          { x: b.x + cw + CLEAR.fieldToField, y: rest.y + i * (rh + CLEAR.fieldToField), w: cw, h: rh },
          l, g, TINTS[1]
        )
      ),
    ].join("\n  "),
  });
}

function numberedStrategies(): string {
  const b = contentBand(2);
  const gw = Math.round(b.w * 0.4);
  const spineX = b.x + gw - 12;
  const listX = b.x + gw + CLEAR.fieldToField;
  const listW = b.w - gw - CLEAR.fieldToField;
  const rows = ["Name it", "Slow down", "Stop early"];
  const gl = ["say what today cost", "one thing at a time", "before the tank empties"];
  const rh = (b.h - CLEAR.fieldToField * 2) / 3;
  const ps = Math.min(gw - 60, b.h * 0.46);
  const px = b.x;
  const py = b.y;
  const X = (u: number) => Math.round(px + ps * u);
  const Y = (v: number) => Math.round(py + ps * v);
  return card({
    eyebrow: "THREE RETURNS",
    headline: ["Three small things", "that give a little back"],
    footer: FOOT,
    note: "stratégies numérotées, une plante en pot, trois teintes",
    body: [
      path(`M ${X(0.24)} ${Y(0.6)} L ${X(0.33)} ${Y(0.98)} L ${X(0.67)} ${Y(0.98)} L ${X(0.76)} ${Y(0.6)} Z`),
      path(`M ${X(0.5)} ${Y(0.6)} C ${X(0.46)} ${Y(0.44)} ${X(0.53)} ${Y(0.28)} ${X(0.5)} ${Y(0.1)}`),
      path(
        `M ${X(0.5)} ${Y(0.45)} C ${X(0.24)} ${Y(0.44)} ${X(0.13)} ${Y(0.24)} ${X(0.4)} ${Y(0.2)} ` +
          `C ${X(0.48)} ${Y(0.28)} ${X(0.51)} ${Y(0.37)} ${X(0.5)} ${Y(0.45)} Z`
      ),
      path(
        `M ${X(0.5)} ${Y(0.36)} C ${X(0.76)} ${Y(0.34)} ${X(0.87)} ${Y(0.14)} ${X(0.6)} ${Y(0.1)} ` +
          `C ${X(0.52)} ${Y(0.18)} ${X(0.49)} ${Y(0.28)} ${X(0.5)} ${Y(0.36)} Z`
      ),
      path(`M ${spineX} ${b.y + 2} L ${spineX} ${b.y + b.h - 2}`),
      ...rows.map((_, i) => {
        const my = Math.round(b.y + i * (rh + CLEAR.fieldToField) + rh / 2);
        return path(`M ${spineX - 14} ${my} L ${spineX + 14} ${my}`);
      }),
      ...rows.map((l, i) =>
        cell({ x: listX, y: b.y + i * (rh + CLEAR.fieldToField), w: listW, h: rh }, l, gl[i], TINTS[i])
      ),
    ].join("\n  "),
  });
}

function letteredTechnique(): string {
  const b = contentBand(2);
  const gw = Math.round(b.w * 0.4);
  const acroY = b.y + 34;
  const top = acroY + CLEAR.glyphToStroke;
  const listX = b.x + gw + CLEAR.fieldToField;
  const listW = b.w - gw - CLEAR.fieldToField;
  const h = b.h - (top - b.y);
  const rows = ["Recognise", "Allow", "Investigate"];
  const gl = ["name what is here", "stop pushing it away", "ask where it sits"];
  const rh = (h - CLEAR.fieldToField * 2) / 3;
  const s = Math.min(gw - 40, h * 0.7);
  const ax = b.x + (gw - s) / 2;
  const ay = top + (h - s) / 2;
  const cx = Math.round(ax + s / 2);
  const ring = Math.round(s * 0.11);
  const bot = Math.round(ay + s * 0.86);
  return card({
    eyebrow: "AFTER EMDR",
    headline: ["Three steps back", "into the room"],
    footer: FOOT,
    note: "technique en étapes autour d'une ancre, trois teintes",
    body: [
      text(b.x, acroY, "RAI", 30, 500, MONO),
      path(`M ${cx} ${ay + ring} m ${-ring} 0 a ${ring} ${ring} 0 1 0 ${ring * 2} 0 a ${ring} ${ring} 0 1 0 ${-ring * 2} 0`),
      path(`M ${cx} ${ay + ring * 2} L ${cx} ${bot}`),
      path(`M ${cx - s * 0.22} ${ay + s * 0.34} L ${cx + s * 0.22} ${ay + s * 0.34}`),
      path(
        `M ${cx - s * 0.34} ${bot - s * 0.2} C ${cx - s * 0.34} ${bot} ${cx - s * 0.1} ${bot} ${cx} ${bot} ` +
          `C ${cx + s * 0.1} ${bot} ${cx + s * 0.34} ${bot} ${cx + s * 0.34} ${bot - s * 0.2}`
      ),
      ...rows.map((l, i) =>
        cell({ x: listX, y: top + i * (rh + CLEAR.fieldToField), w: listW, h: rh }, l, gl[i], TINTS[i])
      ),
    ].join("\n  "),
  });
}

function concentricControl(): string {
  const b = contentBand(2);
  const size = Math.min(b.w, coverage(b, 0.42));
  const cx = b.x + b.w / 2;
  const cy = b.y + size / 2;
  const rings = ["The workload", "The pace", "The stopping"];
  const gl = ["not yours to set", "partly yours", "entirely yours"];
  const listY = b.y + size + CLEAR.fieldToField;
  const cw = (b.w - CLEAR.fieldToField * 2) / 3;
  const inner = (size / 2) * (1 - (2 * 0.72) / 3);
  const sx = cx - inner * 0.62;
  const sy = cy - inner * 0.62;
  const ss = inner * 1.24;
  const X = (u: number) => Math.round(sx + ss * u);
  const Y = (v: number) => Math.round(sy + ss * v);
  const hr = Math.round(ss * 0.12);
  return card({
    eyebrow: "CONTROL",
    headline: ["What is yours", "to put down"],
    footer: FOOT,
    note: "anneaux de contrôle, une silhouette assise au centre, trois teintes",
    body: [
      ...[0, 1, 2].map((i) => {
        const r = Math.round((size / 2) * (1 - (i * 0.72) / 3));
        return path(`M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`);
      }),
      path(`M ${X(0.34)} ${Y(0.14) - hr} a ${hr} ${hr} 0 1 0 0 ${hr * 2} a ${hr} ${hr} 0 1 0 0 ${-hr * 2}`, 3),
      path(
        `M ${X(0.34)} ${Y(0.14) + hr} C ${X(0.25)} ${Y(0.4)} ${X(0.27)} ${Y(0.56)} ${X(0.38)} ${Y(0.63)} ` +
          `L ${X(0.78)} ${Y(0.63)} L ${X(0.8)} ${Y(0.87)}`, 3
      ),
      path(`M ${X(0.12)} ${Y(0.93)} L ${X(0.9)} ${Y(0.93)}`, 3),
      ...rings.map((l, i) =>
        cell(
          { x: b.x + i * (cw + CLEAR.fieldToField), y: listY, w: cw, h: b.h - size - CLEAR.fieldToField },
          l, gl[i], TINTS[i]
        )
      ),
    ].join("\n  "),
  });
}

function annotatedCurve(): string {
  const b = contentBand(2);
  const plotH = coverage(b, 0.42);
  const base = b.y + plotH;
  const level = (t: number) =>
    t <= 0.45 ? 0.94 - (0.78 * t) / 0.45 : 0.16 + (0.46 * (t - 0.45)) / 0.55;
  const pts = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    return `${Math.round(b.x + b.w * t)} ${Math.round(base - plotH * (0.06 + 0.86 * level(t)))}`;
  });
  const names = ["First day", "Week three", "Week six"];
  const gl = ["running on relief", "the relief runs out", "the old pace returns"];
  const listY = base + CLEAR.glyphToStroke + 30 + CLEAR.fieldToField;
  const cw = (b.w - CLEAR.fieldToField * 2) / 3;
  return card({
    eyebrow: "GOING BACK",
    headline: ["The weeks after", "going back to work"],
    footer: FOOT,
    note: "courbe annotée, trois moments nommés en colonnes, trois teintes",
    body: [
      path(`M ${b.x} ${b.y} L ${b.x} ${base}`),
      path(`M ${b.x} ${base} L ${b.x + b.w} ${base}`),
      path(`M ${pts.join(" L ")}`, 6),
      text(b.x, b.y - CLEAR.glyphToStroke, "load", 24, 500, MONO),
      text(b.x + b.w - 120, base + CLEAR.glyphToStroke + 24, "weeks back", 24, 500, MONO),
      ...names.map((l, i) =>
        cell(
          { x: b.x + i * (cw + CLEAR.fieldToField), y: listY, w: cw, h: b.y + b.h - listY },
          l, gl[i], TINTS[i]
        )
      ),
    ].join("\n  "),
  });
}

function practitionerCard(): string {
  const b = contentBand(2);
  const lines = ["EMDR for burnout", "Oakland, California", "Taking new clients"];
  const fh = CLEAR.glyphToFieldEdge * 2 + lines.length * 62;
  const s = Math.min(b.h - fh - CLEAR.fieldToField, b.w * 0.3);
  const dx = b.x + (b.w - s) / 2;
  const dy = b.y + fh + CLEAR.fieldToField;
  const X = (u: number) => Math.round(dx + s * u);
  const Y = (v: number) => Math.round(dy + s * v);
  return card({
    eyebrow: "HOW I WORK",
    headline: ["Where to start,", "if you want to"],
    footer: FOOT,
    /*
     * ⚠ LE SEUL ARCHÉTYPE OÙ UNE DONNÉE DE BILAN PEUT ÊTRE RECOPIÉE. « Oakland,
     * California » est ici parce que c'est une carte praticienne : ailleurs,
     * une réponse de bilan oriente le CHOIX du sujet et ne se pose jamais sur
     * la carte.
     */
    note: "carte praticienne, une porte entrouverte, une teinte",
    body: [
      field({ x: b.x, y: b.y, w: b.w, h: fh }, TINTS[0]),
      ...lines.map((l, i) =>
        text(b.x + CLEAR.glyphToFieldEdge, b.y + CLEAR.glyphToFieldEdge + 44 + i * 62, l, 44, i === 0 ? 600 : 400)
      ),
      path(`M ${X(0.1)} ${Y(0)} L ${X(0.1)} ${Y(1)} L ${X(0.62)} ${Y(1)} L ${X(0.62)} ${Y(0)} Z`),
      path(`M ${X(0.62)} ${Y(0.06)} L ${X(0.94)} ${Y(0.16)} L ${X(0.94)} ${Y(0.9)} L ${X(0.62)} ${Y(1)}`),
      path(`M ${X(0.7)} ${Y(0.56)} L ${X(0.7)} ${Y(0.62)}`),
    ].join("\n  "),
  });
}

/** Le carrousel : les volets côte à côte, dans une seule planche. */
function carousel(): string {
  const slides = [singleStatement(), cycle(), surfaceAndBeneath()];
  const inner = slides
    .map((s, i) => {
      const body = s.slice(s.indexOf("<rect width="), s.lastIndexOf("</svg>"));
      return `<g transform="translate(${i * (W + 60)}, 0)">${body}</g>`;
    })
    .join("\n  ");
  const total = W * 3 + 120;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${H}" width="${total}" height="${H}">
  <title>référence reconstruite, pas un rendu produit</title>
  <desc>carrousel — trois volets, même grille, même famille d'illustration ; reconstruit depuis la spécification écrite.</desc>
  <rect width="${total}" height="${H}" fill="#E9E4DC"/>
  ${inner}
</svg>
`;
}

const FILES: Array<[string, () => string]> = [
  ["single-statement", singleStatement],
  ["quadrant-model", quadrantModel],
  ["cycle", cycle],
  ["surface-and-beneath", surfaceAndBeneath],
  ["comparison-pair", comparisonPair],
  ["numbered-strategies", numberedStrategies],
  ["lettered-technique", letteredTechnique],
  ["concentric-control", concentricControl],
  ["annotated-curve", annotatedCurve],
  ["practitioner-card", practitionerCard],
  ["carousel", carousel],
];

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const [name, build] of FILES) {
    await writeFile(`${OUT}/${name}.svg`, build(), "utf8");
    console.log(`référence reconstruite : ${OUT}/${name}.svg`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
