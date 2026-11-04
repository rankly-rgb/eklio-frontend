import { CANVAS } from "@/lib/compose/constants";
import { round2 } from "@/lib/compose/measure";
import type { Box, Composition, Placed } from "@/lib/compose/types";

/*
 * ── EMITTING THE SVG, AND WHY IT CARRIES ITS OWN BOXES ──────────────────
 *
 * Every placed element is wrapped in a `<g>` carrying `data-role` and
 * `data-box`. That is not debug output: it is the contract the collision suite
 * reads.
 *
 * The alternative — parsing geometry back out of the emitted paths — means
 * implementing bezier bounds inside the test. A bug there would make the suite
 * pass on cards that collide, which is the exact failure a collision suite
 * exists to prevent. The boxes are computed by whoever drew the thing, printed
 * alongside it, and read back verbatim.
 *
 * ⚠ AND THE OUTPUT IS BYTE-FOR-BYTE REPRODUCIBLE. Every number goes through
 * `round2`, attributes are emitted in a fixed order, and nothing here reads a
 * clock, a random source, or an object key order that is not already sorted.
 * `rendered_assets.content_hash` is a cache key only if that holds.
 */

const FAMILY_STACK = {
  display: "Fraunces",
  sans: "Karla",
  mono: "IBM Plex Mono",
  serif: "Cormorant Garamond",
  script: "Parisienne",
} as const;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function boxAttr(b: Box): string {
  return `${round2(b.x)},${round2(b.y)},${round2(b.w)},${round2(b.h)}`;
}

function renderPlaced(p: Placed): string {
  const head = `<g data-role="${p.role}" data-band="${p.band}" data-box="${boxAttr(p.box)}">`;

  if (p.role === "field") {
    if (!p.tail) {
      return (
        head +
        `<rect x="${round2(p.box.x)}" y="${round2(p.box.y)}" ` +
        `width="${round2(p.box.w)}" height="${round2(p.box.h)}" ` +
        `rx="${round2(p.radius)}" fill="${p.fill}"/>` +
        `</g>`
      );
    }

    /*
     * Un champ à queue : une bulle. Le corps s'arrête au-dessus du bas de la
     * boîte et la queue occupe ce qui reste — la boîte déclarée ne bouge pas,
     * donc aucun dégagement ne change.
     */
    const { x, y, w, h } = p.box;
    const drop = Math.min(28, h * 0.12);
    const bodyH = round2(h - drop);
    const r = round2(p.radius);
    const tx = round2(p.tail === "left" ? x + w * 0.16 : x + w * 0.84);
    const dir = p.tail === "left" ? -1 : 1;
    const d =
      `M ${round2(x + r)} ${round2(y)} H ${round2(x + w - r)} ` +
      `A ${r} ${r} 0 0 1 ${round2(x + w)} ${round2(y + r)} ` +
      `V ${round2(y + bodyH - r)} ` +
      `A ${r} ${r} 0 0 1 ${round2(x + w - r)} ${round2(y + bodyH)} ` +
      `L ${round2(tx + dir * w * 0.09)} ${round2(y + bodyH)} ` +
      `L ${round2(tx)} ${round2(y + h)} ` +
      `L ${round2(tx + dir * w * 0.02)} ${round2(y + bodyH)} ` +
      `H ${round2(x + r)} ` +
      `A ${r} ${r} 0 0 1 ${round2(x)} ${round2(y + bodyH - r)} ` +
      `V ${round2(y + r)} ` +
      `A ${r} ${r} 0 0 1 ${round2(x + r)} ${round2(y)} Z`;
    return head + `<path d="${d}" fill="${p.fill}"/>` + `</g>`;
  }

  if (p.role === "figure") {
    const open = p.transform
      ? `<g data-role="figure" data-band="${p.band}" data-box="${boxAttr(p.box)}" transform="${p.transform}">`
      : head;
    const body = p.strokes
      .map((s) => {
        const common =
          `fill="${s.fill}" stroke="${s.stroke}" stroke-width="${round2(s.strokeWidth)}" ` +
          (s.fillRule ? `fill-rule="${s.fillRule}" ` : "") +
          (s.library ? `data-library="${esc(s.library)}" ` : "") +
          `stroke-linecap="round" stroke-linejoin="round" ` +
          `data-box="${boxAttr(s.box)}"`;
        return `<path d="${s.d}" ${common}/>`;
      })
      .join("");
    return open + body + `</g>`;
  }

  const body = p.lines
    .map((l) => {
      // ⚠ THE BASELINE, DERIVED FROM THE EM BOX TOP. Boxes are what the
      // clearances are measured between, so the box is what the layout
      // positions; the baseline is arithmetic over it and lives only here.
      const baseline = round2(l.box.y + l.size * 0.8);
      const x = l.anchor === "middle" ? round2(l.box.x + l.box.w / 2) : round2(l.box.x);
      return (
        `<text x="${x}" y="${baseline}" ` +
        `font-family="${FAMILY_STACK[l.family]}" font-size="${round2(l.size)}" ` +
        `font-weight="${l.weight}" fill="${l.fill}" ` +
        `text-anchor="${l.anchor}" ` +
        `data-box="${boxAttr(l.box)}">` +
        (l.spans
          ? l.spans
              .map((s) =>
                s.emphasis
                  ? `<tspan data-emphasis="1" font-style="italic" fill="${l.emphasisFill ?? l.fill}">${esc(s.text)}</tspan>`
                  : esc(s.text)
              )
              .join("")
          : esc(l.text)) +
        `</text>`
      );
    })
    .join("");

  return head + body + `</g>`;
}

