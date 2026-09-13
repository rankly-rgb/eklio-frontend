import { checkEthics, type EthicsCheckResult } from "@/lib/ethics/rules";
import type { PracticeDetails } from "@/lib/kit/launch-copy";
import type { SpecPage } from "@/lib/site/types";
import type { BriefLabels } from "@/lib/launch/site-setup";
import { planSections, type SectionPlan } from "@/lib/site/section-copy";

/*
 * ── THE BUILDER PROMPT, ASSEMBLED ────────────────────────────────────────
 *
 * ⚠ THIS IS NOT A SECOND GENERATOR. The prompt's body — practice, design
 * tokens, page structure, her copy verbatim, voice, constraints — is produced
 * by `site_spec_envelope` in the database and arrives here as
 * `envelope.output.text`. It is passed through UNCHANGED and unparsed. What
 * this module adds is what that generator does not carry and a migration would
 * be needed to teach it: the wordmark, her tone words, her image slots by role,
 * a blog's structure, the placeholder inventory, and the two omissions below.
 *
 * ⚠ NOTHING HERE IS WRITTEN BY A MODEL, AND NO CLIENT-FACING COPY IS WRITTEN
 * AT ALL. Every line is either a fixed instruction to the builder or a value
 * read off her spec. Where a value is missing, a SCREAMING_SNAKE placeholder
 * named after the field goes in, and every placeholder emitted is listed at the
 * top so she can see what to fill before publishing.
 *
 * ⚠ THE PAGE STRUCTURE IS HERS. It comes from her own site spec's `pages[]`
 * and section types, not from a template — so two practices get two different
 * site structures, and the prompt says so where she can read it.
 */

/** A field the prompt needs, its placeholder, and where it comes from. */
type Placeholder = { token: string; describes: string };

const PLACEHOLDERS = {
  bookingUrl: { token: "BOOKING_URL", describes: "the link your call-to-action button opens" },
  practitionerName: { token: "PRACTITIONER_NAME", describes: "your name, as it appears on your license" },
  licenseLabel: { token: "LICENSE_TYPE", describes: "your license type, e.g. LMFT" },
  licenseNumber: { token: "LICENSE_NUMBER", describes: "your license number" },
  city: { token: "CITY", describes: "the city you practise in" },
  state: { token: "STATE", describes: "the state you are licensed in" },
} as const satisfies Record<string, Placeholder>;

/*
 * ⚠ WHAT THIS PROMPT REFUSES TO ASK A BUILDER FOR.
 *
 * A US therapist's site is normally expected to carry a crisis-line footer and
 * a fee / insurance disclosure. Eklio has neither as approved text, and neither
 * is something to improvise: a builder told to "write a fees section" will
 * invent numbers, and one told to "add a crisis line" will invent a number
 * someone in trouble might dial. Both are omitted OUTRIGHT — not placeholdered,
 * because a placeholder in a legal block is an invitation to draft it unaided.
 *
 * FINDINGS.md records this as legal-review work.
 */
const OMITTED = [
  "Fees, sliding scale and insurance",
  "Crisis-line and emergency footer",
] as const;

export type LovablePrompt = {
  /** The whole thing, ready to paste. */
  text: string;
  /** Every `[TOKEN]` emitted, in the order they appear. */
  placeholders: string[];
  /** Sections deliberately left out, named so their absence is legible. */
  omitted: readonly string[];
  /**
   * The Ethics Guard's verdict, run on the assembled text before display —
   * and reduced to what the ASSEMBLY is responsible for. See `scanAssembled`.
   */
  scan: EthicsCheckResult;
};

/*
 * ⚠ THE SCAN RUNS ON THE WHOLE, AND IS MEASURED AGAINST THE CORE.
 *
 * Running `checkEthics` on the assembled prompt and gating on `ok` was the
 * obvious reading, and it is wrong. The database's prompt QUOTES the phrases it
 * forbids — `Never write: "A proven method that resolves trauma for good."`,
 * `Never write: "Clients often tell me they finally feel free."`, and
 * `Do not invent testimonials, client quotes, statistics…`. `checkEthics` reads
 * those quotations as violations: four blocking hits on a real kit, identical
 * for every kit, because they are product-authored boilerplate.
 *
 * Gating on that would hold the prompt back for EVERYONE, forever, and step 1
 * would ship dead. So the core's own violations are the BASELINE, and this
 * reports only what the assembly adds on top — her copy is inside the core and
 * was already scanned by the Guard when it was generated, and every line this
 * module contributes is scanned here for the first time.
 *
 * The false positives are a defect in `checkEthics`'s prohibitive-context
 * handling, not in the prompt. FINDINGS.md records it; this module does not
 * reach into the Guard to fix it.
 */
