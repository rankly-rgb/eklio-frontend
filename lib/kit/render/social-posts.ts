import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { relativeLuminance } from "@/lib/brand/color";
import { svgToPng } from "@/lib/kit/render/rasterize";
import type { SocialTemplate } from "@/lib/brand/shapes";

/*
 * post_statement_1080 / post_question_1080 / post_notes_1080 /
 * post_signature_1080 / story_1080x1920 (Lot 4.4, "Social").
 *
 * Content source: `kit.socialTemplates` — the kit-level 4-tuple
 * (statement/question/notes/signature) the generation pipeline writes once
 * at kit creation (`lib/generation/pipeline.ts`), shared across all three
 * directions. This IS "the selected direction's sample copy" the brief
 * names as the fallback: nothing in this schema models per-direction sample
 * copy separately (confirmed by reading `directionSchema` — no such
 * fields), and it's the only content in this schema that actually matches
 * the four archetypes the brief names. The "month's first four items"
 * primary source (`monthly_presence_content`) is a real, empty-in-production
 * table with NO archetype/layout column at all — see DECISIONS.md for why
 * that branch isn't wired in this lot.
 *
 * Layout mirrors the existing on-screen preview (`SocialTile` in
 * components/preview/brand-preview.tsx) at print/export resolution rather
 * than reinventing a design: background from `tokens[palette_role mapped]`,
 * foreground/contrast from the same luminance-based logic (adapted to the
 * tokens actually available here — see the header on `resolveBackground`),
 * font from `typography_role`.
 */

const POST_SIZE = 1080;
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

export type SocialTokens = {
  primary: string;
  secondary: string;
  paper: string;
  light_neutral: string;
  dark_neutral: string;
  heading_font: string;
  body_font: string;
};

/**
 * `palette_role` is one of the DIRECTION's five raw roles
 * (primary/secondary/light/dark/paper — `PALETTE_ROLES` in
 * lib/brand/shapes.ts), not the six-role/four-variant asset token set this
 * renderer otherwise reads. Mapped here rather than duplicated as a second
 * palette shape.
 */
function resolveBackground(tokens: SocialTokens, role: SocialTemplate["palette_role"]): string {
  switch (role) {
    case "primary":
      return tokens.primary;
    case "secondary":
      return tokens.secondary;
    case "light":
      return tokens.light_neutral;
    case "dark":
      return tokens.dark_neutral;
    case "paper":
      return tokens.paper;
  }
}

/**
 * Contrast-safe text colour for a saturated tile background. The on-screen
 * preview reaches for a UI-chrome-only `--p-ink` variable that has no
 * equivalent brand token here — this uses `dark_neutral`/`paper` instead
 * (the closest real brand tokens for "dark ink" / "light ink"), same
 * luminance test, not a byte-for-byte port of internal UI CSS.
 */
function resolveForeground(tokens: SocialTokens, background: string): string {
  return relativeLuminance(background) < 0.5 ? tokens.paper : tokens.dark_neutral;
}

function fontFor(tokens: SocialTokens, role: SocialTemplate["typography_role"]): string {
  return role === "heading" ? tokens.heading_font : tokens.body_font;
}

async function loadFonts(tokens: SocialTokens, googleFontsUrl: string) {
  const [heading, body] = await Promise.all([
    getCachedFontBuffer(tokens.heading_font, googleFontsUrl),
    getCachedFontBuffer(tokens.body_font, googleFontsUrl),
  ]);
  return { heading, body };
}

export type SquarePostInput = {
  template: Extract<SocialTemplate, { layout: "statement" | "question" | "notes" }>;
  tokens: SocialTokens;
  googleFontsUrl: string;
};

/** statement / question — a bottom-aligned headline on a full-bleed tile. */
export async function renderStatementOrQuestionPost(input: SquarePostInput): Promise<Buffer> {
  const { template, tokens } = input;
  const background = resolveBackground(tokens, template.palette_role);
  const foreground = resolveForeground(tokens, background);
  const font = fontFor(tokens, template.typography_role);
  const fonts = await loadFonts(tokens, input.googleFontsUrl);

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        width: "100%",
        height: "100%",
        backgroundColor: background,
        padding: 96,
      },
    },
    createElement(
      "div",
      {
        style: {
          display: "flex",
          fontFamily: font,
          fontWeight: 500,
          fontSize: template.layout === "statement" ? 96 : 84,
          lineHeight: 1.14,
          letterSpacing: "-0.015em",
          color: foreground,
        },
      },
      template.headline
    )
  );

  const svg = await satori(tree, {
    width: POST_SIZE,
    height: POST_SIZE,
    fonts: [
      { name: tokens.heading_font, data: fonts.heading, weight: 500, style: "normal" },
      { name: tokens.body_font, data: fonts.body, weight: 500, style: "normal" },
    ],
  });
  return svgToPng(svg);
}

