import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticeStep, WebsiteStep } from "@/components/brief/step-bodies";
import { FIXTURE_CATALOG, FIXTURE_DRAFT } from "@/lib/brief/fixtures/catalog";
import type { StepDraft } from "@/lib/brief/flow";
import { stepIssue } from "@/lib/brief/flow";

/*
 * ── LE TEST QUI PARCOURT L'ÉCRAN ────────────────────────────────────────
 *
 * ⚠ CELUI-CI EXISTE PARCE QUE TOUS LES AUTRES ÉTAIENT VERTS.
 *
 * `lib/brief/platform.ts` a été écrit au lot 1, testé par deux fichiers, et
 * importé par AUCUN fichier de `app/` ni de `components/`. Pire que du code
 * mort : `stepIssue("practice")` exigeait `site_platform_id` — « Tell us where
 * your website lives » — et l'écran n'offrait aucun champ pour répondre. Un
 * brief neuf se bloquait à l'étape 1, sur une question invisible.
 *
 * Aucun test de module ne pouvait l'attraper, parce que chaque module était
 * juste. Ce qui manquait était entre eux.
 *
 * ── COMMENT, SANS DÉPENDANCE NOUVELLE ───────────────────────────────────
 *
 * `renderToStaticMarkup`, de `react-dom/server`, déjà présent. Pas de jsdom,
 * pas de testing-library : on ne simule pas un clic, on regarde ce qui est
 * rendu. C'est exactement la question que personne ne posait.
 */

function draftAt(over: Partial<StepDraft> = {}): StepDraft {
  return { ...FIXTURE_DRAFT, ...over };
}

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

/*
 * Les props que `StepBodyProps` exige et dont l'étape 1 ne se sert pas. Elles
 * sont posées explicitement plutôt que forcées par un cast : le jour où la
 * signature change, on veut que la compilation le dise ici aussi.
 */
const INERT = {
  projectId: "11111111-1111-1111-1111-111111111111",
  preview: null,
  toneCards: null,
  setToneCards: () => {},
  update: () => {},
} as const;

const screen = (over: Partial<StepDraft> = {}) =>
  render(
    <PracticeStep {...INERT} draft={draftAt(over)} catalog={FIXTURE_CATALOG} />
  );

describe("⚠ l'étape 1 POSE la question de plateforme", () => {
  it("la question est à l'écran", () => {
    const html = screen();
    expect(
      html,
      "L'étape 1 ne demande pas où le site vit, et `stepIssue` l'exige : " +
        "le brief se bloque sur une question qui n'est pas posée."
    ).toContain("Where your website lives");
  });

  it("chaque plateforme du catalogue y est proposée", () => {
    const html = screen();
    for (const platform of FIXTURE_CATALOG.sitePlatforms) {
      expect(
        html,
        `« ${platform.label} » est dans site_platforms et pas à l'écran`
      ).toContain(platform.label);
    }
  });

  it("⚠ WordPress est proposé — l'ancien champ ne l'offrait pas", () => {
    /*
     * L'ancien « Where you'll build it » listait Squarespace, Lovable, Framer
     * et Webflow : la seule plateforme sur laquelle Eklio publie vraiment n'y
     * figurait pas. C'est le symptôme qui a fait trouver le reste.
     */
    expect(screen()).toContain("WordPress");
  });

  it("ce que l'écran exige et ce qu'il offre sont la même chose", () => {
    /*
     * ⚠ LE CŒUR DU DÉFAUT, EN UNE ASSERTION. `stepIssue` se plaint d'un champ
     * manquant ; le test vérifie que ce champ-là est rendu. Les deux moitiés
     * de la contradiction, mises face à face.
     */
    /* Étape 1 entièrement répondue SAUF la plateforme : c'est le seul état où
       `stepIssue` parle de la plateforme, puisqu'il rend le PREMIER manque. */
    const answered = {
      practice_name: "Elm & Ember Counseling",
      license_type_id: FIXTURE_CATALOG.licenseTypes[0].id,
      specialty_ids: [FIXTURE_CATALOG.specialties[0].id],
    };
    const issue = stepIssue(
      "practice",
      draftAt({ ...answered, site_platform_id: null })
    );
    expect(issue).toBeTruthy();
    expect(issue).toMatch(/where your website lives/i);
    expect(screen({ site_platform_id: null })).toContain("Where your website lives");

    // Et répondre lève le blocage.
    expect(
      stepIssue("practice", draftAt({ ...answered, site_platform_id: "wordpress" }))
    ).toBeNull();
  });
});

describe("la réponse dit ce qu'elle change, et ne refuse personne", () => {
  it("WordPress : tout est ouvert", () => {
    const html = screen({ site_platform_id: "wordpress" });
    expect(html).toMatch(/we can publish your pages there/i);
  });

  it("⚠ une plateforme non publiable dit ce qui reste ouvert", () => {
    /*
     * LA CORRECTION DE SPEC. Ce n'est pas un mur : l'ancienne offre n'est pas
     * retirée de la vente et ne promet aucune publication. Un écran qui ferme
     * sans dire ce qui reste ouvert se lit comme une porte.
     */
    const html = screen({ site_platform_id: "wix" });
    expect(html, "la raison n'est pas affichée").toContain(
      "We do not publish to Wix yet"
    );
    expect(html, "l'écran ferme sans dire ce qui reste ouvert").toMatch(
      /still yours to buy/i
    );
  });

  it("« conditional » n'est pas rendu comme un refus", () => {
    const html = screen({ site_platform_id: "a_conditional_one" });
    expect(html).toContain("still confirming");
    expect(html).not.toMatch(/still yours to buy/i);
  });

  it("sans réponse, aucune conséquence n'est affichée", () => {
    // Annoncer un refus avant qu'elle ait répondu serait un reproche.
    const html = screen({ site_platform_id: null });
    expect(html).not.toMatch(/still yours to buy/i);
    expect(html).not.toMatch(/we can publish your pages there/i);
  });

  it("⚠ une plateforme retirée du catalogue ne disparaît pas en silence", () => {
    const html = screen({ site_platform_id: "a_platform_that_left" });
    expect(html).toMatch(/no longer on our list/i);
  });
});

describe("⚠ l'ancienne question a quitté l'écran", () => {
  const websiteStep = render(
    <WebsiteStep {...INERT} draft={draftAt()} catalog={FIXTURE_CATALOG} />
  );

  it("« Where you'll build it » n'est plus rendu", () => {
    expect(websiteStep).not.toMatch(/Where you.{0,8}ll build it/i);
  });

  it("l'étape 7 ne pose plus de question de plateforme du tout", () => {
    /*
     * UNE SEULE question de plateforme dans le brief. Deux listes différentes
     * à deux endroits, c'était la même question posée deux fois avec deux
     * réponses possibles — et c'est ce qui a permis à l'étape 1 de rester
     * vide sans que personne ne le remarque.
     */
    for (const label of ["Squarespace", "Lovable", "Framer", "Webflow"]) {
      expect(
        websiteStep,
        `« ${label} » est encore proposé à l'étape 7`
      ).not.toContain(label);
    }
  });
});
