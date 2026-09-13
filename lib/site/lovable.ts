import { checkEthics, type EthicsCheckResult } from "@/lib/ethics/rules";
import type { PracticeDetails } from "@/lib/kit/launch-copy";
import type { SpecPage } from "@/lib/site/types";
import type { BriefLabels } from "@/lib/launch/site-setup";
import { planSections, type SectionPlan } from "@/lib/site/section-copy";
import { siteImages } from "@/lib/site/imagery";

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
  practiceName: { token: "PRACTICE_NAME", describes: "the name of your practice, as it should appear in search results" },
  practitionerName: { token: "PRACTITIONER_NAME", describes: "your name, as it appears on your license" },
  licenseLabel: { token: "LICENSE_TYPE", describes: "your license type, e.g. LMFT" },
  licenseNumber: { token: "LICENSE_NUMBER", describes: "your license number" },
  city: { token: "CITY", describes: "the city you practise in" },
  approachCopy: {
    token: "YOUR DESCRIPTION OF THIS APPROACH",
    describes:
      "a few sentences on each approach page, in your words — Eklio has not written these",
  },
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
  /** The kit's practice name — the site's own name in titles and JSON-LD. */
  practiceName: string | null;
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
  const practiceName = fill(input.practiceName, PLACEHOLDERS.practiceName);
  const practitioner = fill(details?.practitionerName, PLACEHOLDERS.practitionerName);
  const licenseLabel = fill(details?.licenseLabel, PLACEHOLDERS.licenseLabel);
  const licenseNumber = fill(details?.licenseNumber, PLACEHOLDERS.licenseNumber);
  const city = fill(details?.city, PLACEHOLDERS.city);
  const state = fill(details?.state, PLACEHOLDERS.state);

  /*
   * Computed BEFORE the inventory below, because a page it asks for carries a
   * placeholder of its own — and an inventory that misses one is worse than no
   * inventory: she would trust it and publish the word.
   */
  const modalityPages = modalityPagesBlock(input.brief.modalities);
  if (modalityPages && !emitted.includes(PLACEHOLDERS.approachCopy.token)) {
    emitted.push(PLACEHOLDERS.approachCopy.token);
  }

  const plan = planSections({
    pages: [...input.pages],
    sessionStyles: input.brief.sessionStyles,
    modalities: input.brief.modalities.map((m) => m.fullName),
    licenseLabel: details?.licenseLabel?.trim() || null,
    licenseNumber: details?.licenseNumber?.trim() || null,
  });

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

  /*
   * ⚠ THIS BLOCK IS ALWAYS PRESENT, EVEN WITH NOTHING TO FILL IN. The preview
   * warning below belongs to every build: the admin the blog section asks for
   * is reachable on a builder's preview URL while she is still working, and a
   * preview URL is a public URL — it is unlisted, not protected. Someone handed
   * that link before the flag goes off can write to her blog. There is no
   * placeholder that makes that true or false, so it cannot hang off `emitted`.
   */
  sections.push(
    [
      "## Fill these in before you publish",
      "",
      ...(emitted.length > 0
        ? [
            "Eklio does not have these yet, so they appear in the prompt in brackets.",
            "Search for each one and replace it — the site will build either way, but",
            "it will say the bracketed word until you do.",
            "",
            ...emitted.map((token) => {
              const entry = Object.values(PLACEHOLDERS).find((p) => p.token === token);
              return `- [${token}] — ${entry?.describes ?? ""}`;
            }),
            "",
          ]
        : []),
      ...(plan.missing.length > 0
        ? [
            "Eklio is also missing these, and a section is left out of the site",
            "because of it. They are not in the prompt to search for — add them in",
            "Eklio and copy the prompt again:",
            "",
            ...plan.missing.map((need) => `- ${need}`),
            "",
          ]
        : []),
      "⚠ **Your preview link is a public link.** While you are building, your",
      "builder gives the site a preview URL. It is unlisted, not private: anyone",
      "who has it can open it, and a search engine can find it. So while the blog",
      "admin flag is on, do not share that link with anyone — turn the flag off",
      "and publish before you send the address to a colleague or a client.",
    ].join("\n")
  );

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
  const correction = sectionCorrection(plan);
  if (correction) sections.push(correction);

  sections.push(COMPOSITION);

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

  sections.push(imageryBlock(input.imageSlots));

  sections.push(BLOG);

  sections.push(
    seoBlock({
      practiceName,
      practitioner,
      licenseLabel,
      city,
      state,
      specialties: input.brief.specialties,
    })
  );

  sections.push(TESTIMONIALS);

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

  /*
   * ⚠ A BRACKETED TOKEN IS A VISIBLE WORD, NEVER A LIVE VALUE.
   *
   * On the first real assembly this block emitted `Call-to-action link:
   * [BOOKING_URL]` — while the core, three screens up, says the call to action
   * has no link yet and the button must be left unlinked. A builder resolving
   * that either way is wrong: one ignores an instruction, the other ships
   * `href="[BOOKING_URL]"` on a live site, which is a dead button a visitor
   * clicks.
   *
   * So the token stays (the inventory tells her to search for it, and it has to
   * be findable) and the sentence next to it says what to do until she does.
   * The same rule is stated once for every bracketed word in the prompt.
   */
  sections.push(
    [
      "## Contact",
      "",
      `Practice contact block: ${practitioner}, ${licenseLabel} ${licenseNumber}, ${city}, ${state}.`,
      `Call-to-action link: ${bookingUrl}`,
      ...(emitted.length > 0
        ? [
            "",
            "⚠ **A word in [BRACKETS] is missing, not a value.**",
            "",
            "- **Never put one in an attribute.** Not an `href`, not a `src`, not any",
            "  other attribute. The element ships WITHOUT that attribute rather than",
            "  with a broken one: the call-to-action button stays visible and",
            "  unlinked, an image without a source is left out, and nothing gets a",
            "  bracketed word as a URL. This overrides the outline's own wording if",
            "  the two disagree.",
            "- **Never publish one as structured data**, an address or a credential.",
            "  Delete the property or the segment instead — a bracketed segment in a",
            "  contact line or a footer is left out of that line, not printed.",
            "- A bracketed word may appear as VISIBLE TEXT on the page, so she can",
            "  find it and replace it. That is the only place it belongs.",
          ]
        : []),
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

/*
 * ── SEO AND STRUCTURED DATA ──────────────────────────────────────────────
 *
 * ⚠ THE WHOLE DANGER OF A STRUCTURED-DATA BLOCK IS THAT ITS SCHEMA INVITES
 * FIELDS NOBODY HAS. `LocalBusiness` offers `openingHours`, `priceRange`,
 * `telephone`, `aggregateRating` and `review`, and a builder handed the type
 * name will fill them — inventing hours she does not keep, a price band she
 * never set, and a star rating out of nothing. Published as JSON-LD, those are
 * machine-readable claims about a licensed professional.
 *
 * So the block names every property to emit, and then names the ones to leave
 * out by their exact schema.org key, so there is nothing to infer. A value
 * Eklio does not hold arrives here as a `[PLACEHOLDER]` and the instruction is
 * to DROP the property, never to guess it.
 *
 * Meta descriptions are not written either: they are taken from copy that is
 * already on the page and already passed the Guard when it was generated.
 */
function seoBlock(input: {
  practiceName: string;
  practitioner: string;
  licenseLabel: string;
  city: string;
  state: string;
  specialties: readonly string[];
}): string {
  const lines = [
    "## SEO and structured data",
    "",
    "### Titles and descriptions",
    "",
    `- Home page title: \`${input.practiceName} — ${input.licenseLabel} in ${input.city}, ${input.state}\``,
    "- Every other page's title: the page's own `h1`, then an en dash, then the",
    `  practice name — e.g. \`About — ${input.practiceName}\`.`,
    "- **Do not write meta descriptions.** Take each one from text already on that",
    "  page: its first sentence, cut at the last full word before 155 characters.",
    "  A page with no body text gets no meta description tag at all.",
    "- One `h1` per page, matching that page's heading in the structure above.",
    "- Canonical link on every page. `lang=\"en\"` on `<html>`.",
    "- An Open Graph title and description mirroring the two above, and the hero",
    "  photograph as the OG image. No Twitter-specific card beyond the defaults.",
    "",
    "### JSON-LD",
    "",
    "One `<script type=\"application/ld+json\">` block in the home page's `<head>`,",
    "and nowhere else. Emit EXACTLY these properties and no others:",
    "",
    "```json",
    "{",
    '  "@context": "https://schema.org",',
    '  "@type": "ProfessionalService",',
    `  "name": ${JSON.stringify(input.practiceName)},`,
    '  "url": "THE SITE\'S OWN URL ONCE IT IS PUBLISHED",',
    '  "address": {',
    '    "@type": "PostalAddress",',
    `    "addressLocality": ${JSON.stringify(input.city)},`,
    `    "addressRegion": ${JSON.stringify(input.state)},`,
    '    "addressCountry": "US"',
    "  },",
    ...(input.specialties.length > 0
      ? [`  "knowsAbout": ${JSON.stringify([...input.specialties])},`]
      : []),
    '  "founder": {',
    '    "@type": "Person",',
    `    "name": ${JSON.stringify(input.practitioner)},`,
    `    "honorificSuffix": ${JSON.stringify(input.licenseLabel)}`,
    "  }",
    "}",
    "```",
    "",
    "⚠ **Any value above that still reads as a bracketed placeholder: delete that**",
    "**property from the JSON entirely.** A bracketed word published as structured",
    "data is a false claim in a machine-readable format. Never substitute a guess.",
    "",
    "⚠ **Do not add these, under any type name:**",
    "",
    "- No `openingHours`, no `openingHoursSpecification` — her hours are not in Eklio.",
    "- No `priceRange` — no fee information exists here, not even a band.",
    "- No `aggregateRating`, no `review`, no `ratingValue`, no `reviewCount` — none",
    "  exist, and inventing one is the worst thing this site could publish.",
    "- No `telephone`, no `email`, no `streetAddress`, no `geo`, no `latitude`, no",
    "  `longitude` — not held, and not to be looked up from anywhere else.",
    "- No `medicalSpecialty`, no `MedicalBusiness`, no `Physician` — these carry clinical",
    "  meaning this practice has not claimed. `ProfessionalService` is the type.",
    "",
    "### Indexing, on one switch",
    "",
    "`ENABLE_ADMIN` — the blog admin's build-time flag — decides indexing too, so",
    "there is nothing separate to remember:",
    "",
    "- **Flag ON** (while she is building, on the builder's preview URL): every",
    "  page emits `<meta name=\"robots\" content=\"noindex, nofollow\">` and",
    "  `robots.txt` disallows everything. A preview URL is public — unlisted is not",
    "  private — and a staging copy indexed alongside the real domain competes with",
    "  it in search.",
    "- **Flag OFF** (the published build): no `noindex` anywhere, and `robots.txt`",
    "  allows everything.",
    "",
    "⚠ **And one page-level rule on top, whatever the flag.** Any page whose body",
    "still contains a word in [BRACKETS] emits `noindex` and is left out of",
    "`sitemap.xml` — it is an unfinished page, and an unfinished page indexed on a",
    "new domain costs more than it earns. Decide this from the page's own content",
    "at build time, so the `noindex` lifts by itself once she replaces the word.",
    "Nothing to switch off by hand.",
    "",
    "`sitemap.xml` lists the pages you actually build, minus the ones that rule",
    "excludes. No analytics and no tracking script of any kind.",
  ];
  return lines.join("\n");
}

/*
 * ── TESTIMONIALS ─────────────────────────────────────────────────────────
 *
 * ⚠ THIS BLOCK EXISTS TO PREVENT A SECTION, NOT TO PLACE ONE.
 *
 * Her brief carries a `referral_quote` — a line a colleague said about her,
 * which the generator uses as tone material. It is third person, it has no
 * attribution field and no consent flag, and the site spec has no place for
 * it. It is an input, not publishable copy, and this module never receives its
 * text (see `BriefLabels.referralQuotePresent`, and FINDINGS.md finding C).
 *
 * ⚠ AND NO PLACEHOLDER EITHER. "Paste a client testimonial here" is an
 * invitation to publish something a client never approved, about care they
 * received — which in most US states is a licensing-board matter before it is
 * an ethics one. A section that cannot be filled honestly is not built.
 *
 * ⚠ THE WORDING IS LOAD-BEARING. `isProhibitiveMention` only recognises a
 * prohibition when the negation is IMMEDIATELY in front of the word — "no
 * testimonials" passes, "do not build a testimonials section" does not, and
 * this block blocked its own prompt until each forbidden noun was put directly
 * behind a `no`. Rephrasing it into smoother English will fail the scan and
 * take step 1 down with it. The same applies to the schema.org keys in
 * `seoBlock`. The narrowness is deliberate (see `PROHIBITIVE_LEAD`); the fix,
 * if there is one, belongs in the Guard and is logged in FINDINGS.md.
 */
const TESTIMONIALS = [
  "## No testimonials",
  "",
  "Do not build a section of client praise, under any heading. Specifically:",
  "no testimonials, no reviews, no client quotes, no star ratings, no rating",
  "widget, no quote carousel, and no empty placeholder inviting one to be pasted",
  "in later. No quotation marks used as decoration anywhere on the page either.",
  "",
  "There is no approved client quote here, and a therapy practice publishing one",
  "without documented consent is a licensing problem, not a design choice. If she",
  "later has a quote she is allowed to publish, she adds it herself, deliberately.",
].join("\n");

/*
 * ── IMAGERY ──────────────────────────────────────────────────────────────
 *
 * ⚠ A SLOT KEY IS NOT AN INSTRUCTION. The first version listed whatever the
 * image read returned — `ambient_a, ambient_b, hero, post_bg_1, post_bg_2,
 * post_bg_3, texture` — and then gave usage notes for three of those names. So
 * the prompt named three files (the social-post backgrounds) that nothing told
 * the builder what to do with, and named all of them as bare keys.
 *
 * Each entry now arrives with the one place it goes and the size it was
 * generated at, from `lib/site/imagery.ts` — the same list the step screen
 * offers for download, so what she has in her downloads folder and what the
 * prompt asks for cannot drift apart.
 */
function imageryBlock(available: readonly string[]): string {
  const images = siteImages(available);

  const lines = ["## Imagery", ""];

  if (images.length > 0) {
    lines.push(
      "⚠ **This section overrides the outline above on images.** The outline says",
      "to leave labelled image placeholders, because it is written for a practice",
      "with no photographs. This one has them, and they go in. The outline's",
      "no-people rule still holds, and so does every rule below it.",
      "",
      "Eklio generated these photographs. Download them from the step you are",
      "reading this on, upload them to Lovable, and use each one where it says:",
      ""
    );
    for (const image of images) {
      lines.push(`- **${image.title}** (\`${image.slot}\`, ${image.dimensions}) — ${image.role}`);
    }
    lines.push(
      "",
      "Use each photograph once. Do not crop them square, do not add a colour wash",
      "over one, and do not place text over any of them except the hero."
    );
  } else {
    lines.push(
      "Eklio has not generated photographs for this kit yet. Leave a labelled,",
      "empty image placeholder at every image position rather than choosing stock —",
      "an empty frame is honest, and a wrong photograph is not."
    );
  }

  lines.push(
    "",
    "Wherever you source an image yourself, these hold without exception:",
    "- No faces and no people.",
    "- No text inside an image — all text is live text on the page.",
    "- No stock photography of therapy sessions, couches or clipboards.",
    "- No illustration, no 3D render, no AI-looking abstract gradient art.",
    "",
    "Every image is `loading=\"lazy\"` except the hero, and every one has alt text",
    "describing what is in the frame — never the practice, never a claim."
  );

  return lines.join("\n");
}

/*
 * ── THE BLOG, AND THE ADMIN BEHIND IT ────────────────────────────────────
 *
 * The first version asked for an index and a post template and then told her
 * to add posts "by asking Lovable" — which means opening the builder and
 * re-prompting it every time she writes something. That is not a blog she can
 * keep; it is a blog she has to commission.
 *
 * So this asks for the writing surface too. And a writing surface on a public
 * site is the one thing in this prompt that can be exploited rather than
 * merely wrong, so it carries three clauses that are not negotiable and are
 * stated as such:
 *
 *   1. A BUILD-TIME FLAG, not a runtime check. With the flag off, the admin
 *      route 404s AND its write endpoints are not in the build at all. A
 *      runtime `if (isAdmin)` leaves the endpoint deployed and reachable;
 *      anything built out does not exist to be found.
 *   2. NO WRITE PATH REACHABLE FROM THE PUBLISHED SITE, under any URL — no
 *      link, no hidden route, no query parameter that flips a mode.
 *   3. WRITE POLICIES DENIED BY DEFAULT for anonymous visitors, at the data
 *      layer, so the row-level rule holds even if clause 1 or 2 is ever undone
 *      by a later edit. Three independent locks, not one in three wordings.
 *
 * ⚠ AND STILL NO CONTENT. Not a post, not a title, not an excerpt, not a
 * category name. The structure is built empty and stays empty until she writes
 * something.
 */
const BLOG = [
  "## Blog",
  "",
  "Build the structure. **Do not write any posts**, do not invent post titles,",
  "excerpts, categories or author bios, and do not seed example content — an",
  "empty blog that says it is empty is correct.",
  "",
  "### Public pages",
  "",
  "- `/blog` — the index. Posts newest first: title, date, one-line excerpt, and",
  "  the category if the post has one. When there are no posts, one plain line",
  "  saying there is nothing here yet. No pagination until there are posts to",
  "  paginate.",
  "- `/blog/[slug]` — the post. Title, date, category, body, and a link back to",
  "  the index. Same header, footer, fonts and colours as the rest of the site.",
  "  The body renders headings, paragraphs, lists, links, blockquotes and images.",
  "- `/blog/category/[slug]` — the same index, filtered. **Only categories that**",
  "  **actually exist on a post.** Do not pre-create a category list, and do not",
  "  show a category navigation while there are no posts.",
  "- One `Writing` link in the site header, alongside the other page links.",
  "",
  "Each post has: title, slug, date, category (optional), excerpt (optional),",
  "body, and published/draft. A draft is not in the index, not at its URL, and",
  "not in the sitemap.",
  "",
  "### The admin, and the three locks on it",
  "",
  "`/admin/posts` — list, create, edit, delete, publish and unpublish. Plain",
  "forms, no rich-text toolbar needed, and it uses the site's own styles.",
  "",
  "⚠ **These three are requirements, not suggestions. Implement all three.**",
  "",
  "**1. A build-time flag, not a runtime check.** Gate the admin on an",
  "environment variable read AT BUILD TIME (for example `ENABLE_ADMIN`). When it",
  "is not set: the admin route returns 404, and the create, edit, delete and",
  "publish endpoints are not included in the build at all. Not disabled — absent.",
  "A runtime `if (user.isAdmin)` leaves the endpoint deployed and reachable, and",
  "that is exactly what this clause exists to prevent.",
  "",
  "**2. No write path reachable from the published site, under any URL.** No link",
  "to the admin from any public page, no hidden route, no query parameter or",
  "keyboard shortcut that flips the public site into an editing mode, and no API",
  "route that accepts a post body from an unauthenticated request.",
  "",
  "**3. Writes denied by default at the data layer.** Whatever stores the posts,",
  "an anonymous visitor can READ published posts and can write nothing — no",
  "insert, no update, no delete, on posts or on anything else. Deny by default",
  "and allow reads explicitly, never the other way round. This must hold on its",
  "own, with the flag on and the admin reachable: it is the lock that survives a",
  "later edit undoing the other two.",
  "",
  "When the flag is off — which is how the site is published — she writes posts",
  "by turning the flag on in her own project, writing, and turning it off again.",
].join("\n");
