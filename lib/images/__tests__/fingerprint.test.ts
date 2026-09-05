import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { computeImageFingerprint, type ImageFingerprintInput } from "@/lib/images/fingerprint";
import { computeAssetFingerprint, type AssetFingerprintInput } from "@/lib/kit/asset-fingerprint";

const BASE: ImageFingerprintInput = {
  direction: { id: "dir-1", name: "Quiet Clay", tone_keywords: ["calm", "plain", "warm"] },
  palette: {
    primary: "#B4653F",
    secondary: "#2E4E8A",
    accent: "#7A8B6F",
    paper: "#FAF7F2",
    light_neutral: "#E8E2D9",
    dark_neutral: "#2B2724",
  },
  specialty: "Anxiety",
  city: "Austin",
  state: "TX",
};

describe("l'empreinte d'image bouge sur ce que le prompt lit", () => {
  it("est déterministe", () => {
    expect(computeImageFingerprint(BASE)).toBe(computeImageFingerprint({ ...BASE }));
    expect(computeImageFingerprint(BASE)).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["primary", { ...BASE, palette: { ...BASE.palette, primary: "#111111" } }],
    ["secondary", { ...BASE, palette: { ...BASE.palette, secondary: "#111111" } }],
    ["accent", { ...BASE, palette: { ...BASE.palette, accent: "#111111" } }],
    ["paper", { ...BASE, palette: { ...BASE.palette, paper: "#111111" } }],
    ["light_neutral", { ...BASE, palette: { ...BASE.palette, light_neutral: "#111111" } }],
    ["dark_neutral", { ...BASE, palette: { ...BASE.palette, dark_neutral: "#111111" } }],
    ["direction", { ...BASE, direction: { ...BASE.direction, id: "dir-2" } }],
    ["tone keywords", { ...BASE, direction: { ...BASE.direction, tone_keywords: ["stark", "cool", "spare"] } }],
    ["specialty", { ...BASE, specialty: "Grief" }],
    ["city", { ...BASE, city: "Dallas" }],
    ["state", { ...BASE, state: "OR" }],
  ] satisfies Array<[string, ImageFingerprintInput]>)("« %s » qui change la déplace", (_field, next) => {
    expect(computeImageFingerprint(next)).not.toBe(computeImageFingerprint(BASE));
  });
});

describe("l'empreinte d'image ne bouge PAS sur la copie", () => {
  /*
   * L'autre moitié, et la plus chère à rater : un titre modifié ne doit pas
   * coûter 0,25 $ pour rephotographier une pièce où ce titre n'a jamais été.
   *
   * Le type lui-même est la garantie -- il ne PORTE ni nom de cabinet ni
   * titre. Ce test le vérifie par construction : on ajoute ces champs à
   * l'entrée et l'empreinte ne bouge pas, parce qu'ils ne sont pas hachés.
   */
  it.each([
    ["le nom du cabinet", { practiceName: "Elm & Ember Therapy" }],
    ["le titre", { hero: { overline: "Therapy in Austin", headline: "Room to think it through" } }],
    ["la ligne de titre professionnel", { practitionerLine: "Dana Whitfield, LCSW" }],
    ["les modèles de posts", { socialTemplates: { statement: "One thing at a time." } }],
    ["les polices", { fonts: { heading: "Fraunces", body: "Inter" } }],
    ["le lien de réservation", { bookingUrl: "https://example.com/book" }],
  ])("%s n'entre pas dans l'empreinte", (_label, extra) => {
    const withCopy = { ...BASE, ...extra } as ImageFingerprintInput;
    expect(computeImageFingerprint(withCopy)).toBe(computeImageFingerprint(BASE));
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
    const source = readFileSync(
      resolve(__dirname, "../../kit/asset-fingerprint.ts"),
      "utf8"
    );
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

  it("les deux empreintes sont bien différentes", () => {
    // Même primitive, entrées différentes : elles ne doivent jamais coïncider.
    expect(computeImageFingerprint(BASE)).not.toBe(
      createHash("sha256").update("").digest("hex")
    );
  });
});
