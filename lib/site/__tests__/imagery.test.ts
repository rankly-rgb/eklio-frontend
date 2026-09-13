import { describe, expect, it } from "vitest";
import { siteImages, SITE_IMAGE_SLOTS } from "@/lib/site/imagery";
import { IMAGE_SLOTS } from "@/lib/images/config";

/*
 * Eklio génère sept photographies ; quatre seulement sont faites pour un site.
 * Les trois `post_bg_*` sont des fonds de PUBLICATION : carrés, sujet coupé
 * dans le quart bas, moitié haute laissée plate pour une accroche. Les lister
 * comme images de site, c'est nommer trois fichiers dont rien ne dit quoi
 * faire.
 */
const ALL_SEVEN = Object.keys(IMAGE_SLOTS);

describe("les images du site", () => {
  it("⚠ aucun fond de publication n'en fait partie", () => {
    for (const slot of ["post_bg_1", "post_bg_2", "post_bg_3"]) {
      expect(SITE_IMAGE_SLOTS, slot).not.toContain(slot);
    }
  });

  it("les quatre retenues existent bien dans le catalogue d'images", () => {
    for (const slot of SITE_IMAGE_SLOTS) expect(ALL_SEVEN).toContain(slot);
  });

  it("sur les sept, seules les quatre du site ressortent, dans l'ordre de page", () => {
    expect(siteImages(ALL_SEVEN).map((image) => image.slot)).toEqual([
      "hero",
      "ambient_a",
      "ambient_b",
      "texture",
    ]);
  });

  it("chacune porte un rôle et la taille à laquelle elle a été produite", () => {
    for (const image of siteImages(ALL_SEVEN)) {
      expect(image.role.length, image.slot).toBeGreaterThan(20);
      expect(image.dimensions, image.slot).toMatch(/^\d+ × \d+$/);
      // La taille n'est pas retapée : elle vient de la config de génération.
      expect(image.dimensions.replace(/ × /, "x")).toEqual(IMAGE_SLOTS[image.slot].size);
    }
  });

  it("une image non générée n'est pas listée", () => {
    expect(siteImages(["hero"]).map((image) => image.slot)).toEqual(["hero"]);
    expect(siteImages([])).toEqual([]);
  });

  it("un slot inconnu ne fabrique pas d'entrée", () => {
    expect(siteImages(["not_a_slot", "hero"]).map((image) => image.slot)).toEqual(["hero"]);
  });
});
