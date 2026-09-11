import { describe, expect, it } from "vitest";
import { anonCapMessage, secondsUntilReset } from "@/lib/anon/spend";

/*
 * ── CE QU'ELLE LIT QUAND LE PLAFOND SE FERME ────────────────────────────
 *
 * Mesuré en session 4 : le refus est atteignable APRÈS les sept étapes, au
 * moment du bouton « Build my brand ». C'est le pire instant possible pour un
 * refus dans tout le produit, et la phrase qu'elle lit à cet instant est la
 * seule chose qui décide si elle revient.
 */

describe("le message de refus", () => {
  it("⚠ ne dit plus « in a little while » — les compteurs tournent en UTC", () => {
    /*
     * L'ancienne phrase disait « try again in a little while ». Les compteurs
     * sont clés sur la DATE UTC : une thérapeute en Californie qui lit ça à
     * vingt heures est à neuf heures du « little while ». Elle vient de
     * répondre à sept écrans ; un petit mensonge à cet instant est le plus
     * cher que ce produit puisse dire.
     */
    const global = anonCapMessage("global_cap");
    expect(global).not.toMatch(/little while|right now|few minutes/i);
    expect(global).toContain("today");
    expect(global).toContain("tomorrow");
  });

  it("dit que ses réponses sont sauvegardées, parce qu'elles le sont", () => {
    // L'autosave a écrit chaque étape ; le cookie vit trente jours. La phrase
    // est vraie, et c'est la seule raison de la dire.
    expect(anonCapMessage("global_cap")).toMatch(/answers are saved/i);
  });

  it("nomme la sortie qui SURVIT à la fermeture de l'onglet", () => {
    // Le cookie ne la suit pas sur son téléphone. Le lien par e-mail, si.
    // L'offre est sur le même écran (`components/brief/email-me-a-link.tsx`).
    expect(anonCapMessage("global_cap")).toMatch(/email/i);
  });

  it("⚠ ne cite jamais un nombre à quelqu'un qui n'a pas de compte", () => {
    // « vous avez utilisé 3 sur 3 » parle d'un appareil, pas d'elle ; et dire
    // que le plafond global est plein, c'est dire que le produit marche bien,
    // ce qui n'est pas son problème.
    for (const reason of ["ip_cap", "global_cap", "disabled", undefined]) {
      expect(anonCapMessage(reason)).not.toMatch(/\d/);
    }
  });

  it("un refus par IP et un refus global ne disent pas la même chose", () => {
    expect(anonCapMessage("ip_cap")).not.toBe(anonCapMessage("global_cap"));
    // Celui par IP propose le compte : c'est elle qui a beaucoup essayé.
    expect(anonCapMessage("ip_cap")).toMatch(/account/i);
  });

  it("une raison inconnue retombe sur la phrase la plus sûre", () => {
    expect(anonCapMessage("something_new")).toBe(anonCapMessage("global_cap"));
  });
});

describe("retry-after — l'heure du réveil, pas une heure ronde", () => {
  it("compte jusqu'à minuit UTC, pas une heure fixe", () => {
    // L'en-tête disait 3600 en dur : faux de vingt-trois heures dans le pire
    // cas, et faux dans le sens qui invite à réessayer pour rien.
    const evening = new Date("2026-10-06T20:15:00Z");
    expect(secondsUntilReset(evening)).toBe(3 * 3600 + 45 * 60);
  });

  it("juste avant minuit, c'est presque zéro — mais jamais zéro", () => {
    expect(secondsUntilReset(new Date("2026-10-06T23:59:59Z"))).toBe(1);
  });

  it("juste après minuit, c'est presque une journée entière", () => {
    expect(secondsUntilReset(new Date("2026-10-06T00:00:00Z"))).toBe(86400);
  });

  it("traverse une fin de mois sans se tromper de jour", () => {
    expect(secondsUntilReset(new Date("2026-10-31T22:00:00Z"))).toBe(2 * 3600);
  });
});
