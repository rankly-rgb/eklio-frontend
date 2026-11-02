import { CANVAS, THUMB } from "@/lib/compose/constants";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PLANCHER DE CONTRASTE SELON LA TAILLE DU TEXTE RENDU (2026-11-02)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * WCAG AA : 4,5:1 pour le texte courant, 3:1 pour le grand texte — dès 24px en
 * graisse normale, 18,66px en gras. Appliquer 4,5 à un titre d'affichage était
 * plus strict que la norme.
 *
 * ⚠ LA TAILLE EST CELLE DU RENDU, VUE DANS LE FIL. Une carte de 1080 se lit à
 * `THUMB.width` (390px) : un titre posé à 96px s'affiche à 34,7px — grand texte ;
 * un titre réduit à 64px par la règle des quatre lignes s'affiche à 23,1px — il
 * bascule dans le texte courant. On classe la taille POSÉE, pas la taille demandée.
 *
 * ⚠ LA MENTION DE LICENCE GARDE 4,5:1, QUELLE QUE SOIT SA TAILLE. C'est le
 * point où l'on ne discute pas.
 */
export const NORMAL_TEXT_FLOOR = 4.5;
export const LARGE_TEXT_FLOOR = 3;
export const LICENCE_FLOOR = 4.5;

export type TextClass = "licence" | "large" | "normal";

/** La taille affichée dans le fil, en px CSS. */
export function shownPx(size: number): number {
  return (size * THUMB.width) / CANVAS.width;
}

export function textClass(size: number, weight: number, band: string): TextClass {
  if (band === "footer") return "licence";
  const px = shownPx(size);
  if (px >= 24 || (weight >= 700 && px >= 18.66)) return "large";
  return "normal";
}

export function floorFor(cls: TextClass): number {
  return cls === "large" ? LARGE_TEXT_FLOOR : cls === "licence" ? LICENCE_FLOOR : NORMAL_TEXT_FLOOR;
}
