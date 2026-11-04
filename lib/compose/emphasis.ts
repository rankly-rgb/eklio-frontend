import { contrastRatio } from "@/lib/brand/color";
import { grainedWorst, type Ground } from "@/lib/compose/grounds";
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
 * ⚠ LA COULEUR EST UNE ENCRE DE TEXTE CHOISIE, PAS UNE TEINTE D'APLAT ASSOMBRIE
 * (2026-11-04). La première version la dérivait de la teinte la plus saturée et
 * sortait brun-gris. C'est maintenant `palette_families.accent_hex`, l'accent
 * que la famille a déjà choisi pour le site, lu par la direction : sur crème il
 * tient 4,93 à 8,12:1 ; sur ocre et terracotta, où seul le grand dessin (≥ 80 px,
 * grand texte) pose une phrase, 3,62 à 6,84:1. Sur fond profond et sur photo,
 * l'italique seul. Mesuré à la taille rendue (`textClass`), au pire pixel du grain.
 *
 * ⚠ SUR PHOTO, L'ITALIQUE SEUL. Le voile local est calculé pour l'encre de la
 * ligne ; une autre encre dessus n'aurait aucune garantie. Le script (citation)
 * ne prend pas d'emphase : il est déjà une écriture.
 */

export function emphasisOf(payload: unknown): string | null {
  const e = (payload as { emphasis?: unknown } | null)?.emphasis;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}

/** Les fonds sur lesquels l'accent choisi tient son plancher par construction (`the-accent-is-chosen.test.ts`). */
const ACCENT_GROUNDS = new Set(["cream", "ochre", "terra"]);

/**
 * L'encre de l'emphase : l'accent CHOISI de la famille, s'il tient le plancher
 * de la classe de la ligne sur ce fond au pire pixel du grain ; sinon l'encre
 * de la ligne (italique seul). Jamais une couleur dérivée ici.
 */
export function emphasisInk(palette: Palette, lineFill: string, ground: Ground | undefined, floor: number): string {
  if (!palette.accent || palette.dark) return lineFill;
  if (ground && !ACCENT_GROUNDS.has(ground)) return lineFill;
  const worst = grainedWorst(palette.paper, ground ?? "paper");
  return contrastRatio(palette.accent, worst) >= floor ? palette.accent : lineFill;
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

  const changed = new Map<Line, Line>();
  let offset = 0;
  for (const l of lines) {
    const from = Math.max(at, offset);
    const to = Math.min(end, offset + l.text.length);
    if (from < to) {
      const a = from - offset;
      const b = to - offset;
      const floor = floorFor(textClass(l.size, l.weight, "headline"));
      const fill = emphasisInk(palette, l.fill, ground, floor);
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
