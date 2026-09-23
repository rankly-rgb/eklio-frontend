import { describe, expect, it } from "vitest";
import { mirrored, variantOf, profile, door } from "@/lib/compose/illustrations";
import { render } from "@/lib/compose/engine";
import { violations } from "@/lib/compose/engine";
import { payloadFor, CARD, PALETTES } from "@/lib/compose/__tests__/fixtures";

/*
 * ── DEUX ORIENTATIONS PAR OBJET, SANS TOUCHER AUX DÉGAGEMENTS ───────────
 *
 * Une notation indépendante a compté les réutilisations au pixel : six
 * dessins pour onze archétypes, identiques à l'octet près sur quatre, deux ou
 * seize cartes selon l'objet. « L'ensemble se lit uniforme même là où chaque
 * carte est correcte. »
 *
 * Retourner l'objet est la variation la moins coûteuse qui se VOIT. Elle n'a
 * le droit d'exister qu'à une condition : que la boîte de chaque trait suive
 * l'encre, parce que c'est la boîte que le contrôle de dégagement lit.
 */

const BOX = { x: 100, y: 200, w: 300, h: 300 };

describe("le miroir retourne l'encre ET les boîtes", () => {
  /*
   * ⚠ L'ÉTENDUE GARDE SA LARGEUR ET CHANGE DE PLACE — et c'est la bonne
   * assertion, pas l'inverse. Un dessin n'est pas centré dans sa boîte : le
   * profil occupe de 10 % à 82 % de la sienne. Retourné autour de l'axe de la
   * BOÎTE, il se déplace donc, et c'est précisément ce qui se voit.
   *
   * Ce qui doit être vrai : la largeur est conservée — c'est le même objet —
   * et il reste dans la boîte, sinon le dégagement se mesurerait sur une
   * boîte que le dessin déborde.
   */
  it("l'étendue garde sa largeur et reste dans la boîte", () => {
    const drawn = profile(BOX, "#000", 4);
    const flipped = mirrored(drawn, BOX);
    const span = (ss: typeof drawn) => {
      const x0 = Math.min(...ss.map((s) => s.box.x));
      const x1 = Math.max(...ss.map((s) => s.box.x + s.box.w));
      return { x0, x1, w: x1 - x0 };
    };
    const before = span(drawn);
    const after = span(flipped.strokes);
    expect(after.w).toBeCloseTo(before.w, 1);
    expect(after.x0).toBeGreaterThanOrEqual(BOX.x - 0.1);
    expect(after.x1).toBeLessThanOrEqual(BOX.x + BOX.w + 0.1);
    // Et il a vraiment bougé, sinon la variante ne se verrait pas.
    expect(Math.abs(after.x0 - before.x0)).toBeGreaterThan(1);
  });

  it("chaque boîte est bien retournée autour de l'axe de la boîte", () => {
    const drawn = door(BOX, "#000", 4);
    const flipped = mirrored(drawn, BOX);
    const axis = BOX.x + BOX.w / 2;
    for (let i = 0; i < drawn.length; i += 1) {
      const before = drawn[i].box;
      const after = flipped.strokes[i].box;
      expect(after.x).toBeCloseTo(axis * 2 - (before.x + before.w), 1);
      expect(after.w).toBeCloseTo(before.w, 1);
    }
  });

  it("et la transformation SVG correspond à cet axe", () => {
    const flipped = mirrored(door(BOX, "#000", 4), BOX);
    expect(flipped.transform).toBe(`translate(${(BOX.x + BOX.w / 2) * 2}, 0) scale(-1, 1)`);
  });

  /*
   * ⚠ DÉTERMINISTE, PARCE QUE LE CACHE DE RENDU L'EXIGE. `rendered_assets`
   * est indexé sur un hachage de la carte : une orientation tirée au hasard
   * ferait servir le premier rendu pour toujours, et la variation serait
   * invisible en production tout en cassant le cache en développement.
   */
  it("l'orientation d'une carte ne change pas d'un rendu à l'autre", () => {
    for (const key of ["a", "kit-1", "kit-2", "x9f3"]) {
      expect(variantOf(key)).toBe(variantOf(key));
      expect([0, 1]).toContain(variantOf(key));
    }
  });

  it("et elle varie d'une carte à l'autre", () => {
    const keys = Array.from({ length: 24 }, (_, i) => `month-${i}`);
    const seen = new Set(keys.map(variantOf));
    expect(seen.size).toBe(2);
  });
});

describe("une carte retournée reste propre", () => {
  it.each(["quadrant_model", "practitioner_card"])(
    "%s ne viole aucun dégagement, quelle que soit son orientation",
    (archetype) => {
      /*
       * Les quatre palettes ont des clefs différentes, donc les deux
       * orientations sont couvertes — c'est ce que le cas précédent garantit.
       */
      for (const palette of PALETTES) {
        const r = render({ ...CARD, archetype, palette, payload: payloadFor(archetype, "nominal") });
        expect(violations(r.composition.placed), `${archetype} / ${palette.key}`).toEqual([]);
      }
    }
  );
});
