/*
 * Envoi d'e-mails — transport HTTP direct, sans SDK.
 *
 * `fetch` vers l'API de Resend suffit : un SDK ajouterait une dépendance pour
 * un POST JSON. Si `RESEND_API_KEY` n'est pas renseignée, l'envoi est
 * JOURNALISÉ et rien ne part — un déploiement sans clé ne doit pas faire
 * échouer un cron, et le silence complet cacherait le problème.
 */

const ENDPOINT = "https://api.resend.com/emails";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendOutcome =
  | { ok: true; delivered: boolean }
  | { ok: false; error: string };

export function emailFrom(): string {
  return process.env.EMAIL_FROM ?? "Eklio <hello@eklio.com>";
}

export async function sendEmail(email: OutgoingEmail): Promise<SendOutcome> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.warn(
      `[email] RESEND_API_KEY absente — e-mail NON envoyé à ${email.to} : « ${email.subject} »`
    );
    return { ok: true, delivered: false };
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
      return { ok: false, error: `${response.status} ${detail.slice(0, 200)}` };
    }
    return { ok: true, delivered: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    };
  }
}
