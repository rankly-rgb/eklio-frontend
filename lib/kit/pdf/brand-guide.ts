import { rgb } from "pdf-lib";
import {
  BrandGuideDoc,
  CONTENT_WIDTH,
  MARGIN,
  hexToRgbColor,
  type PageFlow,
} from "@/lib/kit/pdf/layout";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { isBelowAa, pairReading } from "@/lib/site/contrast";
import { ETHICS_DISCLAIMER_TEXT } from "@/lib/ethics/disclaimer";
import {
  renderStatementOrQuestionPost,
  renderNotesPost,
  renderSignature,
  type SocialTokens,
} from "@/lib/kit/render/social-posts";
import { renderSiteMockup } from "@/lib/kit/render/site-mockup";
import type { Direction, SocialTemplates, VoiceGuide } from "@/lib/brand/shapes";
import type { ContrastReport, SpecPage } from "@/lib/site/types";

/*
 * The brand guide PDF (Lot 5) — fourteen US Letter pages, composed with the
 * shared layout helper (`lib/kit/pdf/layout.ts`), never positioned page by
 * page. Selectable text throughout (both her fonts embedded via fontkit);
 * the only raster content is the site mockup and the social template
 * previews, which are photographs of a composition, not text pretending to
 * be one.
 *
 * This REPLACES `renderBrandKitPdf` in `lib/kit/pdf.ts` as the brand guide
 * — that file's `renderMarkdownPdf` (the site setup sheet's own PDF export)
 * is untouched, a different document entirely.
 */

export type BrandGuideTokens = {
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
};

export type BrandGuideEthicsRule = {
  id: string;
  label: string;
  description: string;
  exampleForbidden: string;
};

export type BrandGuideData = {
  practiceName: string;
  monogram: string;
  tokens: BrandGuideTokens;
  googleFontsUrl: string;
  contrast: ContrastReport | null;
  direction: Direction;
  voiceGuide: VoiceGuide | null;
  socialTemplates: SocialTemplates | null;
  sitePages: SpecPage[];
  siteBuilderLabel: string | null;
  practitionerLine: string | null;
  /**
   * The REAL six rows of `ethics_rules` (the same table the generation
   * pipeline's own Ethics Guard reads — `lib/ethics/guard.ts`'s
   * `rulesBlock()`), sorted by `sort_order`. Never a second, hand-written
   * copy of this content: that's exactly the "badge tooltip and enforcement
   * path diverge" failure `guard.ts`'s own header warns against — this page
   * is a third reader of the same source, not a fourth set of rules.
   */
  ethicsRules: BrandGuideEthicsRule[];
};

const PAGE_TITLES = [
  "Cover",
  "Contents",
  "Identity",
  "Identity — misuse",
  "Colors, by role",
  "Colors, accessibility",
  "Type, families and scale",
  "Type, applied",
  "Voice",
  "Ethics Guard",
  "Your site",
  "Your site, page by page",
  "Social templates",
  "Using this kit",
] as const;

function ink(hex: string) {
  return hexToRgbColor(hex);
}

export async function renderBrandGuidePdf(data: BrandGuideData): Promise<Uint8Array> {
  const { tokens } = data;
  const darkColor = ink(tokens.dark_neutral);
  const primaryColor = ink(tokens.primary);
  const paperColor = ink(tokens.paper);

  const [headingBytes, bodyBytes] = await Promise.all([
    getCachedFontBuffer(tokens.heading_font, data.googleFontsUrl),
    getCachedFontBuffer(tokens.body_font, data.googleFontsUrl),
  ]);

  const doc = await BrandGuideDoc.create(darkColor, data.practiceName);
  const heading = await doc.pdf.embedFont(headingBytes, { subset: true });
  const body = await doc.pdf.embedFont(bodyBytes, { subset: true });
  // No dedicated mono font family is embedded elsewhere in this kit — the
  // body font at a small size, letter-spaced by the layout helper's own
  // draw calls where needed, stands in for the app's IBM Plex Mono labels.
  doc.setFonts({ heading, body, mono: body });

  buildCover(doc, data, { heading, body, dark: darkColor, primary: primaryColor, paper: paperColor });
  buildContents(doc, data, { heading, body, dark: darkColor });
  buildIdentity(doc, data, { heading, body, dark: darkColor, primary: primaryColor });
  buildIdentityMisuse(doc, data, { heading, body, dark: darkColor });
  buildColorsByRole(doc, data, { heading, body, dark: darkColor });
  buildColorsAccessibility(doc, data, { heading, body, dark: darkColor });
  buildTypeScale(doc, data, { heading, body, dark: darkColor });
  buildTypeApplied(doc, data, { heading, body, dark: darkColor });
  buildVoice(doc, data, { heading, body, dark: darkColor });
  buildEthicsGuard(doc, data, { heading, body, dark: darkColor });
  await buildSiteMockup(doc, data, { heading, body, dark: darkColor });
  buildSiteStructure(doc, data, { heading, body, dark: darkColor });
  await buildSocialTemplates(doc, data, { heading, body, dark: darkColor });
  buildUsingThisKit(doc, data, { heading, body, dark: darkColor, primary: primaryColor });

  return doc.finish();
}

