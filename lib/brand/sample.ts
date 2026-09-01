import type {
  Direction,
  PreviewModel,
  SocialTemplates,
  VoiceGuide,
} from "@/lib/brand/shapes";

/*
 * Données d'exemple — `Elm & Ember Counseling`, la practice fictive des huit
 * références.
 *
 * Elles servent DEUX choses, et pas une de plus :
 *   - `/dev/preview`, la galerie de contrôle visuel ;
 *   - l'état vide de l'accueil (§5), qui montre ce qu'on obtient avant d'avoir
 *     répondu à quoi que ce soit.
 *
 * Aucun écran de production ne s'en sert autrement : les couleurs ci-dessous
 * sont les seuls hex de la base de code hors `styles/tokens.css`, et c'est
 * précisément parce que ce sont des DONNÉES DE MARQUE.
 */

export const SAMPLE_PRACTICE_NAME = "Elm & Ember Counseling";
export const SAMPLE_PRACTITIONER_LINE = "Nora Whitfield, LCSW";

const FRAUNCES_NUNITO =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Nunito+Sans:wght@400;600;700&display=swap";
const CORMORANT_SOURCE =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Source+Sans+3:wght@400;600;700&display=swap";
const NEWSREADER_WORK =
  "https://fonts.googleapis.com/css2?family=Newsreader:wght@500;600&family=Work+Sans:wght@400;600;700&display=swap";

export const SAMPLE_PREVIEW: PreviewModel = {
  practice_name: SAMPLE_PRACTICE_NAME,
  tokens: {
    primary: "#B4674A",
    secondary: "#C08A3E",
    light: "#F4EEE3",
    dark: "#2B2A27",
    paper: "#FAF6EE",
    heading_font: "Fraunces",
    body_font: "Nunito Sans",
    google_fonts_url: FRAUNCES_NUNITO,
  },
  hero: {
    overline: "LCSW · PORTLAND, OR",
    headline: "A calmer place to start.",
    subhead: "Therapy for high-performing adults who can't switch off.",
    cta_label: "Book a consult",
  },
  about_excerpt:
    "I work mostly with professionals who look fine from outside. Much of that work sits with anxiety and burnout.",
  specialties: ["Anxiety", "Burnout"],
};

export const SAMPLE_DIRECTIONS: Direction[] = [
  {
    id: "quiet-confidence",
    name: "Quiet Confidence",
    rationale:
      "Restraint reads as experience. For clients who want steadiness more than warmth.",
    about_excerpt: SAMPLE_PREVIEW.about_excerpt,
    palette: {
      primary: "#3B2C3A",
      secondary: "#4A5361",
      light: "#F3EDE4",
      dark: "#241B23",
      paper: "#FAF7F2",
    },
    hero: {
      overline: "LCSW · PORTLAND, OR",
      headline: "Experienced care, without the noise.",
      subhead: "Therapy for high-performing adults.",
      cta_label: "Book a consult",
    },
    typography: {
      heading_font: "Cormorant Garamond",
      body_font: "Source Sans 3",
      google_fonts_url: CORMORANT_SOURCE,
    },
    tone_keywords: ["composed", "credible", "unhurried"],
    rendering: { nav_surface: "primary", cta_shape: "square", cta_style: "outline" },
  },
  {
    id: "warm-welcome",
    name: "Warm Welcome",
    rationale:
      "Warmth without softness. It says the first call will be easier than they think.",
    about_excerpt: SAMPLE_PREVIEW.about_excerpt,
    palette: {
      primary: "#B4674A",
      secondary: "#C08A3E",
      light: "#F4EEE3",
      dark: "#2B2A27",
      paper: "#FAF6EE",
    },
    hero: {
      overline: "LCSW · PORTLAND, OR",
      headline: "A calmer place to start.",
      subhead: "Therapy for high-performing adults.",
      cta_label: "Book a consult",
    },
    typography: {
      heading_font: "Fraunces",
      body_font: "Nunito Sans",
      google_fonts_url: FRAUNCES_NUNITO,
    },
    tone_keywords: ["steady", "plainspoken", "warm"],
    rendering: { nav_surface: "light", cta_shape: "pill", cta_style: "solid" },
  },
  {
    id: "modern-calm",
    name: "Modern Calm",
    rationale:
      "Structure signals a plan. For the client who needs to see how the work goes.",
    about_excerpt: SAMPLE_PREVIEW.about_excerpt,
    palette: {
      primary: "#22364F",
      secondary: "#7A8168",
      light: "#EDEAE5",
      dark: "#16202E",
      paper: "#F7F6F3",
    },
    hero: {
      overline: "LCSW · PORTLAND, OR",
      headline: "Therapy with a plan you can actually see.",
      subhead: "Therapy for high-performing adults.",
      cta_label: "Book a consult",
    },
    typography: {
      heading_font: "Newsreader",
      body_font: "Work Sans",
      google_fonts_url: NEWSREADER_WORK,
    },
    tone_keywords: ["clear", "structured", "direct"],
    rendering: { nav_surface: "light", cta_shape: "rounded", cta_style: "solid" },
  },
];

/** Direction recommandée dans les références (bordure argile, bouton accent). */
export const SAMPLE_RECOMMENDED_DIRECTION_ID = "warm-welcome";

export const SAMPLE_SOCIAL_TEMPLATES: SocialTemplates = [
  {
    id: "statement",
    type: "post",
    layout: "statement",
    headline: "Rest is not a reward.",
    body: null,
    palette_role: "primary",
    typography_role: "heading",
  },
  {
    id: "question",
    type: "post",
    layout: "question",
    headline: "What is your anxiety protecting?",
    body: null,
    palette_role: "light",
    typography_role: "heading",
  },
  {
    id: "notes",
    type: "post",
    layout: "notes",
    headline: "Notes on burnout",
    body: "Three things that change when rest stops being a reward.",
    palette_role: "secondary",
    typography_role: "body",
  },
  {
    id: "signature",
    type: "story",
    layout: "signature",
    headline: "Elm & Ember",
    body: null,
    palette_role: "light",
    typography_role: "heading",
  },
];

export const SAMPLE_VOICE_GUIDE: VoiceGuide = {
  sounds_like: [
    "Direct without being blunt.",
    "Plain words for clinical ideas.",
    "Calm, never performative.",
  ],
  never_write: [
    "Heal your anxiety in 12 weeks.",
    "Clients often tell me...",
    "Limited spots available.",
  ],
};
