import { CANVAS } from "@/lib/compose/constants";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA SIGNATURE STRUCTURELLE D'UNE CARTE — CE QUE L'ŒIL VOIT À 390PX (F102)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Deux cartes se ressemblent quand leur IMAGE se ressemble, pas quand leur
 * archétype porte le même nom : numbered_strategies et cycle posent toutes deux
 * « un titre, un dessin à gauche, une colonne de blocs à droite ». Le contrôle de
 * mélange compte des noms d'archétype ; il ne le voit pas.
 *
 * ⚠ LUE DANS LE SVG LIVRÉ, PAS DANS UNE TABLE PAR ARCHÉTYPE. Une table se
 * désynchroniserait au premier archétype ajouté. La signature lit ce que la
 * composition a posé : les aplats de la bande de contenu (leur disposition),
 * le dessin de la bibliothèque (sa place par rapport à eux), et le fond photo.
 */
type B = { x: number; y: number; w: number; h: number };
const parse = (s: string): B => {
  const [x, y, w, h] = s.split(",").map(Number);
  return { x, y, w, h };
};

/** Des positions à moins de 24px l'une de l'autre sont une même colonne / une même rangée. */
function clusters(values: number[], tolerance = 24): number {
  const sorted = [...values].sort((a, b) => a - b);
  let n = 0;
  let last = -Infinity;
  for (const v of sorted) {
    if (v - last > tolerance) n += 1;
    last = v;
  }
  return n;
}

export type Structure = { fields: string; drawing: string; ground: string; signature: string };

/*
 * ⚠ MÉMORISÉ PAR SVG. Le sélecteur relit les mêmes trente cartes à chaque tour ;
 * une carte embarque ses JPEG (≈ 600 Ko, F97). Cache borné, même résultat.
 */
const seen = new Map<string, Structure>();

export function structureOf(svg: string): Structure {
  const hit = seen.get(svg);
  if (hit) return hit;
  const out = readStructure(svg);
  if (seen.size > 400) seen.clear();
  seen.set(svg, out);
  return out;
}

function readStructure(svg: string): Structure {
  const fields = [...svg.matchAll(/<g data-role="field" data-band="content" data-box="([^"]+)"/g)].map((m) => parse(m[1]));
  const drawingBox = /data-library="[^"]+" [^>]*data-box="([^"]+)"/.exec(svg)?.[1];
  const drawing = drawingBox ? parse(drawingBox) : null;
  /*
   * Le fond : la famille du plan du mois quand la carte en a une (2026-11-02 —
   * crème, photo, ocre, terracotta, profond), sinon photo / papier. Un idiome de
   * la spec visuelle EST sa disposition : il remplace la lecture des aplats.
   */
  const ground = /\sdata-ground="([a-z]+)"/.exec(svg)?.[1] ?? (/\sdata-photo="/.test(svg) ? "photo" : "papier");
  const idiom = /\sdata-idiom="([a-z_]+)"/.exec(svg)?.[1];
  /*
   * ⚠ LE FOND N'EST PAS DANS LA SIGNATURE (2026-11-02, sixième session). Une pile
   * de blocs sur photo et la même sur crème sont la même carte pour l'œil ; les
   * compter comme deux signatures faisait annoncer 7/30 là où l'œil en voyait une
   * quinzaine. Le fond est déjà tenu par le plan du mois (`grounds-plan.ts`).
   */
  if (idiom) return { fields: idiom, drawing: "idiome", ground, signature: idiom };

  let kind: string;
  if (fields.length === 0) kind = "aucun aplat";
  else {
    const cols = clusters(fields.map((f) => f.x));
    const rows = clusters(fields.map((f) => f.y));
    const span = Math.max(...fields.map((f) => f.x + f.w)) - Math.min(...fields.map((f) => f.x));
    const wide = span >= CANVAS.width * 0.7;
    if (cols === 1 && rows === 1) kind = "un aplat";
    else if (cols === 1) kind = wide ? "bandes pleine largeur" : "colonne";
    else if (rows === 1) kind = "rangée";
    else kind = "grille";
  }

  let place = "sans dessin";
  if (drawing) {
    if (fields.length === 0) place = "dessin seul";
    else {
      const x0 = Math.min(...fields.map((f) => f.x));
      const x1 = Math.max(...fields.map((f) => f.x + f.w));
      const y0 = Math.min(...fields.map((f) => f.y));
      const y1 = Math.max(...fields.map((f) => f.y + f.h));
      const cx = drawing.x + drawing.w / 2;
      const cy = drawing.y + drawing.h / 2;
      if (cx < x0) place = "dessin à gauche";
      else if (cx > x1) place = "dessin à droite";
      else if (cy < y0) place = "dessin au-dessus";
      else if (cy > y1) place = "dessin au-dessous";
      else place = "dessin entre les aplats";
    }
  }
  return { fields: kind, drawing: place, ground, signature: `${kind} · ${place}` };
}
