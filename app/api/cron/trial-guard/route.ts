import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCron } from "@/lib/api/cron";
import { getStripeClient } from "@/lib/stripe/client";
import { track } from "@/lib/analytics";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * A TRIAL WHOSE NOTICE WAS NOT DELIVERED DOES NOT CONVERT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Si on n'a pas pu la prévenir, on ne la débite pas. Pas « on a marqué la
 * ligne », pas « on a essayé » : l'essai est PROLONGÉ, et à défaut ANNULÉ,
 * plutôt que converti sans préavis.
 *
 * ── POURQUOI CE FICHIER EXISTE ALORS QUE `trial-ending` ENVOIE DÉJÀ ───────
 *
 * Parce qu'envoyer n'est pas prévenir. `trial-ending` réessaie chaque jour et
 * laisse la ligne non marquée tant que rien n'est parti — ce qui est correct,
 * et ce qui ne suffit pas : au bout de sept jours de réessais infructueux, la
 * fenêtre se ferme, Stripe débite, et personne n'a rien reçu.
 *
 * Le garde qu'on avait avant — `RESEND_API_KEY` obligatoire au démarrage — ne
 * couvrait qu'un cas : la clé absente AU DÉPLOIEMENT. Il ne voyait ni une clé
 * révoquée, ni un compte Resend suspendu, ni une API en panne une semaine, ni
 * un message accepté puis rebondi. Dans tous ces cas l'application démarrait,
 * servait, et le débit partait quand même. Et il a mis le site entier hors
 * ligne le 2026-09-12. Ce fichier est ce qui le remplace.
 *
 * ── ⚠ LA LIMITE DE LA GARANTIE, ÉCRITE ICI PLUTÔT QUE SOUS-ENTENDUE ──────
 *
 * On ne sait pas prouver « remis ». On sait prouver « accepté par Resend »
 * (2xx + id). Un message accepté peut encore rebondir ou finir en indésirables.
 * La garantie exacte est donc :
 *
 *   un essai dont le préavis n'est pas prouvé ACCEPTÉ ne se convertit pas.
 *
 * C'est plus faible que la phrase du titre, c'est le maximum de ce que ce
 * produit sait établir aujourd'hui, et le dire fait partie du travail. Quand
 * le webhook Resend sera branché, `trial_notice_state` passera de 'accepted' à
 * 'delivered' ou 'bounced' sur la même ligne, et cette fonction n'aura pas à
 * changer : elle demande déjà un état PROUVÉ, pas un état égal à 'accepted'.
 *
 * ── ⚠ CE QUE CE GARDE NE PEUT PAS FAIRE ─────────────────────────────────
 *
 * Il est lui-même un cron. Si les crons ne partent pas — ce qui était le cas
 * jusqu'au 2026-09-12, `CRON_SECRET` manquante — il ne tourne pas, et rien ne
 * protège. C'est pour ça que `unwarned_trials()` est dans `npm run funnel` :
 * un humain voit le chiffre tous les matins, et zéro est la réponse attendue.
 * Une garantie automatique dont personne ne vérifie qu'elle tourne est une
 * garantie qui a déjà échoué une fois cette semaine.
 */

export const maxDuration = 300;

/**
 * ⚠ TROIS JOURS, ET C'EST LE PLANCHER LÉGAL, PAS UN CHOIX DE CONFORT.
 *
 * Cal. Bus. & Prof. Code § 17602 veut un préavis entre 3 et 21 jours avant la
 * bascule. En dessous de trois, un préavis envoyé N'EST PLUS VALABLE : il est
 * hors délai. Le garde agit donc au moment où il devient impossible de
 * régulariser en envoyant — prolonger est alors la seule issue qui garde à la
 * fois la cliente prévenue et l'abonnement en vie.
 */
export const GUARD_DAYS_BEFORE = 3;

/**
 * Sept jours de rab, parce que c'est la fenêtre de `trial-ending` : la
 * prolongation doit laisser au balayage le temps de refaire un cycle complet
 * de réessais sur la NOUVELLE date, pas de le relancer à quatre jours de la
 * fin.
 */
export const EXTENSION_DAYS = 7;

