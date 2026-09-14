import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { qualify, type SitePlatform } from "@/lib/brief/platform";

/*
 * ── LA QUALIFICATION DE PLATEFORME ──────────────────────────────────────
 *
 * Trois choses sont vérifiées ici, et la première est la plus importante :
 *
 *   1. ce module ne contient AUCUN nom de plateforme ;
 *   2. la décision a trois issues, pas deux ;
 *   3. une plateforme inconnue est refusée, pas ignorée.
 */

function platform(over: Partial<SitePlatform> = {}): SitePlatform {
  return {
    id: "p1",
    label: "A platform",
    status: "accepted",
    notice: null,
    ...over,
  };
}

describe("⚠ la liste vit en base, pas dans le code", () => {
  it("aucun nom de plateforme n'est écrit dans le module", () => {
    /*
     * ⚠ CE TEST EST LE LOT. La question « Squarespace expose-t-il une API de
     * création de pages » n'est pas tranchée ; elle le sera par une
     * demi-journée de lecture de documentation, et ce jour-là la réponse doit
     * coûter un UPDATE sur une ligne — pas un déploiement.
     *
     * Un `if (id === "squarespace")` glissé ici plus tard annulerait ça sans
     * qu'aucun autre test bouge : le comportement serait le même jusqu'au jour
     * où la base change d'avis et le code ne suit pas. D'où une lecture du
     * fichier source, qui est le seul moyen de l'attraper.
     *
     * Les commentaires sont retirés avant l'inspection : l'en-tête du module
     * NOMME Squarespace pour expliquer pourquoi la liste est en base, et
     * interdire ça reviendrait à interdire d'écrire la raison.
     */
    const source = readFileSync("lib/brief/platform.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    for (const name of [
      "wordpress",
      "squarespace",
      "wix",
      "webflow",
      "WordPress",
      "Squarespace",
    ]) {
      expect(source, `${name} est écrit en dur dans le module`).not.toContain(
        name
      );
    }
  });
});

describe("la décision a trois issues", () => {
  it("accepté : on vend", () => {
    const result = qualify("p1", [platform({ status: "accepted" })]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.status).toBe("accepted");
  });

  it("conditionnel : on vend ET on le dit", () => {
    /*
     * ⚠ LE TROISIÈME ÉTAT EST LE POINT. Deux états auraient forcé à ranger une
     * question sans réponse du côté « accepté » — et à découvrir six semaines
     * plus tard qu'on doit un remboursement.
     */
    const result = qualify("p1", [
      platform({ status: "conditional", notice: "Still confirming." }),
    ]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.status).toBe("conditional");
    expect(result.ok && result.status === "conditional" && result.notice).toBe(
      "Still confirming."
    );
  });

  it("refusé : on ne vend pas, et on explique", () => {
    const result = qualify("p1", [
      platform({ status: "refused", notice: "We do not publish there." }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("refused");
    expect(
      result.ok === false && result.reason === "refused" && result.notice
    ).toBe("We do not publish there.");
  });
});

describe("ce qui n'a pas de réponse", () => {
  it("pas encore répondu", () => {
    const result = qualify(null, [platform()]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("not_answered");
  });

  it("⚠ une plateforme inconnue est REFUSÉE, pas ignorée", () => {
    /*
     * Un identifiant qui n'est plus au catalogue — retiré, renommé — ne doit
     * pas se lire comme « pas de contrainte ». C'est la forme exacte du défaut
     * que ce dépôt documente depuis le lot 6 : une valeur qui disparaît sans
     * erreur, et le résultat plausible qu'elle laisse derrière elle.
     */
    const result = qualify("une_plateforme_retiree", [platform()]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe("unknown_platform");
  });

  it("⚠ un catalogue vide refuse tout le monde", () => {
    /*
     * C'est ce que rend `loadSitePlatforms` sur une erreur de lecture, et le
     * sens de l'échec est délibérément l'inverse de celui d'un plafond
     * anti-abus : laisser passer voudrait dire encaisser 390 $ en promettant
     * une publication sur une plateforme dont on ne sait rien.
     */
    expect(qualify("wordpress", []).ok).toBe(false);
  });
});

describe("la phrase existe toujours quand on refuse", () => {
  it("même si la base en manquait une", () => {
    /*
     * La base l'impose (`site_platforms_notice_where_needed`), mais une
     * contrainte SQL ne protège pas un type TypeScript, et un écran qui refuse
     * sans expliquer est pire qu'un écran qui explique maladroitement.
     */
    const result = qualify("p1", [platform({ status: "refused", notice: null })]);
    expect(result.ok).toBe(false);
    const notice =
      result.ok === false && result.reason === "refused" ? result.notice : "";
    expect(notice.length).toBeGreaterThan(0);
  });
});
