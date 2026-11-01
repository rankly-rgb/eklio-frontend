import { readFileSync } from "node:fs";
import { join } from "node:path";
import inventoryJson from "@/lib/visual-library/inventory.generated.json";
import type { Inventory } from "@/lib/visual-library/inventory";
import { MAX_OVERLAY_SCRIM } from "@/lib/brand/color";
import { CANVAS } from "@/lib/compose/constants";
import { colourDistance, contrast, tintFor } from "@/lib/compose/palette";
import { libraryVector, placeVector } from "@/lib/compose/library";
import { round2 } from "@/lib/compose/measure";
import type { Box, Palette, Stroke } from "@/lib/compose/types";

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
 * ── ⚠ LE VOILE EST RÉSOLU CONTRE LE PIRE PIXEL, PAS CHOISI ──────────────
 *
 * Même règle que la surimpression du hero (`solveOverlayScrim`) : le pire
 * fond possible (noir sous une encre sombre, blanc sous une encre claire), la
 * première opacité à laquelle l'encre tient `PHOTO_TEXT_CONTRAST`. Le nombre
 * est un PLANCHER garanti pour toute photographie. L'opacité ne descend
 * jamais sous `VEIL_MIN` : la photo reste un fond, pas un sujet.
 */

const ENTRIES = (inventoryJson as Inventory).entries;
const ROOT = join(process.cwd(), "assets", "visual-library");

const ids = (family: string, filter: (id: string) => boolean = () => true) =>
  ENTRIES.filter((e) => e.family === family && !e.id.startsWith("xtra-") && filter(e.id))
    .map((e) => e.id)
    .sort();

/** Les dessins tirables, dans l'ordre qui sert de rang. */
const DRAWABLE = ENTRIES.filter((e) => e.drawable).map((e) => e.id).sort();
export const PHOTOS = ids("fonds");
export const TEXTURES = ids("textures");
export const SHAPES = ids("formes");
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
/** Sous ce voile, la photo cesse d'être un fond. */
export const VEIL_MIN = 0.85;
/** Une texture ne se devine qu'à peine. */
export const TEXTURE_OPACITY = 0.06;

/** Les archétypes qui prennent un fond photo : ceux où une phrase tient la carte. */
export const PHOTO_ARCHETYPES = new Set(["single_statement", "practitioner_card"]);

export type Decor = {
  photo?: { id: string; href: string; veil: string; opacity: number; ratio: number };
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

/**
 * La première opacité de voile (couleur papier) à laquelle `ink` tient
 * `PHOTO_TEXT_CONTRAST` sur le pire pixel — puis relevée à `VEIL_MIN`. Rend
 * `null` si même `MAX_OVERLAY_SCRIM` ne suffit pas : pas de photo, alors.
 */
export function solveVeil(paper: string, ink: string): { opacity: number; ratio: number } | null {
  const worst = worstUnder(ink);
  for (let step = 1; step <= Math.round(MAX_OVERLAY_SCRIM * 100); step += 1) {
    const alpha = step / 100;
    if (contrast(ink, blend(worst, paper, alpha)) < PHOTO_TEXT_CONTRAST) continue;
    const opacity = Math.max(alpha, VEIL_MIN);
    return { opacity, ratio: round2(contrast(ink, blend(worst, paper, opacity))) };
  }
  return null;
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
    if (contrast(palette.ink, fill) < PHOTO_TEXT_CONTRAST) continue;
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
 * Le décor d'une carte.
 *
 * ⚠ CHAQUE COUCHE N'EXISTE QUE SI LE CONTRASTE TIENT. La photo, si le voile
 * résout ; la texture, si l'encre tient encore sur le papier texturé au pire
 * pixel ; la forme, si le titre tient sur sa teinte. Une couche qui ne tient
 * pas n'est pas posée — on ne baisse rien pour la faire passer.
 */
export function decorFor(archetype: string, illustration: string, palette: Palette, headline: Box): Decor {
  const decor: Decor = {};
  const r = rank(illustration);

  if (PHOTO_ARCHETYPES.has(archetype)) {
    const veil = solveVeil(palette.paper, palette.ink);
    if (veil) {
      const id = PHOTOS[r % PHOTOS.length];
      decor.photo = { id, href: dataUri(fileOf(id)), veil: palette.paper, opacity: veil.opacity, ratio: veil.ratio };
      return decor;
    }
  }

  const worst = worstUnder(palette.ink);
  if (contrast(palette.ink, blend(palette.paper, worst, TEXTURE_OPACITY)) >= PHOTO_TEXT_CONTRAST) {
    const id = TEXTURES[r % TEXTURES.length];
    decor.texture = { id, href: dataUri(fileOf(id)), opacity: TEXTURE_OPACITY };
  }

  const fill = shapeFill(palette);
  if (fill) {
    const id = SHAPES[r % SHAPES.length];
    /*
     * Derrière le début du titre, dans sa hauteur : la forme ne déborde ni sur
     * le surtitre ni sur la bande de contenu, où d'autres encres n'ont pas été
     * vérifiées contre elle.
     */
    const side = round2(Math.max(160, Math.min(headline.h + 24, CANVAS.width * 0.42)));
    const box = { x: round2(headline.x - 28), y: round2(headline.y), w: side, h: round2(Math.min(side, headline.h + 24)) };
    const { d, fitted } = placeVector(libraryVector(id), box);
    decor.shape = { id, d, fill, box: fitted };
  }
  return decor;
}
