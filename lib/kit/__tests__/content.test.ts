import { describe, expect, it } from "vitest";
import { kitPages, parseStoredKit, publishableKitText } from "@/lib/kit/content";
import { buildShareSlug, slugifyName } from "@/lib/kit/share";

/*
 * Relecture de `brand_kits.content` (jsonb) et fabrication du slug de partage.
 *
 * La page de kit ne fait jamais confiance au contenu stocké : un jsonb qui ne
 * tient pas la forme attendue doit produire `null` — donc une invitation à
 * régénérer — et jamais un livrable à trous.
 */

const VALID = {
  tier: "signature",
  positioning_statement: "A couples practice for partners who keep circling.",
  brand_story: "Two paragraphs about why this practice exists.",
  voice_and_tone: {
    adjectives: ["warm", "direct", "unhurried"],
    do_examples: ["One.", "Two.", "Three."],
    dont_examples: ["One.", "Two.", "Three."],
  },
  website_copy: [
    { page: "home", sections: [{ heading: "Welcome", body: "Body copy." }] },
    { page: "about", sections: [{ heading: "Who I am", body: "Body copy." }] },
  ],
  social_templates: [],
};

describe("parseStoredKit", () => {
  it("relit un kit valide", () => {
    const kit = parseStoredKit(VALID);

    expect(kit).not.toBeNull();
    expect(kit?.tier).toBe("signature");
    expect(kitPages(kit!)).toEqual(["home", "about"]);
  });

  it("renvoie null sur une forme inattendue plutôt que de rendre un livrable partiel", () => {
    expect(parseStoredKit(null)).toBeNull();
    expect(parseStoredKit({})).toBeNull();
    expect(parseStoredKit("un kit")).toBeNull();
    // Tier absent : le kit ne dit plus quel périmètre l'a produit.
    expect(parseStoredKit({ ...VALID, tier: undefined })).toBeNull();
    // Page inconnue du produit.
    expect(
      parseStoredKit({
        ...VALID,
        website_copy: [{ page: "boutique", sections: [{ heading: "H", body: "B" }] }],
      })
    ).toBeNull();
    // Guide de voix à 2 adjectifs au lieu de 3.
    expect(
      parseStoredKit({
        ...VALID,
        voice_and_tone: { ...VALID.voice_and_tone, adjectives: ["warm", "direct"] },
      })
    ).toBeNull();
  });
});

describe("publishableKitText", () => {
  it("inclut le prompt multi-plateformes, exclut les contre-exemples de voix", () => {
    const kit = parseStoredKit(VALID)!;
    const texts = publishableKitText(kit, "the website prompt");

    expect(texts).toContain("the website prompt");
    expect(texts).toContain(kit.positioning_statement);
    for (const example of kit.voice_and_tone.do_examples) {
      expect(texts).toContain(example);
    }
    // Les contre-exemples illustrent la faute : ils ne sont pas de la copy.
    expect(texts.filter((t) => t === "One.")).toHaveLength(1);
  });
});

describe("slug de partage", () => {
  it("réduit un nom de cabinet à un fragment d'URL lisible", () => {
    expect(slugifyName("Hearth Counseling")).toBe("hearth-counseling");
    expect(slugifyName("Thérapie & Co.")).toBe("therapie-co");
    expect(slugifyName("  ---  ")).toBe("");
  });

  it("ajoute un suffixe aléatoire — deux cabinets homonymes n'entrent pas en collision", () => {
    const a = buildShareSlug("Hearth Counseling");
    const b = buildShareSlug("Hearth Counseling");

    expect(a).toMatch(/^hearth-counseling-[a-z0-9]{7}$/);
    expect(a).not.toBe(b);
  });

  it("reste utilisable quand le nom ne donne aucun fragment", () => {
    expect(buildShareSlug("---")).toMatch(/^kit-[a-z0-9]{7}$/);
  });
});
