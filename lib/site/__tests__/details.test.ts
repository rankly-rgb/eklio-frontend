import { describe, expect, it } from "vitest";
import {
  PRACTITIONER_NAME_KEY,
  detailFields,
  hasPractitionerName,
  practitionerNameMissing,
} from "@/lib/site/details";
import { clayAndSand } from "@/lib/site/__tests__/envelope.fixture";
import type { PracticeDetails } from "@/lib/site/types";

/*
 * `practitioner_name` — le nom de la praticienne, distinct de celui de la
 * practice, et le seul champ qu'on réclame quand il est vide.
 */

const WITHOUT: PracticeDetails = clayAndSand().spec.practice_details;

function withName(value: string | null): PracticeDetails {
  return { ...WITHOUT, practitioner_name: value };
}

describe("le contrôle n'existe que si la base expose la clé", () => {
  it("absent tant que `practice_details` ne la porte pas", () => {
    // Le rendre avant ferait refuser l'écriture en `unknown_field`, sur un
    // contrôle qu'elle vient de remplir.
    expect(hasPractitionerName(WITHOUT)).toBe(false);
    expect(detailFields(WITHOUT).map((field) => field.key)).not.toContain(
      PRACTITIONER_NAME_KEY
    );
  });

  it("apparaît dès que la clé est là, même vide", () => {
    // Aucun déploiement à faire le jour où le backend l'ajoute.
    expect(hasPractitionerName(withName(""))).toBe(true);
    expect(hasPractitionerName(withName(null))).toBe(true);
  });

  it("vient EN PREMIER — c'est le nom qui apparaît sur le site", () => {
    expect(detailFields(withName("Nora Whitfield"))[0]).toEqual({
      key: PRACTITIONER_NAME_KEY,
      label: "Your name",
    });
  });

  it("ne déplace ni ne retire les autres champs", () => {
    const before = detailFields(WITHOUT).map((field) => field.key);
    const after = detailFields(withName("Nora Whitfield")).map((f) => f.key);
    expect(after.slice(1)).toEqual(before);
  });
});

describe("on le réclame quand il est vide", () => {
  it.each([
    ["une chaîne vide", ""],
    ["des espaces", "   "],
    ["null", null],
  ])("%s compte comme manquant", (_label, value) => {
    expect(practitionerNameMissing(withName(value))).toBe(true);
  });

  it("rempli, on ne dit rien", () => {
    expect(practitionerNameMissing(withName("Nora Whitfield, LCSW"))).toBe(false);
  });

  it("on ne réclame PAS un champ que la base n'expose pas encore", () => {
    // Sinon l'éditeur signalerait un manque qu'elle n'a aucun moyen de combler.
    expect(practitionerNameMissing(WITHOUT)).toBe(false);
  });

  it("le nom de la practice ne tient pas lieu de nom de praticienne", () => {
    // C'est le manque que l'inventaire a révélé : `practice_details` portait
    // « Elm & Ember Therapy » et personne.
    expect(WITHOUT.practice_name).toBe("Elm & Ember Therapy");
    expect(practitionerNameMissing(withName(""))).toBe(true);
  });
});