function scanAssembled(core: string, assembled: string): EthicsCheckResult {
  const baseline = new Set(
    checkEthics(core).violations.map((v) => `${v.ruleId}::${v.excerpt}`)
  );
  const violations = checkEthics(assembled).violations.filter(
    (v) => !baseline.has(`${v.ruleId}::${v.excerpt}`)
  );
  return { ok: !violations.some((v) => v.severity === "block"), violations };
}

export function buildLovablePrompt(input: {
  /** `envelope.output.text` — the database's prompt, used verbatim. */
  core: string;
  practiceDetails: PracticeDetails | null;
  bookingUrl: string | null;
  /** Her direction's three tone words. */
  toneWords: readonly string[];
  /** The wordmark's catalogue label and format, when the kit has one. */
  wordmark: { label: string; format: string } | null;
  /** Her generated image slots, by slot key — `hero`, `ambient_a`, … */
  imageSlots: readonly string[];
  /** Her spec's pages, as data, so empty sections can be seen. */
  pages: readonly SpecPage[];
  /** Her brief's catalogue labels — see `loadBriefLabels`. */
  brief: BriefLabels;
}): LovablePrompt {
  const emitted: string[] = [];
  const fill = (value: string | null | undefined, placeholder: Placeholder): string => {
    const text = value?.trim();
    if (text) return text;
    if (!emitted.includes(placeholder.token)) emitted.push(placeholder.token);
    return `[${placeholder.token}]`;
  };

  const details = input.practiceDetails;
  const bookingUrl = fill(input.bookingUrl, PLACEHOLDERS.bookingUrl);
  const practitioner = fill(details?.practitionerName, PLACEHOLDERS.practitionerName);
  const licenseLabel = fill(details?.licenseLabel, PLACEHOLDERS.licenseLabel);
  const licenseNumber = fill(details?.licenseNumber, PLACEHOLDERS.licenseNumber);
  const city = fill(details?.city, PLACEHOLDERS.city);
  const state = fill(details?.state, PLACEHOLDERS.state);

  const sections: string[] = [];

  sections.push(
    [
      "# Build this site",
      "",
      "Paste this whole message into Lovable as your first prompt.",
      "",
      "The page structure below is not a template: it comes from YOUR site spec in",
      "Eklio — your pages, and the sections you kept on each of them. Another",
      "practice would get a different structure from the same instructions.",
    ].join("\n")
  );

  if (emitted.length > 0) {
    sections.push(
      [
        "## Fill these in before you publish",
        "",
        "Eklio does not have these yet, so they appear in the prompt in brackets.",
        "Search for each one and replace it — the site will build either way, but",
        "it will say the bracketed word until you do.",
        "",
        ...emitted.map((token) => {
          const entry = Object.values(PLACEHOLDERS).find((p) => p.token === token);
          return `- [${token}] — ${entry?.describes ?? ""}`;
        }),
      ].join("\n")
    );
  }

  // The database's prompt, whole and unaltered.
  sections.push(input.core);

  /*
   * ── THE CORRECTION BLOCK ─────────────────────────────────────────────
   *
   * ⚠ WHY THIS IS A BLOCK AFTER THE CORE AND NOT AN EDIT TO IT. The core is
   * `envelope.output.text`, composed by `site_spec_envelope` in the database and
   * passed through unparsed on purpose. Teaching it about `project_briefs`
   * means changing the SQL that seeds `site_specs` — a backend migration, which
   * this chantier forbids. Rewriting the core's prose here in TypeScript would
   * be the second generator that was already refused once.
   *
   * So the core keeps its outline, and this block — which comes after it, and
   * says so in its own first line — is what a builder follows where the two
   * differ. That is the honest shape of a join that cannot live in the spec yet.
   * FINDINGS.md records the migration this replaces.
   */
  const plan = planSections({
    pages: [...input.pages],
    sessionStyles: input.brief.sessionStyles,
    modalities: input.brief.modalities.map((m) => m.fullName),
    licenseLabel: details?.licenseLabel?.trim() || null,
    licenseNumber: details?.licenseNumber?.trim() || null,
  });
  const correction = sectionCorrection(plan);
  if (correction) sections.push(correction);

  sections.push(COMPOSITION);

  const modalityPages = modalityPagesBlock(input.brief.modalities);
  if (modalityPages) sections.push(modalityPages);

  const brand: string[] = ["## Brand marks and tone"];
  if (input.wordmark) {
    brand.push(
      `Wordmark: use the ${input.wordmark.label} file (${input.wordmark.format.toUpperCase()}) downloaded from Eklio as the site's logo, in the header and the footer. Do not set the practice name as plain type where the wordmark belongs, and do not recolour it.`
    );
  } else {
    brand.push(
      "No wordmark file: set the practice name in the heading font as the header logo."
    );
  }
  if (input.toneWords.length > 0) {
    brand.push(
      `Tone: ${input.toneWords.join(", ")}. Those three words describe how the site should FEEL — spacing, pace, restraint. They are not copy: do not print them anywhere on the page.`
    );
  }
  sections.push(brand.join("\n\n"));

  sections.push(
    [
      "## Imagery",
      "",
      input.imageSlots.length > 0
        ? `Eklio has generated photographs for these slots, which you download from Eklio and upload to Lovable: ${input.imageSlots.join(", ")}. Use \`hero\` as the hero image; use \`ambient_*\` as section backgrounds or supporting images; use \`texture\` only as a subtle background, never as a subject.`
        : "Eklio has not generated photographs for this kit yet. Leave labelled image placeholders at every image position rather than choosing stock.",
      "",
      "Wherever you source an image yourself, these hold without exception:",
      "- No faces and no people.",
      "- No text inside an image — all text is live text on the page.",
      "- No stock photography of therapy sessions, couches or clipboards.",
    ].join("\n")
  );

  sections.push(
    [
      "## Blog",
      "",
      "Structure only. Do not write any posts, and do not invent post titles or",
      "excerpts — the index renders whatever exists and is empty until she adds one.",
      "",
      "- A `/blog` index route listing posts newest first: title, date, and a one-line",
      "  excerpt. An empty state that simply says there are no posts yet.",
      "- A `/blog/[slug]` post template: title, date, body, and a link back to the",
      "  index. Same fonts, same colours, same header and footer as the rest of the site.",
      "- No categories, no tags, no author box, no comments, no share buttons.",
      "",
      "To add a post afterwards in Lovable: open the project, ask it to add a new",
      "post to the blog with your title and your text, and it will create the entry",
      "and link it from the index.",
    ].join("\n")
  );

  sections.push(
    [
      "## Accessibility",
      "",
      "- Every text-and-background pair on the page must meet WCAG 2.1 AA: 4.5:1 for",
      "  body text, 3:1 for large text. Check the pairs you compose, including text",
      "  over the section background and any text placed over an image.",
      "- Do not rely on the builder's defaults for this. If a pair fails, darken the",
      "  text role rather than changing the brand colour.",
      "- Every image gets alt text. Decorative images get an empty alt attribute.",
      "- One `h1` per page, and headings in order.",
    ].join("\n")
  );

  sections.push(
    [
      "## Do not build these",
      "",
      ...OMITTED.map((item) => `- ${item}.`),
      "",
      "Leave them out entirely — no heading, no placeholder, no lorem. They carry",
      "legal and clinical weight, they are not written yet, and a builder guessing at",
      "them is worse than their absence.",
    ].join("\n")
  );

  sections.push(
    [
      "## Contact",
      "",
      `Practice contact block: ${practitioner}, ${licenseLabel} ${licenseNumber}, ${city}, ${state}.`,
      `Call-to-action link: ${bookingUrl}`,
      "",
      "No contact form that collects health information. A mailto link, a phone",
      "number or a booking link only.",
    ].join("\n")
  );

  const text = sections.join("\n\n---\n\n");

  return {
    text,
    placeholders: emitted,
    omitted: OMITTED,
    // Run BEFORE display, every time, on the assembled whole — minus the
    // core's own quoted prohibitions. See `scanAssembled`.
    scan: scanAssembled(input.core, text),
  };
}


