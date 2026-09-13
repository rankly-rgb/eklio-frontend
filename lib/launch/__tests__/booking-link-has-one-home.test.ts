import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const STEP = "components/launch/site-setup-material.tsx";

/*
 * ── UN SEUL ENDROIT OÙ CE CHAMP S'ÉCRIT ──────────────────────────────────
 *
 * `hero.cta_target_url` a déjà DEUX éditeurs, et tous deux écrivent la même
 * colonne par la même route : la section Details de l'éditeur de site, et
 * Settings. L'étape 1 en demande un troisième affichage — pas une troisième
 * écriture.
 *
 * Settings est celui vers lequel on renvoie, parce qu'il fonctionne : la route
 * de l'éditeur de site lève encore en production (FINDINGS.md), et y envoyer
 * la praticienne est précisément le défaut que cette étape a déjà corrigé une
 * fois.
 */
describe("le lien de réservation n'a qu'un seul endroit où s'écrire", () => {
  it("l'étape renvoie vers Settings", () => {
    expect(read(STEP)).toContain('"/app/settings"');
  });

  it("⚠ et n'écrit rien elle-même : ni PATCH, ni POST, ni formulaire", () => {
    const body = read(STEP);
    expect(body).not.toContain("site-spec");
    expect(body).not.toMatch(/method:\s*"(PATCH|POST|PUT)"/);
    expect(body).not.toContain("<form");
  });

  it("l'écriture existante est bien là où on la dit", () => {
    // Si Settings cessait d'écrire ce champ, le lien ci-dessus ne mènerait
    // nulle part et ce test le dit avant la praticienne.
    const settings = read("components/settings/settings-view.tsx");
    expect(settings).toContain("cta_target_url");
    expect(settings).toContain("/site-spec");
  });

  it("⚠ l'avertissement est AU-DESSUS du puits de copie, pas à côté", () => {
    const body = read(STEP);
    expect(body.indexOf("<BookingLink")).toBeGreaterThan(-1);
    expect(body.indexOf("<BookingLink")).toBeLessThan(body.indexOf("<PromptWell"));
  });

  it("il dit ce que coûte l'absence, en clair", () => {
    const body = read(STEP);
    expect(body).toContain("no working way to reach you");
    expect(body).toContain("won&rsquo;t go anywhere");
  });
});