type Palette = { heading: import("pdf-lib").PDFFont; body: import("pdf-lib").PDFFont; dark: import("pdf-lib").RGB; primary?: import("pdf-lib").RGB; paper?: import("pdf-lib").RGB };

/** A running heading + rule, the same shape on every page — built once, reused fourteen times. */
function pageHeading(flow: PageFlow, title: string, p: Palette): void {
  flow.text(title, p.heading, 20, p.dark, { leading: 26 });
  flow.rule(rgb(0.85, 0.85, 0.83));
  flow.advance(8);
}

function buildCover(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  flow.moveTo(520);
  flow.text(data.practiceName, p.heading, 40, p.dark!, { leading: 48 });
  // A large heading's own leading only clears its descenders, not a
  // comfortable gap before the next block — that gap is this advance,
  // sized relative to the heading's OWN font size (not a small fixed
  // constant), or the next line's baseline sits almost on top of this
  // one's. Caught by rendering and looking at the actual page, not by
  // the text-extraction check alone (see WORKLOG.md).
  flow.advance(24);
  flow.text("Brand guide", p.body, 14, p.dark!, { leading: 20 });
  flow.advance(20);
  flow.page.drawRectangle({ x: MARGIN, y: flow.y, width: 72, height: 4, color: p.primary! });
}

function buildContents(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Contents", p);
  PAGE_TITLES.forEach((title, index) => {
    const num = `${index + 1}`;
    flow.page.drawText(num.padStart(2, "0"), { x: MARGIN, y: flow.y - 14, size: 12, font: p.body, color: p.dark! });
    flow.page.drawText(title, { x: MARGIN + 36, y: flow.y - 14, size: 12, font: p.body, color: p.dark! });
    flow.advance(24);
  });
}

function buildIdentity(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Identity", p);

  flow.text(data.practiceName, p.heading, 48, p.dark!, { leading: 56 });
  // Same "large heading needs a proportionally larger gap" fix as the
  // cover page above — 16pt read as almost no gap at all against 48pt
  // Fraunces once actually rendered. Re-checked by re-rendering and
  // looking at the actual page a second time after the first bump (28pt)
  // still wasn't quite enough — Fraunces' real descenders run deeper
  // than the layout helper's baseline-offset estimate accounts for.
  flow.advance(40);

  flow.text(
    `Clear space — keep at least one monogram-width (${data.monogram}) of empty space on every side of the wordmark. Nothing else — no other text, mark, or edge of the page — should sit inside that margin.`,
    p.body,
    11,
    p.dark!,
    { leading: 16 }
  );
  flow.advance(8);
  flow.text(
    "Minimum size — never smaller than 1 inch (72pt) wide in print, or 120px wide on screen. Below that, the letterforms lose their spacing and the mark stops reading cleanly.",
    p.body,
    11,
    p.dark!,
    { leading: 16 }
  );
  flow.advance(8);
  flow.text(
    `Capitalization — always exactly as shown: "${data.practiceName}". Never set in all capitals, never lowercased, never abbreviated.`,
    p.body,
    11,
    p.dark!,
    { leading: 16 }
  );
  flow.advance(12);
  flow.text(
    `Monogram — ${data.monogram}, used alone for a small space a full wordmark won't fit (a favicon, an avatar, a social icon).`,
    p.body,
    11,
    p.dark!,
    { leading: 16 }
  );
}

