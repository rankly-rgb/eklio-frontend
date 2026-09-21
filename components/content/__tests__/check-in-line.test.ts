import { describe, expect, it } from "vitest";
import { checkInSummary, tidyAnswer } from "@/components/content/check-in-line";
import type { ContentCheckin } from "@/lib/data/content";

/*
 * ── LA LIGNE QUE LA PREVIEW MONTRAIT ────────────────────────────────────
 *
 *   « This month: Burnout, mostly., taking new clients · Edit »
 *
 * Un point au milieu d'une énumération, une majuscule au milieu d'une phrase,
 * et une virgule qui suit un point. Les réponses étaient collées telles
 * quelles.
 *
 * ⚠ CE SONT SES MOTS ET ILS LE RESTENT. Rien ici ne reformule : on retire une
 * ponctuation finale, on replie les espaces, on abaisse une majuscule
 * ordinaire, on coupe proprement si c'est long.
 */

function checkin(overrides: Partial<ContentCheckin> = {}): ContentCheckin {
  return {
    brand_kit_id: "k1",
    month: "2026-09-01",
    sessions_theme: null,
    taking_clients: null,
    happening: null,
    ...overrides,
  } as ContentCheckin;
}

describe("⚠ A.5 — la ligne de check-in, nettoyée sans être réécrite", () => {
  it("CAS NÉGATIF : « Burnout, mostly., taking new clients » devient lisible", () => {
    /*
     * C'est la ligne exacte de la preview. Avant le correctif, cette assertion
     * échouait sur le point avant la virgule et sur la majuscule.
     */
    const line = checkInSummary(
      checkin({ sessions_theme: "Burnout, mostly.", taking_clients: "yes" })
    );
    expect(line).toBe("Burnout, mostly, taking new clients");
    // Ce qui partait : le point avant la virgule.
    expect(line).not.toContain("., ");
  });

  it("le format du brief, avec les trois réponses", () => {
    const line = checkInSummary(
      checkin({
        sessions_theme: "burnout",
        taking_clients: "yes",
        happening: "Closed the week of the 20th.",
      })
    );
    expect(line).toBe("burnout, taking new clients, Closed the week of the 20th");
  });

  it("⚠ LA CASSE N'EST JAMAIS TOUCHÉE, et c'est le cas qui a tranché", () => {
    /*
     * Une première version abaissait la première lettre quand le mot semblait
     * ordinaire. Ce test l'a cassée : « Portland » devenait « portland ».
     * Aucune règle déterministe ne distingue un début de phrase d'un nom
     * propre, donc on ne touche pas — c'est son texte.
     */
    expect(tidyAnswer("Portland clients")).toBe("Portland clients");
    expect(tidyAnswer("EMDR mostly")).toBe("EMDR mostly");
    expect(tidyAnswer("Burnout")).toBe("Burnout");
  });

  it("les espaces et les retours à la ligne sont repliés", () => {
    expect(tidyAnswer("  burnout   at\n  work ")).toBe("burnout at work");
  });

  it("la ponctuation finale part, et seulement elle", () => {
    expect(tidyAnswer("burnout, mostly...")).toBe("burnout, mostly");
    // ⚠ Un point d'interrogation AU MILIEU est le sien, il reste.
    expect(tidyAnswer("is it burnout? maybe.")).toBe("is it burnout? maybe");
  });

  it("une réponse longue est coupée SUR UN MOT", () => {
    const long =
      "burnout at the return to work after a long medical leave and everything that follows";
    const out = tidyAnswer(long)!;
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(50);
    /*
     * ⚠ PAS AU MILIEU D'UN MOT : « retu… » se lirait comme un bug. Le dernier
     * mot avant les points de suspension doit être un mot ENTIER de la
     * réponse d'origine.
     */
    const lastWord = out.slice(0, -1).trim().split(" ").pop()!;
    expect(long.split(" ")).toContain(lastWord);
  });

  it("une réponse vide ou blanche ne laisse pas de virgule orpheline", () => {
    expect(checkInSummary(checkin({ sessions_theme: "   ", taking_clients: "yes" }))).toBe(
      "taking new clients"
    );
    expect(tidyAnswer("")).toBeNull();
    expect(tidyAnswer("   ")).toBeNull();
    expect(tidyAnswer(".")).toBeNull();
  });

  it("aucune réponse du tout : rien, pas une ligne vide", () => {
    expect(checkInSummary(checkin())).toBeNull();
    expect(checkInSummary(null)).toBeNull();
  });

  it("⚠ LE CONTENU N'EST PAS RÉÉCRIT — seuls les bords bougent", () => {
    /*
     * Le garde-fou contre la dérive : si quelqu'un ajoutait un jour une
     * reformulation, cette assertion tomberait. Les mots de sa réponse, dans
     * son ordre, sont les mêmes après nettoyage.
     */
    const raw = "burnout, and the guilt that comes with resting";
    expect(tidyAnswer(raw)).toBe(raw);
  });
});
