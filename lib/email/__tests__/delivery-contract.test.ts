import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { sendEmail } from "@/lib/email/transport";
import {
  REQUIRED_IN_PRODUCTION,
  missingRequired,
  missingRequiredMessage,
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
    expect(outcome.delivered).toBe(false);
  });

  it("en développement, rien ne part et c'est dit explicitement", async () => {
    setEnv("development");
    const outcome = await sendEmail(email);

    // `ok` parce que rien n'a cassé ; `delivered: false` parce que rien
    // n'est parti. Les deux comptent, et seul le second autorise un marquage.
    expect(outcome.ok).toBe(true);
    expect(outcome.delivered).toBe(false);
    expect(outcome.ok && !outcome.delivered && outcome.reason).toBe(
      "not_configured_dev"
    );
  });

  /*
   * ⚠ LE CŒUR DU DÉFAUT. Aucune branche de `sendEmail` ne doit pouvoir rendre
   * `delivered: true` sans qu'un envoi ait réussi. Le type l'interdit déjà —
   * ce test est là pour que le jour où quelqu'un le rouvre en
   * `delivered: boolean`, la promesse reste écrite quelque part.
   */
  it("aucune branche non configurée ne prétend avoir remis", async () => {
    for (const nodeEnv of ["production", "development", "test"]) {
      setEnv(nodeEnv);
      const outcome = await sendEmail(email);
      expect(outcome.delivered, nodeEnv).toBe(false);
    }
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
    const guard = source.indexOf("if (!outcome.delivered)");
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
    const guard = source.indexOf("if (!outcome.delivered)");
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
describe("les variables dont l'absence est silencieuse", () => {
  it("RESEND_API_KEY en fait partie, avec sa raison", () => {
    expect(Object.keys(REQUIRED_IN_PRODUCTION)).toContain("RESEND_API_KEY");
    expect(REQUIRED_IN_PRODUCTION.RESEND_API_KEY).toMatch(/17602|préavis/);
  });

  /*
   * CRON_SECRET répond au même critère et pour la même raison : son absence
   * ne casse rien de visible. `authorizeCron` rend 404, les cinq crons
   * partent à l'heure et n'atteignent jamais la base, et le panneau de
   * Vercel montre des invocations. Mesuré le 12 septembre 2026 : aucune
   * trace PostgREST des passages de 04:00, 05:00 et 06:00.
   */
  it("CRON_SECRET aussi, et sa raison nomme le 404", () => {
    expect(Object.keys(REQUIRED_IN_PRODUCTION)).toContain("CRON_SECRET");
    expect(REQUIRED_IN_PRODUCTION.CRON_SECRET).toMatch(/404/);
  });

  it("et le démarrage refuse en nommant les deux", () => {
    const message = missingRequiredMessage(
      missingRequired({ NODE_ENV: "production" })
    );
    expect(message).toContain("RESEND_API_KEY");
    expect(message).toContain("CRON_SECRET");
  });

  /*
   * Le critère d'entrée est étroit : « son absence ne casse rien de visible ».
   * Les clés Stripe lèvent une StripeConfigError au premier appel, donc elles
   * n'ont rien à faire ici — et si quelqu'un les ajoute, c'est le signe que le
   * critère a été oublié.
   */
  it("et les variables qui lèvent déjà d'elles-mêmes n'y sont pas", () => {
    for (const name of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      expect(Object.keys(REQUIRED_IN_PRODUCTION)).not.toContain(name);
    }
  });

  it("refuse le démarrage en production quand il en manque une", () => {
    expect(() =>
      assertRequiredEnv({ NODE_ENV: "production" })
    ).toThrow(/RESEND_API_KEY/);
  });

  it("et le message dit POURQUOI, pas seulement quoi", () => {
    const message = missingRequiredMessage(["RESEND_API_KEY"]);
    expect(message).toContain("RESEND_API_KEY");
    expect(message).toMatch(/17602/);
    expect(message).toMatch(/SILENCIEUSE/);
  });

  it("laisse démarrer quand tout est là", () => {
    /*
     * L'environnement complet est DÉRIVÉ du registre, jamais réécrit à la
     * main. La version manuscrite ne fournissait que RESEND_API_KEY et devait
     * tomber à la première variable ajoutée : c'est arrivé le 2026-09-12 avec
     * CRON_SECRET. Le test n'était pas faux, il était écrit au singulier.
     */
    const toutesPresentes = Object.fromEntries(
      Object.keys(REQUIRED_IN_PRODUCTION).map((name) => [name, "valeur"])
    );
    expect(() =>
      assertRequiredEnv({ NODE_ENV: "production", ...toutesPresentes })
    ).not.toThrow();
  });

  /*
   * ⚠ ET NE LÈVE JAMAIS HORS PRODUCTION. Une clé d'envoi absente est le cas
   * normal en local ; exiger la clé empêcherait de lancer le projet et de
   * faire tourner cette suite.
   */
  it("ne lève ni en développement ni en test", () => {
    for (const nodeEnv of ["development", "test", undefined]) {
      expect(() =>
        assertRequiredEnv({ NODE_ENV: nodeEnv })
      ).not.toThrow();
    }
  });

  it("missingRequired énumère, et l'énumération n'est pas vide", () => {
    // Dérivé du registre : un environnement vide manque TOUT le registre.
    expect(missingRequired({})).toEqual(Object.keys(REQUIRED_IN_PRODUCTION));

    const toutesPresentes = Object.fromEntries(
      Object.keys(REQUIRED_IN_PRODUCTION).map((name) => [name, "valeur"])
    );
    expect(missingRequired(toutesPresentes)).toEqual([]);

    // Garde anti-vacuité : la liste a de quoi mordre.
    expect(Object.keys(REQUIRED_IN_PRODUCTION).length).toBeGreaterThan(0);

    // Canarie : le registre porte au moins les deux qu'on sait y être.
    expect(Object.keys(REQUIRED_IN_PRODUCTION)).toEqual(
      expect.arrayContaining(["RESEND_API_KEY", "CRON_SECRET"])
    );
  });

  it("et instrumentation.ts l'appelle vraiment au démarrage", () => {
    const source = readFileSync("instrumentation.ts", "utf8");
    expect(source).toContain("assertRequiredEnv");
    expect(source).toContain("lib/env/required");
  });
});
