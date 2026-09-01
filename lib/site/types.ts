/*
 * L'enveloppe de l'éditeur de site, telle que la BASE la renvoie.
 *
 * Chaque type ci-dessous est relevé sur le JSON réel du §2 du
 * FRONTEND_CONTRACT — 18 540 octets capturés sur un kit CLAY & SAND — et sur
 * les énumérations des §1, §3 et §4. Rien n'est inventé, rien n'est déduit
 * d'une migration.
 *
 * ── Pourquoi des TYPES et non des schémas Zod ────────────────────────────
 *
 * `lib/brand/shapes.ts` valide ses jsonb parce qu'ils sont ÉCRITS par une
 * pipeline et relus des mois plus tard : un kit d'avant une contrainte peut ne
 * plus avoir la forme attendue. Ici, l'enveloppe est COMPOSÉE à chaque appel
 * par la fonction Postgres, et les routes la renvoient telle quelle (§0 de la
 * commande : « call one function and return what comes back »). Un
 * `z.object()` retirerait au passage toute clé que le backend ajouterait
 * ensuite — exactement ce que « renvoyer ce qui arrive » interdit.
 *
 * Le seul contrôle à l'exécution est celui de la forme d'ERREUR
 * (`isSiteError`, dans `lib/site/rpc.ts`) : c'est la seule branche où le
 * front doit décider quelque chose.
 */

/* ── Énumérations (§1) ──────────────────────────────────────────────────── */

/** Les sept constructeurs. L'ordre vient de `builder_targets`, pas d'ici. */
export const SITE_TARGETS = [
  "lovable",
  "framer",
  "v0",
  "generic",
  "squarespace",
  "wix",
  "webflow",
] as const;
export type SiteTarget = (typeof SITE_TARGETS)[number];

export const RESET_SCOPES = [
  "all",
  "colors",
  "typography",
  "copy",
  "structure",
] as const;
export type ResetScope = (typeof RESET_SCOPES)[number];

export const OUTPUT_FORMATS = ["json", "md", "txt"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export function isSiteTarget(value: string): value is SiteTarget {
  return (SITE_TARGETS as readonly string[]).includes(value);
}

export function isResetScope(value: string): value is ResetScope {
  return (RESET_SCOPES as readonly string[]).includes(value);
}

export function isOutputFormat(value: string): value is OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(value);
}

/* ── Le spec ────────────────────────────────────────────────────────────── */

export type SiteHero = {
  overline: string;
  headline: string;
  subhead: string;
  cta_label: string;
  cta_target_url: string;
};

/**
 * Les champs d'une section. `section_types.fields[].kind` vaut `text`,
 * `longtext` ou `list` : d'où une chaîne ou un tableau de chaînes, et rien
 * d'autre.
 */
export type SectionFields = Record<string, string | string[]>;

export type SpecSection = {
  key: string;
  type: string;
  /**
   * CLÉ DE TRI, jamais un index (§8 du contrat). Une section désactivée
   * disparaît de `preview` sans que les suivantes soient renumérotées :
   * `[1, 2, 4]` est une suite normale.
   */
  order: number;
  fields: SectionFields;
  enabled: boolean;
};

export type SpecPage = {
  key: string;
  label: string;
  enabled: boolean;
  sections: SpecSection[];
};

