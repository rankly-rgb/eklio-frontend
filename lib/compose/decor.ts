import { readFileSync } from "node:fs";
import { join } from "node:path";
import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import type { Inventory } from "@/lib/visual-library/inventory";
import photoBandsJson from "@/lib/visual-library/photo-bands.generated.json";
import { colourDistance, tintFor, TINT_INK_MIN_CONTRAST } from "@/lib/compose/palette";
import { contrastRatio } from "@/lib/brand/color";

/*
 * ⚠ LE CONTRASTE DU DÉCOR SE MESURE AVEC `contrastRatio` (lib/brand/color.ts),
 * PAS AVEC `contrast` DE lib/compose/palette.ts. Trouvé le 2026-11-01 : la
 * luminance de ce dernier ne linéarise pas le canal bleu (`0.0722 * (n & 255)`)
 * — `contrast("#2B2A27", "#000000")` y vaut 57,7 au lieu de 1,5. Un voile résolu
 * avec lui ne protégerait rien. Défaut hors de ce chantier : F99.
 */
const contrast = contrastRatio;
import { libraryVector, placeVector } from "@/lib/compose/library";
import { round2 } from "@/lib/compose/measure";
import type { Box, Palette, Placed, Stroke } from "@/lib/compose/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE DÉCOR D'UNE CARTE — FOND PHOTO VOILÉ, TEXTURE, FORME, ACCENT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Tiré de la bibliothèque (`assets/visual-library/`), jamais inventé. Une carte
 * qui n'a pas de dessin de la bibliothèque (un post d'avant elle) n'a pas de
 * décor : elle reste exactement ce qu'elle était.
 *
 * ── ⚠ CHOISI PAR LE DESSIN, PAS PAR LE SENS ─────────────────────────────
 *
 * Les fonds, textures, formes et accents n'ont pas de thèmes dans
 * `themes.csv` — le pack ne leur en donne pas. Ils sont donc tirés du rang du
 * dessin que le SENS a choisi : déterministe, sans colonne de plus en base, et
 * puisque deux dessins voisins à moins de dix posts sont toujours différents,
 * leurs décors le sont presque toujours aussi. « Presque » est mesuré sur la
 * planche, pas supposé.
 *
 * ── ⚠ LE VOILE EST LOCAL, ET RÉSOLU CONTRE LES PIXELS MESURÉS ───────────
 *
 * Derrière chaque ligne de texte, bande de 10px par bande, la première opacité
 * à laquelle l'encre tient `PHOTO_TEXT_CONTRAST` contre les bornes de pixels
 * MESURÉES de cette bande (`photo-bands.generated.json`) ; derrière chaque
 * dessin, un halo à `PHOTO_FIGURE_CONTRAST`. Ailleurs, `VEIL_FREE` : la photo
 * respire là où rien ne la recouvre. Le texte ne change ni de taille ni de
 * graisse : c'est la protection qui s'adapte.
 */

const ENTRIES = (inventoryJson as Inventory).entries;
const ROOT = join(process.cwd(), "assets", "visual-library");

const ids = (family: string, filter: (id: string) => boolean = () => true) =>
  ENTRIES.filter((e) => e.family === family && !e.id.startsWith("xtra-") && filter(e.id))
    .map((e) => e.id)
    .sort();

/** Les dessins tirables, dans l'ordre qui sert de rang. */
export const DRAWABLE = ENTRIES.filter((e) => e.drawable).map((e) => e.id).sort();
export const PHOTOS = ids("fonds");
export const TEXTURES = ids("textures");
export const SHAPES = ids("formes");
/**
 * Les formes qui peuvent porter un dessin : pleines et rondes. Un bord déchiré,
 * un coup de pinceau, une bande en vague ou un croissant posés sous un dessin
 * se lisaient à 390px comme un accident ; une goutte ou une feuille, comme un
 * SECOND objet qui parasite le sens du dessin (planche « après », 2026-11-01).
 */
export const BACKDROP_SHAPES = SHAPES.filter((id) =>
  ["shape-arch", "shape-blob-soft", "shape-blob-wide", "shape-cloud-soft", "shape-half-circle", "shape-oval-tilted"].includes(id)
);
/**
 * Les accents qui remplacent le trait horizontal — ceux qui SONT horizontaux
 * (plus de quatre fois plus larges que hauts). Une astérisque à la place d'un
 * soulignement ne dirait plus « la phrase s'arrête là ».
 */