/**
 * ⚠ TROIS PROLONGATIONS, PUIS ON ANNULE. Sans plafond, une panne d'envoi
 * durable prolongerait un essai indéfiniment : la cliente garderait le service
 * sans jamais être facturée ni jamais décider, et l'abonnement deviendrait un
 * cadeau permanent que personne n'a voulu offrir. Trois fois sept jours, c'est
 * trois semaines pour réparer un mailer — au-delà, la panne est structurelle
 * et convertir en silence serait pire qu'annuler.
 */
export const MAX_EXTENSIONS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type GuardRow = {
  status: string;
  trialEnd: string | null;
  trialNoticeSentFor: string | null;
  trialNoticeState: string | null;
  trialExtensions: number;
};

/**
 * Les états qui valent PREUVE qu'elle a été prévenue.
 *
 * ⚠ DÉRIVÉ D'UNE INTENTION, PAS D'UNE LISTE D'ÉTATS CONNUS. 'accepted' est ce
 * qu'on sait produire aujourd'hui ; 'delivered' arrivera du webhook. Tout le
 * reste — 'bounced', 'complained', 'failed', et surtout NULL — est un non.
 * NULL compte comme non : c'est une ligne marquée par du code qui enregistrait
 * une TENTATIVE, et c'est exactement le défaut que ce fichier existe pour ne
 * plus avoir.
 */
export const PROVES_SHE_WAS_WARNED = ["accepted", "delivered"] as const;

export type GuardAction = "none" | "extend" | "cancel";

/**
 * Que faire de cette ligne, maintenant.
 *
 * Fonction PURE et exportée : c'est elle qui décide si quelqu'un est débité,
 * et « à peu près la bonne fenêtre » n'est pas une réponse acceptable ici.
 */
