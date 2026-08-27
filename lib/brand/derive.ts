import {
  capLightness,
  darkenLightness,
  toneOf,
  withAlpha,
} from "@/lib/brand/color";
import type { PreviewTokens } from "@/lib/brand/shapes";

/*
 * Couleurs DÉRIVÉES d'une palette de marque, pour la prévisualisation.
 *
 * Les huit références montrent des maquettes dont l'encre n'est aucun des cinq
 * rôles de palette : sur l'Écran 1, le titre de la maquette est `#4A3427` alors
 * que le primaire est `#B4674A`. Ces valeurs doivent être DÉRIVÉES, pas
 * relevées : une palette générée que personne n'a vue doit produire une
 * maquette lisible sans intervention.
 *
 * Les règles ci-dessous reproduisent les références à ~2 % près :
 *   Écran 1  primaire #B4674A → titre #4A3427   (règle : #503021)
 *   Écran 4  primaire #22364F → titre #22364F   (règle : #22364F, exact)
 *   Écran 4  primaire #3B2C3A → titre #3B2C3A   (règle : #3B2C3A, exact)
 *
 * ÉCART SIGNALÉ — le corps de texte. L'Écran 1 (#7A6A58) et la troisième carte
 * de l'Écran 4 (#5A6472) suivent la règle « teinte du primaire, désaturée,
 * clarté 41 % ». La PREMIÈRE carte de l'Écran 4 utilise `secondary` tel quel
 * (#4A5361) au lieu du violet gris que donnerait la règle. Les références se
 * contredisent donc entre elles ; la règle déterministe l'emporte, parce
 * qu'elle doit tenir pour n'importe quelle palette générée.
 */

export type DerivedPreviewColors = {
  /** Titres de la maquette : le primaire ramené sous 22 % de clarté. */
  ink: string;
  /** Corps et navigation : la teinte du primaire, désaturée, à 41 %. */
  inkSoft: string;
  /** Carte « About » et bandeau de pied : le clair descendu de 3.3 points. */
  about: string;
  /** Filet teinté au-dessus du bandeau, primaire à l'alpha demandé. */
  rule: string;
  /** Texte posé sur un aplat de primaire. */
  onPrimary: string;
};

/** Alpha du filet teinté, relevé sur chaque référence. */
export const HAIRLINE_ALPHA = {
  panel: 0.18,
  card: 0.14,
  full: 0.16,
} as const;

export function deriveColors(
  tokens: Pick<PreviewTokens, "primary" | "secondary" | "light" | "dark">,
  hairlineAlpha: number = HAIRLINE_ALPHA.panel
): DerivedPreviewColors {
  return {
    ink: capLightness(tokens.primary, 22),
    inkSoft: toneOf(tokens.primary, 17, 41),
    about: darkenLightness(tokens.light, 3.3),
    rule: withAlpha(tokens.primary, hairlineAlpha),
    onPrimary: tokens.light,
  };
}

/**
 * Les propriétés custom posées sur la racine de `<BrandPreview>`.
 *
 * Elles sont posées en STYLE, pas remontées en classes : un changement de
 * modèle doit ANIMER la maquette (500 ms sur les couleurs), pas la remonter.
 * Un remount ferait clignoter la maquette à chaque frappe dans le brief.
 */
export function previewCssVariables(
  tokens: PreviewTokens,
  hairlineAlpha?: number
): React.CSSProperties {
  const derived = deriveColors(tokens, hairlineAlpha);
  return {
    "--p-primary": tokens.primary,
    "--p-secondary": tokens.secondary,
    "--p-light": tokens.light,
    "--p-dark": tokens.dark,
    "--p-paper": tokens.paper,
    "--p-heading": `"${tokens.heading_font}", Georgia, serif`,
    "--p-body": `"${tokens.body_font}", system-ui, sans-serif`,
    "--p-ink": derived.ink,
    "--p-ink-soft": derived.inkSoft,
    "--p-about": derived.about,
    "--p-rule": derived.rule,
    "--p-on-primary": derived.onPrimary,
  } as React.CSSProperties;
}

/*
 * Mots de fin de raison sociale qu'un praticien ne met pas dans son domaine.
 * L'Écran 1 rend `elmandember.com` pour « Elm & Ember Counseling » : le
 * qualificatif tombe, le nom reste.
 */
const GENERIC_PRACTICE_WORDS = new Set([
  "counseling",
  "counselling",
  "therapy",
  "therapist",
  "psychotherapy",
  "practice",
  "clinic",
  "center",
  "centre",
  "group",
  "associates",
  "partners",
  "wellness",
  "health",
  "services",
  "llc",
  "pllc",
  "pc",
  "inc",
]);

/** `Elm & Ember Counseling` → `elmandember.com`, pour la barre d'URL. */
export function domainFor(practiceName: string | null): string {
  const words = (practiceName ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // On ne retire les qualificatifs qu'en FIN de nom, et jamais tous : « The
  // Counseling Practice » doit rester un domaine, pas une chaîne vide.
  while (words.length > 1 && GENERIC_PRACTICE_WORDS.has(words[words.length - 1])) {
    words.pop();
  }

  const slug = words.join("").slice(0, 30);
  return slug ? `${slug}.com` : "yourpractice.com";
}
