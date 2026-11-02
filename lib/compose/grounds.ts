import { contrastRatio } from "@/lib/brand/color";
import { mix, type DirectionPalette } from "@/lib/compose/palette";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES CINQ FAMILLES DE FOND (spécification visuelle du 2026-11-02)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Crème, photo noir et blanc, teinte secondaire pleine (« ocre »), teinte
 * primaire pleine (« terracotta »), fond profond. La spec les pose en valeurs
 * fixes pour un kit (crème #F7F4EE, ocre pastel #F3E4C4, terracotta pastel
 * #F4DFD7, profond #3A3B36) ; le moteur les DÉRIVE de la direction de marque,
 * pour que chaque famille du catalogue les ait toutes :
 *
 *   crème      = papier refroidi : mix(papier, #EEEEEE, 0,25) — exactement la
 *                spec pour le papier #FAF6EE du kit de test ;
 *   ocre       = mix(secondaire, crème, 0,80) ;
 *   terracotta = mix(primaire, crème, 0,86) ;
 *   profond    = mix(foncé, crème, 0,07) ;
 *   photo      = la photo du pack sous le voile local, encre claire.
 *
 * ⚠ LES ENCRES SONT RÉSOLUES AU PLANCHER, PAS COPIÉES. Mesurées avec la seule
 * fonction de contraste (F99), quatre valeurs de la spec passent sous 4,5:1 :
 * signature #746A60 sur ocre pastel (4,20) et terracotta pastel (4,12),
 * italique terracotta sur crème (2,94). Chaque encre secondaire est donc la
 * teinte la plus claire de sa famille qui tient 4,5:1 sur SON fond — on fonce,
 * on ne baisse rien.
 */
export const GROUNDS = ["cream", "photo", "ochre", "terra", "deep"] as const;
export type Ground = (typeof GROUNDS)[number];

export const TEXT_FLOOR = 4.5;
/**
 * La teinte secondaire (signature, surtitre) est résolue à 4,7:1, pas au ras du
 * plancher : sur une photo, même sous un voile opaque, le rendu ne rend pas
 * exactement le papier, et la signature sortait à 4,45:1 au pire pixel
 * (bg-branch-sky, palettes sombres — mesuré le 2026-11-02). Ça serre.
 */
export const SOFT_TARGET = 4.7;
const COOL = "#EEEEEE";

export type GroundPalette = {
  ground: Ground;
  /** Le fond plein (sous la photo pour `photo`). */
  background: string;
  /** Le texte principal. */
  ink: string;
  /** Le texte secondaire : surtitre, signature, sous-ligne. */
  soft: string;
  /** Le voile sous le texte d'une photo (couleur), sinon le fond. */
  veil: string;
  /** Pour une couverture de carrousel sur photo : le fond des diapositives suivantes (crème). */
  rest?: GroundPalette | null;
};

export function creamOf(direction: DirectionPalette): string {
  return mix(direction.paper, COOL, 0.25);
}

/**
 * La teinte la plus proche du fond (la plus « douce ») de `from` vers `towards`
 * qui tient `floor` sur `ground` ; `null` si même `towards` ne tient pas.
 */
export function softest(from: string, towards: string, ground: string, floor = TEXT_FLOOR): string | null {
  let best: string | null = null;
  for (let step = 0; step <= 100; step += 1) {
    const candidate = mix(from, towards, step / 100);
    if (contrastRatio(candidate, ground) >= floor) best = candidate;
    else break;
  }
  return best;
}

export function groundPalette(direction: DirectionPalette, ground: Ground): GroundPalette | null {
  const cream = creamOf(direction);
  const darkInk = direction.dark;
  const lightInk = direction.paper;
  const background =
    ground === "cream"
      ? cream
      : ground === "ochre"
        ? mix(direction.secondary, cream, 0.8)
        : ground === "terra"
          ? mix(direction.primary, cream, 0.86)
          : ground === "deep"
            ? mix(direction.dark, cream, 0.07)
            : /* photo : le voile est sombre, l'encre claire */ mix(direction.dark, "#000000", 0.45);
  const ink = ground === "deep" || ground === "photo" ? lightInk : darkInk;
  if (contrastRatio(ink, background) < TEXT_FLOOR) return null;
  /* Le texte secondaire : de l'encre vers le fond, jusqu'au plancher. */
  const soft = softest(ink, background, background, SOFT_TARGET) ?? ink;
  return { ground, background, ink, soft, veil: background };
}

/** Le fond résolu qu'un appelant passe au moteur ; une photo emporte la crème de ses diapositives suivantes. */
export function groundFor(direction: DirectionPalette, ground: Ground): GroundPalette | null {
  const gp = groundPalette(direction, ground);
  if (gp && ground === "photo") gp.rest = groundPalette(direction, "cream");
  return gp;
}

export function isGround(value: unknown): value is Ground {
  return typeof value === "string" && (GROUNDS as readonly string[]).includes(value);
}
