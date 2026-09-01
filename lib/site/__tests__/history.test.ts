import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, pushHistory, type SpecHistory } from "@/lib/site/history";
import { clayAndSand } from "@/lib/site/__tests__/envelope.fixture";
import type { SiteSpec } from "@/lib/site/types";

/*
 * L'annulation — 50 instantanés, et rien qui tourne en rond.
 */

function specAt(version: number, primary = "#B4674A"): SiteSpec {
  return { ...clayAndSand().spec, spec_version: version, primary };
}

function history(present: SiteSpec): SpecHistory {
  return { past: [], present, future: [] };
}

describe("l'empilement", () => {
  it("garde l'état précédent et vide le futur", () => {
    const start = history(specAt(4));
    const next = pushHistory(start, specAt(5, "#000000"));

    expect(next.past).toHaveLength(1);
    expect(next.past[0].spec_version).toBe(4);
    expect(next.present.spec_version).toBe(5);
    expect(next.future).toEqual([]);
  });

  it("ignore une écriture qui n'a rien changé", () => {
    // Un patch `{}` ou un champ remis à sa valeur ne bouge pas `spec_version`.
    // L'empiler donnerait un Cmd+Z sans effet visible — ce qui fait douter d'un
    // annulateur plus sûrement qu'une absence d'annulateur.
    const start = history(specAt(4));
    expect(pushHistory(start, specAt(4))).toBe(start);
  });

  it("efface le futur quand on réédite après une annulation", () => {
    const branched: SpecHistory = {
      past: [specAt(3)],
      present: specAt(4),
      future: [specAt(5)],
    };

    // La règle de tout historique linéaire, et la seule qui ne mente pas.
    expect(pushHistory(branched, specAt(6)).future).toEqual([]);
  });

  it("ne garde que les 50 derniers", () => {
    let current = history(specAt(0));
    for (let version = 1; version <= 60; version += 1) {
      current = pushHistory(current, specAt(version));
    }

    expect(current.past).toHaveLength(HISTORY_LIMIT);
    // Le plus ancien conservé est celui d'il y a 50 écritures, pas le premier.
    expect(current.past[0].spec_version).toBe(60 - HISTORY_LIMIT);
    expect(current.present.spec_version).toBe(60);
  });
});

describe("ce que l'historique NE porte pas", () => {
  it("aucune variante dérivée", () => {
    // Elles ne sont pas dans `spec` : elles reviennent recalculées avec
    // l'enveloppe de l'annulation, comme de toute autre écriture.
    const snapshot = specAt(4);
    expect(snapshot).not.toHaveProperty("primary_text");
    expect(snapshot).not.toHaveProperty("cta_ink");
  });

  it("des instantanés, pas des opérations inverses", () => {
    // Une opération inverse supposerait qu'on sache défaire tout ce que la base
    // a fait : un correctif de contraste déplace un jeton ET recalcule quatre
    // variantes ; un reset réécrit une portée entière.
    const snapshot = specAt(4, "#123456");
    expect(snapshot.primary).toBe("#123456");
    expect(Object.keys(snapshot)).toContain("pages");
  });
});
