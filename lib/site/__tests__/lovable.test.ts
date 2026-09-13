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

  it("tout rempli : aucun marqueur, et aucune ligne d'inventaire", () => {
    const result = buildLovablePrompt(FULL);
    expect(result.placeholders).toEqual([]);
    // Le mot « [BRACKETS] » de la règle elle-même n'est pas un marqueur.
    expect(result.text.replace(/\[BRACKETS\]/g, "")).not.toMatch(/\[[A-Z_]{3,}\]/);
    // L'inventaire lui-même disparaît ; la section demeure pour l'avertissement.
    expect(result.text).not.toContain("so they appear in the prompt in brackets");
  });

  /*
   * ⚠ LA SECTION RESTE MÊME QUAND IL N'Y A RIEN À REMPLIR.
   *
   * Le lien de prévisualisation est public — non listé, pas protégé — et
   * l'admin du blog y est atteignable pendant qu'elle travaille. Ça ne dépend
   * d'aucun champ manquant, donc ça ne peut pas dépendre de `emitted`.
   */
  it("l'avertissement sur le lien de prévisualisation est toujours là", () => {
    for (const input of [FULL, { ...FULL, practiceDetails: null, bookingUrl: null }]) {
      const { text } = buildLovablePrompt(input);
      expect(text).toContain("## Fill these in before you publish");
      expect(text).toContain("Your preview link is a public link.");
      expect(text).toContain("It is unlisted, not private");
    }
  });

  it("une page par approche apporte SON marqueur à l'inventaire", () => {
    const result = buildLovablePrompt({ ...FULL, brief: HER_BRIEF });
    expect(result.placeholders).toContain("YOUR DESCRIPTION OF THIS APPROACH");
    // Listé en tête, pas seulement présent au milieu du prompt.
    const inventory = result.text.slice(
      result.text.indexOf("## Fill these in before you publish")
    );
    expect(inventory.indexOf("YOUR DESCRIPTION OF THIS APPROACH")).toBeGreaterThan(-1);
    expect(result.text.indexOf("## Fill these in")).toBeLessThan(
      result.text.indexOf("## A page for each approach")
    );
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

/*
 * ── LE BLOG ET SON ADMIN ─────────────────────────────────────────────────
 *
 * La première version demandait un index et un gabarit, puis lui disait
 * d'ajouter un article « en le demandant à Lovable » : un blog qu'il faut
 * commander à chaque fois, pas un blog qu'elle tient. Une surface d'écriture
 * sur un site public est aussi la seule chose de ce prompt qui puisse être
 * exploitée plutôt que simplement fausse — d'où trois verrous indépendants.
 */
describe("le blog est une structure, pas du contenu", () => {
  it("un index, un gabarit, des catégories, un lien de navigation", () => {
    const { text } = buildLovablePrompt(FULL);
    expect(text).toContain("`/blog`");
    expect(text).toContain("`/blog/[slug]`");
    expect(text).toContain("`/blog/category/[slug]`");
    expect(text).toContain("One `Writing` link in the site header");
  });

  it("⚠ aucun contenu : ni article, ni titre, ni catégorie inventée", () => {
    const { text } = buildLovablePrompt(FULL);
    expect(text).toContain("**Do not write any posts**");
    expect(text).toContain("do not seed example content");
    expect(text).toContain("**Only categories that**");
  });

  it("un brouillon n'existe nulle part — ni index, ni URL, ni sitemap", () => {
    expect(buildLovablePrompt(FULL).text).toContain(
      "A draft is not in the index, not at its URL, and"
    );
  });

  it("⚠ verrou 1 : un drapeau AU BUILD, pas un test à l'exécution", () => {
    const { text } = buildLovablePrompt(FULL);
    expect(text).toContain("build-time flag, not a runtime check");
    expect(text).toContain("the admin route returns 404");
    expect(text).toContain("are not included in the build at all");
    expect(text).toContain("Not disabled — absent.");
  });

  it("⚠ verrou 2 : aucun chemin d'écriture atteignable depuis le site publié", () => {
    const { text } = buildLovablePrompt(FULL);
    expect(text).toContain("No write path reachable from the published site, under any URL");
    expect(text).toContain("no hidden route");
    expect(text).toContain("accepts a post body from an unauthenticated request");
  });

  it("⚠ verrou 3 : refus par défaut au niveau des données", () => {
    const { text } = buildLovablePrompt(FULL);
    expect(text).toContain("Writes denied by default at the data layer");
    expect(text).toContain("Deny by default");
    expect(text).toContain("survives a");
  });

  it("⚠ les trois sont exigés ensemble, pas au choix", () => {
    expect(buildLovablePrompt(FULL).text).toContain(
      "These three are requirements, not suggestions. Implement all three."
    );
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
    expect(text).toContain("empty image placeholder at every image position");
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
      "No analytics and no tracking script of any kind"
    );
  });

  /*
   * ── L'INDEXATION SUIT LE DRAPEAU ─────────────────────────────────────
   *
   * Son lien de prévisualisation est public. Un site de recette indexé à côté
   * du vrai domaine lui fait concurrence dans les résultats, et sur un domaine
   * neuf ça coûte. Un seul interrupteur, deux conséquences.
   */
  it("drapeau allumé : noindex partout et robots.txt qui interdit tout", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("`ENABLE_ADMIN` — the blog admin's build-time flag — decides indexing");
    expect(text).toContain('content="noindex, nofollow"');
    expect(text).toContain("`robots.txt` disallows everything");
  });

  it("drapeau éteint : plus de noindex, robots.txt ouvert", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("**Flag OFF** (the published build): no `noindex` anywhere");
  });

  it("⚠ une page qui porte encore un marqueur n'est ni indexée ni au sitemap", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("still contains a word in [BRACKETS] emits `noindex`");
    expect(text).toContain("left out of");
    expect(text).toContain("`sitemap.xml`");
  });

  it("⚠ et la règle se lève seule : rien à désactiver à la main", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("lifts by itself once she replaces the word");
    expect(text).toContain("Nothing to switch off by hand.");
    // Énoncée pour TOUTE page, pas pour les trois pages d'approche seulement.
    expect(text).toContain("Any page whose body");
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

/*
 * ── LES PHOTOGRAPHIES ────────────────────────────────────────────────────
 *
 * Eklio en génère sept ; quatre seulement sont faites pour un site. Les trois
 * `post_bg_*` sont des fonds de publication — carrés, moitié haute laissée
 * vide pour une accroche — et le prompt les nommait sans jamais dire quoi en
 * faire.
 */
describe("la liste d'images", () => {
  const ALL_SEVEN = [
    "ambient_a",
    "ambient_b",
    "hero",
    "post_bg_1",
    "post_bg_2",
    "post_bg_3",
    "texture",
  ];

  it("⚠ les fonds de publication ne sont pas des images de site", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, imageSlots: ALL_SEVEN });
    for (const slot of ["post_bg_1", "post_bg_2", "post_bg_3"]) {
      expect(text, slot).not.toContain(slot);
    }
  });

  it("chaque image nommée porte son rôle et sa taille", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, imageSlots: ALL_SEVEN });
    expect(text).toContain("**Hero photograph** (`hero`, 1536 × 1024)");
    expect(text).toContain("**Texture** (`texture`, 1024 × 1024)");
    expect(text).toContain("The hero band's background, full-bleed");
  });

  it("aucun nom de slot n'apparaît sans une instruction qui va avec", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, imageSlots: ALL_SEVEN });
    const block = text.slice(text.indexOf("## Imagery")).split("\n---\n")[0];
    for (const line of block.split("\n").filter((l) => l.startsWith("- **"))) {
      expect(line, line).toContain(" — ");
    }
  });

  it("une image non générée n'est pas promise", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, imageSlots: ["hero"] });
    expect(text).toContain("`hero`");
    expect(text).not.toContain("`ambient_a`");
  });
});

