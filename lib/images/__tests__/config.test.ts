import { describe, expect, it } from "vitest";
import {
  IMAGE_MODEL,
  IMAGE_SLOTS,
  IMAGE_SLOT_KEYS,
  MODERATION,
  OUTPUT_FORMAT,
  PRICE_USD,
  priceCents,
  slotPriceCents,
  UnpricedImageError,
} from "@/lib/images/config";

/*
 * Le prix est la seule chose de ce lot qui se paie en vrai. Ces tests
 * empêchent la manière dont il pourrait devenir faux SANS que rien casse :
 * une taille ou une qualité nouvelle qui ne coûterait, silencieusement, rien.
 */

describe("chaque emplacement a un prix", () => {
  it.each(IMAGE_SLOT_KEYS)("« %s » se résout à un prix", (slot) => {
    const cents = slotPriceCents(slot);
    expect(cents).toBeGreaterThan(0);
    expect(Number.isInteger(cents)).toBe(true);
  });

  it("une combinaison non tarifée LÈVE plutôt que de coûter zéro", () => {
    // Le mode de défaillance à empêcher : un `?? 0` qui laisse une image
    // gratuite passer sous le plafond quotidien sans jamais le remplir.
    expect(() => priceCents(IMAGE_MODEL, "high", "2048x2048" as never)).toThrow(UnpricedImageError);
    expect(() => priceCents("gpt-image-9", "high", "1024x1024")).toThrow(UnpricedImageError);
  });

  it("arrondit AU-DESSUS, jamais en dessous", () => {
    // 0,063 $ → 7 centimes, pas 6. Un budget qui sous-compte n'est pas un budget.
    expect(priceCents("gpt-image-1", "medium", "1024x1536")).toBe(7);
    expect(priceCents("gpt-image-1", "high", "1536x1024")).toBe(25);
    expect(priceCents("gpt-image-1", "medium", "1024x1024")).toBe(5);
  });
});

describe("le pack de prompts", () => {
  it("le modèle est épinglé et jamais gpt-image-2", () => {
    // gpt-image-2 est facturé au jeton, sans prix forfaitaire publié : un
    // plafond dur ne peut pas être calculé AVANT l'appel. Cf. FINDINGS.md.
    expect(IMAGE_MODEL).toBe("gpt-image-1");
    expect(Object.keys(PRICE_USD)).toEqual([IMAGE_MODEL]);
  });

  it("un seul emplacement est activé dans cette session", () => {
    const enabled = IMAGE_SLOT_KEYS.filter((slot) => IMAGE_SLOTS[slot].enabled);
    expect(enabled).toEqual(["hero"]);
  });

  it("le héros est le seul en « high »", () => {
    // Les six autres passent sous un voile avec du texte par-dessus : « high »
    // y achèterait un détail que personne ne verra.
    const high = IMAGE_SLOT_KEYS.filter((slot) => IMAGE_SLOTS[slot].quality === "high");
    expect(high).toEqual(["hero"]);
  });

  it("la modération n'est jamais « low »", () => {
    expect(MODERATION).toBe("auto");
  });

  it("le format est webp", () => {
    expect(OUTPUT_FORMAT).toBe("webp");
  });
});

describe("l'arithmétique du kit", () => {
  it("les sept emplacements coûtent 59 centimes arrondis au-dessus", () => {
    // 25 + 7 + 7 + 5 + 5 + 5 + 5. Le vrai total en dollars est 0,544 $ ;
    // l'écart est l'arrondi vers le haut, toujours du côté sûr.
    const total = IMAGE_SLOT_KEYS.reduce((sum, slot) => sum + slotPriceCents(slot), 0);
    expect(total).toBe(59);
  });
});