const MISUSE_EXAMPLES = [
  "Stretching or squeezing the wordmark to fit a space",
  "Recoloring it outside your six brand colors",
  "Adding a drop shadow, outline, or bevel",
  "Rotating or angling it",
  "Placing it on a background it doesn't have enough contrast against",
];

function buildIdentityMisuse(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Identity — misuse", p);
  flow.text("Five things not to do with your mark:", p.body, 12, p.dark!, { leading: 20 });
  flow.advance(6);

  for (const example of MISUSE_EXAMPLES) {
    const y = flow.y - 12;
    flow.page.drawText(example, { x: MARGIN, y, size: 13, font: p.body, color: p.dark! });
    const width = p.body.widthOfTextAtSize(example, 13);
    // The strikethrough itself.
    flow.page.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: MARGIN + width, y: y + 4 },
      thickness: 1,
      color: p.dark!,
      opacity: 0.7,
    });
    flow.advance(30);
  }
}

function buildColorsByRole(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Colors, by role", p);

  const roles: { key: keyof BrandGuideTokens; label: string; job: string }[] = [
    { key: "primary", label: "Primary", job: "Buttons, links, active states." },
    { key: "secondary", label: "Secondary", job: "Supporting headings and surfaces." },
    { key: "accent", label: "Accent", job: "Small marks only." },
    { key: "paper", label: "Paper", job: "The whole page." },
    { key: "light_neutral", label: "Light neutral", job: "Tinted bands and cards." },
    { key: "dark_neutral", label: "Dark neutral", job: "Body copy." },
  ];

  // Hex only — the role name and its job are already spelled out in the list right below.
  flow.swatchRow(
    roles.map((r) => ({ hex: data.tokens[r.key], label: data.tokens[r.key], mono: p.body })),
    72
  );
  flow.advance(14);
  for (const role of roles) {
    flow.text(`${role.label} — ${role.job}`, p.body, 11, p.dark!, { leading: 16 });
  }
}

function buildColorsAccessibility(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Colors, accessibility", p);

  if (!data.contrast) {
    flow.text("Contrast data wasn't available when this guide was generated.", p.body, 11, p.dark!);
    return;
  }

  flow.text(
    data.contrast.passes_aa
      ? `All seven pairs pass WCAG AA. Worst ratio: ${data.contrast.worst_ratio.toFixed(2)}:1.`
      : "Some pairs fall below WCAG AA — see below.",
    p.body,
    11,
    p.dark!,
    { leading: 16 }
  );
  flow.advance(10);

  for (const pair of data.contrast.pairs) {
    const below = isBelowAa(pair);
    flow.page.drawRectangle({ x: MARGIN, y: flow.y - 16, width: 16, height: 16, color: ink(pair.bg) });
    flow.page.drawRectangle({ x: MARGIN + 20, y: flow.y - 16, width: 16, height: 16, color: ink(pair.fg) });
    flow.page.drawText(pair.label, { x: MARGIN + 48, y: flow.y - 12, size: 11, font: p.body, color: p.dark! });
    const reading = pairReading(pair);
    const readingWidth = p.body.widthOfTextAtSize(reading, 10);
    flow.page.drawText(reading, {
      x: MARGIN + CONTENT_WIDTH - readingWidth,
      y: flow.y - 12,
      size: 10,
      font: p.body,
      color: below ? rgb(0.72, 0.24, 0.2) : p.dark!,
      opacity: below ? 1 : 0.7,
    });
    flow.advance(28);
  }
}

function buildTypeScale(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Type, families and scale", p);

  flow.text(`Headings — ${data.tokens.heading_font}`, p.body, 11, p.dark!, { leading: 16 });
  flow.text(`Body — ${data.tokens.body_font}`, p.body, 11, p.dark!, { leading: 16 });
  flow.advance(14);

  const scale: { label: string; size: number; font: import("pdf-lib").PDFFont }[] = [
    { label: "Heading 1", size: 36, font: p.heading },
    { label: "Heading 2", size: 24, font: p.heading },
    { label: "Heading 3", size: 18, font: p.heading },
    { label: "Body", size: 12, font: p.body },
    { label: "Small / caption", size: 9, font: p.body },
  ];
  for (const step of scale) {
    flow.text(step.label, step.font, step.size, p.dark!, { leading: step.size * 1.3 });
    // Proportional to the step's own size — a fixed 6pt reads fine after
    // "Body"/"Small" but is too tight after "Heading 1" at 36pt (same class
    // of bug as the cover/identity pages — see the comment there).
    flow.advance(Math.max(6, step.size * 0.25));
  }
}

