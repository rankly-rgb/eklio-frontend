import { describe, expect, it } from "vitest";
import { buildLovablePrompt } from "@/lib/site/lovable";
import { checkEthics } from "@/lib/ethics/rules";
import type { SpecPage } from "@/lib/site/types";

/*
 * Le prompt Lovable : un ASSEMBLAGE, jamais une rédaction.
 *
 * Le corps vient de `site_spec_envelope` et traverse ce module tel quel. Ce
 * qui est testé ici, c'est ce que le module AJOUTE, et surtout ce qu'il refuse
 * d'ajouter.
 */

const CORE = [
  "Build a one-page website for a therapy private practice.",
  "## Design tokens",
  "Primary — fills, buttons, bands and borders: #B4674A",
  "Page background — the whole page sits on this: #FAF6EE",
  "Heading font: Fraunces",
  "Body font: Nunito Sans",
].join("\n");

const FULL = {
  core: CORE,
  practiceDetails: {
    practitionerName: "Nora Whitfield",
    licenseLabel: "LMFT",
    licenseNumber: "12345",
    city: "Portland",
    state: "OR",
  },
  practiceName: "Whitfield Therapy",
  bookingUrl: "https://example.com/book",
  toneWords: ["Slower", "Braver", "You"],
  wordmark: { label: "Wordmark (dark)", format: "svg" },
  imageSlots: ["hero", "ambient_a"],
  pages: [],
  brief: { sessionStyles: [], modalities: [], specialties: [], referralQuotePresent: false },
};

describe("le corps du prompt traverse intact", () => {
  it("le texte de la base est présent mot pour mot", () => {
    // S'il était reformaté, ce module serait devenu un second générateur.
    expect(buildLovablePrompt(FULL).text).toContain(CORE);
  });

  it("chaque hex et chaque police du corps s'y retrouvent", () => {
    const { text } = buildLovablePrompt(FULL);
    for (const token of ["#B4674A", "#FAF6EE", "Fraunces", "Nunito Sans"]) {
      expect(text, token).toContain(token);
    }
  });

  it("il dit que la structure vient de SA spec, pas d'un gabarit", () => {
    expect(buildLovablePrompt(FULL).text).toContain("comes from YOUR site spec");
  });
});

describe("⚠ un champ manquant devient un marqueur nommé, jamais un vide", () => {
  it("sans lien de réservation, [BOOKING_URL] et rien d'autre", () => {
    const result = buildLovablePrompt({ ...FULL, bookingUrl: null });
    expect(result.placeholders).toEqual(["BOOKING_URL"]);
    expect(result.text).toContain("[BOOKING_URL]");
    // Jamais un segment vide à la place.
    expect(result.text).not.toMatch(/Call-to-action link:\s*$/m);
  });

  it("sans practice details, les cinq champs sont marqués et LISTÉS en tête", () => {
    const result = buildLovablePrompt({ ...FULL, practiceDetails: null, bookingUrl: null });
    expect(result.placeholders).toEqual([
      "BOOKING_URL",
      "PRACTITIONER_NAME",
      "LICENSE_TYPE",
      "LICENSE_NUMBER",
      "CITY",
      "STATE",
    ]);
    // L'inventaire est en tête, avant le corps : elle doit le voir d'abord.
    const inventory = result.text.indexOf("Fill these in before you publish");
    expect(inventory).toBeGreaterThan(-1);
    expect(inventory).toBeLessThan(result.text.indexOf(CORE));
    for (const token of result.placeholders) {
      expect(result.text).toContain(`[${token}]`);
    }
  });

  it("tout rempli : aucun marqueur, et pas de section d'inventaire", () => {
    const result = buildLovablePrompt(FULL);
    expect(result.placeholders).toEqual([]);
    expect(result.text).not.toContain("Fill these in before you publish");
    expect(result.text).not.toMatch(/\[[A-Z_]{3,}\]/);
  });

  it("un champ blanc compte comme manquant, pas comme rempli", () => {
    const result = buildLovablePrompt({
      ...FULL,
      practiceDetails: { ...FULL.practiceDetails, city: "   " },
    });
    expect(result.placeholders).toEqual(["CITY"]);
  });
});