export type NotesPostInput = {
  template: Extract<SocialTemplate, { layout: "notes" }>;
  tokens: SocialTokens;
  googleFontsUrl: string;
};

/**
 * notes — a small-caps label headline, then the real body copy if the kit
 * has any. No placeholder filler lines here (the on-screen preview's grey
 * bars are a loading-state stand-in, not something a downloadable file may
 * ship as if it were content) — a kit with no body text for this archetype
 * gets the headline alone, not fabricated lines.
 */
export async function renderNotesPost(input: NotesPostInput): Promise<Buffer> {
  const { template, tokens } = input;
  const background = resolveBackground(tokens, template.palette_role);
  const foreground = resolveForeground(tokens, background);
  const fonts = await loadFonts(tokens, input.googleFontsUrl);

  const children: ReturnType<typeof createElement>[] = [
    createElement(
      "div",
      {
        key: "headline",
        style: {
          display: "flex",
          fontFamily: tokens.body_font,
          fontWeight: 700,
          fontSize: 40,
          letterSpacing: "0.14em",
          textTransform: "uppercase" as const,
          color: foreground,
        },
      },
      template.headline
    ),
  ];

  if (template.body) {
    children.push(
      createElement(
        "div",
        {
          key: "body",
          style: {
            display: "flex",
            marginTop: 56,
            fontFamily: tokens.body_font,
            fontWeight: 400,
            fontSize: 44,
            lineHeight: 1.4,
            color: foreground,
            opacity: 0.85,
          },
        },
        template.body
      )
    );
  }

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: background,
        padding: "104px 96px",
      },
    },
    ...children
  );

  const svg = await satori(tree, {
    width: POST_SIZE,
    height: POST_SIZE,
    fonts: [
      { name: tokens.heading_font, data: fonts.heading, weight: 500, style: "normal" },
      { name: tokens.body_font, data: fonts.body, weight: 400, style: "normal" },
      { name: tokens.body_font, data: fonts.body, weight: 700, style: "normal" },
    ],
  });
  return svgToPng(svg);
}

export type SignatureInput = {
  template: Extract<SocialTemplate, { layout: "signature" }>;
  tokens: SocialTokens;
  practitionerLine: string | null;
  googleFontsUrl: string;
  /** Square (post_signature_1080) or portrait (story_1080x1920) — same content, two canvases. */
  shape: "square" | "story";
};

/**
 * signature — centred headline plus the practitioner line, matching the
 * on-screen `signature` tile exactly (see file header). The brief asks for
 * this content in TWO shapes (`post_signature_1080`, square, and
 * `story_1080x1920`, portrait) from ONE underlying template — see
 * DECISIONS.md for why that's the right reading, not a schema conflict.
 */
export async function renderSignature(input: SignatureInput): Promise<Buffer> {
  const { template, tokens } = input;
  const background = resolveBackground(tokens, template.palette_role);
  const foreground = resolveForeground(tokens, background);
  const fonts = await loadFonts(tokens, input.googleFontsUrl);
  const width = POST_SIZE;
  const height = input.shape === "square" ? POST_SIZE : STORY_HEIGHT;

  const children: ReturnType<typeof createElement>[] = [
    createElement(
      "div",
      {
        key: "headline",
        style: {
          display: "flex",
          fontFamily: tokens.heading_font,
          fontWeight: 600,
          fontSize: 72,
          letterSpacing: "-0.01em",
          color: tokens.primary,
          textAlign: "center" as const,
        },
      },
      template.headline
    ),
  ];

  if (input.practitionerLine) {
    children.push(
      createElement(
        "div",
        {
          key: "line",
          style: {
            display: "flex",
            marginTop: 28,
            fontFamily: tokens.body_font,
            fontSize: 40,
            color: foreground,
            opacity: 0.75,
          },
        },
        input.practitionerLine
      )
    );
  }

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: background,
        padding: 96,
        textAlign: "center" as const,
      },
    },
    ...children
  );

  const svg = await satori(tree, {
    width,
    height,
    fonts: [
      { name: tokens.heading_font, data: fonts.heading, weight: 600, style: "normal" },
      { name: tokens.body_font, data: fonts.body, weight: 400, style: "normal" },
    ],
  });
  return svgToPng(svg);
}
