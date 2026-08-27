import { z } from "zod";

/*
 * Les formes de données de marque, telles que la BASE les contraint.
 *
 * Chaque schéma ci-dessous est la transcription d'un CHECK vérifié dans le
 * projet US `fobgdsupyfslxbswfuay` — pas une interprétation. Les fonctions
 * citées en commentaire sont celles qui font foi ; si l'une d'elles change,
 * c'est ici qu'il faut le refléter, et nulle part ailleurs.
 *
 * Les valider ICI, avant l'écriture, est ce qui évite qu'un CHECK rejeté
 * remonte en 500 sur l'écran de révélation d'un praticien (§7).
 */

const HEX = /^#[0-9A-Fa-f]{6}$/;
const hex = z.string().regex(HEX, "Expected a #RRGGBB color");

/* ── Palette ────────────────────────────────────────────────────────────── */
/* `brand_kit_palette_valid` : cinq rôles, tous en hex. */

export const PALETTE_ROLES = [
  "primary",
  "secondary",
  "light",
  "dark",
  "paper",
] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];

export const paletteSchema = z.object({
  primary: hex,
  secondary: hex,
  light: hex,
  dark: hex,
  paper: hex,
});
export type Palette = z.infer<typeof paletteSchema>;

/* ── Typographie ────────────────────────────────────────────────────────── */

export const typographySchema = z.object({
  heading_font: z.string().min(1),
  body_font: z.string().min(1),
  google_fonts_url: z
    .string()
    .startsWith("https://fonts.googleapis.com/css2?family=")
    .endsWith("display=swap"),
});
export type Typography = z.infer<typeof typographySchema>;

/* ── Hero ───────────────────────────────────────────────────────────────── */
/*
 * `brand_kit_hero_valid` n'exige que quatre chaînes ; les longueurs viennent
 * de `brand_kit_directions_rendering_valid`, qui les mesure pour la maquette
 * de 250px de la carte de direction.
 */

export const heroSchema = z.object({
  overline: z.string(),
  headline: z.string().max(46),
  subhead: z.string().max(60),
  cta_label: z.string(),
});
export type Hero = z.infer<typeof heroSchema>;

/* ── Rendu d'une direction ──────────────────────────────────────────────── */
/*
 * La personnalité de la maquette : barre de navigation posée sur le primaire
 * ou sur le clair, et forme du bouton. Ce n'est PAS dans le CHECK de la base
 * (qui tolère les clés supplémentaires) mais c'est une donnée de direction,
 * pas une décision d'index : l'Écran 4 montre trois traitements différents,
 * et les coder par position ferait mentir la quatrième direction générée.
 */

export const NAV_SURFACES = ["primary", "light"] as const;
export const CTA_SHAPES = ["pill", "rounded", "square"] as const;
export const CTA_STYLES = ["solid", "outline"] as const;

export const renderingSchema = z.object({
  nav_surface: z.enum(NAV_SURFACES),
  cta_shape: z.enum(CTA_SHAPES),
  cta_style: z.enum(CTA_STYLES),
});
export type Rendering = z.infer<typeof renderingSchema>;

/**
 * Rendu de repli quand une direction n'en porte pas — dérivé de la PALETTE,
 * jamais de la position dans le tableau. Un primaire sombre supporte d'être
 * une barre pleine ; un primaire clair a besoin du filet teinté.
 */
export function defaultRendering(palette: Palette): Rendering {
  const dark = isDarkEnoughForNavbar(palette.primary);
  return {
    nav_surface: dark ? "primary" : "light",
    cta_shape: "pill",
    cta_style: "solid",
  };
}

/* Seuil de luminance : au-dessus, du texte clair ne tient plus sur le primaire. */
function isDarkEnoughForNavbar(primary: string): boolean {
  const value = Number.parseInt(primary.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.32;
}

/* ── Direction ──────────────────────────────────────────────────────────── */
/*
 * `brand_kit_directions_shape_valid` + `…_rendering_valid` + `…_contrasted` :
 *   - exactement 3 directions, ids distincts
 *   - `name` ≤ 20 caractères ET 1 ou 2 mots
 *   - `rationale` entre 60 et 95 caractères
 *   - `hero.headline` ≤ 46, `hero.subhead` ≤ 60
 *   - exactement 3 `tone_keywords`, sans espace, joints par « · » sur ≤ 32
 *   - les trois `typography.heading_font` DISTINCTS d'une direction à l'autre
 */

export const TONE_KEYWORD_SEPARATOR = " · ";

export const directionSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .max(20)
    .refine((value) => {
      const words = value.trim().split(/\s+/).filter(Boolean);
      return words.length >= 1 && words.length <= 2;
    }, "A direction name is one or two words"),
  rationale: z.string().min(60).max(95),
  about_excerpt: z.string(),
  palette: paletteSchema,
  hero: heroSchema,
  typography: typographySchema,
  tone_keywords: z
    .array(z.string().regex(/^\S+$/, "Tone keywords carry no whitespace"))
    .length(3)
    .refine(
      (words) => words.join(TONE_KEYWORD_SEPARATOR).length <= 32,
      "The keyword row is nowrap: joined, it must stay under 33 characters"
    ),
  rendering: renderingSchema.optional(),
});
export type Direction = z.infer<typeof directionSchema>;

