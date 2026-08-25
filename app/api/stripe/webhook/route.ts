import { getStripeClient, getWebhookSecret, StripeConfigError } from "@/lib/stripe/client";
import { createWebhookPorts } from "@/lib/stripe/webhook-store";
import { processStripeEvent } from "@/lib/stripe/webhook";

/*
 * Le webhook Stripe — la SEULE autorité sur ce qui est payé.
 *
 * Rien d'autre dans l'application n'écrit `purchases` ni `subscriptions` : ni
 * la page de succès, ni une server action, ni un formulaire. Une redirection
 * se forge dans la barre d'adresse ; une signature HMAC, non.
 *
 * Trois règles tiennent cette route :
 *
 * 1. SIGNATURE D'ABORD. Le corps est lu en TEXTE BRUT et vérifié avant d'être
 *    interprété — `constructEventAsync` recalcule la signature sur les octets
 *    exacts reçus. Le parser en JSON avant la vérification (ou laisser un
 *    framework le faire) invalide le calcul et ouvre la porte à n'importe qui.
 * 2. IDEMPOTENCE. Stripe rejoue un event tant qu'il n'a pas reçu de 2xx.
 *    `stripe_events` porte `stripe_event_id` en clé primaire : le second
 *    passage est reconnu et ignoré (cf. `lib/stripe/webhook.ts`).
 * 3. LE CODE DE RETOUR EST UN CONTRAT. 2xx signifie « traité, ne rejoue pas ».
 *    On ne le rend donc que si l'event a été traité, dupliqué, ou délibérément
 *    ignoré. Une panne rend 500 pour que Stripe REVIENNE.
 */

/*
 * Runtime Node : la vérification de signature s'appuie sur le crypto de la
 * plateforme, et le client Supabase service_role n'a rien à faire ailleurs.
 */
export const runtime = "nodejs";

/* Aucune mise en cache : chaque event est un fait nouveau. */
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header.", { status: 400 });
  }

  // Texte brut, avant toute interprétation : c'est sur ces octets exacts que
  // la signature est recalculée.
  const payload = await request.text();

  let event;
  try {
    event = await getStripeClient().webhooks.constructEventAsync(
      payload,
      signature,
      getWebhookSecret()
    );
  } catch (error) {
    if (error instanceof StripeConfigError) {
      /*
       * `STRIPE_WEBHOOK_SECRET` manquant : c'est une panne de configuration,
       * pas un event douteux. On rend 500 pour que Stripe rejoue une fois la
       * variable posée, au lieu de perdre des paiements sur un 400 définitif.
       */
      console.error(`[stripe-webhook] ${error.message}`);
      return new Response("Webhook not configured.", { status: 500 });
    }
    /*
     * Signature invalide ou horodatage hors tolérance. On ne dit rien de plus
     * à l'appelant : détailler l'échec aiderait qui essaie d'en forger une.
     */
    console.warn("[stripe-webhook] signature refusée");
    return new Response("Invalid signature.", { status: 400 });
  }

  try {
    const outcome = await processStripeEvent(createWebhookPorts(), event);

    if (outcome.status === "ignored") {
      console.warn(
        `[stripe-webhook] ${outcome.type} ignoré — ${outcome.reason} (event ${event.id})`
      );
    } else {
      console.info(`[stripe-webhook] ${outcome.type} ${outcome.status} (event ${event.id})`);
    }

    // 2xx dans les trois cas : traité, déjà vu, ou délibérément ignoré. Aucun
    // rejeu ne changerait le résultat.
    return Response.json(outcome, { status: 200 });
  } catch (error) {
    const detail = error as { message?: string; code?: string };
    console.error(
      `[stripe-webhook] ÉCHEC de traitement de ${event.type} (event ${event.id})${
        detail?.code ? ` [${detail.code}]` : ""
      } : ${detail?.message ?? String(error)}`,
      error
    );
    // 500 : Stripe rejouera, et l'event a été retiré de `stripe_events` pour
    // que ce rejeu ne se heurte pas au verrou d'idempotence.
    return new Response("Webhook handler failed.", { status: 500 });
  }
}
