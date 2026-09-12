/*
 * Envoi d'e-mails — transport HTTP direct, sans SDK.
 *
 * `fetch` vers l'API de Resend suffit : un SDK ajouterait une dépendance pour
 * un POST JSON.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ⚠ « ACCEPTÉ » N'EST PAS « REMIS », ET CE MODULE NE DIRA PLUS LE CONTRAIRE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ce champ s'appelait `delivered`. Il valait `true` dès que Resend rendait un
 * 2xx. Ce n'est pas ce que « remis » veut dire :
 *
 *   ACCEPTÉ   Resend a pris le message en charge et rend un id. C'est tout ce
 *             que ce module peut savoir, et c'est tout ce qu'il prétend.
 *   REMIS     un serveur de messagerie l'a accepté. Ça arrive PLUS TARD, sur
 *             le webhook `email.delivered` de Resend, que ce produit ne
 *             consomme pas encore.
 *   LU        jamais connu, et hors de portée de tout ce qu'on pourrait
 *             brancher. Un message dans les indésirables est « remis ».
 *
 * Un message accepté peut encore rebondir, être refusé, ou finir en spam. Le
 * renommage n'est pas cosmétique : le préavis d'avant-prélèvement décide d'un
 * débit, et `app/api/cron/trial-guard/route.ts` refuse de convertir un essai
 * dont le préavis n'est pas prouvé. Une garantie bâtie sur un mot plus fort
 * qu'il ne le mérite est une garantie qui ment.
 *
 * ── CE QUI A CHANGÉ AVANT ÇA ─────────────────────────────────────────────
 *
 * Ce module rendait `{ ok: true }` quand `RESEND_API_KEY` manquait. La forme
 * disait « ça s'est bien passé » et l'appelant le croyait : la ligne marquée
 * « prévenue », personne de prévenu, le débit qui part. EN PRODUCTION une clé
 * absente rend désormais `ok: false` — on ne prétend jamais avoir envoyé.
 *
 * ⚠ ET IL N'Y A PLUS DE VERROU AU DÉMARRAGE. `RESEND_API_KEY` a quitté le
 * registre « refuser de servir » de `lib/env/required.ts` le 2026-09-12 : ce
 * verrou ne voyait ni une clé révoquée, ni un compte suspendu, ni une API en
 * panne — donc il ne tenait pas la promesse qu'on lui prêtait, tout en
 * pouvant mettre le site entier hors ligne. La promesse est tenue à la
 * conversion, pas au démarrage.
 *
 * En DÉVELOPPEMENT, rien ne part et c'est journalisé : `accepted: false` sur
 * une issue `ok`. Personne n'est facturé en local.
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
 * ⚠ SEUL `accepted: true` AUTORISE À MARQUER QUOI QUE CE SOIT. `ok` veut dire
 * « rien n'a cassé », pas « c'est parti » : les deux ne se séparent qu'en
 * développement local. Le type est écrit en trois branches plutôt qu'en
 * `accepted: boolean` pour que la lecture `ok && accepted` soit l'évidence, et
 * pour que `reason` soit là quand elle ne l'est pas.
 *
 * `providerId` est l'id Resend du message. Il est stocké sur la ligne d'essai
 * pour qu'un webhook ultérieur puisse dire ce qui est VRAIMENT arrivé à ce
 * message-là, et pour qu'un débit contesté ait autre chose à montrer qu'un
 * booléen. `null` si Resend a répondu 2xx sans id lisible — accepté quand
 * même, mais sans prise pour la suite.
 */
export type SendOutcome =
  | { ok: true; accepted: true; providerId: string | null }
  | { ok: true; accepted: false; reason: "not_configured_dev" }
  | { ok: false; accepted: false; error: string };

export function emailFrom(): string {
  return process.env.EMAIL_FROM ?? "Eklio <hello@eklio.com>";
}

export async function sendEmail(email: OutgoingEmail): Promise<SendOutcome> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    /*
     * ⚠ EN PRODUCTION C'EST UN ÉCHEC, PAS UN SUCCÈS SILENCIEUX. L'appelant ne
     * doit surtout pas pouvoir marquer une ligne « prévenue » sur cette
     * branche : voir `app/api/cron/trial-ending/route.ts`.
     */
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[email] RESEND_API_KEY absente EN PRODUCTION — e-mail NON envoyé à ${email.to} : « ${email.subject} »`
      );
      return {
        ok: false,
        accepted: false,
        error: "RESEND_API_KEY absente en production",
      };
    }

    console.warn(
      `[email] RESEND_API_KEY absente — e-mail NON envoyé à ${email.to} : « ${email.subject} »`
    );
    return { ok: true, accepted: false, reason: "not_configured_dev" };
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
        accepted: false,
        error: `${response.status} ${detail.slice(0, 200)}`,
      };
    }

    /*
     * L'id est lu au mieux : un corps illisible n'annule pas une acceptation
     * que le 2xx a déjà établie. On perd seulement la prise pour le webhook,
     * et le dire (`null`) vaut mieux que d'inventer un id.
     */
    let providerId: string | null = null;
    try {
      const body = (await response.json()) as { id?: unknown };
      if (typeof body?.id === "string" && body.id.length > 0) {
        providerId = body.id;
      }
    } catch {
      providerId = null;
    }

    return { ok: true, accepted: true, providerId };
  } catch (error) {
    return {
      ok: false,
      accepted: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}