/*
 * ⚠ LE DÉCOR EST SOUS TOUT, ET HORS DES `<g data-role>`. Il n'est ni texte, ni
 * trait, ni aplat : le contrôle de dégagement ne le lit pas, et c'est voulu —
 * la forme est DERRIÈRE le titre. Ce qui le garde lisible est le contraste,
 * résolu à la pose (`decorFor`), pas une distance.
 */
/** FNV-1a 32 bits, en base 36 : un identifiant court et stable. */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function decorLayers(composition: Composition): string {
  const d = composition.decor;
  if (!d) return "";
  const W = CANVAS.width;
  const H = CANVAS.height;
  let out = "";
  if (d.photo) {
    /*
     * ⚠ DES MARCHES, PAS UNE RAMPE. Deux arrêts à la même position par limite
     * de bande : l'opacité est constante sur toute la bande, et une ligne de
     * texte ne tombe jamais dans une interpolation qui la mettrait sous son
     * plancher. Les bandes égales voisines sont fusionnées.
     */
    /*
     * ⚠ UN IDENTIFIANT TIRÉ DU CONTENU. L'écran de relecture insère plusieurs
     * SVG dans la même page (diapositives, variantes) : un `id` fixe ferait
     * prendre à une carte le voile d'une autre. Deux voiles identiques
     * partagent leur identifiant, ce qui est sans conséquence.
     */
    const key = fnv(`${d.photo.id}|${d.photo.veil}|${d.photo.bands.join(",")}|${JSON.stringify(d.photo.halos)}`);
    const step = H / d.photo.bands.length;
    let stops = "";
    let prev: number | null = null;
    d.photo.bands.forEach((a, i) => {
      if (a === prev) return;
      /* ⚠ CINQ DÉCIMALES : arrondi à deux, un arrêt glissait de 6,75px sur 1350 et une ligne au bord de sa bande tombait sous le voile de la voisine. */
      const at = Math.round(((i * step) / H) * 1e5) / 1e5;
      if (prev !== null) stops += `<stop offset="${at}" stop-color="${d.photo!.veil}" stop-opacity="${prev}"/>`;
      stops += `<stop offset="${at}" stop-color="${d.photo!.veil}" stop-opacity="${a}"/>`;
      prev = a;
    });
    stops += `<stop offset="1" stop-color="${d.photo.veil}" stop-opacity="${prev ?? 0}"/>`;
    const halos = d.photo.halos
      .map(
        (h, i) =>
          `<radialGradient id="eklio-halo-${key}-${i}" cx="0.5" cy="0.5" r="0.5">` +
          `<stop offset="0" stop-color="${d.photo!.veil}" stop-opacity="${h.alpha}"/>` +
          `<stop offset="${h.plateau}" stop-color="${d.photo!.veil}" stop-opacity="${h.alpha}"/>` +
          `<stop offset="1" stop-color="${d.photo!.veil}" stop-opacity="0"/></radialGradient>`
      )
      .join("");
    out +=
      `<defs><linearGradient id="eklio-veil-${key}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}">${stops}</linearGradient>${halos}</defs>` +
      `<image data-photo="${esc(d.photo.id)}" href="${d.photo.href}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` +
      `<rect data-veil="local" data-worst-text="${d.photo.worstText}" width="${W}" height="${H}" fill="url(#eklio-veil-${key})"/>` +
      d.photo.halos
        .map((h, i) => `<rect data-halo="${h.alpha}" x="${round2(h.box.x)}" y="${round2(h.box.y)}" width="${round2(h.box.w)}" height="${round2(h.box.h)}" fill="url(#eklio-halo-${key}-${i})"/>`)
        .join("");
  }
  if (d.texture) {
    out += `<image data-texture="${esc(d.texture.id)}" href="${d.texture.href}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity="${d.texture.opacity}" style="mix-blend-mode:multiply"/>`;
  }
  if (d.photoClip) {
    const c = d.photoClip;
    const r = round2(c.box.w / 2);
    const key = fnv(`${c.id}|${boxAttr(c.box)}`);
    out +=
      `<defs><clipPath id="eklio-clip-${key}"><circle cx="${round2(c.box.x + r)}" cy="${round2(c.box.y + r)}" r="${r}"/></clipPath></defs>` +
      `<image data-photo="${esc(c.id)}" href="${c.href}" x="${round2(c.box.x)}" y="${round2(c.box.y)}" width="${round2(c.box.w)}" height="${round2(c.box.h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#eklio-clip-${key})"/>`;
  }
  if (d.shape) {
    out += `<path data-shape="${esc(d.shape.id)}" d="${d.shape.d}" fill="${d.shape.fill}" fill-rule="evenodd" data-box="${boxAttr(d.shape.box)}"/>`;
  }
  return out;
}

