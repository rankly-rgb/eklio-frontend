import { afterEach, describe, expect, it } from "vitest";
import { deployEnvName, showsTechnicalDetail } from "@/lib/env/deploy";

/*
 * ⚠ CHAQUE CAS REPOSE L'ENVIRONNEMENT. Un test qui laisse `VERCEL_ENV` posée
 * change le résultat du suivant, et le suivant passe pour la mauvaise raison.
 */
const SAVED = { vercel: process.env.VERCEL_ENV, node: process.env.NODE_ENV };

/*
 * ⚠ `NODE_ENV` EST EN LECTURE SEULE POUR TYPESCRIPT, et l'écrire demande de
 * passer par l'index. Ce n'est pas un contournement du typage : c'est la seule
 * façon d'éprouver la règle « VERCEL_ENV gagne sur NODE_ENV », qui n'a de sens
 * que quand les deux sont posées en même temps.
 */
const env = process.env as Record<string, string | undefined>;

afterEach(() => {
  if (SAVED.vercel === undefined) delete env.VERCEL_ENV;
  else env.VERCEL_ENV = SAVED.vercel;
  if (SAVED.node !== undefined) env.NODE_ENV = SAVED.node;
});

describe("showsTechnicalDetail", () => {
  it("ouvre sur une preview Vercel", () => {
    env.VERCEL_ENV = "preview";
    expect(showsTechnicalDetail()).toBe(true);
  });

  it("FERME sur la production Vercel", () => {
    env.VERCEL_ENV = "production";
    expect(showsTechnicalDetail()).toBe(false);
  });

  it("ferme quand NODE_ENV dit production et que Vercel ne dit rien", () => {
    delete env.VERCEL_ENV;
    env.NODE_ENV = "production";
    expect(showsTechnicalDetail()).toBe(false);
  });

  it("⚠ `VERCEL_ENV` GAGNE SUR `NODE_ENV`, et c'est le cas qui compte", () => {
    /*
     * Une preview Vercel est construite avec `NODE_ENV=production` : c'est un
     * build optimisé. Lire `NODE_ENV` en premier fermerait donc la porte
     * exactement là où elle doit être ouverte — et le défaut serait invisible,
     * puisqu'il produit le comportement le plus prudent.
     */
    env.VERCEL_ENV = "preview";
    env.NODE_ENV = "production";
    expect(showsTechnicalDetail()).toBe(true);
  });

  it("une valeur inconnue n'est pas la production, donc elle ouvre", () => {
    env.VERCEL_ENV = "staging";
    expect(showsTechnicalDetail()).toBe(true);
  });
});

describe("deployEnvName", () => {
  it("nomme l'environnement quand quelque chose le dit", () => {
    env.VERCEL_ENV = "preview";
    expect(deployEnvName()).toBe("preview");
  });
});
