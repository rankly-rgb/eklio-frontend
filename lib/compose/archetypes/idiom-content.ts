import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import type { Inventory } from "@/lib/visual-library/inventory";
import { candidates } from "@/lib/visual-library/match";
import { CLEARANCE, LINE_HEIGHT, TYPE } from "@/lib/compose/constants";
import { fitText, linesFrom, type TextFit } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import { inkOnTintFor, tintFor } from "@/lib/compose/palette";
import { libraryDrawing, libraryVector, placeVector } from "@/lib/compose/library";
import type { Ctx, Item } from "@/lib/compose/archetypes/types";
import type { Box, Line, Placed, Stroke } from "@/lib/compose/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES IDIOMES QUI REMPLACENT LA PILE DE BLOCS (spec visuelle, 2026-11-02)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Trois rendus de la bande de contenu, pour les archétypes qui produisaient
 * « un titre, puis une pile de blocs étiquetés » :
 *
 *   7  pilules à case   ← numbered_strategies (les étapes) ;
 *   6  bulles reliées   ← cycle (les nœuds), connecteurs CALCULÉS de bord à bord ;
 *   5  grille à taches  ← quadrant_model (les quatre cellules), une tache et un
 *                         dessin par cellule, chacun choisi PAR LE SENS de la
 *                         cellule — aucun dessin par défaut : une cellule sans
 *                         appariement fait refuser la grille.
 *
 * Aucune surface de texte nouvelle : les libellés et gloses sont ceux des
 * charges utiles existantes, déjà lus par `checkMonth` et le socle.
 *
 * ⚠ CHAQUE RENDU PEUT REFUSER (`null`) : l'archétype retombe alors sur sa mise
 * en page d'avant. Rien n'est posé sous un plancher ni à moins d'un dégagement.
 */
const ENTRIES = (inventoryJson as Inventory).entries;

/** Un texte d'aplat : libellé (serif d'affichage) et glose (sans), dans `w`. */
function fieldText(label: string, gloss: string, w: number, secondaryMax: number, maxH: number): { label: TextFit; gloss: TextFit | null } | null {
  const labelFit = fitText(label, "display", w, maxH, { min: TYPE.label.min, max: Math.min(40, TYPE.label.max, secondaryMax), floor: TYPE.label.floor });
  if (!labelFit) return null;
  if (!gloss.trim()) return { label: labelFit, gloss: null };
  const glossFit = fitText(gloss, "sans", w, maxH - labelFit.height - 6, { min: TYPE.gloss.min, max: Math.min(32, TYPE.gloss.max, secondaryMax), floor: TYPE.gloss.floor });
  if (!glossFit) return null;
  return { label: labelFit, gloss: glossFit };
}

function setText(fit: { label: TextFit; gloss: TextFit | null }, x: number, y: number, w: number, ink: string): Line[] {
  const lines = linesFrom(fit.label, x, y, w, "display", 400, ink, "start");
  if (fit.gloss) lines.push(...linesFrom(fit.gloss, x, round2(y + fit.label.height + 6), w, "sans", 400, ink, "start"));
  return lines;
}

const height = (fit: { label: TextFit; gloss: TextFit | null }) => round2(fit.label.height + (fit.gloss ? 6 + fit.gloss.height : 0));

/**
 * Le dessin du post dans l'espace qui reste sous `top`, s'il y a la place (≥ 160px).
 *
 * ⚠ LA SPEC NE MET PAS DE DESSIN SUR LES PILULES NI SUR LES BULLES. Sur un fond
 * photo, la photo tient lieu de visuel (« zéro carte vide » le lit) : sans place,
 * pas de dessin. Sur crème, il en faut un ; sans place, l'idiome refuse et
 * l'archétype garde sa mise en page d'avant.
 */
