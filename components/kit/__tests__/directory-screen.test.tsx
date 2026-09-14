import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DirectoryProfile } from "@/components/kit/directory-profile";
import type { DirectoryProfileView } from "@/lib/data/directory";

/*
 * ── LE PROFIL PSYCHOLOGY TODAY, RENDU ───────────────────────────────────
 *
 * Troisième occurrence du même défaut : `lib/directory/profile.ts` était
 * importé par son seul test, et le livrable CENTRAL de The Foundation
 * n'apparaissait sur aucun écran. Un test de module ne pouvait pas l'attraper.
 *
 * `renderToStaticMarkup`, comme pour l'étape 1 du brief : pas de jsdom, pas de
 * testing-library, aucune dépendance nouvelle.
 */

const render = (view: DirectoryProfileView) =>
  renderToStaticMarkup(<DirectoryProfile view={view} />);

const FULL: DirectoryProfileView = {
  structured: {
    licensed_state: ["OR"],
    issues: ["Anxiety", "Life transitions"],
    therapy_types: ["EMDR"],
    client_focus: ["Couples"],
  },
  prose: {
    firstParagraph: "You have been holding it together for a long time.",
    body: "In our first session, mostly you talk and I listen for the pattern.",
  },
  proseIssue: null,
};

describe("⚠ le livrable complet est à l'écran", () => {
  it("les champs structurés y sont, libellés comme l'annuaire les nomme", () => {
    const html = render(FULL);
    for (const value of ["OR", "Anxiety", "Life transitions", "EMDR", "Couples"]) {
      expect(html, `« ${value} » vient du brief et n'est pas rendu`).toContain(value);
    }
    expect(html).toContain("Licensed in");
    expect(html).toContain("Types of therapy");
  });

  it("la prose y est, les deux morceaux", () => {
    const html = render(FULL);
    expect(html).toContain(FULL.prose!.firstParagraph);
    expect(html).toContain(FULL.prose!.body);
  });

  it("⚠ le premier paragraphe est ADRESSABLE SEUL", () => {
    /*
     * C'est le seul morceau que les résultats de recherche de l'annuaire
     * montrent, et c'est celui que The First Line (L6) réécrira. Il lui faut
     * donc son ancre propre, pour qu'un lot ultérieur le vise sans redécouper
     * l'écran.
     */
    const html = render(FULL);
    expect(html, "pas d'ancre sur le premier paragraphe").toContain(
      'id="directory-first-paragraph"'
    );

    /* Et son propre bouton de copie : on copie CE paragraphe, pas le tout. */
    const block = html.slice(html.indexOf('id="directory-first-paragraph"'));
    const endOfBlock = block.indexOf(FULL.prose!.body);
    expect(
      block.slice(0, endOfBlock),
      "le premier paragraphe n'a pas son propre bouton de copie"
    ).toMatch(/First paragraph/);
  });

  it("le tout se copie aussi d'un bloc", () => {
    // Le formulaire de l'annuaire n'a qu'un seul champ pour les deux.
    expect(render(FULL)).toMatch(/Copy the whole statement/);
  });
});

describe("les absences se disent, et ne se confondent pas", () => {
  it("prose jamais produite : la phrase dit ce qui est prêt malgré tout", () => {
    const html = render({ ...FULL, prose: null, proseIssue: "not_produced" });
    expect(html).toMatch(/has not been written yet/i);
    // ⚠ Et les champs structurés restent rendus : ils sont dérivables sans modèle.
    expect(html).toContain("Anxiety");
  });

  it("⚠ prose rangée mais refusée : une AUTRE phrase", () => {
    /*
     * « Rien n'a été produit » et « ce qui est rangé ne passe plus les bornes »
     * envoient chercher à deux endroits différents. Les confondre sous un
     * « indisponible » fait perdre la journée de celle qui cherche.
     */
    const html = render({ ...FULL, prose: null, proseIssue: "stored_prose_rejected" });
    expect(html).toMatch(/did not pass our own length and repetition checks/i);
    expect(html).not.toMatch(/has not been written yet/i);
  });

  it("aucun champ structuré : un cas normal, pas une panne", () => {
    /*
     * `profile.test.ts` a déjà son test pour « tous les optionnels vides ».
     * L'écran doit le rendre comme un état normal, avec quoi faire ensuite.
     */
    const html = render({ structured: {}, prose: FULL.prose, proseIssue: null });
    expect(html).toMatch(/Nothing to fill in yet/i);
    expect(html).not.toMatch(/Licensed in/);
  });

  it("⚠ une clé absente ne produit PAS de libellé suivi de rien", () => {
    /*
     * La règle que `buildStructuredFields` applique en amont, vérifiée ici à
     * l'affichage : c'est la forme exacte du défaut qui a fait disparaître
     * trois lignes d'un livrable payant sans lever d'erreur.
     */
    const html = render({ ...FULL, structured: { issues: ["Anxiety"] } });
    expect(html).toContain("Issues");
    for (const label of ["Licensed in", "Types of therapy", "Client focus", "Insurance"]) {
      expect(html, `« ${label} » est rendu sans valeur`).not.toContain(label);
    }
  });
});
