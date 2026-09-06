import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeImageFingerprint, type ImageFingerprintInput } from "@/lib/images/fingerprint";
import { buildImagePrompt } from "@/lib/images/prompt";
import { IMAGE_SLOT_KEYS } from "@/lib/images/config";
import { computeAssetFingerprint, type AssetFingerprintInput } from "@/lib/kit/asset-fingerprint";

const BASE: ImageFingerprintInput = {
  toneKeywords: ["calm", "plain", "warm"],
  palette: {
    primary: "#B4653F",
    secondary: "#2E4E8A",
    paper: "#FAF7F2",
    light_neutral: "#E8E2D9",
    dark_neutral: "#2B2724",
  },
  specialty: "self_esteem",
};

/*
 * ── THE INVARIANT, TESTED IN BOTH DIRECTIONS ────────────────────────────
 *
 *   A FIELD BELONGS IN `image_fingerprint` IF AND ONLY IF IT REACHES THE
 *   PROMPT.
 *
 * Hashed but not prompted bills her for a regeneration that produces a
 * byte-identical photograph. Prompted but not hashed serves a stale
 * photograph forever. Neither announces itself, so both get a test.
 *
 * Every entry below moves ONE field and asserts BOTH halves at once.
 */
const MOVED: Array<[string, ImageFingerprintInput]> = [
  ["toneKeywords", { ...BASE, toneKeywords: ["stark", "cool", "spare"] }],
  ["palette.primary", { ...BASE, palette: { ...BASE.palette, primary: "#111111" } }],
  ["palette.secondary", { ...BASE, palette: { ...BASE.palette, secondary: "#111111" } }],
  ["palette.paper", { ...BASE, palette: { ...BASE.palette, paper: "#111111" } }],
  ["palette.light_neutral", { ...BASE, palette: { ...BASE.palette, light_neutral: "#111111" } }],
  ["palette.dark_neutral", { ...BASE, palette: { ...BASE.palette, dark_neutral: "#111111" } }],
  ["specialty", { ...BASE, specialty: "grief" }],
];

/** Every leaf path of a sample input, so a NEW field cannot slip past the list above. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("l'invariant : haché si et seulement si envoyé au modèle", () => {
  it("l'énumération couvre chaque champ du type, sans en oublier un", () => {
    // La garde qui protège les deux tests suivants : ajouter un champ à
    // `ImageFingerprintInput` sans l'ajouter ici casse ce test-ci d'abord,
    // plutôt que de laisser passer un champ non vérifié.
    expect(MOVED.map(([field]) => field).sort()).toEqual(leafPaths(BASE).sort());
  });

  it.each(MOVED)("« %s » déplace l'empreinte", (_field, next) => {
    expect(computeImageFingerprint(next)).not.toBe(computeImageFingerprint(BASE));
  });

  it.each(MOVED)("« %s » change AUSSI le prompt", (_field, next) => {
    // Le sens inverse, et le plus coûteux à rater : un champ haché que le
    // prompt ignore facture une régénération pour un résultat identique.
    expect(buildImagePrompt("hero", next)).not.toBe(buildImagePrompt("hero", BASE));
  });

  it("un champ non déclaré ne change ni l'un ni l'autre", () => {
    /*
     * L'autre sens, tenu par CONSTRUCTION plutôt que par vigilance :
     * `buildImagePrompt` et `computeImageFingerprint` ne reçoivent QUE
     * `ImageFingerprintInput`, et l'empreinte projette ses champs
     * explicitement. Un appelant qui passe un objet plus large -- un kit
     * entier -- ne peut donc élargir ni le hachage ni le prompt.
     */
    const wider = {
      ...BASE,
      practiceName: "Elm & Ember Therapy",
      hero: { overline: "Therapy in Austin", headline: "Room to think it through" },
      city: "Austin",
      state: "TX",
      accent: "#7A8B6F",
    } as ImageFingerprintInput;
    expect(computeImageFingerprint(wider)).toBe(computeImageFingerprint(BASE));
    expect(buildImagePrompt("hero", wider)).toBe(buildImagePrompt("hero", BASE));
  });

  it("aucun emplacement ne fait mentir l'invariant", () => {
    // Les six emplacements désactivés n'ont pas de jeton `{subject}` : leur
    // prompt ne varie donc pas avec la spécialité, ce qui est vrai et voulu
    // jusqu'à l'étape 8. Le seul emplacement actif, lui, doit varier.
    const other = { ...BASE, specialty: "grief" };
    expect(buildImagePrompt("hero", other)).not.toBe(buildImagePrompt("hero", BASE));
    expect(IMAGE_SLOT_KEYS).toContain("hero");
  });
});

describe("l'empreinte d'image", () => {
  it("est déterministe et de la bonne forme", () => {
    expect(computeImageFingerprint(BASE)).toBe(computeImageFingerprint({ ...BASE }));
    expect(computeImageFingerprint(BASE)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("computeAssetFingerprint reste intact", () => {
  /*
   * ⚠ LA GARDE QUI COMPTE POUR LES SESSIONS SUIVANTES.
   *
   * L'empreinte d'ASSET est porteuse pour tout le lot 4 : la faire bouger
   * réinvaliderait chaque fichier déterministe déjà rendu et stocké, sans
   * que rien ne casse visiblement. Ce lot-ci en a construit une SECONDE, à
   * côté, et n'a pas le droit d'avoir touché la première.
   */
  it("le fichier ne mentionne rien de la photographie", () => {
    const source = readFileSync(resolve(__dirname, "../../kit/asset-fingerprint.ts"), "utf8");
    for (const forbidden of ["IMAGE_PROMPT_VERSION", "lib/images", "brand_images", "gpt-image"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("son empreinte pour une entrée fixe est inchangée", () => {
    // Valeur figée : si elle bouge, quelque chose a changé le hachage des
    // assets, et tout `brand_assets` déjà stocké vient de devenir périmé.
    const input: AssetFingerprintInput = {
      tokens: {
        primary: "#B4653F", secondary: "#2E4E8A", accent: "#7A8B6F",
        paper: "#FAF7F2", light_neutral: "#E8E2D9", dark_neutral: "#2B2724",
        primary_text: "#FFFFFF", secondary_text: "#FFFFFF", accent_text: "#2B2724",
        cta_ink: "#FFFFFF", heading_font: "Fraunces", body_font: "Inter",
      },
      practiceName: "Elm & Ember Therapy",
      hero: { overline: "Therapy in Austin", headline: "Room to think it through" },
      socialTemplates: null,
      practitionerLine: null,
      practiceDetails: null,
      bookingUrl: null,
    };
    expect(computeAssetFingerprint(input)).toBe(
      "dad3d59478ded36a9619deaf4f4f7ccab94250baa399bfcaf7783e577342b402"
    );
  });
});
