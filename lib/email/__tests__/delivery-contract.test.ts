import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { sendEmail } from "@/lib/email/transport";
import {
  REQUIRED_TO_SERVE,
  REQUIRED_FOR_A_FEATURE,
  missingRequired,
  missingFeatureEnv,
  missingRequiredMessage,
  degradedFeaturesMessage,
  assertRequiredEnv,
} from "@/lib/env/required";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * « PAS CONFIGURÉ » N'EST PAS UN SUCCÈS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le défaut réparé ici : `sendEmail` rendait `{ ok: true, delivered: false }`
 * sans clé Resend, le balayage du préavis lisait `ok`, et marquait la ligne
 * « prévenue ». Sur un déploiement mal configuré, tous les essais étaient
 * marqués avertis, personne n'était averti, et les prélèvements partaient.
 *
 * Le préavis est une obligation légale (Cal. Bus. & Prof. Code § 17602). Ces
 * tests figent les deux verrous : l'exécution et le démarrage.
 */

const KEY = "RESEND_API_KEY";

afterEach(() => {
  vi.unstubAllEnvs();
});

/*
 * `vi.stubEnv` plutôt qu'une écriture directe : `process.env` est un objet
 * spécial de Node qui refuse `Object.defineProperty`, et vitest restaure
 * proprement à `unstubAllEnvs`. La clé absente est simulée par une chaîne
 * VIDE — c'est ce que lit `!key`, et c'est aussi la forme qu'une variable
 * déclarée-mais-non-remplie prend réellement sur un hébergeur.
 */
function setEnv(nodeEnv: string, key = "") {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv(KEY, key);
}

const email = {
  to: "her@example.com",
  subject: "Monthly Presence renews on December 8, 2026",
  html: "<p>x</p>",
  text: "x",
};

describe("le verrou d'exécution", () => {
  it("⚠ en production, une clé absente est un ÉCHEC — jamais un succès", async () => {
    setEnv("production");
    const outcome = await sendEmail(email);

    expect(outcome.ok).toBe(false);
    expect(outcome.accepted).toBe(false);
  });

  it("en développement, rien ne part et c'est dit explicitement", async () => {
    setEnv("development");
    const outcome = await sendEmail(email);

    // `ok` parce que rien n'a cassé ; `accepted: false` parce que rien
    // n'est parti. Les deux comptent, et seul le second autorise un marquage.
    expect(outcome.ok).toBe(true);
    expect(outcome.accepted).toBe(false);
    expect(outcome.ok && !outcome.accepted && outcome.reason).toBe(
      "not_configured_dev"
    );
  });

  /*
   * ⚠ LE CŒUR DU DÉFAUT. Aucune branche de `sendEmail` ne doit pouvoir rendre
   * `accepted: true` sans qu'un envoi ait réussi. Le type l'interdit déjà —
   * ce test est là pour que le jour où quelqu'un le rouvre en
   * `accepted: boolean`, la promesse reste écrite quelque part.
   */
  it("aucune branche non configurée ne prétend avoir été acceptée", async () => {
    for (const nodeEnv of ["production", "development", "test"]) {
      setEnv(nodeEnv);
      const outcome = await sendEmail(email);
      expect(outcome.accepted, nodeEnv).toBe(false);
    }
  });

  /*
   * ⚠ LE MOT LUI-MÊME. « delivered » promettait plus que ce que ce module peut
   * savoir : un 2xx de Resend est une PRISE EN CHARGE, pas une remise. Le
   * champ s'appelle `accepted` pour cette raison, et ce test existe pour que
   * personne ne le renomme en arrière sans lire pourquoi.
   */
  it("⚠ ne promet jamais « delivered » — le transport ne sait pas ça", () => {
    const transport = readFileSync("lib/email/transport.ts", "utf8");
    expect(transport).not.toMatch(/\bdelivered\s*:/);
    expect(transport).toContain("accepted");
    expect(transport).toContain("providerId");
  });
});

