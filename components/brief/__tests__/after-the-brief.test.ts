import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * ── LE NOMBRE D'ÉCRANS DIT LA VÉRITÉ ────────────────────────────────────
 *
 * La marche d'acquisition (`ACQUISITION_WALK.md` §2) : la jauge se remplit à
 * « 7 de 7 » et il reste deux écrans, sur un chemin vendu par son nombre
 * d'étapes. Ce fichier tient les deux moitiés de la correction — l'écran
 * n'affiche plus une barre pleine, et la page d'accueil ne promet plus sept
 * écrans jusqu'aux directions.
 *
 * Vérifié sur le CODE, pas sur un rendu : ce qui a dérivé la première fois,
 * c'est une chaîne, et c'est une chaîne qu'on garde.
 */

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("après le brief, plus de jauge pleine", () => {
  it("l'écran de positionnement n'affiche plus « 7 de 7 »", () => {
    const source = read("app/app/briefs/[id]/positioning/page.tsx");
    expect(source).not.toContain("<Progress7");
    expect(source).not.toContain("<StepCounter");
    expect(source).toContain("<AfterTheBrief");
  });

  it("le récapitulatif annonce lui aussi ce qui reste", () => {
    expect(read("app/app/briefs/[id]/review/page.tsx")).toContain("<AfterTheBrief");
  });

  it("le fil est nommé, jamais numéroté", () => {
    const source = read("components/brief/after-the-brief.tsx");
    // Trois repères, et aucun « Step N » : numéroter en ferait des étapes de
    // brief, ce qu'ils ne sont pas.
    for (const label of ["Review", "Your positioning", "Your directions"]) {
      expect(source).toContain(label);
    }
    expect(source).not.toMatch(/Step \$\{|Step \d/);
  });

  it("et il dit combien d'écrans restent, en toutes lettres", () => {
    const source = read("components/brief/after-the-brief.tsx");
    expect(source).toContain("One more screen");
    expect(source).toContain("more screens");
  });
});

describe("la page d'accueil ne promet plus sept écrans", () => {
  it("elle nomme la relecture entre le brief et les directions", () => {
    const source = read("app/page.tsx");
    expect(source).toContain("seven-step brief");
    // ⚠ LE CANARI : la phrase EXACTE qui était en production enchaînait le
    //   brief aux directions sans rien entre les deux.
    expect(source).not.toContain("Answer a seven-step brief. Get three complete");
    expect(source).toMatch(/check it over/);
  });
});