export const ACCENTS = ids("accents", (id) => {
  const v = libraryVector(id);
  return v.w / v.h >= 4;
});

/** Le contraste exigé du texte posé sur la photo voilée : celui du hero (`CONTRAST_TARGET`, 4,5). */
export const PHOTO_TEXT_CONTRAST = 4.5;
/**
 * Le voile de base, partout où rien n'est posé : la photo garde 85 % de sa force.
 *
 * ⚠ L'ANCIEN VOILE UNIFORME ÉTAIT À 0,85 AU MOINS, ET C'ÉTAIT L'ERREUR (2026-11-01,
 * troisième session). Pour protéger le pire pixel sous le texte, il noyait la
 * photo partout — « un papier légèrement sali ». La protection est maintenant
 * LOCALE : bande par bande derrière le texte, halo derrière chaque dessin.
 */
export const VEIL_FREE = 0.15;
/**
 * La cible à laquelle le voile derrière le texte est RÉSOLU : 7:1 (WCAG AAA).
 *
 * ⚠ CE N'EST PAS LE PLANCHER, C'EST UNE MARGE DE CONFORT, ET ELLE SERRE. Résolu
 * à 4,5 tout juste, le voile laissait une branche de `bg-branch-sky` traverser le
 * titre à pleine lisibilité réglementaire — lisible, mais encombré à 390px. Le
 * plancher mesuré reste `PHOTO_TEXT_CONTRAST` ; la photo respire ailleurs.
 */
export const PHOTO_TEXT_COMFORT = 7;
/** Le plancher graphique d'un dessin ou d'un accent sur son fond : celui des aplats (3:1). */
export const PHOTO_FIGURE_CONTRAST = TINT_INK_MIN_CONTRAST;
/** La marge, au-dessus et au-dessous d'une ligne, où le voile tient déjà son plancher. */
const TEXT_PAD = 12;
/** La descente du voile vers sa base, au-delà de la marge. */
const FEATHER = 60;
/** Une texture ne se devine qu'à peine. */
export const TEXTURE_OPACITY = 0.06;

/** Les archétypes qui prennent un fond photo : ceux où une phrase tient la carte. */
export const PHOTO_ARCHETYPES = new Set(["single_statement", "practitioner_card"]);

export type Decor = {
  photo?: {
    id: string;
    href: string;
    veil: string;
    /** L'opacité du voile, bande de `PHOTO_BANDS_STEP` px par bande, du haut au bas de la carte. */
    bands: number[];
    /** Un halo par dessin : plateau à `alpha` sur toute sa boîte, puis descente à zéro. */
    halos: Array<{ box: Box; alpha: number; plateau: number }>;
    /** Le pire contraste garanti sous une ligne de texte, contre les bornes mesurées. */
    worstText: number;
  };
  texture?: { id: string; href: string; opacity: number };
  shape?: { id: string; d: string; fill: string; box: Box };
};