describe("⚠ ce que le prompt refuse de demander", () => {
  it("les honoraires et la ligne de crise sont OMIS, et nommés comme tels", () => {
    const { text, omitted } = buildLovablePrompt(FULL);
    expect(omitted).toContain("Fees, sliding scale and insurance");
    expect(omitted).toContain("Crisis-line and emergency footer");
    expect(text).toContain("## Do not build these");
  });

  it("aucun marqueur n'invite à rédiger du texte légal", () => {
    // Un [CRISIS_LINE] serait une invitation à l'écrire seule.
    const { text } = buildLovablePrompt({ ...FULL, practiceDetails: null, bookingUrl: null });
    expect(text).not.toMatch(/\[(CRISIS|FEE|INSURANCE|SLIDING)[A-Z_]*\]/);
  });

  it("aucun visage, aucune personne, aucun texte dans les images", () => {
    const { text } = buildLovablePrompt(FULL);
    expect(text).toContain("No faces and no people.");
    expect(text).toContain("No text inside an image");
  });

  it("le contraste AA est EXIGÉ, pas laissé au constructeur", () => {
    expect(buildLovablePrompt(FULL).text).toContain("WCAG 2.1 AA");
    expect(buildLovablePrompt(FULL).text).toContain("Do not rely on the builder's defaults");
  });
});

describe("le blog est une structure, pas du contenu", () => {
  it("un index, un gabarit d'article, et comment en ajouter un", () => {
    const { text } = buildLovablePrompt(FULL);
    expect(text).toContain("/blog");
    expect(text).toContain("/blog/[slug]");
    expect(text).toContain("Do not write any posts");
    expect(text).toContain("To add a post afterwards in Lovable");
  });
});

describe("la marque et les images", () => {
  it("le wordmark est nommé avec son format quand il existe", () => {
    expect(buildLovablePrompt(FULL).text).toContain("Wordmark (dark) file (SVG)");
  });

  it("sans wordmark, le nom en police de titre — pas un trou", () => {
    const { text } = buildLovablePrompt({ ...FULL, wordmark: null });
    expect(text).toContain("set the practice name in the heading font");
  });

  it("les mots de ton ne doivent PAS être imprimés sur la page", () => {
    expect(buildLovablePrompt(FULL).text).toContain("do not print them anywhere");
  });

  it("sans photographies, on laisse des emplacements — jamais du stock", () => {
    const { text } = buildLovablePrompt({ ...FULL, imageSlots: [] });
    expect(text).toContain("Leave labelled image placeholders");
    expect(text).toContain("rather than choosing stock");
  });
});