/*
 * ── UN MOT ENTRE CROCHETS N'EST PAS UNE VALEUR ───────────────────────────
 *
 * Relevé sur le premier assemblage réel : le bloc contact émettait
 * « Call-to-action link: [BOOKING_URL] » alors que le corps, trois écrans plus
 * haut, dit que le bouton n'a pas encore de lien et doit rester non lié. Un
 * constructeur qui tranche dans un sens ignore une consigne ; dans l'autre, il
 * publie `href="[BOOKING_URL]"` — un bouton mort sur un site en ligne.
 */
describe("les marqueurs ne deviennent jamais des valeurs publiées", () => {
  it("le bouton reste visible et NON LIÉ tant que son lien est entre crochets", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, bookingUrl: null });
    expect(text).toContain("Call-to-action link: [BOOKING_URL]");
    expect(text).toContain("button stays visible and");
    expect(text).toContain("unlinked");
    expect(text).toContain("**Never put one in an attribute.**");
    expect(text).toContain("ships WITHOUT that attribute rather than");
  });

  it("un segment entre crochets sort de la ligne plutôt que d'être imprimé", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, practiceDetails: null });
    expect(text).toContain("left out of that line, not printed");
  });

  it("⚠ ni href, ni src, ni aucun autre attribut", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, bookingUrl: null });
    expect(text).toContain("Not an `href`, not a `src`, not any");
    expect(text).toContain("other attribute");
    // Et la règle tranche explicitement contre le plan du corps.
    expect(text).toContain("This overrides the outline's own wording");
  });

  it("le marqueur reste lisible à l'écran — c'est sa seule place", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, bookingUrl: null });
    expect(text).toContain("may appear as VISIBLE TEXT on the page");
  });

  it("rien à remplir : la mise en garde ne s'affiche pas non plus", () => {
    const { text } = buildLovablePrompt(FULL);
    expect(text).not.toContain("A word in [BRACKETS] is missing");
  });

  it("⚠ la règle couvre aussi le lien, l'adresse et les données structurées", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, bookingUrl: null });
    expect(text).toContain("Never publish one as structured data");
  });
});