export function guardAction(
  row: GuardRow,
  now: Date,
  daysBefore: number = GUARD_DAYS_BEFORE,
  maxExtensions: number = MAX_EXTENSIONS
): GuardAction {
  if (row.status !== "trialing") return "none";
  if (!row.trialEnd) return "none";

  const end = Date.parse(row.trialEnd);
  if (Number.isNaN(end)) return "none";

  /*
   * Déjà passé : il n'y a plus de conversion à empêcher, seulement une facture
   * à discuter. Agir ici donnerait l'illusion d'avoir protégé quelqu'un.
   */
  if (end < now.getTime()) return "none";

  // Encore loin : `trial-ending` a le temps de réessayer, et prolonger
  // maintenant déplacerait une date qui n'a aucun problème.
  if (end > now.getTime() + daysBefore * DAY_MS) return "none";

  /*
   * ⚠ PROUVER QU'ELLE A ÉTÉ PRÉVENUE, pas prouver qu'elle ne l'a pas été.
   * Comparaison sur l'INSTANT : Postgres et Stripe n'écrivent pas le même ISO
   * pour la même date, et une comparaison de chaînes lirait deux dates là où
   * il y en a une.
   */
  const stamped = row.trialNoticeSentFor ? Date.parse(row.trialNoticeSentFor) : NaN;
  const warned =
    !Number.isNaN(stamped) &&
    stamped === end &&
    row.trialNoticeState !== null &&
    (PROVES_SHE_WAS_WARNED as readonly string[]).includes(row.trialNoticeState);

  if (warned) return "none";

  return row.trialExtensions >= maxExtensions ? "cancel" : "extend";
}

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const admin = createAdminClient();
  const now = new Date();

  const { data, error } = await admin
    .from("subscriptions")
    .select(
      "user_id, stripe_subscription_id, status, trial_end, trial_notice_sent_for, trial_notice_state, trial_extensions"
    )
    .eq("status", "trialing")
    .not("trial_end", "is", null)
    .lte("trial_end", new Date(now.getTime() + GUARD_DAYS_BEFORE * DAY_MS).toISOString())
    .gte("trial_end", now.toISOString())
    .limit(200);

  if (error) {
    console.error("[cron/trial-guard] lecture subscriptions", error);
    return NextResponse.json({ extended: 0, cancelled: 0, error: true }, { status: 500 });
  }

  let extended = 0;
  let cancelled = 0;
  let failed = 0;

  for (const row of data ?? []) {
    /*
     * La requête a filtré ; la décision est REPOSÉE par la fonction pure, qui
     * est celle qui est testée. Un filtre SQL qui dérive de la règle est un bug
     * qu'aucun test ne verrait — et ici le bug s'appelle « débitée sans avoir
     * été prévenue ».
     */
    const action = guardAction(
      {
        status: row.status,
        trialEnd: row.trial_end,
        trialNoticeSentFor: row.trial_notice_sent_for,
        trialNoticeState: row.trial_notice_state,
        trialExtensions: row.trial_extensions ?? 0,
      },
      now
    );

    if (action === "none") continue;

    const stripe = getStripeClient();

    try {
      if (action === "extend") {
        const newEnd = new Date(Date.parse(row.trial_end as string) + EXTENSION_DAYS * DAY_MS);

        /*
         * ⚠ VERIFY-THEN-CONSUME. Stripe est l'acte IRRÉVERSIBLE ici — il
         * déplace la date à laquelle une carte est débitée. Il passe en
         * premier, et la ligne n'est écrite QUE s'il a réussi. Dans l'autre
         * ordre, un échec Stripe laisserait une ligne disant « prolongé » sur
         * un essai qui se convertit demain, ce qui est exactement la classe de
         * mensonge qu'on est en train de retirer du produit.
         */
        await stripe.subscriptions.update(row.stripe_subscription_id, {
          trial_end: Math.floor(newEnd.getTime() / 1000),
          proration_behavior: "none",
        });

        const { error: writeError } = await admin
          .from("subscriptions")
          .update({
            trial_end: newEnd.toISOString(),
            trial_extensions: (row.trial_extensions ?? 0) + 1,
            trial_guard_acted_at: now.toISOString(),
            /*
             * La nouvelle date n'a PAS été annoncée : l'ancien préavis portait
             * sur un autre débit. On efface la preuve en même temps que la
             * date, sinon `trial-ending` croirait avoir déjà prévenu.
             */
            trial_notice_sent_for: null,
            trial_notice_state: null,
            trial_notice_provider_id: null,
            trial_notice_accepted_at: null,
          })
          .eq("user_id", row.user_id);

        if (writeError) {
          console.error("[cron/trial-guard] écriture après prolongation", writeError);
        }

        console.error(
          `[cron/trial-guard] PROLONGÉ de ${EXTENSION_DAYS} j pour ${row.user_id} — préavis non prouvé (état: ${row.trial_notice_state ?? "aucun"})`
        );
        track("trial_guard_extended", { extensions: (row.trial_extensions ?? 0) + 1 });
        extended += 1;
      } else {
        /*
         * Annulation à la fin de la période d'essai : Stripe ne facture rien,
         * et elle garde le service jusqu'à la date prévue. On n'annule pas
         * séance tenante — lui retirer le service AUJOURD'HUI pour une panne de
         * mailer serait la punir d'un défaut qui n'est pas le sien.
         */
        await stripe.subscriptions.update(row.stripe_subscription_id, {
          cancel_at_period_end: true,
        });

        const { error: writeError } = await admin
          .from("subscriptions")
          .update({
            cancel_at_period_end: true,
            trial_guard_acted_at: now.toISOString(),
          })
          .eq("user_id", row.user_id);

        if (writeError) {
          console.error("[cron/trial-guard] écriture après annulation", writeError);
        }

        console.error(
          `[cron/trial-guard] ANNULÉ à la fin d'essai pour ${row.user_id} — ${row.trial_extensions} prolongations sans préavis prouvé`
        );
        track("trial_guard_cancelled", { extensions: row.trial_extensions ?? 0 });
        cancelled += 1;
      }
    } catch (stripeError) {
      /*
       * Rien n'est écrit : la ligne reste telle quelle et le balayage de demain
       * la retrouvera. Compté et rendu dans la réponse, parce qu'un garde qui
       * échoue en silence est le problème qu'on répare.
       */
      console.error(
        `[cron/trial-guard] Stripe a refusé ${action} pour ${row.user_id} :`,
        stripeError instanceof Error ? stripeError.message : stripeError
      );
      failed += 1;
    }
  }

  return NextResponse.json({ extended, cancelled, failed });
}
