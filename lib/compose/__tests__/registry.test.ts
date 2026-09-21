import { describe, expect, it } from "vitest";
import { ARCHETYPES, ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { CANVAS, CLEARANCE, ENGINE_VERSION, FIGURE_COVERAGE, TYPE } from "@/lib/compose/constants";
import { BODY, EYEBROW, FOOTER } from "@/lib/compose/constants-bands";

/*
 * ── THE CONTRACT, PINNED ON THIS SIDE ───────────────────────────────────
 *
 * `content_archetypes` in the database is the other side of it. A module here
 * that the database does not know can never be assigned a topic; a row there
 * with no module here renders nothing on the 1st of the month, at 2am, for
 * every subscriber at once.
 *
 * The backend's own guard rail (`20260920150000`) pins the eleven there. This
 * pins them here, with the same spelling, so the two files have to be changed
 * together.
 */

const THE_ELEVEN = [
  "single_statement",
  "quadrant_model",
  "cycle",
  "surface_and_beneath",
  "comparison_pair",
  "numbered_strategies",
  "lettered_technique",
  "concentric_control",
  "annotated_curve",
  "practitioner_card",
  "carousel",
];

describe("the eleven archetypes", () => {
  it("are exactly the eleven the database carries", () => {
    expect([...ARCHETYPE_KEYS].sort()).toEqual([...THE_ELEVEN].sort());
  });

  it("each module answers to its own key", () => {
    for (const [key, entry] of Object.entries(ARCHETYPES)) {
      expect(entry.key).toBe(key);
    }
  });

  it("each declares an illustration zone the database also allows", () => {
    // `content_archetypes_zone_check` is (none, content, content_center).
    for (const entry of Object.values(ARCHETYPES)) {
      expect(["none", "content", "content_center"]).toContain(entry.illustrationZone);
    }
  });

  it("exactly one archetype is centred inside an empty shape", () => {
    // The one exception the zone rule names. Two would mean the exception had
    // quietly become a second layout style.
    const centred = Object.values(ARCHETYPES).filter((m) => m.illustrationZone === "content_center");
    expect(centred.map((m) => m.key)).toEqual(["concentric_control"]);
  });

  it("each refuses a payload of the wrong shape rather than rendering nonsense", () => {
    for (const entry of Object.values(ARCHETYPES)) {
      for (const junk of [null, {}, [], "x", 42, { nope: true }]) {
        expect(entry.parse(junk), `${entry.key} accepted ${JSON.stringify(junk)}`).toBeNull();
      }
    }
  });
});

describe("the zone system's numbers", () => {
  /*
   * These are the contract the chantier specified, at 1080 wide. A change to
   * any of them changes every card ever rendered — which is why
   * ENGINE_VERSION is in the content hash, and why this test exists to make
   * changing one a deliberate act.
   */
  it("the canvas is 1080 × 1350", () => {
    expect(CANVAS).toEqual({ width: 1080, height: 1350 });
  });

  it("the four clearances are 40 / 32 / 48 / 64", () => {
    expect(CLEARANCE).toEqual({
      glyphToStroke: 40,
      glyphToFieldEdge: 32,
      fieldToField: 48,
      aboveFooter: 64,
    });
  });

  it("the eyebrow is ~90px and the footer ~110px", () => {
    expect(EYEBROW.h).toBe(90);
    expect(FOOTER.h).toBe(110);
  });

  it("the body band sits between them, clear of the footer", () => {
    expect(BODY.y).toBe(EYEBROW.y + EYEBROW.h);
    expect(BODY.y + BODY.h).toBe(FOOTER.y - CLEARANCE.aboveFooter);
  });

  it("illustration coverage is 25–45% of the content band", () => {
    expect(FIGURE_COVERAGE).toEqual({ min: 0.25, max: 0.45 });
  });

  it("the type floors are the specified ones", () => {
    expect(TYPE.display).toEqual({ min: 64, max: 110 });
    /*
     * ⚠ RÉÉCRITS LE 2026-09-21, ET DANS LE SENS DU DURCISSEMENT. Le plancher
     * du libellé et celui de la glose valent 30, qui est `10,5 × 1080 / 390` —
     * la lisibilité mesurée sur un post pleine largeur de téléphone. Le mono,
     * qui ne porte plus que le surtitre et le pied, a un plancher de 22.
     */
    expect(TYPE.label).toEqual({ min: 32, max: 48, floor: 30 });
    expect(TYPE.gloss).toEqual({ min: 30, max: 40, floor: 30 });
    expect(TYPE.mono).toEqual({ min: 22, max: 30, floor: 22 });
  });

  it("the engine version is part of the contract", () => {
    // If this string never changes, the render cache never invalidates.
    expect(ENGINE_VERSION).toMatch(/^compose\/\d+$/);
  });
});