const cache = new Map<string, string>();
function dataUri(file: string): string {
  let uri = cache.get(file);
  if (!uri) {
    uri = `data:image/jpeg;base64,${readFileSync(join(ROOT, file)).toString("base64")}`;
    cache.set(file, uri);
  }
  return uri;
}
const fileOf = (id: string) => ENTRIES.find((e) => e.id === id)!.file.replace(/^assets\/visual-library\//, "");

/** Le JPEG d'un fond ou d'une texture, en `data:` — tel que la carte l'embarque. */
export function imageHref(id: string): string {
  return dataUri(fileOf(id));
}

const channels = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** `over` posé à `alpha` sur `under`. */
export function blend(under: string, over: string, alpha: number): string {
  const u = channels(under);
  const o = channels(over);
  return hex(u.map((c, i) => c * (1 - alpha) + o[i] * alpha));
}

/** Le pire pixel pour une encre : celui qui lui ressemble le plus. */
export function worstUnder(ink: string): string {
  return contrast(ink, "#000000") < contrast(ink, "#ffffff") ? "#000000" : "#ffffff";
}

type Bands = { band: number; min: number[][]; max: number[][] };
const PHOTO_BANDS = photoBandsJson as unknown as Record<string, Bands & { sha256: string }>;
export const PHOTO_BANDS_STEP = 10;

/** Le pire contraste entre `ink` et toute la bande `b`, sous un voile `alpha` de `paper`. */
function worstInBand(bands: Bands, b: number, paper: string, ink: string, alpha: number): number {
  /*
   * ⚠ À L'OPACITÉ RENDUE, PAS À L'OPACITÉ ÉCRITE. Le rendu compose le voile en
   * 8 bits : 0,62 devient 158/255 = 0,6196, et l'arrondi du mélange coûte encore
   * un niveau. Mesuré sur le rendu : des lignes à 4,47:1 là où le calcul disait
   * 4,5. Le plancher est donc vérifié deux pas de 8 bits plus bas.
   */
  const rendered = Math.max(0, alpha - 2 / 255);
  const lo = blend(hex(bands.min[b]), paper, rendered);
  const hi = blend(hex(bands.max[b]), paper, rendered);
  return Math.min(contrast(ink, lo), contrast(ink, hi));
}

/**
 * La première opacité (pas de 0,01, jusqu'à 1) à laquelle `ink` tient `target`
 * sur TOUTES les bandes `from..to`, contre leurs bornes mesurées. `null` : même
 * le papier plein ne suffit pas (l'encre ne tient pas sur son propre papier).
 *
 * ⚠ JUSQU'À 1, ET C'EST LOCAL. Le plafond de 0,92 de l'ancien voile disait « au-
 * delà, la photographie cesse d'en être une » — vrai d'un voile sur toute la
 * carte, pas d'une bande derrière trois lignes de texte.
 */
export function solveLocal(bands: Bands, from: number, to: number, paper: string, ink: string, target: number): number | null {
  for (let step = 0; step <= 100; step += 1) {
    const alpha = step / 100;
    let ok = true;
    for (let b = Math.max(0, from); b <= Math.min(bands.min.length - 1, to) && ok; b += 1) {
      if (worstInBand(bands, b, paper, ink, alpha) < target) ok = false;
    }
    if (ok) return alpha;
  }
  return null;
}

/** Les lignes de texte posées à même le fond — celles d'un aplat sont sur son aplat opaque. */
function textOnGround(placed: Placed[]): Array<{ box: Box; fill: string }> {
  const fields = placed.filter((p) => p.role === "field").map((p) => p.box);
  const inside = (b: Box) => fields.some((f) => b.x >= f.x - 0.5 && b.y >= f.y - 0.5 && b.x + b.w <= f.x + f.w + 0.5 && b.y + b.h <= f.y + f.h + 0.5);
  const out: Array<{ box: Box; fill: string }> = [];
  for (const p of placed) {
    if (p.role !== "text") continue;
    for (const l of p.lines) if (!inside(l.box)) out.push({ box: l.box, fill: l.fill });
  }
  return out;
}

/**
 * Le voile local d'un fond photo, ou `null` si une ligne ou un dessin ne peut
 * pas tenir son plancher même sur papier plein.
 */
export function localVeil(
  photo: string,
  palette: Palette,
  placed: Placed[]
): { bands: number[]; halos: Array<{ box: Box; alpha: number; plateau: number }>; worstText: number } | null {
  const bands = PHOTO_BANDS[photo];
  if (!bands) return null;
  const n = bands.min.length;
  const need = new Array<number>(n).fill(0);
  const bandOf = (y: number) => Math.floor(y / PHOTO_BANDS_STEP);

  /* ── le texte : bande par bande, à 4,5:1 ─────────────────────────────── */
  for (const line of textOnGround(placed)) {
    const from = bandOf(line.box.y - TEXT_PAD);
    const to = bandOf(line.box.y + line.box.h + TEXT_PAD);
    for (let b = Math.max(0, from); b <= Math.min(n - 1, to); b += 1) {
      const alpha = solveLocal(bands, b, b, palette.paper, line.fill, PHOTO_TEXT_COMFORT);
      if (alpha === null) return null;
      need[b] = Math.max(need[b], alpha);
    }
  }

  /* ── la descente, par marches de 10px : jamais sous la base ──────────── */
  const steps = FEATHER / PHOTO_BANDS_STEP;
  const veil = need.map((_, b) => {
    let v = VEIL_FREE;
    for (let k = Math.max(0, b - steps); k <= Math.min(n - 1, b + steps); k += 1) {
      if (need[k] <= VEIL_FREE) continue;
      const d = Math.abs(k - b);
      v = Math.max(v, d === 0 ? need[k] : VEIL_FREE + (need[k] - VEIL_FREE) * (1 - d / (steps + 1)));
    }
    return Math.round(v * 100) / 100;
  });

  /* ── les dessins : un halo par trait de figure, à 3:1 ────────────────── */
  const halos: Array<{ box: Box; alpha: number; plateau: number }> = [];
  for (const p of placed) {
    if (p.role !== "figure") continue;
    for (const s of p.strokes) {
      const ink = s.fill !== "none" ? s.fill : s.stroke;
      const from = bandOf(s.box.y);
      const to = bandOf(s.box.y + s.box.h);
      const alpha = solveLocal(bands, from, to, palette.paper, ink, PHOTO_FIGURE_CONTRAST);
      if (alpha === null) return null;
      /* Le voile vertical y suffit déjà ? Pas de halo. */
      let covered = true;
      for (let b = Math.max(0, from); b <= Math.min(n - 1, to); b += 1) if (veil[b] < alpha) covered = false;
      if (covered) continue;
      /*
       * L'ellipse inscrite dans `box` agrandie : le plateau va jusqu'au coin de
       * la boîte du trait (t ≤ plateau), puis descend à zéro au bord.
       */
      const grow = Math.max(60, Math.min(s.box.w, s.box.h) * 0.35);
      const halo = { x: round2(s.box.x - grow), y: round2(s.box.y - grow), w: round2(s.box.w + 2 * grow), h: round2(s.box.h + 2 * grow) };
      const plateau = Math.hypot(s.box.w / 2 / (halo.w / 2), s.box.h / 2 / (halo.h / 2));
      if (plateau >= 1) return null;
      halos.push({ box: halo, alpha, plateau: Math.ceil(plateau * 1000) / 1000 });
    }
  }

  /* ── ce qui est garanti sous le texte, contre les bornes ─────────────── */
  let worstText = Infinity;
  for (const line of textOnGround(placed)) {
    for (let b = Math.max(0, bandOf(line.box.y)); b <= Math.min(n - 1, bandOf(line.box.y + line.box.h)); b += 1) {
      worstText = Math.min(worstText, worstInBand(bands, b, palette.paper, line.fill, veil[b]));
    }
  }
  return { bands: veil, halos, worstText: round2(worstText) };
}

/**
 * La teinte de la forme : la secondaire de la palette, TELLE QUELLE.
 *
 * ⚠ JAMAIS UNE TEINTE NOUVELLE. Adoucie vers le papier, elle devenait une
 * cinquième couleur, et le contrôle de teintes (`checkTints`) l'a refusée comme
 * trop proche d'un aplat — à raison : une teinte de plus est une seconde marque.
 * Si le titre ne tient pas sur la secondaire, on essaie les autres aplats de la
 * carte, et sinon pas de forme.
 */
export function shapeFill(palette: Palette): string | null {
  for (const i of [1, 3, 2, 0]) {
    const fill = tintFor(palette, i);
    /* Sous le dessin, plus sous le titre : le plancher est le graphique (3:1). */
    if (contrast(palette.ink, fill) < PHOTO_FIGURE_CONTRAST) continue;
    if (colourDistance(fill, palette.paper) < 6.5) continue;
    return fill;
  }
  return null;
}

function rank(illustration: string): number {
  const i = DRAWABLE.indexOf(illustration);
  return i < 0 ? 0 : i;
}

export function photoFor(illustration: string): string {
  return PHOTOS[rank(illustration) % PHOTOS.length];
}

export function accentFor(illustration: string): string {
  return ACCENTS[rank(illustration) % ACCENTS.length];
}

/** L'accent comme dessin : posé dans la boîte, à l'encre, comme le trait qu'il remplace. */
export function accentDrawing(illustration: string) {
  const id = accentFor(illustration);
  const v = libraryVector(id);
  return (box: Box, colour: string): Stroke[] => {
    const { d, fitted } = placeVector(v, box);
    return [{ kind: "path", d, box: fitted, stroke: "none", strokeWidth: 0, fill: colour, fillRule: "evenodd" }];
  };
}

/**
 * Le décor d'une carte, posé APRÈS la composition : il lit ce qui a été placé.
 *
 * ⚠ CHAQUE COUCHE N'EXISTE QUE SI LE CONTRASTE TIENT. La photo, si chaque ligne
 * et chaque dessin tiennent leur plancher sous leur protection locale ; la
 * texture, si l'encre tient sur le papier texturé au pire pixel ; la forme, si
 * le dessin tient sur sa teinte et qu'aucun texte ne la recouvre. Une couche qui
 * ne tient pas n'est pas posée — on ne baisse rien pour la faire passer.
 */
export function decorFor(archetype: string, illustration: string, palette: Palette, placed: Placed[]): Decor {
  const decor: Decor = {};
  const r = rank(illustration);

  if (PHOTO_ARCHETYPES.has(archetype)) {
    const id = PHOTOS[r % PHOTOS.length];
    const veil = localVeil(id, palette, placed);
    if (veil) {
      decor.photo = { id, href: dataUri(fileOf(id)), veil: palette.paper, ...veil };
      return decor;
    }
  }

  const worst = worstUnder(palette.ink);
  if (contrast(palette.ink, blend(palette.paper, worst, TEXTURE_OPACITY)) >= PHOTO_TEXT_CONTRAST) {
    const id = TEXTURES[r % TEXTURES.length];
    decor.texture = { id, href: dataUri(fileOf(id)), opacity: TEXTURE_OPACITY };
  }

  const shape = shapeBehindDrawing(placed, palette, BACKDROP_SHAPES[r % BACKDROP_SHAPES.length]);
  if (shape) decor.shape = shape;
  return decor;
}

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA FORME : DERRIÈRE LE DESSIN, FRANCHE — PLUS DERRIÈRE LE TITRE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Derrière deux mots du titre, à la teinte la plus claire qui laissait le titre
 * à 4,5:1, elle se lisait à 390px comme un défaut d'impression (planche du
 * 2026-11-01, cartes 2, 16, 17, 26). Elle est maintenant sous le DESSIN, pleine,
 * plus grande que lui : un aplat de couleur qui dit « voici l'objet de la
 * carte ». Le dessin tient 3:1 sur elle (le plancher graphique des aplats) ;
 * aucune ligne de texte ni aucun aplat ne la recouvre, sinon elle rétrécit,
 * sinon elle n'est pas posée.
 */
