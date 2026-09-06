import { describe, expect, it } from "vitest";
import { bookingUrlFrom, practiceDetailsFrom } from "@/lib/kit/launch-context";

describe("les deux champs que le spec du site prête au lancement", () => {
  it("un spec absent ne devient pas un objet vide", () => {
    // Un objet à cinq nulls et « pas encore de détails » ne se lisent pas
    // pareil : le premier passe les gardes `if (details)` des étapes.
    expect(practiceDetailsFrom(null)).toBeNull();
    expect(practiceDetailsFrom({ hero: {} })).toBeNull();
  });

  it("les champs manquants deviennent null, jamais undefined", () => {
    const details = practiceDetailsFrom({
      practice_details: { practitioner_name: "Dana Whitfield", city: "Austin" },
      hero: {},
    });
    expect(details).toEqual({
      practitionerName: "Dana Whitfield",
      licenseLabel: null,
      licenseNumber: null,
      city: "Austin",
      state: null,
    });
  });

  it("une chaîne vide n'est pas un lien de réservation", () => {
    // C'est la valeur réelle d'un `cta_target_url` jamais renseigné, et un
    // bouton « copier » sur une chaîne vide est pire qu'un lien absent.
    expect(bookingUrlFrom({ hero: { cta_target_url: "" } })).toBeNull();
    expect(bookingUrlFrom({ hero: {} })).toBeNull();
    expect(bookingUrlFrom(null)).toBeNull();
    expect(bookingUrlFrom({ hero: { cta_target_url: "https://cal.com/dana" } })).toBe(
      "https://cal.com/dana"
    );
  });
});