/*
 * ── EMPTY SECTIONS ───────────────────────────────────────────────────────
 *
 * Her spec's outline lists every section she kept, including four that carry a
 * heading and no body. A builder given a heading and told to write nothing
 * renders the heading over white space — which is what the first site did.
 *
 * Three of the four have an answer one table away (see `lib/site/section-copy.ts`).
 * The fourth has none, and the answer for a section with nothing to say is to
 * NOT BUILD IT — not a placeholder, not lorem, not a "coming soon". A missing
 * section is invisible; an empty one is a defect a visitor can see.
 */
function sectionCorrection(plan: SectionPlan): string | null {
  if (plan.supplements.length === 0 && plan.omit.length === 0) return null;

  const lines = [
    "## Sections: corrections to the outline above",
    "",
    "Where this block and the outline above disagree, THIS BLOCK WINS. The outline",
    "lists every section in the spec; some of them have no text yet, and this says",
    "what to do about each one.",
  ];

  if (plan.supplements.length > 0) {
    lines.push(
      "",
      "### Sections whose content is below, not in the outline",
      "",
      "Each list is her own words, chosen in Eklio. Set them as the section's",
      "content — as short cards or a plain list, one item each, in this order. Do",
      "not rewrite them, do not expand them into paragraphs, and do not add items."
    );
    for (const supplement of plan.supplements) {
      lines.push(
        "",
        `**${supplement.page} → ${supplement.heading}**`,
        ...supplement.lines.map((line) => `- ${line}`)
      );
    }
  }

  if (plan.omit.length > 0) {
    lines.push(
      "",
      "### Sections to leave out entirely",
      "",
      "There is no approved text for these. Do not build them: no heading, no",
      "placeholder, no lorem, no invented copy. The page above them and the page",
      "below them join up as if the section had never been listed.",
      "",
      ...plan.omit.map((ref) => `- ${ref.page} → ${ref.section}`),
      "",
      "If leaving one out empties a page of everything but its header and footer,",
      "drop that page from the site and from the navigation too."
    );
  }

  return lines.join("\n");
}