export const directionsSchema = z
  .array(directionSchema)
  .length(3)
  .refine(
    (list) => new Set(list.map((d) => d.id)).size === 3,
    "The three directions carry distinct ids"
  )
  .refine(
    (list) => new Set(list.map((d) => d.typography.heading_font)).size === 3,
    "The three directions carry distinct heading fonts"
  );

/* ── Modèles sociaux ────────────────────────────────────────────────────── */
/*
 * `brand_kit_social_templates_shape_valid` : exactement 4, dans CET ordre —
 * post/statement, post/question, post/notes, story/signature. Les longueurs
 * viennent de `…_rendering_valid` : 34, 34, 20 pour les trois premiers.
 */

export const SOCIAL_LAYOUTS = [
  "statement",
  "question",
  "notes",
  "signature",
] as const;
export type SocialLayout = (typeof SOCIAL_LAYOUTS)[number];

const socialTemplateBase = {
  id: z.string().min(1),
  body: z.string().nullable().optional(),
  palette_role: z.enum(PALETTE_ROLES),
  typography_role: z.enum(["heading", "body"]),
};

export const socialTemplatesSchema = z.tuple([
  z.object({
    ...socialTemplateBase,
    type: z.literal("post"),
    layout: z.literal("statement"),
    headline: z.string().max(34),
  }),
  z.object({
    ...socialTemplateBase,
    type: z.literal("post"),
    layout: z.literal("question"),
    headline: z.string().max(34),
  }),
  z.object({
    ...socialTemplateBase,
    type: z.literal("post"),
    layout: z.literal("notes"),
    headline: z.string().max(20),
  }),
  z.object({
    ...socialTemplateBase,
    type: z.literal("story"),
    layout: z.literal("signature"),
    headline: z.string(),
  }),
]);
export type SocialTemplates = z.infer<typeof socialTemplatesSchema>;
export type SocialTemplate = SocialTemplates[number];

/* ── Guide de voix ──────────────────────────────────────────────────────── */
/* `brand_kit_voice_guide_valid` : deux tableaux de 3 chaînes exactement. */

export const voiceGuideSchema = z.object({
  sounds_like: z.array(z.string().min(1)).length(3),
  never_write: z.array(z.string().min(1)).length(3),
});
export type VoiceGuide = z.infer<typeof voiceGuideSchema>;

/* ── Contrôle déontologique persisté ────────────────────────────────────── */
/* `brand_kit_ethics_check_valid`. `rule_id` référence `ethics_rules.id`. */

export const ethicsCheckSchema = z.object({
  passed: z.boolean(),
  flagged: z.array(
    z.object({
      field: z.string(),
      excerpt: z.string(),
      rule_id: z.string(),
    })
  ),
  checked_at: z.string(),
});
export type EthicsCheck = z.infer<typeof ethicsCheckSchema>;

/* ── Modèle de prévisualisation ─────────────────────────────────────────── */
/*
 * Ce que renvoie la fonction `brief_preview(p_brief_id)`. Elle résout
 * elle-même les ids de catalogue et pose ses propres replis : le rail du brief
 * a donc TOUJOURS quelque chose à rendre, dès le premier écran.
 */

export const previewTokensSchema = z.object({
  primary: hex,
  secondary: hex,
  light: hex,
  dark: hex,
  paper: hex,
  heading_font: z.string().min(1),
  body_font: z.string().min(1),
  google_fonts_url: z.string().min(1),
});
export type PreviewTokens = z.infer<typeof previewTokensSchema>;

export const previewModelSchema = z.object({
  practice_name: z.string().nullable(),
  tokens: previewTokensSchema,
  hero: z.object({
    overline: z.string().nullable(),
    headline: z.string(),
    subhead: z.string(),
    cta_label: z.string(),
  }),
  about_excerpt: z.string(),
  specialties: z.array(z.string()),
});
export type PreviewModel = z.infer<typeof previewModelSchema>;

/**
 * Modèle de prévisualisation dérivé d'une DIRECTION, pour rendre la même
 * maquette sur l'écran de révélation et sur le kit de marque.
 */
export function previewModelFromDirection(
  direction: Direction,
  practiceName: string | null
): PreviewModel {
  return {
    practice_name: practiceName,
    tokens: {
      ...direction.palette,
      heading_font: direction.typography.heading_font,
      body_font: direction.typography.body_font,
      google_fonts_url: direction.typography.google_fonts_url,
    },
    hero: direction.hero,
    about_excerpt: direction.about_excerpt,
    specialties: [],
  };
}