/*
 * ── LES IMAGES CONTRE LE PLAN DU CORPS ───────────────────────────────────
 *
 * Le corps dit « No stock photos of people; leave labeled image placeholders »
 * — écrit pour une practice SANS photographies. Celle-ci en a quatre. Rien ne
 * disait lequel des deux l'emporte, et c'est ce qui a produit une boîte
 * placeholder moutarde à la place du héros.
 */
describe("la section Imagery tranche contre le plan", () => {
  it("elle dit qu'elle prime, et sur quoi exactement", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("**This section overrides the outline above on images.**");
    expect(text).toContain("to leave labelled image placeholders");
  });

  it("⚠ mais la règle « aucune personne » survit à l'exception", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("no-people rule still holds");
    expect(text).toContain("- No faces and no people.");
  });

  it("sans photographies, aucune exception n'est déclarée", () => {
    const { text } = buildLovablePrompt({ ...WITH_SPEC, imageSlots: [] });
    expect(text).not.toContain("overrides the outline above on images");
  });
});

/*
 * ── CE QUI MANQUE, ET QUI N'EST PAS UN MARQUEUR ──────────────────────────
 *
 * « Training and licensure » se réduisait à une puce, LMFT, déjà présente dans
 * la surtitre et le pied de page. La section est omise, et ce qui la
 * remplirait est nommé — sans être inventé, et sans être un mot à chercher
 * dans un prompt où il n'apparaît pas.
 */
describe("l'inventaire distingue deux manques", () => {
  const NO_NUMBER = { ...WITH_SPEC, practiceDetails: { ...FULL.practiceDetails, licenseNumber: "" } };

  it("la section au seul libellé de licence est omise", () => {
    const { text } = buildLovablePrompt(NO_NUMBER);
    const omitted = text.slice(text.indexOf("### Sections to leave out"));
    expect(omitted).toContain("About → Training and licensure");
  });

  it("ce qui la remplirait est listé, et dit ne pas être à chercher", () => {
    const { text } = buildLovablePrompt(NO_NUMBER);
    expect(text).toContain("- your degrees and completed training");
    expect(text).toContain("- your licence number");
    expect(text).toContain("not in the prompt to search for");
  });

  it("⚠ ni formation ni numéro ne sont inventés dans le corps", () => {
    const { text } = buildLovablePrompt(NO_NUMBER);
    const correction = text.slice(
      text.indexOf("## Sections: corrections"),
      text.indexOf("## Composition")
    );
    expect(correction).not.toContain("Training and licensure**");
  });

  it("avec un numéro, la section existe et porte le fait entier", () => {
    const { text } = buildLovablePrompt(WITH_SPEC);
    expect(text).toContain("**About → Training and licensure**");
    expect(text).toContain("- LMFT 12345");
  });
});

/*
 * ── LE LIEN DE RÉSERVATION ───────────────────────────────────────────────
 *
 * Renseigné, il traverse jusqu'au bouton et le marqueur disparaît. C'est la
 * seule chose qui fasse du site un moyen de la joindre.
 */
describe("le lien de réservation", () => {
  it("renseigné : l'URL réelle, et plus aucun [BOOKING_URL]", () => {
    const result = buildLovablePrompt({ ...WITH_SPEC, bookingUrl: "https://cal.com/ember" });
    expect(result.placeholders).not.toContain("BOOKING_URL");
    expect(result.text).toContain("Call-to-action link: https://cal.com/ember");
    expect(result.text).not.toContain("[BOOKING_URL]");
  });

  it("absent : le marqueur, et la règle qui empêche le href cassé", () => {
    const result = buildLovablePrompt({ ...WITH_SPEC, bookingUrl: null });
    expect(result.placeholders).toContain("BOOKING_URL");
    expect(result.text).toContain("**Never put one in an attribute.**");
  });
});