describe("⚠ le scan déontologique tourne AVANT l'affichage", () => {
  it("le prompt assemblé est scanné et le résultat accompagne le texte", () => {
    const result = buildLovablePrompt(FULL);
    expect(result.scan).toBeDefined();
    expect(typeof result.scan.ok).toBe("boolean");
    expect(Array.isArray(result.scan.violations)).toBe(true);
  });

  it("le prompt tel qu'assemblé passe", () => {
    expect(buildLovablePrompt(FULL).scan.ok).toBe(true);
  });

  it("⚠ le canari : ce que l'ASSEMBLAGE ajoute est bien scanné", () => {
    /*
     * C'est là que porte la garde. Le noyau est la référence ; tout ce que ce
     * module compose par-dessus passe au scan pour la première fois. Si ceci
     * passait, le scan ne regarderait rien du tout.
     */
    const result = buildLovablePrompt({
      ...FULL,
      wordmark: { label: "A proven method that resolves trauma", format: "svg" },
    });
    expect(result.scan.ok).toBe(false);
    expect(result.scan.violations.length).toBeGreaterThan(0);
  });

  it("⚠ et une violation du NOYAU reste au noyau — elle ne bloque pas l'étape", () => {
    /*
     * Contrepartie assumée, et elle doit être dite : la copie approuvée vit
     * DANS le noyau, et le noyau est la référence. Elle est scannée en amont
     * par la garde au moment où elle est générée (`ethics_check` sur le kit) ;
     * ce re-scan-ci couvre l'assemblage, pas elle. FINDINGS le note.
     */
    const result = buildLovablePrompt({
      ...FULL,
      core: `${CORE}\nA proven method that cures anxiety for good.`,
    });
    expect(result.scan.ok).toBe(true);
  });

  it("⚠ les interdictions CITÉES par le prompt ne comptent pas contre lui", () => {
    /*
     * Le prompt de la base cite les phrases qu'il interdit. `checkEthics` les
     * lit comme des violations — quatre, bloquantes, identiques pour chaque
     * kit. Bloquer là-dessus masquerait le prompt pour TOUT LE MONDE et
     * livrerait l'étape morte. Le noyau est donc la référence, et seul ce que
     * l'assemblage ajoute est retenu.
     */
    const quoting = [
      CORE,
      "## Voice",
      'Never write:',
      '- "A proven method that resolves trauma for good."',
      '- "Clients often tell me they finally feel free."',
      "- Do not invent testimonials, client quotes, statistics, credentials or awards.",
    ].join("\n");

    // Le noyau seul déclencherait la garde…
    expect(checkEthics(quoting).ok).toBe(false);
    // …et pourtant le prompt assemblé passe, parce que rien de neuf n'a été ajouté.
    expect(buildLovablePrompt({ ...FULL, core: quoting }).scan.ok).toBe(true);
  });
});

/*
 * ── LE BLOC DE CORRECTION ────────────────────────────────────────────────
 *
 * Le corps vient de la base et garde son plan, titres vides compris. Ce que le
 * module ajoute après lui doit donc dire deux choses sans ambiguïté : lequel
 * des deux fait foi, et ce qu'on fait de chaque section vide.
 */
const HER_PAGES: SpecPage[] = [
  {
    key: "about",
    label: "About",
    enabled: true,
    sections: [
      { key: "a1", type: "approach", order: 1, enabled: true, fields: { heading: "How I work", body: "" } },
      { key: "a2", type: "credentials", order: 2, enabled: true, fields: { heading: "Training and licensure", items: [] } },
    ],
  },
  {
    key: "services",
    label: "Services",
    enabled: true,
    sections: [
      { key: "s1", type: "services", order: 1, enabled: true, fields: { heading: "Services", items: [] } },
      { key: "s2", type: "fees", order: 2, enabled: true, fields: { heading: "Fees", items: [] } },
      { key: "s3", type: "faq", order: 3, enabled: true, fields: { heading: "Common questions", items: [] } },
    ],
  },
];

const HER_BRIEF = {
  sessionStyles: ["I ask a lot of questions"],
  modalities: [
    { label: "CBT", fullName: "CBT — Cognitive Behavioral Therapy" },
    { label: "EMDR", fullName: "EMDR — Eye Movement Desensitization and Reprocessing" },
  ],
  specialties: ["Self-esteem"],
  referralQuotePresent: true,
};

const WITH_SPEC = { ...FULL, pages: HER_PAGES, brief: HER_BRIEF };

