/*
 * Envoi d'e-mails — transport HTTP direct, sans SDK.
 *
 * `fetch` vers l'API de Resend suffit : un SDK ajouterait une dépendance pour
 * un POST JSON.
 *
 * ── ⚠ « PAS CONFIGURÉ » N'EST PLUS UN SUCCÈS ─────────────────────────────
 *
 * Ce module rendait `{ ok: true, delivered: false }` quand `RESEND_API_KEY`
 * manquait. La forme disait « ça s'est bien passé » et l'appelant qui lisait
 * `outcome.ok` — le seul champ qu'on lit d'habitude — le croyait. Sur le
 * préavis d'avant-prélèvement, ça donnait : la ligne marquée « prévenue »,
 * personne de prévenu, et le débit qui part quand même. Un défaut de
 * conformité, pas un bug d'e-mail.
 *
 * Deux verrous, et les deux sont voulus :
 *
 *   1. EN PRODUCTION, une clé absente rend `ok: false`. On ne prétend jamais
 *      avoir envoyé. C'est le filet d'exécution.
 *   2. AU DÉMARRAGE, une clé absente en production fait échouer le boot
 *      (`lib/env/required.ts`, appelé par `instrumentation.ts`) — la panne se
 *      voit au déploiement, pas trente jours plus tard sur le premier essai
 *      arrivé à terme.
 *
 * Le second rend le premier théoriquement inatteignable. Il reste parce que
 * « théoriquement » : un runtime où l'instrumentation ne tourne pas laisserait
 * le premier tout seul, et c'est celui qui protège la praticienne.
 *
 * En DÉVELOPPEMENT, rien ne part et c'est journalisé : `delivered: false` sur
 * une issue `ok`. Personne n'est facturé en local, et exiger la clé
 * empêcherait de lancer le projet.
 */

const ENDPOINT = "https://api.resend.com/emails";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Le résultat d'un envoi.
 *
 * ⚠ SEUL `delivered: true` AUTORISE À MARQUER QUOI QUE CE SOIT COMME ENVOYÉ.
 * `ok` veut dire « rien n'a cassé », pas « c'est parti » : les deux se
 * séparent dans le seul cas du développement local. Le type est écrit en trois
 * branches plutôt qu'en `delivered: boolean` pour que la lecture `ok &&
 * delivered` soit la lecture évidente, et pour que `reason` soit là quand elle
 * ne l'est pas.
 */
export type SendOutcome =
  | { ok: true; delivered: true }
  | { ok: true; delivered: false; reason: "not_configured_dev" }
  | { ok: false; delivered: false; error: string };

export function emailFrom(): string {
  return process.env.EMAIL_FROM ?? "Eklio <hello@eklio.com>";
}

export async function sendEmail(email: OutgoingEmail): Promise<SendOutcome> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    /*
     * ⚠ EN PRODUCTION C'EST UN ÉCHEC, PAS UN SUCCÈS SILENCIEUX. L'appelant ne
     * doit surtout pas pouvoir marquer une ligne « prévenue » sur cette
     * branche : voir l'en-tête, et `app/api/cron/trial-ending/route.ts`.
     */
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[email] RESEND_API_KEY absente EN PRODUCTION — e-mail NON envoyé à ${email.to} : « ${email.subject} »`
      );
      return {
        ok: false,
        delivered: false,
        error: "RESEND_API_KEY absente en production",
      };
    }

    console.warn(
      `[email] RESEND_API_KEY absente — e-mail NON envoyé à ${email.to} : « ${email.subject} »`
    );
    return { ok: true, delivered: false, reason: "not_configured_dev" };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        delivered: false,
        error: `${response.status} ${detail.slice(0, 200)}`,
      };
    }
    return { ok: true, delivered: true };
  } catch (error) {
    return {
      ok: false,
      delivered: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}