/*
 * ── COMPOSITION ──────────────────────────────────────────────────────────
 *
 * The first prompt said what to put on the page and nothing about how it should
 * sit there, so the builder defaulted to its house style: stacked full-width
 * bands, everything centred, every section the same. These are the decisions
 * that make a page look composed rather than assembled, written as rules a
 * builder can follow without judgement.
 *
 * ⚠ NOTHING HERE IS COPY. Not one sentence goes on the page.
 */
const COMPOSITION = [
  "## Composition",
  "",
  "These are layout rules, not content. Follow them exactly.",
  "",
  "**The home page is one page, and it scrolls.** Every home section is on it, in",
  "the order given, with in-page anchors from the header. No section opens a",
  "modal, no section is behind a tab, and nothing is hidden behind a carousel.",
  "",
  "**Hero.** Roughly 90vh tall, never a full 100vh and never taller than the",
  "viewport. The headline sits in the left third over the empty part of the",
  "photograph, left-aligned, with the sub-head under it and one button under that.",
  "One button — not two, and no secondary link styled as a button.",
  "",
  "**Rhythm.** Alternate the sections so two neighbours never share a shape: a",
  "text-only band, then a band with the image on one side, then a text-only band",
  "with a different background tint. Vertical padding is generous and equal for",
  "every band — one spacing value used everywhere, not a different guess per",
  "section.",
  "",
  "**One full-bleed band, and only one.** Exactly one section below the hero runs",
  "edge to edge with a photograph or the brand's deeper colour behind it. Every",
  "other section sits inside the page's content width. Two full-bleed bands make",
  "the page read as a sequence of posters.",
  "",
  "**Measure.** Body text never runs wider than about 70 characters, even when its",
  "band is wider. Centre a short lead paragraph if you like; never centre a",
  "paragraph longer than three lines.",
  "",
  "**Restraint.**",
  "- No gradients, no glassmorphism, no drop shadows on text, no animated counters.",
  "- No icon next to every heading; no stock icon set at all.",
  "- Motion is limited to a quiet fade-and-rise as a section enters, once, and it",
  "  is disabled under `prefers-reduced-motion`.",
  "- Buttons all look the same: one primary style, one quiet text-link style.",
  "",
  "**Header.** Sticky, thin, the wordmark on the left and the page links on the",
  "right, with the call-to-action button as the last item. It does not change",
  "height on scroll and it does not hide itself.",
  "",
  "**Footer.** Practice name, licence type and number, city and state, the contact",
  "link, and the page links again. Nothing else — no newsletter box, no social",
  "icons unless a URL is given above, no badges.",
].join("\n");

/*
 * ── A PAGE PER APPROACH ──────────────────────────────────────────────────
 *
 * Only when she has at least two, and only ever as structure: the page's own
 * words are hers to write, and this says so on the page itself rather than
 * letting a builder fill the space.
 */
function modalityPagesBlock(modalities: readonly { label: string; fullName: string }[]): string | null {
  if (modalities.length < 2) return null;

  const slug = (label: string) =>
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return [
    "## A page for each approach",
    "",
    "Build one page per approach below. These are the approaches she works in,",
    "chosen in Eklio — the names are hers and are spelled exactly as written.",
    "",
    ...modalities.map((m) => `- \`/approaches/${slug(m.label)}\` — page title: ${m.fullName}`),
    "",
    "Each page uses the site's own header, footer, fonts and colours, and carries:",
    "the approach's name as the `h1`, one section of body text, and the same",
    "call-to-action button as the home page. Nothing else.",
    "",
    "**Do not write the body text.** Eklio has not generated it yet. Leave a clearly",
    "marked empty block on each page reading `[YOUR DESCRIPTION OF THIS APPROACH]`",
    "so she can see where it goes. Do not describe the approach yourself, do not",
    "copy a description from anywhere, and do not state what it treats, how long it",
    "takes or how well it works.",
    "",
    "**Navigation.** Add one `Approaches` item to the header. It opens a dropdown",
    "listing the pages above, and the item itself also links to a `/approaches`",
    "index page that lists the same names and nothing more. On a narrow screen the",
    "dropdown becomes an indented group inside the mobile menu, not a second menu.",
    "The dropdown opens on click and on keyboard focus, closes on Escape, and every",
    "item is reachable with the Tab key.",
  ].join("\n");
}