describe("les sections vides", () => {
  it("le bloc arrive APRÈS le corps et dit qu'il fait foi", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text.indexOf("## Sections: corrections")).toBeGreaterThan(text.indexOf(CORE));
    expect(text).toContain("THIS BLOCK WINS");
  });

  it("les réponses du brief arrivent sous leur section, mot pour mot", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("**About → How I work**");
    expect(text).toContain("- I ask a lot of questions");
    expect(text).toContain("- CBT — Cognitive Behavioral Therapy");
  });

  it("⚠ ce qui n'a pas de texte approuvé est omis, pas laissé vide", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    const omitted = text.slice(text.indexOf("### Sections to leave out"));
    expect(omitted).toContain("Services → Common questions");
    expect(omitted).toContain("Services → Fees");
    expect(omitted).toContain("no lorem, no invented copy");
  });

  it("sans spec lisible, aucun bloc de correction n'est inventé", () => {
    expect(buildLovablePrompt(FULL).text).not.toContain("## Sections: corrections");
  });

  it("⚠ le scan tourne sur le tout, y compris ce bloc", () => {
    expect(buildLovablePrompt(WITH_SPEC).scan.ok).toBe(true);
  });
});

/*
 * ── LA COMPOSITION ───────────────────────────────────────────────────────
 *
 * Le premier prompt disait QUOI mettre sur la page et rien sur la façon dont
 * ça devait s'y poser : le constructeur a donc appliqué son style maison. Ces
 * règles sont déterministes — mêmes entrées, même page — et aucune n'est du
 * texte qui finit à l'écran.
 */
describe("les instructions de composition", () => {
  it("elles sont là, et elles sont les mêmes pour tout le monde", () => {
    const a = buildLovablePrompt(WITH_SPEC).text;
    const b = buildLovablePrompt({ ...WITH_SPEC, toneWords: ["Other", "Words", "Here"] }).text;
    const block = (text: string) => text.slice(text.indexOf("## Composition"));
    expect(a).toContain("## Composition");
    expect(block(a).split("---")[0]).toEqual(block(b).split("---")[0]);
  });

  it("une page d'accueil qui défile, un seul bandeau pleine largeur, un héros à 90vh", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("90vh");
    expect(text).toContain("**One full-bleed band, and only one.**");
    expect(text).toContain("no section is behind a tab");
  });

  it("la retenue est nommée, pas suggérée", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    for (const banned of ["No gradients", "glassmorphism", "animated counters"]) {
      expect(text, banned).toContain(banned);
    }
    expect(text).toContain("prefers-reduced-motion");
  });

  it("⚠ aucune ligne de composition n'est une phrase à imprimer", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    const block = text.slice(text.indexOf("## Composition")).split("\n---\n")[0];
    expect(block).toContain("These are layout rules, not content.");
  });
});

/*
 * ── UNE PAGE PAR APPROCHE ────────────────────────────────────────────────
 *
 * Structure seulement. Le texte de ces pages n'existe pas encore, et un
 * constructeur qui décrirait l'EMDR lui-même écrirait une allégation clinique
 * en son nom.
 */
describe("les pages d'approche", () => {
  it("une page et une entrée de menu par approche, avec ses noms à elle", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("/approaches/cbt");
    expect(text).toContain("/approaches/emdr");
    expect(text).toContain("EMDR — Eye Movement Desensitization and Reprocessing");
    expect(text).toContain("`Approaches` item to the header");
  });

  it("⚠ le corps de ces pages reste vide et marqué, jamais rédigé", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("[YOUR DESCRIPTION OF THIS APPROACH]");
    expect(text).toContain("Do not describe the approach yourself");
    expect(text).toContain("do not state what it treats");
  });

  it("une seule approche : ni pages ni menu déroulant", () => {
    const one = { ...HER_BRIEF, modalities: [HER_BRIEF.modalities[0]] };
    const { text } = buildLovablePrompt({ ...WITH_SPEC, brief: one });
    expect(text).not.toContain("## A page for each approach");
    expect(text).not.toContain("/approaches/");
  });

  it("aucune approche : rien non plus", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, brief: { ...HER_BRIEF, modalities: [] } });
    expect(text).not.toContain("## A page for each approach");
  });

  it("le menu déroulant est utilisable au clavier", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("closes on Escape");
    expect(text).toContain("reachable with the Tab key");
  });
});

