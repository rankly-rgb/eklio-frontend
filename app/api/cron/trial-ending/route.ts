import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCron } from "@/lib/api/cron";
import { trialEndingEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/transport";
import { formatUsd, MONTHLY_PRESENCE } from "@/lib/billing/plans";
import { track } from "@/lib/analytics";

/*
 * Le préavis d'avant-prélèvement — balayé une fois par jour.
 *
 * Practice Suite comprend trois mois de Monthly Presence, implémentés comme un
 * vrai abonnement Stripe en essai de 90 jours. Au 91e jour, la carte est
 * débitée de $39. Ce balayage est ce qui fait qu'elle le sait avant.
 *
 * ⚠ CE N'EST PAS UNE COURTOISIE. Ce produit n'a AUCUNE primitive de
 * remboursement après-coup : rien, nulle part, ne sait rendre $39 encaissés.
 * Le préavis est donc la seule mitigation qui existe, et un balayage qui ne
 * tourne pas est un prélèvement non annoncé, pas un e-mail manquant.
 */

export const maxDuration = 300;

/*
 * ── SEPT JOURS, ET POURQUOI SEPT ─────────────────────────────────────────
 *
 * La loi californienne sur la reconduction automatique (Bus. & Prof. Code
 * § 17602, amendée le 1er juillet 2025) impose, pour un essai gratuit de PLUS
 * DE 31 JOURS, un préavis envoyé entre 3 et 21 jours avant la bascule. Nos
 * quatre-vingt-dix jours sont largement au-dessus de 31 : la fenêtre
 * s'applique, et le marché du produit est américain.
 *
 * Sept est à l'intérieur, avec de la marge des deux côtés, et la marge est
 * l'argument :
 *
 *   - PAS TROIS, le plancher légal. Ce balayage tourne une fois par jour. Un
 *     déploiement raté, une panne d'envoi, un jour de quota Resend dépassé, et
 *     un préavis prévu à J-3 part à J-2 : hors délai. À sept, le balayage peut
 *     échouer quatre jours d'affilée et le préavis reste dans les clous.
 *   - PAS VINGT-ET-UN, le plafond. Trois semaines avant, un e-mail est lu puis
 *     oublié ; la date qu'il annonce n'est plus dans la tête de personne le
 *     jour du prélèvement. Un préavis qu'on n'oublie pas vaut mieux qu'un
 *     préavis très en avance.
 *
 * Sept jours, c'est aussi ce que Stripe utilise par défaut pour ses propres
 * e-mails de fin d'essai : la praticienne qui reçoit les deux les reçoit le
 * même jour plutôt qu'à une semaine d'écart, et n'a pas à se demander lequel
 * dit vrai.
 *
 * La borne BASSE compte autant que la haute : on n'écrit pas à quelqu'un dont
 * l'essai finit dans deux mois. La fenêtre est donc fermée aux deux bouts.
 */
export const NOTICE_DAYS_BEFORE = 7;

const BATCH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Les abonnements à prévenir maintenant.
 *
 * Fonction PURE, exportée pour être testée aux bornes : c'est elle qui décide
 * qui reçoit le seul avertissement qu'il y aura, et « à peu près la bonne
 * fenêtre » n'est pas une réponse acceptable ici.
 *
 * Trois conditions, toutes nécessaires :
 *
 *   1. `status === "trialing"` — un abonnement déjà payant n'a pas de bascule
 *      à annoncer, et Stripe l'a déjà facturé au moins une fois.
 *   2. la fin d'essai tombe dans la fenêtre [maintenant, maintenant + 7 j].
 *      Fermée en bas aussi : un essai déjà terminé n'a plus de préavis à
 *      recevoir, seulement une facture.
 *   3. `trialNoticeSentFor !== trialEnd` — on n'a pas déjà prévenu pour CETTE
 *      date-là. C'est ce qui rend le balayage rejouable, et ce qui fait qu'un
 *      essai PROLONGÉ donne lieu à un nouveau préavis : la date a changé, donc
 *      l'avertissement précédent ne portait pas sur le bon prélèvement.
 */
export function owedNotice(
  row: {
    status: string;
    trialEnd: string | null;
    trialNoticeSentFor: string | null;
  },
  now: Date,
  daysBefore: number = NOTICE_DAYS_BEFORE
): boolean {
  if (row.status !== "trialing") return false;
  if (!row.trialEnd) return false;

  const end = Date.parse(row.trialEnd);
  if (Number.isNaN(end)) return false;

  const from = now.getTime();
  const until = from + daysBefore * DAY_MS;
  if (end < from || end > until) return false;

  /*
   * Comparaison sur l'INSTANT, pas sur la chaîne : Postgres et Stripe ne
   * rendent pas le même formatage ISO pour la même date, et deux écritures de
   * la même seconde se liraient comme deux dates différentes — donc deux
   * préavis pour un seul prélèvement.
   */
  if (!row.trialNoticeSentFor) return true;
  const sentFor = Date.parse(row.trialNoticeSentFor);
  return Number.isNaN(sentFor) || sentFor !== end;
}

/** « December 8, 2026 » — la date telle qu'elle la lira. */
export function formatChargeDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const admin = createAdminClient();
  const now = new Date();

  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id, status, trial_end, trial_notice_sent_for")
    .eq("status", "trialing")
    .not("trial_end", "is", null)
    .lte("trial_end", new Date(now.getTime() + NOTICE_DAYS_BEFORE * DAY_MS).toISOString())
    .gte("trial_end", now.toISOString())
    .limit(BATCH);

  if (error) {
    console.error("[cron/trial-ending] lecture subscriptions", error);
    return NextResponse.json({ sent: 0, error: true }, { status: 500 });
  }

  let sent = 0;
  /*
   * Compté et rendu dans la réponse : un balayage qui échoue à tout remettre
   * rend `{ sent: 0, failed: 12 }` plutôt qu'un `{ sent: 0 }` qu'on lirait
   * comme « rien à faire aujourd'hui ». C'est la différence entre une panne
   * visible et une panne silencieuse, et c'est tout le sujet de ce fichier.
   */
  let failed = 0;

  for (const row of data ?? []) {
    /*
     * La requête a déjà filtré, mais la décision est reposée ici par la
     * fonction pure : c'est elle qui est testée, et c'est elle qui doit faire
     * autorité. Un filtre SQL qui dérive de la règle est un bug qu'aucun test
     * ne verrait.
     */
    if (
      !owedNotice(
        {
          status: row.status,
          trialEnd: row.trial_end,
          trialNoticeSentFor: row.trial_notice_sent_for,
        },
        now
      )
    ) {
      continue;
    }

    const { data: account } = await admin.auth.admin.getUserById(row.user_id);
    const email = account?.user?.email;
    if (!email) continue;

    /*
     * ⚠ NI `canSend`, NI `recordSend`, ET C'EST DÉLIBÉRÉ.
     *
     * `lib/email/state.ts` porte deux règles faites pour les RELANCES : un
     * seul e-mail par 72 h tous types confondus, et jamais deux fois le même
     * type. Les deux sont fausses ici. La première ferait sauter un préavis
     * légal parce qu'une relance de brief est partie l'avant-veille ; la
     * seconde interdirait le second préavis d'une praticienne qui rachète
     * Practice Suite un an plus tard. Et la désinscription marketing ne doit
     * pas non plus couper un message qui annonce un débit.
     *
     * La déduplication vit donc sur la ligne elle-même,
     * `trial_notice_sent_for`, qui est par ESSAI et non par personne.
     */
    const outcome = await sendEmail(
      trialEndingEmail({
        to: email,
        userId: row.user_id,
        chargeDate: formatChargeDate(row.trial_end as string),
        amount: formatUsd(MONTHLY_PRESENCE.amountCents),
        interval: MONTHLY_PRESENCE.interval,
      })
    );

    /*
     * ⚠ ON NE MARQUE QUE SUR UNE REMISE CONFIRMÉE, et `ok` ne suffit pas.
     *
     * C'est le défaut que ce bloc existe pour ne plus avoir : `sendEmail`
     * rendait `{ ok: true, delivered: false }` quand `RESEND_API_KEY`
     * manquait, on lisait `ok`, et on marquait la ligne « prévenue ». Sur un
     * déploiement mal configuré, ça marquait TOUS les essais comme avertis
     * sans avertir personne — pendant que les prélèvements partaient. Le
     * préavis est une obligation légale (Cal. Bus. & Prof. Code § 17602) : le
     * supprimer en silence est une faute de conformité, pas un e-mail perdu.
     *
     * `delivered === true` veut dire « Resend a accepté le message ». Tout le
     * reste — clé absente, 4xx, réseau coupé — laisse la ligne INTACTE, donc
     * `owedNotice` la retrouve demain et le balayage réessaie. Sept jours de
     * fenêtre contre un plancher légal de trois : il y a de la place pour
     * quatre réessais avant que ça devienne un problème, et c'est exactement
     * pour ça que la fenêtre est à sept.
     */
    if (!outcome.delivered) {
      console.error(
        `[cron/trial-ending] NON REMIS pour ${row.user_id} — ligne laissée non marquée, réessai au prochain balayage :`,
        outcome.ok ? outcome.reason : outcome.error
      );
      failed += 1;
      continue;
    }

    /*
     * Marqué APRÈS la remise. Dans l'autre ordre, un échec laisserait une
     * marque disant « prévenue » sur quelqu'un qui ne l'a pas été. Le risque
     * qui reste est l'inverse — un doublon si CETTE écriture échoue après un
     * envoi réussi — et c'est le bon sens du compromis : un préavis de trop se
     * lit, un préavis manquant se paie $39 et une infraction.
     */
    const { error: markError } = await admin
      .from("subscriptions")
      .update({ trial_notice_sent_for: row.trial_end })
      .eq("user_id", row.user_id);

    if (markError) {
      console.error("[cron/trial-ending] marquage", markError);
    }

    track("trial_ending_notice_sent", { delivered: true });
    sent += 1;
  }

  return NextResponse.json({ sent, failed });
}
