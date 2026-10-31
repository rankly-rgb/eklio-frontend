import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rationaleBody } from "@/lib/content/rationale";

/*
 * « Why this one: Why this one: » sur chaque carte du flux (novembre 2026,
 * kit 45de0dac) : le modèle recopiait le préfixe que l'écran pose déjà.
 */
describe("« Why this one: » n'est écrit qu'une fois", () => {
  it("retire le préfixe recopié par le modèle, quelle qu'en soit la forme", () => {
    expect(rationaleBody("Why this one: It names an often overlooked form of grief.")).toBe(
      "It names an often overlooked form of grief."
    );
    expect(rationaleBody("why this one — it names grief")).toBe("It names grief");
    expect(rationaleBody("Why this one: Why this one: twice")).toBe("Twice");
    expect(rationaleBody("  WHY THIS ONE:it names grief")).toBe("It names grief");
  });

  it("laisse intacte une justification sans préfixe, et rend vide ce qui est vide", () => {
    expect(rationaleBody("It names subtle ways the past may show up.")).toBe(
      "It names subtle ways the past may show up."
    );
    expect(rationaleBody("A reason why this one matters.")).toBe("A reason why this one matters.");
    expect(rationaleBody(null)).toBe("");
    expect(rationaleBody("Why this one:")).toBe("");
  });

  it("chaque écran qui pose le préfixe passe la justification par rationaleBody", () => {
    const root = join(__dirname, "..", "..", "..");
    for (const rel of [
      "components/content/content-stream.tsx",
      "components/content/review-surface.tsx",
      "components/content/write-panel.tsx",
    ]) {
      const source = readFileSync(join(root, rel), "utf8");
      const prefixed = source.match(/Why this one:(<\/span>)?\s*\{[^}]*\}/g) ?? [];
      expect(prefixed.length, rel).toBeGreaterThan(0);
      for (const use of prefixed) expect(use, rel).toContain("rationaleBody(");
    }
  });

  it("la lecture de la réponse du modèle retire le préfixe avant d'écrire", () => {
    const source = readFileSync(join(__dirname, "..", "generate", "copy-batch.ts"), "utf8");
    const reads = source.match(/rationale: typeof o\.rationale === "string" \? [^,]+/g) ?? [];
    expect(reads.length).toBe(2);
    for (const r of reads) expect(r).toContain("rationaleBody(o.rationale)");
  });
});
