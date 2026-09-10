import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { FIXTURE_ITEMS, FIXTURE_LABEL, FIXTURE_MONTH } from "@/lib/content/fixtures/proposed-month";
import { STUB_LABEL } from "@/lib/content/generate/stub-model";

/*
 * ── UNE MAQUETTE NE DOIT JAMAIS POUVOIR PASSER POUR UN VRAI MOIS ────────
 *
 * L'écran de revue a été dessiné sur douze billets qui n'existent pas, parce
 * qu'aucun mois n'a encore été généré. C'est la bonne façon de le dessiner, et
 * c'est aussi exactement la façon dont une maquette finit publiée.
 *
 * Trois verrous, et le troisième est celui qui compte :
 *
 *   1. le module de fixtures n'est importé QUE par la page /dev ;
 *   2. l'écran affiche un badge dès qu'on le lui passe ;
 *   3. le label du générateur voyage jusqu'à l'écran — c'est ce qui distingue
 *      un mois écrit par un stub d'un mois écrit par un modèle, une fois les
 *      deux en base.
 */

const ROOT = resolve(__dirname, "../..");
const FIXTURE_MODULE = "content/fixtures/proposed-month";

function sources(dir: string): string[] {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".next") return [];
    if (entry.isDirectory()) return sources(child);
    return /\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

const ALL = [...sources("app"), ...sources("components"), ...sources("lib")];

describe("l'énumération elle-même", () => {
  it("balaye bien le dépôt", () => {
    // Sans cette garde, un balayage cassé rendrait la règle vacuously vraie.
    expect(ALL.length).toBeGreaterThan(100);
    expect(ALL).toContain("app/dev/content-plan/page.tsx");
  });
});

describe("les fixtures ne sortent pas de /dev", () => {
  it("un seul fichier importe le mois de démonstration", () => {
    const importers = ALL.filter((path) =>
      readFileSync(join(ROOT, path), "utf8").includes(FIXTURE_MODULE)
    ).filter((path) => !path.startsWith("app/__tests__"));

    expect(importers).toEqual(["app/dev/content-plan/page.tsx"]);
  });

  it("et la page /dev le déclare comme tel, en toutes lettres", () => {
    const source = readFileSync(join(ROOT, "app/dev/content-plan/page.tsx"), "utf8");
    // `fixture` sur le composant : c'est lui qui dessine le badge rouge.
    expect(source).toMatch(/\bfixture\b/);
    expect(source).toContain("FIXTURE_LABEL");
  });

  it("l'écran sait dessiner le badge, et le dit en texte", () => {
    const source = readFileSync(join(ROOT, "components/content/month-plan.tsx"), "utf8");
    expect(source).toContain("Fixture — not real content");
    // Témoin : un badge qui ne serait que de la couleur ne serait pas lu par
    // un lecteur d'écran. Ici c'est du texte, dans le flux.
    expect(source).not.toMatch(/aria-hidden[^>]*Fixture/);
  });
});

describe("le mois de démonstration a la forme du vrai", () => {
  it("porte le label du stub, et pas un nom de modèle", () => {
    expect(FIXTURE_LABEL).toBe(STUB_LABEL);
    expect(FIXTURE_LABEL).toContain("stub");
  });

  it("trois thèmes, douze billets, et chacun rattaché à son mois", () => {
    expect(FIXTURE_MONTH.themes).toHaveLength(3);
    expect(FIXTURE_ITEMS).toHaveLength(12);

    for (const item of FIXTURE_ITEMS) {
      expect(item.month_id).toBe(FIXTURE_MONTH.id);
      expect(item.status).toBe("proposed");
      // ⚠ `theme` et jamais `category` : `category` est à elle.
      expect(FIXTURE_MONTH.themes).toContain(item.theme);
      expect(item.category).toBeNull();
      // Deux textes, écrits séparément.
      expect(item.on_image_text).toBeTruthy();
      expect(item.caption).toBeTruthy();
      expect(item.caption?.startsWith(item.on_image_text ?? "")).toBe(false);
    }
  });

  it("ne cache pas l'état sans texte alternatif, qui est un vrai état", () => {
    // La RPC refuse `ready` sans alt text. Si toutes les fixtures en avaient,
    // la branche « ce billet ne peut pas être marqué prêt » ne serait jamais
    // dessinée, et personne ne verrait à quoi elle ressemble.
    expect(FIXTURE_ITEMS.some((item) => item.alt_text === null)).toBe(true);
    expect(FIXTURE_ITEMS.some((item) => item.alt_text !== null)).toBe(true);
  });
});
