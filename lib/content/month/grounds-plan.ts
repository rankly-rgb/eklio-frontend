import type { Ground } from "@/lib/compose/grounds";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE FOND SE DÉCIDE À L'ÉCHELLE DU MOIS (spécification visuelle, 2026-11-02)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Une grille Instagram montre neuf à douze vignettes à la fois : c'est là que
 * le rythme clair / sombre se lit. Un mois à vingt-huit crème et deux photos
 * aurait respecté chaque carte et raté l'effet. La règle est donc posée sur la
 * SUITE des trente posts, et mesurée (`groundRhythm`) :
 *
 *   R1  deux posts voisins n'ont jamais le même fond, sauf la crème ;
 *   R2  toute fenêtre de neuf posts consécutifs (une grille) porte au moins
 *       trois fonds non-crème, dont au moins deux sombres (photo ou profond).
 *
 * Ce que chaque mise en page peut porter : une phrase seule, les cinq familles
 * (sur teinte pleine elle devient « grand dessin », sur fond profond la
 * « citation ») ; une couverture de carrousel, crème ou photo ; un diagramme,
 * crème ou photo (ses aplats ne se posent pas sur une teinte pleine — ils s'y
 * confondraient).
 *
 * Les parts visées sur trente : crème 40 %, photo 30 %, profond 10 %, ocre 10 %,
 * terracotta 10 %. Glouton, déterministe : à chaque rang, la famille permise la
 * plus en retard sur sa part, sous R1, en tenant R2 sur la fenêtre qui se ferme.
 */
export const TARGET: Record<Ground, number> = { cream: 0.4, photo: 0.3, deep: 0.1, ochre: 0.1, terra: 0.1 };
export const WINDOW = 9;
const DARK: Ground[] = ["photo", "deep"];

export function allowedGrounds(archetype: string): Ground[] {
  if (archetype === "single_statement") return ["cream", "photo", "deep", "ochre", "terra"];
  return ["cream", "photo"];
}

export function planGrounds(archetypes: string[]): Ground[] {
  const out: Ground[] = [];
  const count: Record<Ground, number> = { cream: 0, photo: 0, deep: 0, ochre: 0, terra: 0 };
  archetypes.forEach((archetype, i) => {
    const window = out.slice(Math.max(0, i - WINDOW + 1));
    const nonCream = window.filter((g) => g !== "cream").length;
    const dark = window.filter((g) => DARK.includes(g)).length;
    const left = Math.min(WINDOW, i + 1) - window.length; // les rangs qui restent dans cette fenêtre, celui-ci compris
    const score = (g: Ground) => {
      let s = TARGET[g] * (i + 1) - count[g]; // le retard sur la part visée
      if (g !== "cream" && out[i - 1] === g) s -= 100; // R1
      const needNonCream = 3 - nonCream;
      const needDark = 2 - dark;
      if (g === "cream" && needNonCream >= left) s -= 50; // R2 : la fenêtre n'a plus le droit à la crème
      if (!DARK.includes(g) && needDark >= left) s -= 50;
      return s;
    };
    const allowed = allowedGrounds(archetype);
    const best = [...allowed].sort((a, b) => score(b) - score(a) || allowed.indexOf(a) - allowed.indexOf(b))[0];
    out.push(best);
    count[best] += 1;
  });
  return out;
}

/** La mesure du rythme : parts, voisins identiques (hors crème), fenêtres de neuf qui manquent R2. */
export function groundRhythm(grounds: Ground[]): {
  counts: Record<Ground, number>;
  sameNeighbours: number;
  windowsFailing: number;
  windows: number;
} {
  const counts: Record<Ground, number> = { cream: 0, photo: 0, deep: 0, ochre: 0, terra: 0 };
  for (const g of grounds) counts[g] += 1;
  let sameNeighbours = 0;
  for (let i = 1; i < grounds.length; i += 1) if (grounds[i] !== "cream" && grounds[i] === grounds[i - 1]) sameNeighbours += 1;
  let windowsFailing = 0;
  let windows = 0;
  for (let i = 0; i + WINDOW <= grounds.length; i += 1) {
    windows += 1;
    const w = grounds.slice(i, i + WINDOW);
    if (w.filter((g) => g !== "cream").length < 3 || w.filter((g) => DARK.includes(g)).length < 2) windowsFailing += 1;
  }
  return { counts, sameNeighbours, windowsFailing, windows };
}