function drawingBelow(ctx: Ctx<unknown>, top: number): Placed | "none" | null {
  const free = round2(ctx.content.y + ctx.content.h - top);
  const side = round2(Math.min(free, 340, ctx.content.w * 0.4));
  if (side < 160) return ctx.onPhoto ? "none" : null;
  const box = { x: round2(ctx.content.x + ctx.content.w - side), y: round2(ctx.content.y + ctx.content.h - side), w: side, h: side };
  return { role: "figure", band: "content", box, strokes: ctx.draw(box, ctx.palette.ink) };
}

/* ── 7. Pilules à case ─────────────────────────────────────────────────── */
/**
 * Pleine largeur d'abord (la spec) ; si le dessin du post n'a pas sa place
 * dessous (sur crème, il en faut un), les pilules se resserrent et le dessin se
 * pose à leur droite, centré sur elles.
 */
export function pills(items: Item[], ctx: Ctx<unknown>): Placed[] | null {
  const full = pillsIn(items, ctx, ctx.content.w);
  if (full) return full;
  const side = round2(Math.min(260, ctx.content.w * 0.28));
  const narrow = pillsIn(items, { ...ctx, onPhoto: true }, round2(ctx.content.w - side - CLEARANCE.glyphToStroke));
  if (!narrow) return null;
  const fields = narrow.filter((p) => p.role === "field");
  const top = Math.min(...fields.map((f) => f.box.y));
  const bottom = Math.max(...fields.map((f) => f.box.y + f.box.h));
  if (bottom - top < side) return null;
  const box = { x: round2(ctx.content.x + ctx.content.w - side), y: round2(top + (bottom - top - side) / 2), w: side, h: side };
  return [...narrow.filter((p) => !(p.role === "figure" && p.strokes.some((st) => st.library))), { role: "figure", band: "content", box, strokes: ctx.draw(box, ctx.palette.ink) }];
}

function pillsIn(items: Item[], ctx: Ctx<unknown>, width: number): Placed[] | null {
  const { palette, secondaryMax } = ctx;
  const content = { ...ctx.content, w: width };
  const padX = 42;
  const padY = 26;
  const tick = 44;
  const textX = padX + tick + CLEARANCE.glyphToStroke + 2; /* + 2 : le contour de la case (3px) déborde de 1,5px */
  const innerW = content.w - textX - padX;
  const gap = CLEARANCE.fieldToField;
  const placed: Placed[] = [];
  let y = content.y;
  for (let i = 0; i < items.length; i += 1) {
    const fit = fieldText(items[i].label, items[i].gloss, innerW, secondaryMax, 220);
    if (!fit) return null;
    const h = round2(height(fit) + padY * 2);
    const tint = i % 2 === 0 ? 1 : 0;
    const box = { x: content.x, y, w: content.w, h };
    placed.push({ role: "field", band: "content", box, fill: tintFor(palette, tint), radius: round2(Math.min(h / 2, 60)) });
    const ink = inkOnTintFor(palette, tint);
    const lines = setText(fit, round2(content.x + textX), round2(y + padY), innerW, ink);
    placed.push({ role: "text", band: "content", box: { x: round2(content.x + textX), y: round2(y + padY), w: innerW, h: height(fit) }, lines });
    /* La case : un carré arrondi au trait, et la coche du pack — sur toutes les pilules (une case vide affirmerait « pas fait »). */
    const cy = round2(y + padY + fit.label.size * LINE_HEIGHT * 0.5);
    const cb = { x: round2(content.x + padX), y: round2(cy - tick / 2), w: tick, h: tick };
    const r = 12;
    const square: Stroke = {
      kind: "path",
      d: `M ${round2(cb.x + r)} ${cb.y} H ${round2(cb.x + tick - r)} A ${r} ${r} 0 0 1 ${round2(cb.x + tick)} ${round2(cb.y + r)} V ${round2(cb.y + tick - r)} A ${r} ${r} 0 0 1 ${round2(cb.x + tick - r)} ${round2(cb.y + tick)} H ${round2(cb.x + r)} A ${r} ${r} 0 0 1 ${cb.x} ${round2(cb.y + tick - r)} V ${round2(cb.y + r)} A ${r} ${r} 0 0 1 ${round2(cb.x + r)} ${cb.y} Z`,
      box: { x: round2(cb.x - 1.5), y: round2(cb.y - 1.5), w: tick + 3, h: tick + 3 },
      stroke: ink,
      strokeWidth: 3,
      fill: "none",
    };
    const tickBox = { x: round2(cb.x + 10), y: round2(cb.y + 11), w: 24, h: 22 };
    const t = placeVector(libraryVector("mark-tick"), tickBox);
    placed.push({ role: "figure", band: "content", box: cb, strokes: [square, { kind: "path", d: t.d, box: t.fitted, stroke: "none", strokeWidth: 0, fill: ink, fillRule: "evenodd" }] });
    y = round2(y + h + gap);
  }
  /* Les pilules tiennent dans la bande de contenu, ou l'idiome refuse. */
  if (y - gap > content.y + content.h) return null;
  const drawing = drawingBelow({ ...ctx, content }, round2(y - gap + CLEARANCE.glyphToStroke));
  if (!drawing) return null;
  if (drawing !== "none") placed.push(drawing);
  return placed;
}