export function toSvg(composition: Composition, paper: string): string {
  const body = composition.placed.map(renderPlaced).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${CANVAS.width}" height="${CANVAS.height}" ` +
    `viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" ` +
    `data-archetype="${esc(composition.archetype)}" ` +
    `data-palette="${esc(composition.paletteKey)}"` +
    (composition.idiom ? ` data-idiom="${esc(composition.idiom)}"` : "") +
    (composition.ground ? ` data-ground="${esc(composition.ground)}"` : "") +
    `>` +
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${paper}"/>` +
    decorLayers(composition) +
    body +
    `</svg>`
  );
}

/* ── Reading it back, for the suites ─────────────────────────────────── */

export type ParsedBox = { role: string; band: string; box: Box; size?: number };

const G_RE = /<g data-role="([a-z]+)" data-band="([a-z]+)" data-box="([^"]+)">([\s\S]*?)<\/g>/g;
const TEXT_RE = /<text [^>]*font-size="([0-9.]+)"[^>]*data-box="([^"]+)"/g;
const STROKE_RE = /<path [^>]*data-box="([^"]+)"/g;

function parseBox(s: string): Box {
  const [x, y, w, h] = s.split(",").map(Number);
  return { x, y, w, h };
}

/**
 * Every glyph box and every stroke box in the document, flattened.
 *
 * The suites work on this rather than on the composition object on purpose: a
 * bug in `toSvg` that dropped a box, or emitted it in the wrong coordinate
 * space, would be invisible to a test that checked the object it was built
 * from.
 */
export function parseBoxes(svg: string): ParsedBox[] {
  const out: ParsedBox[] = [];
  for (const m of svg.matchAll(G_RE)) {
    const [, role, band, , inner] = m;
    if (role === "text") {
      for (const t of inner.matchAll(TEXT_RE)) {
        out.push({ role: "text", band, box: parseBox(t[2]), size: Number(t[1]) });
      }
    } else if (role === "figure") {
      for (const s of inner.matchAll(STROKE_RE)) {
        out.push({ role: "stroke", band, box: parseBox(s[1]) });
      }
    } else {
      out.push({ role, band, box: parseBox(m[3]) });
    }
  }
  return out;
}

/** The gap between two boxes: 0 when they overlap, otherwise the shortest distance. */
export function gap(a: Box, b: Box): number {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  // ⚠ NOT THE EUCLIDEAN DISTANCE. Two boxes offset on both axes are separated
  // by the larger of the two gaps as far as a reader is concerned — the
  // diagonal is longer, and using it would let a label sit 30px below and 30px
  // left of a stroke and call it 42px of clearance.
  if (dx === 0 && dy === 0) return 0;
  // ⚠ ROUNDED TO THE PRECISION THE DOCUMENT CARRIES. Every coordinate in the
  // SVG is printed to two decimals, so a gap of 47.999999999999886 and a gap
  // of 48 are the same document. Comparing the raw float made three
  // archetypes fail a clearance they met exactly — the accumulated error of
  // adding a rounded row height n times, not a layout mistake.
  return round2(Math.max(dx, dy));
}