export type PracticeDetails = {
  /*
   * ⚠ Le nom de la PRATICIENNE, distinct du nom de la practice.
   *
   * Il arrive après le reste : `practice_details` ne portait que
   * `practice_name`, et un site de thérapie qui ne nomme pas la thérapeute est
   * un problème de conformité, pas seulement une omission bizarre. Le champ est
   * donc rendu SOUS CONDITION DE PRÉSENCE de la clé (cf.
   * `lib/site/details.ts`) : tant que la base ne l'expose pas, on ne propose
   * pas un contrôle dont l'écriture serait refusée en `unknown_field`.
   */
  practitioner_name?: string | null;
  practice_name?: string | null;
  license_label?: string | null;
  license_number?: string | null;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * Ce que le semeur a raccourci (§7 du contrat).
 *
 * Indexé par chemin de champ, PAS par une union de trois clés : le contrat
 * demande explicitement de lire les clés présentes plutôt que d'en attendre
 * trois. `null` — et non `{}` — quand il ne reste rien.
 */
export type SeedClampNote = { original_length: number; clamped_length: number };
export type SeedClamped = Record<string, SeedClampNote> | null;

export type SiteSpec = {
  brand_kit_id: string;
  spec_version: number;
  last_copied_spec_version: number | null;
  updated_at: string;
  target: SiteTarget;

  /* Les six rôles de couleur du §3, dans l'ordre du contrat. */
  primary: string;
  secondary: string;
  accent: string;
  paper: string;
  light_neutral: string;
  dark_neutral: string;

  heading_font: string;
  body_font: string;
  type_pairing_id: string;
  google_fonts_url: string;

  hero: SiteHero;
  about_excerpt: string;
  pages: SpecPage[];
  practice_details: PracticeDetails;
  extra_instructions: string | null;
  seed_clamped: SeedClamped;
};

/* ── La maquette ────────────────────────────────────────────────────────── */

/**
 * Les jetons de la maquette : les six rôles, les QUATRE variantes dérivées, et
 * la typographie.
 *
 * `primary_text`, `secondary_text`, `accent_text` et `cta_ink` sont calculées
 * par un trigger. Elles ne sont PAS dans `spec`, ne sont pas patchables, et
 * n'ont aucun contrôle en face d'elles (§3 du contrat).
 */
export type SitePreviewTokens = {
  primary: string;
  secondary: string;
  accent: string;
  paper: string;
  light_neutral: string;
  dark_neutral: string;
  primary_text: string;
  secondary_text: string;
  accent_text: string;
  cta_ink: string;
  heading_font: string;
  body_font: string;
  google_fonts_url: string;
};

export type PreviewSection = {
  key: string;
  type: string;
  order: number;
  fields: SectionFields;
};

export type PreviewPage = {
  key: string;
  label: string;
  sections: PreviewSection[];
};

export type SitePreviewModel = {
  pages: PreviewPage[];
  tokens: SitePreviewTokens;
  practice_name: string | null;
};

/* ── Contraste (§4) ─────────────────────────────────────────────────────── */

/** Les sept paires, dans l'ordre où elles arrivent — toujours le même. */
export const CONTRAST_PAIR_IDS = [
  "cta_label_on_primary",
  "dark_neutral_on_paper",
  "primary_on_paper",
  "secondary_on_paper",
  "accent_on_paper",
  "dark_neutral_on_light_neutral",
  "paper_on_dark_neutral",
] as const;
export type ContrastPairId = (typeof CONTRAST_PAIR_IDS)[number];

export type ContrastLevel = "AAA" | "AA" | "AA_large" | "fail";

/**
 * Le jeton qu'un correctif déplace. JAMAIS `paper` ni `light_neutral` — les
 * deux surfaces ne bougent pas — et jamais une variante dérivée : il n'y a pas
 * de contrôle derrière.
 */
export type FixableToken = "primary" | "secondary" | "accent" | "dark_neutral";

export type SuggestedFix = { token: FixableToken; hex: string };

export type ContrastPair = {
  pair_id: ContrastPairId;
  label: string;
  /** La couleur RÉELLEMENT mesurée — pour trois paires, c'est une variante. */
  fg: string;
  bg: string;
  /** WCAG 2.1, arrondi à deux décimales. Ne jamais le recalculer côté client. */
  ratio: number;
  /** Dérivé du ratio ARRONDI : les deux ne peuvent pas se contredire. */
  level: ContrastLevel;
  suggested_fix: SuggestedFix | null;
};

export type ContrastReport = {
  pairs: ContrastPair[];
  passes_aa: boolean;
  worst_ratio: number;
};

/* ── La sortie ──────────────────────────────────────────────────────────── */

export type OutputValueKind = "hex" | "font" | "url" | "text";

export type OutputValue = {
  kind: OutputValueKind;
  label: string;
  value: string;
};

export type SetupSheetStep = {
  /** Le numéro vient de la base. Ne jamais le coder en dur : la feuille a
   *  gagné une étape (huit → neuf) sans prévenir. */
  n: number;
  title: string;
  body: string;
  values: OutputValue[];
  builder_hint: string | null;
};

export type CopyBlock = {
  page: string;
  section: string;
  label: string;
  text: string;
};

export type PromptOutput = {
  kind: "prompt";
  text: string;
  char_count: number;
};

export type SetupSheetOutput = {
  kind: "setup_sheet";
  steps: SetupSheetStep[];
  copy_blocks: CopyBlock[];
};

export type SiteOutput = PromptOutput | SetupSheetOutput;

export function isPromptOutput(output: SiteOutput): output is PromptOutput {
  return output.kind === "prompt";
}

export function isSetupSheet(output: SiteOutput): output is SetupSheetOutput {
  return output.kind === "setup_sheet";
}

/* ── Le diff ────────────────────────────────────────────────────────────── */

export type SiteDiffChange = {
  area: string;
  label: string;
};

export type SiteDiff = {
  /** Vrai quand `spec_version` a dépassé `last_copied_spec_version`. */
  stale: boolean;
  changes: SiteDiffChange[];
};

/* ── L'enveloppe ────────────────────────────────────────────────────────── */

/**
 * Ce que renvoient SIX des huit entrées : get, patch, reset, set_target,
 * mark_copied et fix_contrast. Identique dans les six cas.
 */
export type SiteSpecEnvelope = {
  spec: SiteSpec;
  preview: SitePreviewModel;
  contrast: ContrastReport;
  output: SiteOutput;
  diff: SiteDiff;
  etag: string;
};

/* ── Erreurs (§1) ───────────────────────────────────────────────────────── */

export const SITE_ERROR_CODES = [
  "too_long",
  "not_found",
  "invalid_body",
  "invalid_field",
  "invalid_scope",
  "no_fix_needed",
  "unknown_field",
  "invalid_format",
  "invalid_target",
  "unauthenticated",
  "no_direction",
  /*
   * ⚠ Le kit n'est pas payé.
   *
   * La barrière est EN BASE (`brand_kit_entitled`), pas dans nos routes : une
   * route qui oublierait de vérifier ne reçoit rien, au lieu de tout. C'est
   * l'inverse du modèle précédent, où le paiement était un `if` côté client
   * au-dessus d'une route ouverte.
   *
   * Ce n'est PAS une erreur à afficher. C'est une offre : on ouvre le
   * checkout, avec le kit en contexte.
   */
  "payment_required",
] as const;
export type SiteErrorCode = (typeof SITE_ERROR_CODES)[number];

export type SiteErrorBody = {
  code: SiteErrorCode;
  message: string;
  /** Absent quand l'erreur ne porte pas sur un champ. */
  field?: string;
};

export type SiteErrorEnvelope = { error: SiteErrorBody };

/* ── Le catalogue (§5 et annexe) ────────────────────────────────────────── */

/** Lu par l'ÉDITEUR. Ne jamais borner une génération de direction avec. */
export type SiteSpecLimits = {
  hero_overline: number;
  hero_headline: number;
  hero_subhead: number;
  hero_cta_label: number;
  about_excerpt: number;
  /** Plafond de TOUTE chaîne dans les `fields` d'une section, item compris. */
  section_text: number;
  extra_instructions: number;
};

/** Lu par la PIPELINE DE GÉNÉRATION. Bornes différentes, consommateur différent. */
export type DirectionLimits = {
  name: number;
  name_words_max: number;
  rationale_min: number;
  rationale_max: number;
  hero_headline: number;
  hero_subhead: number;
  tone_keywords_count: number;
  tone_keywords_joined: number;
  directions_count: number;
};

export type SectionFieldKind = "text" | "longtext" | "list";

export type SectionTypeField = {
  key: string;
  label: string;
  kind: SectionFieldKind;
  max_length: number;
};

/**
 * `source` dit OÙ vit la copy d'une section. `fields` — son propre objet ;
 * `spec.hero` et `spec.about_excerpt` — la colonne de haut niveau, qu'il faut
 * éditer et patcher là-bas.
 */
export type SectionSource = "fields" | "spec.hero" | "spec.about_excerpt";

export type SectionType = {
  type: string;
  label: string;
  source: SectionSource;
  allowed_pages: string[];
  fields: SectionTypeField[];
  default_enabled: boolean;
  active: boolean;
};

export type BuilderTarget = {
  id: SiteTarget;
  label: string;
  output_kind: SiteOutput["kind"];
  /** Généré depuis `output_kind` : les deux ne peuvent pas se contredire. */
  accepts_prompt: boolean;
};

export type SiteCatalog = {
  direction_limits: DirectionLimits;
  site_spec_limits: SiteSpecLimits;
  section_types: SectionType[];
  builder_targets: BuilderTarget[];
};