/* ── 6. Bulles reliées ─────────────────────────────────────────────────── */
export type Connector = { from: Box; to: Box; d: string; start: [number, number]; end: [number, number] };

export function bubbles(nodes: Item[], ctx: Ctx<unknown>): { placed: Placed[]; connectors: Connector[] } | null {
  const { content, palette, secondaryMax } = ctx;
  const padX = 44;
  const padY = 44; // ≥ 40 : le connecteur touche le bord, le texte reste à 40px de lui
  const maxW = round2(content.w * 0.64);
  /* L'écart entre bulles : le dégagement entre deux aplats (48px), que le connecteur traverse. */
  const vgap = CLEARANCE.fieldToField;
  const placed: Placed[] = [];
  const boxes: Box[] = [];
  let y = content.y;
  for (let i = 0; i < nodes.length; i += 1) {
    const fit = fieldText(nodes[i].label, nodes[i].gloss, maxW - padX * 2, secondaryMax, 260);
    if (!fit) return null;
    const textW = Math.max(fit.label.width, fit.gloss?.width ?? 0);
    const w = round2(Math.min(maxW, textW + padX * 2));
    const h = round2(height(fit) + padY * 2);
    const x = i % 2 === 0 ? content.x : round2(content.x + content.w - w);
    const box = { x, y, w, h };
    boxes.push(box);
    const tint = i % 3 === 1 ? 0 : i % 3 === 2 ? 2 : 1;
    placed.push({ role: "field", band: "content", box, fill: tintFor(palette, tint), radius: round2(Math.min(h / 2, 150)) });
    const lines = setText(fit, round2(x + padX), round2(y + padY), w - padX * 2, inkOnTintFor(palette, tint));
    placed.push({ role: "text", band: "content", box: { x: round2(x + padX), y: round2(y + padY), w: round2(w - padX * 2), h: height(fit) }, lines });
    y = round2(y + h + vgap);
  }
  if (y - vgap > content.y + content.h) return null;
  /*
   * ⚠ LES CONNECTEURS SONT CALCULÉS, PAS POSÉS : chacun part du bord BAS d'une
   * bulle et arrive au bord HAUT de la suivante, aux abscisses de leurs flancs
   * intérieurs. Un trait qui s'arrête dans le vide se lit comme un bug.
   */
  const connectors: Connector[] = [];
  for (let i = 0; i + 1 < boxes.length; i += 1) {
    const a = boxes[i];
    const b = boxes[i + 1];
    const sx = round2(i % 2 === 0 ? a.x + a.w * 0.7 : a.x + a.w * 0.3);
    const ex = round2(i % 2 === 0 ? b.x + b.w * 0.3 : b.x + b.w * 0.7);
    const sy = round2(a.y + a.h);
    const ey = b.y;
    const my = round2((sy + ey) / 2);
    const d = `M ${sx} ${sy} C ${sx} ${my} ${ex} ${my} ${ex} ${ey}`;
    connectors.push({ from: a, to: b, d, start: [sx, sy], end: [ex, ey] });
    placed.push({
      role: "figure",
      band: "content",
      box: { x: round2(Math.min(sx, ex) - 2), y: sy, w: round2(Math.abs(ex - sx) + 4), h: round2(ey - sy) },
      strokes: [{ kind: "path", d, box: { x: round2(Math.min(sx, ex) - 2), y: sy, w: round2(Math.abs(ex - sx) + 4), h: round2(ey - sy) }, stroke: tintFor(palette, 3), strokeWidth: 4, fill: "none" }],
    });
  }
  const drawing = drawingBelow(ctx, round2(y - vgap + CLEARANCE.glyphToStroke));
  if (!drawing) return null;
  if (drawing !== "none") placed.push(drawing);
  return { placed, connectors };
}