function buildTypeApplied(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Type, applied", p);

  flow.text(data.direction.hero.headline, p.heading, 30, p.dark!, { leading: 36 });
  flow.advance(18);
  flow.text(data.direction.hero.subhead, p.body, 15, p.dark!, { leading: 21 });
  flow.advance(14);
  flow.text(data.direction.about_excerpt, p.body, 11, p.dark!, { leading: 16 });
}

function buildVoice(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Voice", p);

  if (!data.voiceGuide) {
    flow.text("Your voice guide wasn't available when this guide was generated.", p.body, 11, p.dark!);
    return;
  }

  flow.text("Sounds like you", p.heading, 15, p.dark!, { leading: 20 });
  flow.advance(4);
  for (const line of data.voiceGuide.sounds_like) {
    flow.text(`— ${line}`, p.body, 11, p.dark!, { leading: 16 });
  }
  flow.advance(14);
  flow.text("Never write this", p.heading, 15, p.dark!, { leading: 20 });
  flow.advance(4);
  for (const line of data.voiceGuide.never_write) {
    flow.text(`— ${line}`, p.body, 11, p.dark!, { leading: 16 });
  }
}

function buildEthicsGuard(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Ethics Guard", p);
  flow.text(
    "Eklio checks every piece of copy it generates against six rule families, before you ever see it.",
    p.body,
    11,
    p.dark!,
    { leading: 16 }
  );
  flow.advance(10);

  if (data.ethicsRules.length === 0) {
    flow.text("Your ethics rules weren't available when this guide was generated.", p.body, 11, p.dark!);
    return;
  }

  for (const rule of data.ethicsRules) {
    flow.text(rule.label, p.heading, 13, p.dark!, { leading: 18 });
    flow.text(rule.description, p.body, 10, p.dark!, { leading: 14, x: MARGIN + 4 });
    flow.text(`Never: "${rule.exampleForbidden}"`, p.body, 10, p.dark!, { leading: 14, x: MARGIN + 4 });
    flow.advance(8);
  }
}

async function buildSiteMockup(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): Promise<void> {
  const flow = doc.newPage();
  pageHeading(flow, "Your site", p);

  const png = await renderSiteMockup({
    practiceName: data.practiceName,
    overline: data.direction.hero.overline,
    headline: data.direction.hero.headline,
    subhead: data.direction.hero.subhead,
    ctaLabel: data.direction.hero.cta_label,
    headingFont: data.tokens.heading_font,
    bodyFont: data.tokens.body_font,
    googleFontsUrl: data.googleFontsUrl,
    primaryColor: data.tokens.primary,
    ctaInk: data.tokens.cta_ink,
    paperColor: data.tokens.paper,
    darkColor: data.tokens.dark_neutral,
    lightColor: data.tokens.light_neutral,
  });
  const image = await doc.pdf.embedPng(png);
  const imageHeight = CONTENT_WIDTH * (image.height / image.width);
  flow.advance(imageHeight);
  flow.page.drawImage(image, { x: MARGIN, y: flow.y, width: CONTENT_WIDTH, height: imageHeight });
  flow.advance(10);
  flow.text(
    `Built with ${data.siteBuilderLabel ?? "your chosen builder"}. This page is a reference — edit the real thing in your site editor.`,
    p.body,
    9,
    p.dark!,
    { leading: 13 }
  );
}

