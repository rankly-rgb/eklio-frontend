import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { displayNameFrom } from "@/lib/app/header-context";

/*
 * Les quatre défauts visibles en production le 8 septembre 2026, et ce qui
 * les empêche de revenir.
 *
 * Ils n'ont rien en commun sauf leur famille : chacun est une VÉRITÉ AFFICHÉE
 * DEUX FOIS, ou affichée à partir de la mauvaise source. C'est le mode de
 * défaillance de cet écran, et c'est pour ça qu'ils sont regroupés ici plutôt
 * que dispersés dans les fichiers qu'ils touchent.
 */

const ROOT = resolve(__dirname, "../..");

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/*
 * ── DÉFAUT 1 ─────────────────────────────────────────────────────────────
 * « YOUR FIRST WEEK » affichait sa barre et son « 0 OF 7 » DEUX FOIS une
 * fois dépliée : une dans la ligne de résumé, une dans la liste elle-même.
 * Et les deux pouvaient diverger — la liste compte son propre état
 * optimiste, qui bouge dès qu'elle coche ; la ligne compte la prop du
 * serveur, qui ne bouge pas.
 */
describe("défaut 1 — la barre de progression n'est rendue qu'une fois", () => {
  const row = stripComments(source("components/kit/launch-progress-row.tsx"));
  const list = stripComments(source("components/checklist/launch-checklist.tsx"));

  it("la liste dépliée porte bien sa propre barre et son propre compte", () => {
    // Si ça cessait d'être vrai, le correctif ci-dessous retirerait la
    // seule barre restante au lieu de la doublure.
    expect(list).toContain("bg-accent transition-[width]");
    expect(list).toContain("${resolved} of ${total}");
  });

  it("⚠ la ligne de résumé masque les siennes dès qu'elle est ouverte", () => {
    const summary = row.slice(row.indexOf("{open ? ("), row.indexOf("<LaunchChecklist"));
    expect(
      summary.includes("${progress.resolvedCount} of ${progress.total}"),
      "le compte du résumé n'est plus dans la branche conditionnelle de `open`"
    ).toBe(true);
    expect(
      summary.includes('<span className="flex-1" />'),
      "la branche ouverte devrait ne rendre qu'un espaceur, pas une barre"
    ).toBe(true);
  });

  it("et la liste n'est montée que dans le même état ouvert", () => {
    expect(row).toMatch(/\{open \? \([\s\S]*<LaunchChecklist/);
  });
});

/*
 * ── DÉFAUT 2 ─────────────────────────────────────────────────────────────
 * Sur le canevas des couleurs, « Primary fill · CTA ink text » chevauchait
 * « Body copy sits in dark neutral, on paper. » et sortait par la gauche du
 * conteneur, qui le coupait.
 *
 * Deux causes, deux règles :
 *   - une étiquette `top-full` sort du flux, donc le flux doit lui laisser
 *     la place ;
 *   - une étiquette LARGE centrée sur un élément ÉTROIT déborde des deux
 *     côtés ; celle-là débordait dans un conteneur `overflow-hidden`.
 */
describe("défaut 2 — les étiquettes du canevas ne se chevauchent plus", () => {
  const canvas = stripComments(source("components/kit/colors-section.tsx"));

  const hangingTags = [...canvas.matchAll(/<RegionTag[^>]*className="([^"]*top-full[^"]*)"/g)].map(
    (match) => match[1]
  );

  it("l'énumération trouve bien les étiquettes suspendues", () => {
    expect(hangingTags.length).toBeGreaterThanOrEqual(3);
  });

  it.each(hangingTags)("« %s » ne se centre pas sur ce qu'elle nomme", (className) => {
    /*
     * `left-1/2 -translate-x-1/2` sur une pastille de 145px avec une
     * étiquette de 180px la pousse hors du bord gauche. Elles partent
     * maintenant du bord gauche de l'élément et grandissent vers la droite,
     * où il y a 900px de canevas.
     */
    expect(className).not.toContain("-translate-x-1/2");
    expect(className).toContain("left-0");
  });

  it("le flux laisse la place aux étiquettes suspendues", () => {
    // La rangée qui en porte deux, et le conteneur qui porte la dernière.
    expect(canvas).toContain("mt-5 mb-9 flex flex-wrap");
    expect(canvas).toContain("relative p-6 pb-14");
  });
});

/*
 * ── DÉFAUT 3 ─────────────────────────────────────────────────────────────
 * La pastille de compte affichait la partie locale de l'email
 * (« contactnsocialmediaonline ») à l'endroit d'un nom, sur tous les écrans.
 * La donnée existait ; elle n'était pas demandée.
 */
describe("défaut 3 — le nom affiché vient d'une source qui en est une", () => {
  it("son nom complet, quand elle l'a donné", () => {
    expect(
      displayNameFrom({
        fullName: "Dana Whitfield",
        practiceName: "Elm & Ember Therapy",
        email: "contactnsocialmediaonline@gmail.com",
      })
    ).toBe("Dana Whitfield");
  });

  it("sinon le nom de la practice", () => {
    expect(
      displayNameFrom({
        fullName: null,
        practiceName: "Elm & Ember Therapy",
        practitionerName: "Dana Whitfield",
        email: "contactnsocialmediaonline@gmail.com",
      })
    ).toBe("Elm & Ember Therapy");
  });

  it("sinon le PRÉNOM du brief, pas la ligne entière", () => {
    expect(
      displayNameFrom({
        practitionerName: "Dana Whitfield, LCSW",
        email: "contactnsocialmediaonline@gmail.com",
      })
    ).toBe("Dana");
  });

  it("⚠ la partie locale de l'email reste le DERNIER recours", () => {
    expect(displayNameFrom({ email: "contactnsocialmediaonline@gmail.com" })).toBe(
      "contactnsocialmediaonline"
    );
  });

  it("un champ vide ou blanc ne compte pas comme rempli", () => {
    // `full_name` vaut « » plutôt que null pour toute inscription qui a
    // touché le champ sans le remplir — c'est le cas réel du défaut.
    expect(
      displayNameFrom({ fullName: "   ", practiceName: "Elm & Ember Therapy" })
    ).toBe("Elm & Ember Therapy");
  });

  it("et rien du tout rend une chaîne vide, que la pastille sait remplacer", () => {
    expect(displayNameFrom({})).toBe("");
  });
});

/*
 * ── DÉFAUT 4 ─────────────────────────────────────────────────────────────
 * La liste de sections surlignait le mauvais élément. Il devait mourir avec
 * la découpe en routes : on le vérifie plutôt que de le supposer.
 */
describe("défaut 4 — l'ancien scroll-spy n'existe plus", () => {
  it("le rail à ancres est supprimé, pas adapté", () => {
    expect(existsSync(join(ROOT, "components/kit/workspace-nav.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/kit/brand-kit-view.tsx"))).toBe(false);
  });

  it("plus aucune section du kit n'est atteinte par une ancre", () => {
    const rail = stripComments(source("components/kit/kit-rail.tsx"));
    expect(rail).not.toMatch(/href=\{?["'`]#/);
  });
});
