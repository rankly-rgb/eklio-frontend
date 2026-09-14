import { describe, expect, it } from "vitest";
import {
  GOOGLE_DESCRIPTION_MAX,
  googleDescription,
  personalStatement,
  type PracticeDetails,
} from "@/lib/kit/launch-copy";
import { stepTextBlocks } from "@/lib/launch/material";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";

/*
 * ── DEUX LECTEURS, DEUX TEXTES ──────────────────────────────────────────
 *
 * La démarche Google recevait EXACTEMENT le bloc de Psychology Today :
 * `stepTextBlocks` faisait tomber `update_directory` et `google_profile` sur
 * le même `push("Statement", …)`.
 *
 * Un profil Psychology Today est lu par quelqu'un qui compare déjà des
 * thérapeutes — la licence et la ville y sont des critères de tri. Une fiche
 * Google est lue par quelqu'un qui a tapé « therapist near me » et ne sait pas
 * encore s'il veut appeler.
 */

const details: PracticeDetails = {
  practitionerName: "Maya Ellison",
  licenseLabel: "LCSW",
  licenseNumber: "L-4417",
  city: "Portland",
  state: "OR",
};

const ABOUT =
  "A practice for people whose bodies keep score long after the thing itself is over.";

function context(over: Partial<LaunchStepContext> = {}): LaunchStepContext {
  return {
    practiceName: "Elm & Ember",
    practitionerLine: "Maya Ellison",
    practiceDetails: details,
    aboutExcerpt: ABOUT,
    bookingUrl: "https://example.com/book",
    ...over,
  } as LaunchStepContext;
}

describe("⚠ les deux textes sont produits séparément et diffèrent", () => {
  it("la description Google n'est pas la déclaration Psychology Today", () => {
    const pt = personalStatement("Maya Ellison", details);
    const google = googleDescription(ABOUT, details);

    expect(pt).not.toBeNull();
    expect(google).not.toBeNull();
    expect(google).not.toBe(pt);
  });

  it("la checklist ne leur donne plus le même bloc", () => {
    /*
     * ⚠ LE TEST QUI TIENT LE LOT. Les deux `case` tombaient sur le même
     * `push`, et rien dans le dépôt ne le disait — c'est en lisant la sortie
     * rendue qu'on l'a vu, comme les trois lignes disparues du lot 6.
     */
    const pt = stepTextBlocks("update_directory", context());
    const google = stepTextBlocks("google_profile", context());

    expect(pt).toHaveLength(1);
    expect(google).toHaveLength(1);
    expect(google[0].text).not.toBe(pt[0].text);
    expect(pt[0].label).toBe("Statement");
    expect(google[0].label).toBe("Description");
  });
});

describe("ce que chacun met en avant", () => {
  it("Psychology Today porte la licence : c'est un critère de tri là-bas", () => {
    expect(personalStatement("Maya Ellison", details)).toContain("LCSW");
  });

  it("⚠ Google porte ce que la pratique FAIT, pas le numéro de licence", () => {
    const google = googleDescription(ABOUT, details) ?? "";
    expect(google).toContain("bodies keep score");
    // Sur Google, un numéro de licence est un chiffre qui n'aide personne à
    // décider d'appeler, et la place est comptée.
    expect(google).not.toContain("L-4417");
  });

  it("Google porte quand même le lieu", () => {
    expect(googleDescription(ABOUT, details)).toContain("Portland, OR");
  });
});

describe("les champs absents ne produisent rien", () => {
  it("aucun about, aucun lieu : aucun texte", () => {
    expect(googleDescription(null, null)).toBeNull();
  });

  it("un about sans lieu ne laisse pas de séparateur orphelin", () => {
    /*
     * ⚠ LE DÉFAUT DE CONCATÉNATION, DANS SA FORME TYPESCRIPT. `'a' + ', ' +
     * undefined` ne vaut pas NULL ici — il vaut la chaîne « a, undefined »,
     * qu'elle collerait sur sa fiche publique.
     */
    const google = googleDescription(ABOUT, null) ?? "";
    expect(google).toBe(ABOUT);
    expect(google).not.toContain("undefined");
    expect(google).not.toContain("null");
    expect(google.trim()).toBe(google);
  });

  it("un lieu sans about ne rend pas une ville toute seule mal ponctuée", () => {
    const google = googleDescription(null, details) ?? "";
    expect(google).toBe("Portland, OR");
  });
});

describe("la borne est celle de Google", () => {
  it("750, et ce n'est pas celle de Psychology Today", () => {
    // La base l'impose aussi, par plateforme
    // (`directory_profiles_first_paragraph_check` : 750 pour Google, 1200
    // pour Psychology Today).
    expect(GOOGLE_DESCRIPTION_MAX).toBe(750);
  });

  it("un texte plus long est tronqué sur une limite de mot", () => {
    /*
     * ⚠ ON TRONQUE ICI, ET C'EST L'INVERSE DE `lib/directory/profile.ts`.
     * Les deux objets diffèrent : là-bas, une prose RÉDIGÉE trop longue est
     * un échec de génération qu'on veut voir ; ici, c'est un assemblage de
     * champs qu'elle a écrits, et le seul autre recours serait de lui rendre
     * une chaîne vide.
     */
    const long = "word ".repeat(400).trim();
    const google = googleDescription(long, null) ?? "";
    expect(google.length).toBeLessThanOrEqual(GOOGLE_DESCRIPTION_MAX + 1);
    expect(google.endsWith("…")).toBe(true);
    expect(google).not.toMatch(/wo…$/);
  });
});