/*
 * ── LE BALAYAGE NE MARQUE QUE SUR `delivered` ────────────────────────────
 *
 * Vérifié sur la SOURCE plutôt que par un faux client Supabase : ce qui doit
 * être garanti n'est pas qu'un scénario passe, c'est qu'il n'existe aucun
 * chemin d'écriture derrière un simple `ok`. On lit du CODE, pas de la prose.
 */
describe("le balayage du préavis", () => {
  const source = readFileSync("app/api/cron/trial-ending/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("sort AVANT le marquage quand rien n'a été remis", () => {
    const guard = source.indexOf("if (!outcome.accepted)");
    const mark = source.indexOf("trial_notice_sent_for: row.trial_end");

    expect(guard).toBeGreaterThan(-1);
    expect(mark).toBeGreaterThan(-1);
    // La garde est physiquement au-dessus de l'écriture.
    expect(guard).toBeLessThan(mark);
  });

  it("ne marque jamais sur un simple `ok`", () => {
    expect(source).not.toMatch(/if\s*\(\s*!?\s*outcome\.ok\s*\)\s*\{[^}]*trial_notice_sent_for/);
    // La seule écriture du marqueur est unique : pas de second chemin.
    expect(source.match(/trial_notice_sent_for: row\.trial_end/g)).toHaveLength(1);
  });

  it("laisse la ligne intacte pour que le balayage suivant réessaie", () => {
    /*
     * Le bloc de la garde, borné à SON `continue` — pas une fenêtre de N
     * caractères, qui déborderait sur le marquage placé juste en dessous et
     * ferait échouer le test pour une raison qui n'est pas la sienne.
     */
    const guard = source.indexOf("if (!outcome.accepted)");
    const block = source.slice(
      guard,
      source.indexOf("continue;", guard) + "continue;".length
    );

    expect(block).toContain("continue;");
    // Rien n'est écrit entre la garde et la sortie : la ligne reste due.
    expect(block).not.toContain("trial_notice_sent_for");
    expect(block).not.toContain(".update(");
  });

  it("et compte les échecs dans sa réponse", () => {
    expect(source).toContain("failed");
    expect(source).toMatch(/NextResponse\.json\(\{\s*sent,\s*failed\s*\}\)/);
  });
});

/*
 * ── LE VERROU DE DÉMARRAGE ───────────────────────────────────────────────
 */