function buildSiteStructure(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  let flow = doc.newPage();
  pageHeading(flow, "Your site, page by page", p);

  const enabledPages = data.sitePages.filter((page) => page.enabled);
  if (enabledPages.length === 0) {
    flow.text("Your site pages weren't available when this guide was generated.", p.body, 11, p.dark!);
    return;
  }

  for (const sitePage of enabledPages) {
    if (flow.remaining < 80) flow = doc.newPage();

    flow.text(sitePage.label, p.heading, 16, p.dark!, { leading: 22 });
    flow.advance(4);

    const sections = [...sitePage.sections].filter((s) => s.enabled).sort((a, b) => a.order - b.order);
    for (const section of sections) {
      if (flow.remaining < 60) flow = doc.newPage();

      flow.text(section.type, p.body, 9, p.dark!, { leading: 13, x: MARGIN + 4 });
      for (const [fieldKey, value] of Object.entries(section.fields)) {
        const text = Array.isArray(value) ? value.join(" · ") : value;
        if (!text) continue;
        if (flow.remaining < 40) flow = doc.newPage();
        flow.text(`${fieldKey}: ${text}`, p.body, 10, p.dark!, { leading: 15, x: MARGIN + 12 });
      }
      flow.advance(6);
    }
    flow.advance(10);
  }
}

async function buildSocialTemplates(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): Promise<void> {
  const flow = doc.newPage();
  pageHeading(flow, "Social templates", p);

  if (!data.socialTemplates) {
    flow.text("Your social templates weren't available when this guide was generated.", p.body, 11, p.dark!);
    return;
  }

  const socialTokens: SocialTokens = {
    primary: data.tokens.primary,
    secondary: data.tokens.secondary,
    paper: data.tokens.paper,
    light_neutral: data.tokens.light_neutral,
    dark_neutral: data.tokens.dark_neutral,
    heading_font: data.tokens.heading_font,
    body_font: data.tokens.body_font,
  };

  const [statement, question, notes, signature] = await Promise.all([
    renderStatementOrQuestionPost({ template: data.socialTemplates[0], tokens: socialTokens, googleFontsUrl: data.googleFontsUrl }),
    renderStatementOrQuestionPost({ template: data.socialTemplates[1], tokens: socialTokens, googleFontsUrl: data.googleFontsUrl }),
    renderNotesPost({ template: data.socialTemplates[2], tokens: socialTokens, googleFontsUrl: data.googleFontsUrl }),
    renderSignature({
      template: data.socialTemplates[3],
      tokens: socialTokens,
      practitionerLine: data.practitionerLine,
      googleFontsUrl: data.googleFontsUrl,
      shape: "square",
    }),
  ]);

  const thumbSize = (CONTENT_WIDTH - 16) / 2;
  const images = await Promise.all([statement, question, notes, signature].map((bytes) => doc.pdf.embedPng(bytes)));

  flow.advance(thumbSize);
  const row1Y = flow.y;
  flow.page.drawImage(images[0], { x: MARGIN, y: row1Y, width: thumbSize, height: thumbSize });
  flow.page.drawImage(images[1], { x: MARGIN + thumbSize + 16, y: row1Y, width: thumbSize, height: thumbSize });

  flow.advance(thumbSize + 16);
  const row2Y = flow.y;
  flow.page.drawImage(images[2], { x: MARGIN, y: row2Y, width: thumbSize, height: thumbSize });
  flow.page.drawImage(images[3], { x: MARGIN + thumbSize + 16, y: row2Y, width: thumbSize, height: thumbSize });
}

function buildUsingThisKit(doc: BrandGuideDoc, data: BrandGuideData, p: Palette): void {
  const flow = doc.newPage();
  pageHeading(flow, "Using this kit", p);

  flow.text(
    "Every file behind this guide — the wordmark, the icons, your colors, your social templates, your business card — lives in your brand kit's \"Your assets\" section, ready to download.",
    p.body,
    11,
    p.dark!,
    { leading: 16 }
  );
  flow.advance(10);
  flow.text(
    "Your voice guide and Ethics Guard rules apply to anything you write yourself, not only what Eklio drafts for you.",
    p.body,
    11,
    p.dark!,
    { leading: 16 }
  );
  flow.advance(24);

  flow.rule(rgb(0.85, 0.85, 0.83));
  flow.advance(10);
  flow.text(ETHICS_DISCLAIMER_TEXT, p.body, 9, p.dark!, { leading: 13 });
  flow.advance(20);

  flow.page.drawText("Made with Eklio", {
    x: MARGIN,
    // A raw drawText call (unlike flow.text()) doesn't apply the layout
    // helper's own baseline offset — matching it by hand here, or this
    // line sits too close beneath the disclaimer above it. Caught by
    // rendering and looking at the actual last page.
    y: flow.y - 8 * 0.85,
    size: 8,
    font: p.body,
    color: p.dark!,
    opacity: 0.5,
  });
}