export function shapeBehindDrawing(placed: Placed[], palette: Palette, id: string): { id: string; d: string; fill: string; box: Box } | null {
  const drawing = placed
    .filter((p) => p.role === "figure")
    .flatMap((p) => (p as Extract<Placed, { role: "figure" }>).strokes)
    .find((s) => s.library);
  if (!drawing) return null;
  const fill = shapeFill(palette);
  if (!fill) return null;
  /*
   * Ni texte, ni aplat, ni AUTRE trait : dans `concentric_control` le dessin vit
   * au milieu des anneaux, et une forme y faisait une tache entre eux.
   */
  const others = [
    ...textOnGround(placed).map((l) => l.box),
    ...placed.filter((p) => p.role === "field" || p.role === "text").map((p) => p.box),
    ...placed
      .filter((p) => p.role === "figure")
      .flatMap((p) => (p as Extract<Placed, { role: "figure" }>).strokes)
      .filter((s) => s !== drawing)
      .map((s) => s.box),
  ];
  const hits = (b: Box) => others.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
  const v = libraryVector(id);
  for (const grow of [0.22, 0.12, 0.05]) {
    const g = Math.max(drawing.box.w, drawing.box.h) * grow;
    const box = { x: drawing.box.x - g, y: drawing.box.y - g, w: drawing.box.w + 2 * g, h: drawing.box.h + 2 * g };
    const { d, fitted } = placeVector(v, box);
    /* La forme couvre-t-elle le dessin ? Contenue dans sa boîte agrandie, centrée sur lui. */
    if (fitted.w < drawing.box.w * 0.9 && fitted.h < drawing.box.h * 0.9) continue;
    if (hits(fitted)) continue;
    return { id, d, fill, box: fitted };
  }
  return null;
}
