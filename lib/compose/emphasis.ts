import { contrastRatio } from "@/lib/brand/color";
import { grainedWorst, type Ground } from "@/lib/compose/grounds";
import { mix } from "@/lib/compose/palette";
import { floorFor, textClass } from "@/lib/compose/text-class";
import type { Line, Palette, Placed } from "@/lib/compose/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'EMPHASE : QUELQUES MOTS DU TITRE, EN ITALIQUE COLORÉ (F108, 2026-11-04)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le rédacteur émet `emphasis`, une sous-chaîne EXACTE du titre de la carte ;
 * `validateCopy` l'a déjà vérifiée et la range dans le payload. Ici on ne
 * devine rien : si la locution ne se retrouve pas telle quelle dans les lignes
 * du titre, il n'y a pas d'emphase — jamais une correspondance approximative,
 * qui mettrait l'italique au mauvais endroit.
 *
 * ⚠ LA COULEUR EST UNE TEINTE DE TEXTE DÉDIÉE, PAS LA TEINTE D'APLAT. La
 * terracotta de la spec tient 2,94:1 sur crème, sous 3:1 même en grand texte.
 * L'encre d'accent part de la teinte la plus saturée de la palette et fonce
 * vers l'encre du titre jusqu'au plancher de SA classe — mesurée à la taille
 * rendue (`textClass`), contre le fond au pire pixel du grain. Aucun plancher
 * n'est baissé ; aucune couleur de palette ne change.
 *
 * ⚠ SUR PHOTO, L'ITALIQUE SEUL. Le voile local est calculé pour l'encre de la
 * ligne ; une autre encre dessus n'aurait aucune garantie. Le script (citation)
 * ne prend pas d'emphase : il est déjà une écriture.
 */

export function emphasisOf(payload: unknown): string | null {
  const e = (payload as { emphasis?: unknown } | null)?.emphasis;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}

function saturation(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** L'encre d'accent : de la teinte la plus saturée vers l'encre, jusqu'au plancher. */
export function accentInk(palette: Palette, lineFill: string, background: string, floor: number): string | null {
  const source = [...palette.tints].sort((a, b) => saturation(b) - saturation(a))[0];
  if (!source) return null;
  for (let step = 0; step <= 100; step += 1) {
    const c = mix(source, lineFill, step / 100);
    if (contrastRatio(c, background) >= floor) return step >= 100 ? null : c;
  }
  return null;
}

/** Les lignes du titre (bande `headline`), hors script, avec l'emphase découpée en segments. */
export function emphasise(placed: Placed[], emphasis: string | null, palette: Palette, ground: Ground | undefined): Placed[] {
  if (!emphasis) return placed;
  const title = placed.filter((p) => p.role === "text" && p.band === "headline" && p.lines.every((l) => l.family !== "script"));
  const lines = title.flatMap((p) => (p.role === "text" ? p.lines : []));
  if (lines.length === 0) return placed;
  const joined = lines.map((l) => l.text).join(" ");
  const at = joined.indexOf(emphasis);
  if (at < 0) return placed;
  /* Sur des frontières de mot seulement. */
  const before = joined[at - 1];
  const after = joined[at + emphasis.length];
  if ((before !== undefined && /[\p{L}\p{N}]/u.test(before)) || (after !== undefined && /[\p{L}\p{N}]/u.test(after))) return placed;
  const end = at + emphasis.length;

  const background = ground === "photo" ? null : grainedWorst(palette.paper, ground ?? "paper");
  const changed = new Map<Line, Line>();
  let offset = 0;
  for (const l of lines) {
    const from = Math.max(at, offset);
    const to = Math.min(end, offset + l.text.length);
    if (from < to) {
      const a = from - offset;
      const b = to - offset;
      const floor = floorFor(textClass(l.size, l.weight, "headline"));
      const fill = background ? accentInk(palette, l.fill, background, floor) ?? l.fill : l.fill;
      changed.set(l, {
        ...l,
        spans: [
          { text: l.text.slice(0, a), emphasis: false },
          { text: l.text.slice(a, b), emphasis: true },
          { text: l.text.slice(b), emphasis: false },
        ].filter((s) => s.text.length > 0),
        emphasisFill: fill,
      });
    }
    offset += l.text.length + 1;
  }
  if (changed.size === 0) return placed;
  return placed.map((p) => (p.role === "text" && p.lines.some((l) => changed.has(l)) ? { ...p, lines: p.lines.map((l) => changed.get(l) ?? l) } : p));
}