/* ── 5. Grille à taches décalées ───────────────────────────────────────── */
/** Un dessin par cellule, choisi par le sens de la cellule ; distincts ; `null` si une cellule n'en a pas. */
export function cellDrawings(items: Item[], avoid: string | null): string[] | null {
  const taken = new Set<string>(avoid ? [avoid] : []);
  const out: string[] = [];
  for (const it of items) {
    const pick = candidates({ cardLine: it.label, hook: it.gloss }, ENTRIES).find((m) => !taken.has(m.id));
    if (!pick) return null;
    taken.add(pick.id);
    out.push(pick.id);
  }
  return out;
}

const BLOBS = ["shape-blob-soft", "shape-blob-wide", "shape-oval-tilted", "shape-cloud-soft"];

export function grid(items: Item[], ctx: Ctx<unknown>, avoid: string | null): Placed[] | null {
  const { content, palette, secondaryMax } = ctx;
  const ids = cellDrawings(items, avoid);
  if (!ids) return null;
  const cols = items.length > 4 ? 3 : 2;
  const rows = Math.ceil(items.length / cols);
  const colGap = 40;
  const rowGap = 64;
  const cw = round2((content.w - colGap * (cols - 1)) / cols);
  const ch = round2((content.h - rowGap * (rows - 1)) / rows);
  const placed: Placed[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const cx = round2(content.x + (i % cols) * (cw + colGap));
    const cy = round2(content.y + Math.floor(i / cols) * (ch + rowGap));
    const fit = fieldText(items[i].label, items[i].gloss, cw, secondaryMax, ch * 0.45);
    if (!fit) return null;
    const textH = height(fit);
    const holder = round2(Math.min(cw, ch - textH - CLEARANCE.glyphToStroke));
    if (holder < 150) return null;
    /* La tache, décalée (spec : 210px pour un dessin de 132) ; le dessin, centré dans la case. */
    const blobSide = round2(holder * 0.92);
    const blobBox = { x: round2(cx + (cw - blobSide) / 2 + holder * 0.08), y: round2(cy + holder * 0.04), w: blobSide, h: blobSide };
    const blob = placeVector(libraryVector(BLOBS[i % BLOBS.length]), blobBox);
    const drawSide = round2(holder * 0.6);
    const drawBox = { x: round2(cx + (cw - drawSide) / 2), y: round2(cy + (holder - drawSide) / 2), w: drawSide, h: drawSide };
    placed.push({
      role: "figure",
      band: "content",
      box: { x: cx, y: cy, w: cw, h: holder },
      strokes: [
        { kind: "path", d: blob.d, box: blob.fitted, stroke: "none", strokeWidth: 0, fill: tintFor(palette, i % 2 === 0 ? 1 : 2), fillRule: "evenodd" },
        ...libraryDrawing(ids[i])(drawBox, palette.ink),
      ],
    });
    const top = round2(cy + holder + CLEARANCE.glyphToStroke);
    const lines = setText(fit, cx, top, cw, palette.ink).map((l) => ({ ...l, anchor: "middle" as const, box: { ...l.box, x: round2(cx + (cw - l.box.w) / 2) } }));
    placed.push({ role: "text", band: "content", box: { x: cx, y: top, w: cw, h: textH }, lines });
  }
  return placed;
}
