import { describe, expect, it } from "vitest";
import { isVisible, monthKey, monthLabel } from "@/lib/data/calendar";

/*
 * Le mois du produit est celui de New York : c'est dans ce fuseau que le cron
 * mensuel tourne, et une grille qui basculerait un jour trop tôt montrerait un
 * mois vide à tout le monde sur la côte Est.
 */
describe("monthKey", () => {
  it("rend le premier jour du mois, en heure de New York", () => {
    expect(monthKey(new Date("2026-09-15T12:00:00Z"))).toBe("2026-09-01");
  });

  it("le 1er à 02:00 UTC est encore le mois précédent à New York", () => {
    // 2026-10-01T02:00Z = 2026-09-30 22:00 à New York.
    expect(monthKey(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09-01");
  });
});

describe("monthLabel", () => {
  it("rend le mois en capitales pour le libellé mono", () => {
    expect(monthLabel("2026-09-01")).toBe("SEPTEMBER");
    expect(monthLabel("2026-01-01")).toBe("JANUARY");
  });
});

describe("isVisible", () => {
  it("seul `locked` est flouté", () => {
    expect(isVisible("locked")).toBe(false);
    expect(isVisible("draft")).toBe(true);
    expect(isVisible("ready")).toBe(true);
    expect(isVisible("published")).toBe(true);
  });
});
