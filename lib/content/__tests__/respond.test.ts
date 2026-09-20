import { describe, expect, it } from "vitest";
import { contentResponse } from "@/lib/content/respond";
import { contentStatusForCode } from "@/lib/data/content";

/*
 * ── LE CORPS D'UN REFUS, ET POURQUOI IL A SON PROPRE FICHIER ────────────
 *
 * Un défaut réel, trouvé en relisant la table des statuts et non par un test :
 * le flux de cartes lisait `body.error.code` sur un corps où `error` est une
 * CHAÎNE. La branche « la banque est vide » ne pouvait donc jamais partir, et
 * une banque épuisée s'annonçait « That could not be swapped. Try again. » —
 * une phrase qui invite à réessayer un tirage qui rendra le même rien.
 *
 * Et `bank_exhausted` n'était pas dans la table : il retombait sur 500, donc
 * l'écran disait « Eklio est cassé » pour un dimensionnement de banque.
 *
 * Les deux moitiés sont vérifiées ici : la forme du corps, et le statut.
 */

describe("le corps d'un refus porte le code À CÔTÉ de la phrase", () => {
  it("`error` reste une chaîne, parce que tous les écrans l'affichent", async () => {
    const response = contentResponse({
      ok: false,
      code: "bank_exhausted",
      message: "bank_exhausted",
      status: 409,
    });
    const body = (await response.json()) as { error: unknown; code: unknown };

    expect(typeof body.error).toBe("string");
    /*
     * ⚠ C'EST LA LIGNE QUI AURAIT ÉCHOUÉ AVANT LA CORRECTION. Le corps ne
     * portait aucun `code`, et le seul écran qui en avait besoin lisait un
     * champ qui n'existait pas.
     */
    expect(body.code).toBe("bank_exhausted");
  });

  it("un succès ne porte ni l'un ni l'autre", async () => {
    const response = contentResponse({ ok: true, data: { id: "x" } });
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ id: "x" });
    expect(response.status).toBe(200);
  });
});

describe("le statut de chaque code de refus", () => {
  /*
   * ⚠ LA TABLE EST ÉNUMÉRÉE, PAS ÉCHANTILLONNÉE. Un code absent retombe sur
   * 500 — délibérément, pour qu'un nouveau refus se remarque. Ce qui se
   * remarque doit ensuite être ajouté, et c'est cette liste qui dit lesquels
   * l'ont été.
   */
  const CASES: Array<[string, number, string]> = [
    ["not_found", 404, "un 403 confirmerait que l'item d'une autre existe"],
    ["payment_required", 402, "un refus rendu « rien ici » se lit comme un bug"],
    ["unknown_field", 400, "la cliente a envoyé une clef que le serveur refuse"],
    ["alt_text_required", 400, "idem"],
    ["invalid_preferences", 400, "idem"],
    ["invalid_checkin", 400, "idem"],
    ["month_not_ready", 409, "la requête est valide, l'état du monde refuse"],
    ["bank_exhausted", 409, "la requête est valide, la banque n'a plus rien"],
    ["unknown_layout", 400, "une mise en page qui n'est pas au catalogue"],
  ];

  for (const [code, status, why] of CASES) {
    it(`${code} → ${status} (${why})`, () => {
      expect(contentStatusForCode(code)).toBe(status);
    });
  }

  it("un code inconnu retombe sur 500, et c'est voulu", () => {
    /*
     * Un nouveau refus rapporté comme la faute de la cliente (400) passerait
     * inaperçu. 500 le rend visible.
     */
    expect(contentStatusForCode("a_refusal_nobody_mapped_yet")).toBe(500);
  });
});