/*
 * ── SEO ET DONNÉES STRUCTURÉES ───────────────────────────────────────────
 *
 * Le danger d'un bloc JSON-LD, c'est que le schéma appelle des champs que
 * personne ne détient : horaires, fourchette de prix, note moyenne. Publiés,
 * ce sont des affirmations lisibles par machine sur une professionnelle
 * agréée.
 */
describe("le bloc SEO", () => {
  it("le titre et le JSON-LD ne portent que des valeurs stockées", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("Whitfield Therapy — LMFT in Portland, OR");
    expect(text).toContain('"@type": "ProfessionalService"');
    expect(text).toContain('"addressLocality": "Portland"');
    expect(text).toContain('"honorificSuffix": "LMFT"');
  });

  it("⚠ aucun champ inventé n'est autorisé, chacun nommé par sa clé", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    for (const key of [
      "openingHours",
      "priceRange",
      "aggregateRating",
      "ratingValue",
      "reviewCount",
      "streetAddress",
      "geo",
      "MedicalBusiness",
    ]) {
      // Chaque clé doit être collée à une négation — c'est ce que le garde lit.
      expect(text, key).toMatch(new RegExp(`\\bno \`${key}\``, "i"));
    }
  });

  it("⚠ un marqueur non rempli fait SUPPRIMER la propriété, jamais deviner", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, practiceDetails: null });
    expect(text).toContain("delete that**");
    expect(text).toContain("Never substitute a guess.");
  });

  it("les descriptions ne sont pas rédigées : elles sont prises sur la page", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("**Do not write meta descriptions.**");
    expect(text).toContain("no meta description tag at all");
  });

  it("ses spécialités passent en knowsAbout, telles quelles", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain('"knowsAbout": ["Self-esteem"]');
  });

  it("sans spécialité, la propriété disparaît au lieu de valoir []", () => {
    const brief = { ...HER_BRIEF, specialties: [] };
    expect(buildLovablePrompt({ ...WITH_SPEC, brief }).text).not.toContain("knowsAbout");
  });

  it("aucun script de mesure n'est demandé", () => {
    expect(buildLovablePrompt(WITH_SPEC).text).toContain(
      "no analytics or tracking script of any kind"
    );
  });
});

/*
 * ── LES TÉMOIGNAGES ──────────────────────────────────────────────────────
 *
 * La citation de renvoi existe dans son brief, mais c'est une ENTRÉE de
 * génération : troisième personne, sans attribution et sans consentement. Ce
 * module n'en reçoit jamais le texte — seulement un booléen.
 */
describe("la règle des témoignages", () => {
  it("la section est interdite, y compris comme emplacement vide", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("## No testimonials");
    expect(text).toContain("no empty placeholder inviting one to be pasted");
  });

  it("⚠ la règle ne change pas selon que la citation existe ou non", () => {
    const without = { ...HER_BRIEF, referralQuotePresent: false };
    const a = buildLovablePrompt(WITH_SPEC).text;
    const b = buildLovablePrompt({ ...WITH_SPEC, brief: without }).text;
    const block = (t: string) => t.slice(t.indexOf("## No testimonials")).split("\n---\n")[0];
    expect(block(a)).toEqual(block(b));
  });

  it("⚠ le texte de la citation n'est pas dans l'entrée du module, donc jamais dans la sortie", () => {
    // `BriefLabels` ne porte qu'un booléen : il n'y a rien à fuiter.
    expect(Object.keys(HER_BRIEF)).not.toContain("referralQuote");
    expect(buildLovablePrompt(WITH_SPEC).text).not.toContain("colleague would say");
  });

  it("⚠ le prompt assemblé passe le garde déontologique", () => {
    expect(buildLovablePrompt(WITH_SPEC).scan.ok).toBe(true);
    expect(buildLovablePrompt(WITH_SPEC).scan.violations).toEqual([]);
  });
});
