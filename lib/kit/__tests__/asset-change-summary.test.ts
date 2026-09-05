import { describe, expect, it } from "vitest";
import { describeAssetChange } from "@/lib/kit/asset-change-summary";
import type { AssetFingerprintInput } from "@/lib/kit/asset-fingerprint";

const BASE: AssetFingerprintInput = {
  tokens: {
    primary: "#B4653F",
    secondary: "#2E4E8A",
    accent: "#7A8B6F",
    paper: "#FAF7F2",
    light_neutral: "#E8E2D9",
    dark_neutral: "#2B2724",
    primary_text: "#FFFFFF",
    secondary_text: "#FFFFFF",
    accent_text: "#2B2724",
    cta_ink: "#FFFFFF",
    heading_font: "Fraunces",
    body_font: "Inter",
  },
  practiceName: "Elm & Ember Therapy",
  hero: { overline: "Therapy in Austin", headline: "Room to think it through" },
  socialTemplates: { statement: "One thing at a time." },
  practitionerLine: "Dana Whitfield, LCSW",
  practiceDetails: { practitionerName: "Dana Whitfield", city: "Austin", state: "TX" },
  bookingUrl: "https://example.com/book",
};

/** The same input with one field moved — how a rebuild actually happens. */
function withTokens(patch: Partial<AssetFingerprintInput["tokens"]>): AssetFingerprintInput {
  return { ...BASE, tokens: { ...BASE.tokens, ...patch } };
}

describe("une première version n'explique rien", () => {
  it("rend une phrase vide quand il n'y a pas de version d'avant", () => {
    expect(describeAssetChange({}, BASE)).toBe("");
  });
});

describe("la phrase nomme ce qui a bougé", () => {
  it("un seul champ", () => {
    expect(describeAssetChange(BASE, withTokens({ primary: "#2E4E8A" }))).toBe(
      "Your primary color changed."
    );
  });

  it("deux champs, liés par « and » sans virgule", () => {
    expect(
      describeAssetChange(BASE, withTokens({ primary: "#2E4E8A", heading_font: "Lora" }))
    ).toBe("Your primary color and heading font changed.");
  });

  it("trois champs, avec la virgule de série", () => {
    expect(
      describeAssetChange(
        BASE,
        withTokens({ primary: "#2E4E8A", secondary: "#B4653F", heading_font: "Lora" })
      )
    ).toBe("Your primary color, secondary color, and heading font changed.");
  });

  it("au-delà de trois, elle compte le reste plutôt que de tout lister", () => {
    // Onze rôles de couleur nommés ne renseignent pas mieux que « and 8
    // others » : c'est seulement plus long, et elle doit quand même regarder.
    const summary = describeAssetChange(
      BASE,
      withTokens({
        primary: "#111111",
        secondary: "#222222",
        accent: "#333333",
        paper: "#444444",
        light_neutral: "#555555",
      })
    );
    expect(summary).toBe(
      "Your primary color, secondary color, accent color, and 2 others changed."
    );
  });

  it("un seul « other » reste au singulier", () => {
    const summary = describeAssetChange(
      BASE,
      withTokens({ primary: "#111111", secondary: "#222222", accent: "#333333", paper: "#444444" })
    );
    expect(summary).toBe(
      "Your primary color, secondary color, accent color, and 1 other changed."
    );
  });

  it("les champs hachés en bloc sont comparés par valeur, pas par référence", () => {
    // `hero`, `socialTemplates` et `practiceDetails` sont des objets : deux
    // objets identiques recréés à chaque chargement ne sont PAS un changement.
    const rebuilt = { ...BASE, hero: { ...BASE.hero! }, practiceDetails: { ...(BASE.practiceDetails as object) } };
    expect(describeAssetChange(BASE, rebuilt)).toBe("Eklio's renderer was updated.");

    const moved = { ...BASE, hero: { overline: "Therapy in Austin", headline: "A place to land" } };
    expect(describeAssetChange(BASE, moved)).toBe("Your headline changed.");
  });
});

describe("aucun champ haché ne reste sans explication", () => {
  /*
   * La garde qui compte pour la suite : si une session future ajoute un champ
   * à `AssetFingerprintInput` — parce qu'un nouveau renderer le lit — le
   * hachage bougera et l'historique dira « Eklio's renderer was updated »,
   * ce qui serait faux. Ce test bouge chaque champ un par un et exige une
   * phrase qui le NOMME.
   */
  const MOVED: Array<[string, AssetFingerprintInput]> = [
    ...Object.keys(BASE.tokens).map(
      (field): [string, AssetFingerprintInput] => [
        `tokens.${field}`,
        withTokens({ [field]: "MOVED" } as Partial<AssetFingerprintInput["tokens"]>),
      ]
    ),
    ["practiceName", { ...BASE, practiceName: "Another Practice" }],
    ["hero", { ...BASE, hero: { overline: "x", headline: "y" } }],
    ["socialTemplates", { ...BASE, socialTemplates: { statement: "Something else." } }],
    ["practitionerLine", { ...BASE, practitionerLine: "Dana Whitfield, LPC" }],
    ["practiceDetails", { ...BASE, practiceDetails: { city: "Dallas" } }],
    ["bookingUrl", { ...BASE, bookingUrl: "https://example.com/schedule" }],
  ];

  it("couvre bien tous les champs du hachage", () => {
    // Sans cette garde, un champ retiré de l'énumération passerait inaperçu.
    expect(MOVED.length).toBe(Object.keys(BASE).length - 1 + Object.keys(BASE.tokens).length);
  });

  it.each(MOVED)("« %s » produit une phrase qui le nomme", (_field, next) => {
    const summary = describeAssetChange(BASE, next);
    expect(summary).not.toBe("");
    expect(
      summary,
      "Un champ haché sans libellé se lit « Eklio's renderer was updated », ce qui\n" +
        "est faux : c'est SON changement à elle, pas le nôtre. Ajoutez le libellé\n" +
        "dans lib/kit/asset-change-summary.ts en même temps que le champ."
    ).not.toBe("Eklio's renderer was updated.");
  });
});

describe("la copie respecte la loi de design", () => {
  const SAMPLES = [
    describeAssetChange(BASE, withTokens({ primary: "#111111" })),
    describeAssetChange(BASE, withTokens({ primary: "#111111", body_font: "Lora" })),
    describeAssetChange(BASE, BASE),
    describeAssetChange({}, BASE),
  ];

  it.each(SAMPLES)("« %s » n'a ni point d'exclamation ni emoji", (sentence) => {
    expect(sentence).not.toContain("!");
    // Toute la copie produit reste en ASCII : pas d'emoji, jamais.
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(sentence)).toBe(false);
  });
});
