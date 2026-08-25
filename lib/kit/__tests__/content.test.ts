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
    expect(kitPages(kit!)).toEqual(["home", "about"]);
  });

  it("relit encore les kits du Lot 3, qui portaient le tier dans le jsonb", () => {
    // Le tier a sa colonne depuis le Lot 4 (`brand_kits.tier`) et n'est plus
    // écrit ici. Refuser les kits déjà en base rendrait leur page illisible
    // pour un champ dont la valeur vit désormais ailleurs.
    expect(parseStoredKit(VALID)?.tier).toBe("signature");
    const withoutTier = { ...VALID, tier: undefined };
    expect(parseStoredKit(withoutTier)).not.toBeNull();
    expect(parseStoredKit(withoutTier)?.tier).toBeUndefined();
  });

  it("renvoie null sur une forme inattendue plutôt que de rendre un livrable partiel", () => {
    expect(parseStoredKit(null)).toBeNull();
    expect(parseStoredKit({})).toBeNull();
    expect(parseStoredKit("un kit")).toBeNull();
    // Tier présent mais hors du CHECK en base : le jsonb n'est pas contraint,
    // donc c'est ici que la valeur aberrante doit être refusée.
    expect(parseStoredKit({ ...VALID, tier: "enterprise" })).toBeNull();
    // Page inconnue du produit.
    expect(
      parseStoredKit({
        ...VALID,
        website_copy: [{ page: "boutique", sections: [{ heading: "H", body: "B" }] }],
      })
    ).toBeNull();
    // Guide de voix SANS aucun adjectif : plus un guide du tout.
    expect(
      parseStoredKit({
        ...VALID,
        voice_and_tone: { ...VALID.voice_and_tone, adjectives: [] },
      })
    ).toBeNull();
  });
});

describe("bornes des listes d'exemples — normaliser, pas rejeter", () => {
  /*
   * L'API n'autorise pas `minItems`/`maxItems` dans un schéma d'outil strict :
   * « 3 à 5 exemples » n'est qu'une consigne, jamais une garantie. Une borne
   * serrée côté zod ne discipline pas le modèle, elle jette un kit entier
   * après deux minutes de génération. C'est exactement ce qui s'est produit :
   * 6 contre-exemples au lieu de 5, et tout le livrable était perdu.
   */
  it("accepte un surplus d'exemples et ne garde que les premiers", () => {
    const kit = parseStoredKit({
      ...VALID,
      voice_and_tone: {
        adjectives: ["warm", "direct", "unhurried", "steady", "plain"],
        do_examples: ["A.", "B.", "C.", "D.", "E.", "F.", "G."],
        // Le cas réel : 6 contre-exemples pour un maximum annoncé de 5.
        dont_examples: ["A.", "B.", "C.", "D.", "E.", "F."],
      },
    });

    expect(kit).not.toBeNull();
    expect(kit!.voice_and_tone.adjectives).toEqual([
      "warm",
      "direct",
      "unhurried",
    ]);
    expect(kit!.voice_and_tone.do_examples).toHaveLength(5);
    expect(kit!.voice_and_tone.dont_examples).toHaveLength(5);
  });

  it("accepte un nombre d'exemples inférieur au format nominal", () => {
    const kit = parseStoredKit({
      ...VALID,
      voice_and_tone: {
        adjectives: ["warm", "direct"],
        do_examples: ["A."],
        dont_examples: ["B."],
      },
    });

    // Un guide un peu court reste un guide ; le refuser coûterait tout le kit.
    expect(kit).not.toBeNull();
    expect(kit!.voice_and_tone.adjectives).toEqual(["warm", "direct"]);
  });

  it("refuse quand même une liste vide", () => {
    for (const key of ["adjectives", "do_examples", "dont_examples"]) {
      expect(
        parseStoredKit({
          ...VALID,
          voice_and_tone: { ...VALID.voice_and_tone, [key]: [] },
        })
      ).toBeNull();
    }
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
