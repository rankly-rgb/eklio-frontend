import type { SiteSpecEnvelope } from "@/lib/site/types";

/*
 * L'enveloppe du §2 du FRONTEND_CONTRACT — capturée sur un kit CLAY & SAND
 * réel, pas écrite à la main.
 *
 * Elle est reprise TELLE QUELLE, y compris ses aspérités, parce que ce sont
 * elles qui font les tests :
 *   - les sept paires de contraste passent toutes, donc tous les
 *     `suggested_fix` y sont `null` — la forme non nulle est construite à
 *     part, dans le test qui en a besoin ;
 *   - la page Services porte `order` `[1, 2, 4]` dans `preview` : la section
 *     `faq` est désactivée et rien n'est renuméroté. C'est le cas qui casse
 *     tout code qui prendrait `order` pour un index ;
 *   - `diff.stale` est vrai, parce que `last_copied_spec_version` (3) est
 *     resté derrière `spec_version` (4) ;
 *   - `extra_instructions` est renseigné et n'apparaît NULLE PART dans
 *     `preview`.
 */

const FOOTER = "Elm & Ember Therapy, PLLC. Licensed in Oregon.";
const INTRO =
  "I work mostly with professionals who look fine from the outside. Much of that work sits with anxiety and burnout.";

export const CLAY_AND_SAND: SiteSpecEnvelope = {
  etag: "710df92493419592f4dfcadf647887bb",
  diff: {
    stale: true,
    changes: [{ area: "copy", label: "About text edited" }],
  },
  spec: {
    brand_kit_id: "33333333-3333-3333-3333-333333333333",
    spec_version: 4,
    last_copied_spec_version: 3,
    updated_at: "2026-08-29T11:10:39.838112+00:00",
    target: "squarespace",
    primary: "#B4674A",
    secondary: "#C08A3E",
    accent: "#6E3320",
    paper: "#FAF6EE",
    light_neutral: "#F4EEE3",
    dark_neutral: "#2B2A27",
    heading_font: "Fraunces",
    body_font: "Nunito Sans",
    type_pairing_id: "fraunces_nunito",
    google_fonts_url:
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Nunito+Sans:wght@400;600;700&display=swap",
    hero: {
      overline: "LCSW · PORTLAND, OR",
      headline: "A calmer place to start.",
      subhead: "Therapy for adults who hold it together.",
      cta_label: "Book a consult",
      cta_target_url: "https://elmandember.clientsecure.me/book",
    },
    about_excerpt: INTRO,
    extra_instructions:
      "Please keep the fee off the home page. Tuesday and Thursday are the only hours open right now.",
    seed_clamped: null,
    practice_details: {
      practice_name: "Elm & Ember Therapy",
      license_label: "LCSW",
      license_number: "LC61234",
      city: "Portland",
      state: "OR",
      email: "hello@elmandember.com",
      phone: "(503) 555-0123",
    },
    pages: [
      {
        key: "home",
        label: "Home",
        enabled: true,
        sections: [
          { key: "hero", type: "hero", order: 1, fields: {}, enabled: true },
          { key: "intro", type: "intro", order: 2, fields: {}, enabled: true },
          {
            key: "specialties",
            type: "specialties",
            order: 3,
            fields: {
              heading: "What I work with",
              items: ["Anxiety", "Burnout", "Life transitions"],
            },
            enabled: true,
          },
          {
            key: "who_i_work_with",
            type: "who_i_work_with",
            order: 4,
            fields: {
              heading: "Who I work with",
              items: [
                "Professionals who look fine from the outside",
                "Adults carrying something from years back",
              ],
            },
            enabled: true,
          },
          {
            key: "contact",
            type: "contact",
            order: 5,
            fields: {
              heading: "Get in touch",
              body: "A consult is fifteen minutes on the phone, at no charge.",
            },
            enabled: true,
          },
          {
            key: "footer",
            type: "footer",
            order: 6,
            fields: { body: FOOTER },
            enabled: true,
          },
        ],
      },
      {
        key: "about",
        label: "About",
        enabled: true,
        sections: [
          { key: "intro", type: "intro", order: 1, fields: {}, enabled: true },
          {
            key: "approach",
            type: "approach",
            order: 2,
            fields: {
              heading: "How I work",
              body: "Sessions are fifty minutes, weekly to start. You set the pace.",
            },
            enabled: true,
          },
          {
            key: "credentials",
            type: "credentials",
            order: 3,
            fields: {
              heading: "Training and licensure",
              items: [
                "Licensed Clinical Social Worker, Oregon #LC61234",
                "MSW, Portland State University",
              ],
            },
            enabled: true,
          },
          {
            key: "footer",
            type: "footer",
            order: 4,
            fields: { body: FOOTER },
            enabled: true,
          },
        ],
      },
      {
        key: "services",
        label: "Services",
        enabled: true,
        sections: [
          {
            key: "services",
            type: "services",
            order: 1,
            fields: {
              heading: "Services",
              body: "Individual therapy for adults, in person and by video in Oregon.",
              items: ["Individual therapy, 50 minutes, weekly"],
            },
            enabled: true,
          },
          {
            key: "fees",
            type: "fees",
            order: 2,
            fields: {
              heading: "Fees",
              body: "Out of network, with a monthly superbill.",
              items: ["$185 per 50-minute session"],
            },
            enabled: true,
          },
          {
            key: "faq",
            type: "faq",
            order: 3,
            fields: { heading: "Common questions", items: [] },
            /* Désactivée — et c'est elle qui fait le trou dans `order`. */
            enabled: false,
          },
          {
            key: "footer",
            type: "footer",
            order: 4,
            fields: { body: FOOTER },
            enabled: true,
          },
        ],
      },
      {
        key: "contact",
        label: "Contact",
        enabled: true,
        sections: [
          {
            key: "contact",
            type: "contact",
            order: 1,
            fields: {
              heading: "Get in touch",
              body: "The fastest way to reach me is the booking link.",
            },
            enabled: true,
          },
          {
            key: "footer",
            type: "footer",
            order: 2,
            fields: { body: FOOTER },
            enabled: true,
          },
        ],
      },
    ],
  },
  preview: {
    practice_name: "Elm & Ember Therapy",
    tokens: {
      primary: "#B4674A",
      secondary: "#C08A3E",
      accent: "#6E3320",
      paper: "#FAF6EE",
      light_neutral: "#F4EEE3",
      dark_neutral: "#2B2A27",
      primary_text: "#A35D43",
      secondary_text: "#92692F",
      /* Identique à `accent` : cet accent lit déjà comme texte. Dix des dix-huit
         couleurs livrées sont dans ce cas — la variante n'est pas toujours
         différente. */
      accent_text: "#6E3320",
      cta_ink: "#10100F",
      heading_font: "Fraunces",
      body_font: "Nunito Sans",
      google_fonts_url:
        "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Nunito+Sans:wght@400;600;700&display=swap",
    },
    pages: [
      {
        key: "home",
        label: "Home",
        sections: [
          {
            key: "hero",
            type: "hero",
            order: 1,
            fields: {
              overline: "LCSW · PORTLAND, OR",
              headline: "A calmer place to start.",
              subhead: "Therapy for adults who hold it together.",
              cta_label: "Book a consult",
              cta_target_url: "https://elmandember.clientsecure.me/book",
            },
          },
          { key: "intro", type: "intro", order: 2, fields: { body: INTRO } },
          {
            key: "specialties",
            type: "specialties",
            order: 3,
            fields: {
              heading: "What I work with",
              items: ["Anxiety", "Burnout", "Life transitions"],
            },
          },
          {
            key: "who_i_work_with",
            type: "who_i_work_with",
            order: 4,
            fields: {
              heading: "Who I work with",
              items: [
                "Professionals who look fine from the outside",
                "Adults carrying something from years back",
              ],
            },
          },
          {
            key: "contact",
            type: "contact",
            order: 5,
            fields: {
              heading: "Get in touch",
              body: "A consult is fifteen minutes on the phone, at no charge.",
            },
          },
          { key: "footer", type: "footer", order: 6, fields: { body: FOOTER } },
        ],
      },
      {
        key: "about",
        label: "About",
        sections: [
          { key: "intro", type: "intro", order: 1, fields: { body: INTRO } },
          {
            key: "approach",
            type: "approach",
            order: 2,
            fields: {
              heading: "How I work",
              body: "Sessions are fifty minutes, weekly to start. You set the pace.",
            },
          },
          {
            key: "credentials",
            type: "credentials",
            order: 3,
            fields: {
              heading: "Training and licensure",
              items: [
                "Licensed Clinical Social Worker, Oregon #LC61234",
                "MSW, Portland State University",
              ],
            },
          },
          { key: "footer", type: "footer", order: 4, fields: { body: FOOTER } },
        ],
      },
      {
        key: "services",
        label: "Services",
        sections: [
          {
            key: "services",
            type: "services",
            order: 1,
            fields: {
              heading: "Services",
              body: "Individual therapy for adults, in person and by video in Oregon.",
              items: ["Individual therapy, 50 minutes, weekly"],
            },
          },
          {
            key: "fees",
            type: "fees",
            order: 2,
            fields: {
              heading: "Fees",
              body: "Out of network, with a monthly superbill.",
              items: ["$185 per 50-minute session"],
            },
          },
          /* `faq` absente, `footer` reste à 4 : `[1, 2, 4]`. */
          { key: "footer", type: "footer", order: 4, fields: { body: FOOTER } },
        ],
      },
      {
        key: "contact",
        label: "Contact",
        sections: [
          {
            key: "contact",
            type: "contact",
            order: 1,
            fields: {
              heading: "Get in touch",
              body: "The fastest way to reach me is the booking link.",
            },
          },
          { key: "footer", type: "footer", order: 2, fields: { body: FOOTER } },
        ],
      },
    ],
  },
  contrast: {
    passes_aa: true,
    worst_ratio: 4.51,
    pairs: [
      {
        pair_id: "cta_label_on_primary",
        label: "Button label on your primary color",
        bg: "#B4674A",
        fg: "#10100F",
        ratio: 4.51,
        level: "AA",
        suggested_fix: null,
      },
      {
        pair_id: "dark_neutral_on_paper",
        label: "Body text on the page",
        bg: "#FAF6EE",
        fg: "#2B2A27",
        ratio: 13.31,
        level: "AAA",
        suggested_fix: null,
      },
      {
        pair_id: "primary_on_paper",
        label: "Primary color as text on the page",
        bg: "#FAF6EE",
        fg: "#A35D43",
        ratio: 4.63,
        level: "AA",
        suggested_fix: null,
      },
      {
        pair_id: "secondary_on_paper",
        label: "Secondary color as text on the page",
        bg: "#FAF6EE",
        fg: "#92692F",
        ratio: 4.55,
        level: "AA",
        suggested_fix: null,
      },
      {
        pair_id: "accent_on_paper",
        label: "Accent color as text on the page",
        bg: "#FAF6EE",
        fg: "#6E3320",
        ratio: 9.03,
        level: "AAA",
        suggested_fix: null,
      },
      {
        pair_id: "dark_neutral_on_light_neutral",
        label: "Body text on a tinted section",
        bg: "#F4EEE3",
        fg: "#2B2A27",
        ratio: 12.43,
        level: "AAA",
        suggested_fix: null,
      },
      {
        pair_id: "paper_on_dark_neutral",
        label: "Light text on a dark section",
        bg: "#2B2A27",
        fg: "#FAF6EE",
        ratio: 13.31,
        level: "AAA",
        suggested_fix: null,
      },
    ],
  },
  output: {
    kind: "setup_sheet",
    steps: [
      {
        n: 1,
        title: "Start from the right template",
        body: "Pick a template that is already close to the structure below. You will delete more than you add.",
        values: [],
        builder_hint:
          "Start from a one-page portfolio or personal template, then delete the sections you do not need.",
      },
      {
        n: 2,
        title: "Set your six colors",
        body: "Enter each hex exactly as written and give it the role named next to it.",
        values: [
          { kind: "hex", label: "Primary — fills, buttons, bands and borders", value: "#B4674A" },
          { kind: "hex", label: "Secondary — supporting surfaces and fills", value: "#C08A3E" },
          { kind: "hex", label: "Accent — small marks, rules and selected states", value: "#6E3320" },
          { kind: "hex", label: "Page background — the whole page sits on this", value: "#FAF6EE" },
          { kind: "hex", label: "Section background — tinted bands and cards only", value: "#F4EEE3" },
          { kind: "hex", label: "Dark neutral — body text", value: "#2B2A27" },
        ],
        builder_hint: "Site Styles › Colors",
      },
      {
        n: 3,
        title: "Add the text versions of those three colors",
        body: "These are the same three brand colors, darkened just enough to be readable as text on your page background.",
        values: [
          { kind: "hex", label: "Primary as text — headings and links on the page", value: "#A35D43" },
          { kind: "hex", label: "Secondary as text — supporting headings on the page", value: "#92692F" },
          { kind: "hex", label: "Accent as text — small highlighted words", value: "#6E3320" },
        ],
        builder_hint: "Site Styles › Colors",
      },
      {
        n: 4,
        title: "Set your fonts",
        body: "Both faces are on Google Fonts.",
        values: [
          { kind: "font", label: "Heading font", value: "Fraunces" },
          { kind: "font", label: "Body font", value: "Nunito Sans" },
          {
            kind: "url",
            label: "Google Fonts stylesheet",
            value:
              "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Nunito+Sans:wght@400;600;700&display=swap",
          },
        ],
        builder_hint: "Site Styles › Fonts",
      },
      {
        n: 5,
        title: "Build the pages and sections in this order",
        body: "Add each page, then each section inside it, top to bottom.",
        values: [],
        builder_hint: "Pages › Edit › Add Section",
      },
      {
        n: 6,
        title: "Paste your copy",
        body: "Every string your site needs is listed below this sheet, one block per field.",
        values: [],
        builder_hint: null,
      },
      {
        n: 7,
        title: "Point the button at your booking link",
        body: "Set every call-to-action button to this link.",
        values: [
          { kind: "text", label: "Button label", value: "Book a consult" },
          {
            kind: "url",
            label: "Button links to",
            value: "https://elmandember.clientsecure.me/book",
          },
          { kind: "hex", label: "Button label color", value: "#10100F" },
          {
            kind: "text",
            label: "Smallest the label may be set",
            value: "18px bold, or 24px if it is not bold",
          },
        ],
        builder_hint: null,
      },
      {
        n: 8,
        title: "Before you publish",
        body: "[ ] Use the provided copy exactly as written.\n[ ] Do not invent testimonials, client quotes, statistics, credentials or awards.\n[ ] Maintain WCAG AA text contrast.",
        values: [],
        builder_hint: null,
      },
      {
        n: 9,
        title: "Your own notes",
        body: "Please keep the fee off the home page. Tuesday and Thursday are the only hours open right now.",
        values: [],
        builder_hint: null,
      },
    ],
    copy_blocks: [
      { page: "Home", section: "Hero", label: "Overline", text: "LCSW · PORTLAND, OR" },
      { page: "Home", section: "Hero", label: "Headline", text: "A calmer place to start." },
      { page: "Home", section: "Introduction", label: "Paragraph", text: INTRO },
      { page: "About", section: "Introduction", label: "Paragraph", text: INTRO },
      { page: "Contact", section: "Footer", label: "Footer note", text: FOOTER },
    ],
  },
};

/** Une copie profonde — pour un test qui a besoin de muter sans contaminer. */
export function clayAndSand(): SiteSpecEnvelope {
  return structuredClone(CLAY_AND_SAND);
}
