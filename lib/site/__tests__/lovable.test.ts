import { describe, expect, it } from "vitest";
import { buildLovablePrompt } from "@/lib/site/lovable";

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
  bookingUrl: "https://example.com/book",
  toneWords: ["Slower", "Braver", "You"],
  wordmark: { label: "Wordmark (dark)", format: "svg" },
  imageSlots: ["hero", "ambient_a"],
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

  it("⚠ le canari : une promesse de résultat glissée dans le corps fait échouer le scan", () => {
    // Si ça passait, le scan ne regarderait pas le corps.
    const result = buildLovablePrompt({
      ...FULL,
      core: `${CORE}\nA proven method that cures anxiety for good.`,
    });
    expect(result.scan.ok).toBe(false);
    expect(result.scan.violations.length).toBeGreaterThan(0);
  });
});