describe("les deux registres de variables silencieuses", () => {
  /*
   * ══════════════════════════════════════════════════════════════════════
   * ⚠ CE BLOC EXISTE PARCE QUE CE FICHIER A MIS LA PRODUCTION PAR TERRE
   * ══════════════════════════════════════════════════════════════════════
   *
   * Le 2026-09-12, `CRON_SECRET` a été mise dans le registre « refuser de
   * démarrer ». Elle n'était pas réglée sur Vercel. Le serveur a refusé de
   * préparer, et le site entier a rendu « Internal Server Error » en texte
   * brut — page d'accueil, tarifs, brief anonyme compris — pour une variable
   * que seules cinq routes de cron utilisent.
   *
   * Les tests ci-dessous ne vérifient pas « le garde marche ». Ils vérifient
   * QUE LE GARDE EST PROPORTIONNÉ : qu'une variable de fonctionnalité ne peut
   * pas, par un futur déplacement d'une ligne, reprendre le site avec elle.
   */

  /*
   * ⚠ LE REGISTRE 1 EST VIDE, ET C'EST UNE DÉCISION.
   *
   * `RESEND_API_KEY` en est sortie le 2026-09-12 : un garde au démarrage ne
   * voit qu'une clé absente AU DÉPLOIEMENT — pas une clé révoquée, pas un
   * compte suspendu, pas une API en panne — donc il ne tenait pas la promesse
   * qu'on lui prêtait, tout en pouvant mettre le site entier hors ligne. La
   * promesse est tenue par `app/api/cron/trial-guard`.
   *
   * Ce test n'interdit pas d'y remettre quelque chose un jour. Il exige que
   * quiconque le fait vienne lire pourquoi c'est vide.
   */
  it("⚠ le registre « requis pour servir » est VIDE, délibérément", () => {
    expect(Object.keys(REQUIRED_TO_SERVE)).toEqual([]);
  });

  it("RESEND_API_KEY est dans le registre « fonctionnalité », et sa raison nomme la garantie", () => {
    expect(Object.keys(REQUIRED_FOR_A_FEATURE)).toContain("RESEND_API_KEY");
    expect(REQUIRED_FOR_A_FEATURE.RESEND_API_KEY.reason).toMatch(/17602/);
    expect(REQUIRED_FOR_A_FEATURE.RESEND_API_KEY.reason).toMatch(/trial-guard/);
  });

  it("CRON_SECRET est dans le registre « fonctionnalité », et sa raison nomme le 503", () => {
    expect(Object.keys(REQUIRED_FOR_A_FEATURE)).toContain("CRON_SECRET");
    expect(REQUIRED_FOR_A_FEATURE.CRON_SECRET.feature).toMatch(/cron/i);
    expect(REQUIRED_FOR_A_FEATURE.CRON_SECRET.reason).toMatch(/503/);
  });

  /*
   * ⚠ LA RÉGRESSION ELLE-MÊME. Si quelqu'un redéplace CRON_SECRET dans le
   * registre 1, ce test tombe, et le message dit pourquoi.
   */
  it("⚠ CRON_SECRET ne peut PAS revenir dans « requis pour servir »", () => {
    expect(Object.keys(REQUIRED_TO_SERVE)).not.toContain("CRON_SECRET");
  });

  it("les deux registres sont disjoints", () => {
    const both = Object.keys(REQUIRED_TO_SERVE).filter(
      (name) => name in REQUIRED_FOR_A_FEATURE
    );
    expect(both).toEqual([]);
  });

  /*
   * Le critère d'entrée reste étroit : « son absence ne casse rien de
   * visible ». Les clés Stripe lèvent une StripeConfigError au premier appel,
   * donc elles n'ont leur place dans NI l'un NI l'autre.
   */
  it("et les variables qui lèvent déjà d'elles-mêmes ne sont dans aucun registre", () => {
    for (const name of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      expect(Object.keys(REQUIRED_TO_SERVE)).not.toContain(name);
      expect(Object.keys(REQUIRED_FOR_A_FEATURE)).not.toContain(name);
    }
  });

  /*
   * ⚠ LA MÉCANIQUE DU REFUS RESTE TESTÉE PENDANT QUE LE REGISTRE EST VIDE.
   * Un mécanisme non testé parce qu'il n'a rien à faire aujourd'hui est un
   * mécanisme cassé le jour où on lui confie quelque chose. Le registre est
   * injecté pour ça, et pour rien d'autre.
   */
  it("la mécanique du refus marche encore, registre injecté", () => {
    const synthetic = { SOME_FUTURE_KEY: "sans elle le produit mentirait" };
    expect(missingRequired({ NODE_ENV: "production" }, synthetic)).toEqual([
      "SOME_FUTURE_KEY",
    ]);
    expect(missingRequired({ SOME_FUTURE_KEY: "x" }, synthetic)).toEqual([]);
    expect(missingRequiredMessage(["SOME_FUTURE_KEY"], synthetic)).toContain(
      "sans elle le produit mentirait"
    );
  });

  it("⚠ et ne refuse RIEN aujourd'hui, puisque le registre est vide", () => {
    expect(() => assertRequiredEnv({ NODE_ENV: "production" })).not.toThrow();
  });

  /*
   * ⚠ LE TEST QUI AURAIT ÉVITÉ L'INCIDENT. Une variable de fonctionnalité
   * absente AVERTIT et LAISSE DÉMARRER.
   */
  it("⚠ mais LAISSE DÉMARRER quand il ne manque qu'une variable du registre 2", () => {
    const serveOk = Object.fromEntries(
      Object.keys(REQUIRED_TO_SERVE).map((name) => [name, "valeur"])
    );
    expect(() =>
      assertRequiredEnv({ NODE_ENV: "production", ...serveOk })
    ).not.toThrow();
  });

  it("et le message de refus dit POURQUOI, pas seulement quoi", () => {
    const message = missingRequiredMessage(["X"], { X: "la raison lisible" });
    expect(message).toContain("X");
    expect(message).toContain("la raison lisible");
    expect(message).toMatch(/SERVIR/);
  });

  it("et l'avertissement de dégradation nomme la fonctionnalité qui tombe", () => {
    const message = degradedFeaturesMessage(["CRON_SECRET"]);
    expect(message).toContain("CRON_SECRET");
    expect(message).toMatch(/cron/i);
    expect(message).toMatch(/continue de servir/);
  });

  it("laisse démarrer quand tout est là", () => {
    /*
     * Les deux environnements sont DÉRIVÉS des registres, jamais réécrits à la
     * main : la version manuscrite ne fournissait que RESEND_API_KEY et devait
     * tomber à la première variable ajoutée. C'est arrivé le 2026-09-12.
     */
    const complet = Object.fromEntries(
      [...Object.keys(REQUIRED_TO_SERVE), ...Object.keys(REQUIRED_FOR_A_FEATURE)].map(
        (name) => [name, "valeur"]
      )
    );
    expect(() =>
      assertRequiredEnv({ NODE_ENV: "production", ...complet })
    ).not.toThrow();
  });

  it("ne lève ni en développement ni en test", () => {
    for (const nodeEnv of ["development", "test", undefined]) {
      expect(() => assertRequiredEnv({ NODE_ENV: nodeEnv })).not.toThrow();
    }
  });

  it("les deux énumérations sont dérivées, et aucune n'est vide", () => {
    expect(missingRequired({})).toEqual(Object.keys(REQUIRED_TO_SERVE));
    expect(missingFeatureEnv({})).toEqual(Object.keys(REQUIRED_FOR_A_FEATURE));

    const complet = Object.fromEntries(
      [...Object.keys(REQUIRED_TO_SERVE), ...Object.keys(REQUIRED_FOR_A_FEATURE)].map(
        (name) => [name, "valeur"]
      )
    );
    expect(missingRequired(complet)).toEqual([]);
    expect(missingFeatureEnv(complet)).toEqual([]);

    /*
     * Garde anti-vacuité sur le SEUL registre qui doit mordre. Le registre 1
     * est légitimement vide ; exiger qu'il ne le soit pas pousserait quelqu'un
     * à y remettre une variable pour faire passer un test, ce qui est
     * exactement l'accident du 2026-09-12.
     */
    expect(Object.keys(REQUIRED_FOR_A_FEATURE).length).toBeGreaterThan(0);
    expect(Object.keys(REQUIRED_FOR_A_FEATURE)).toEqual(
      expect.arrayContaining(["CRON_SECRET", "RESEND_API_KEY"])
    );
  });

  it("et instrumentation.ts l'appelle vraiment au démarrage", () => {
    const source = readFileSync("instrumentation.ts", "utf8");
    expect(source).toContain("assertRequiredEnv");
    expect(source).toContain("lib/env/required");
  });
});

/*
 * ── LA GARDE DES CRONS, DU CÔTÉ DE L'USAGE ───────────────────────────────
 * « Échouer fort là où la chose sert » n'est vrai que si la route le fait.
 */
describe("authorizeCron échoue là où la chose sert", () => {
  const source = readFileSync("lib/api/cron.ts", "utf8");

  it("rend 503 en nommant la variable quand CRON_SECRET est absente", () => {
    expect(source).toContain("CRON_SECRET");
    expect(source).toMatch(/status:\s*503/);
    expect(source).toContain("missing_env");
  });

  it("et garde le 404 pour un mauvais secret — une porte fermée ne se présente pas", () => {
    expect(source).toMatch(/status:\s*404/);
    expect(source).toContain("Not found.");
  });
});
