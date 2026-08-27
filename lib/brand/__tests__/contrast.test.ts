import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/brand/color";

/*
 * Le contraste du CHROME de l'application, mesuré — pas supposé.
 *
 * ── Ce que ce test a trouvé ──────────────────────────────────────────────
 *
 * Le §9 demande que « le contraste du chrome passe AA sur chaque paire ». Il
 * ne passe pas : trois paires échouent, et elles échouent avec les valeurs
 * relevées TELLES QUELLES dans `design/reference/*.dc.html`, qui est le
 * contrat visuel. Le §1 et le §9 se contredisent donc, et c'est le genre de
 * conflit qui se signale au lieu de se trancher tout seul :
 *
 *   --ink-3 sur --bg     2.57:1  échoue AA, et échoue même en grand texte
 *   --accent sur --bg    4.20:1  échoue AA en texte courant, passe en grand
 *   --bg sur --accent    4.20:1  idem — c'est le libellé du bouton `accent`
 *
 * ── Ce qui a été fait ────────────────────────────────────────────────────
 *
 * Les tokens ne bougent PAS : la consigne est explicite, la référence gagne.
 * Là où l'échec touche du texte que les références n'imposent pas, le token a
 * changé — les erreurs en ligne sont passées en `--ink` avec un filet argile
 * (cf. `components/ui/text-field.tsx`), ce qui les rend lisibles sans sortir
 * du système.
 *
 * Là où la référence impose la couleur, l'échec RESTE, et il est nommé ici :
 *   - « 11 MORE LOCKED » et « 2 REGENERATIONS LEFT » en `--ink-3` (Écrans 4
 *     et 7) ;
 *   - le libellé du bouton `accent` (Écrans 4 et 6).
 *
 * Ce test échouera si quelqu'un CHANGE un token en croyant bien faire : les
 * ratios sont figés à leur valeur mesurée, échecs compris.
 */

const TOKENS = {
  bg: "#FDFCFA",
  surface: "#FFFFFF",
  card: "#F6F2EA",
  ink: "#26211C",
  ink2: "#6F675E",
  ink3: "#A79E93",
  line: "#EBE6E0",
  accent: "#B4653F",
} as const;

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

function ratio(foreground: string, background: string): number {
  return Math.round(contrastRatio(foreground, background) * 100) / 100;
}

describe("contraste du chrome — paires conformes", () => {
  it.each([
    ["ink sur bg", TOKENS.ink, TOKENS.bg],
    ["ink sur card", TOKENS.ink, TOKENS.card],
    ["ink sur surface", TOKENS.ink, TOKENS.surface],
    ["ink-2 sur bg", TOKENS.ink2, TOKENS.bg],
    ["ink-2 sur card", TOKENS.ink2, TOKENS.card],
    ["bg sur ink", TOKENS.bg, TOKENS.ink],
  ])("%s passe AA en texte courant", (_label, foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe("contraste du chrome — les trois échecs connus", () => {
  it("--ink-3 sur --bg échoue, y compris en grand texte", () => {
    // Réservé au texte inactif (item de checklist barré), aux lignes de
    // placeholder (décoratives, aria-hidden) et à la barre d'URL de la
    // maquette. Il porte aussi deux libellés INFORMATIFS que les références
    // imposent : c'est l'échec qui reste.
    expect(ratio(TOKENS.ink3, TOKENS.bg)).toBe(2.57);
    expect(ratio(TOKENS.ink3, TOKENS.bg)).toBeLessThan(AA_LARGE);
  });

  it("--accent sur --bg échoue en texte courant, passe en grand", () => {
    const value = ratio(TOKENS.accent, TOKENS.bg);
    expect(value).toBe(4.2);
    expect(value).toBeLessThan(AA_NORMAL);
    expect(value).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("le libellé du bouton `accent` échoue en texte courant", () => {
    // 14px semi-gras n'atteint pas le seuil « grand texte » de WCAG
    // (18.66px gras / 24px). La paire vient telle quelle des Écrans 4 et 6.
    const value = ratio(TOKENS.bg, TOKENS.accent);
    expect(value).toBe(4.2);
    expect(value).toBeLessThan(AA_NORMAL);
  });
});

describe("l'anneau de focus reste distinguable du filet", () => {
  it("l'argile se détache de la ligne sur le fond de page", () => {
    // L'anneau est posé à 40 % d'opacité sur `--bg` ; il doit rester
    // nettement plus contrasté que le filet qu'il entoure.
    expect(ratio(TOKENS.accent, TOKENS.bg)).toBeGreaterThan(
      ratio(TOKENS.line, TOKENS.bg)
    );
  });
});
