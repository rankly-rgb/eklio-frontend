import {
  reserveRefusal,
  type CreditPort,
  type PaidCallSpec,
  type ReserveOutcome,
} from "@/lib/credits/paid-call";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE PORT DE CRÉDIT CÔTÉ SERVEUR — ÉTAGE E3 DE F45
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `CreditPort` avait UNE implémentation, et elle était dans
 * `scripts/local-render/20-month.ts`. Le chemin produit n'en avait aucune : le
 * recensement du 2026-09-26 a montré que le quota de trente posts achetés
 * n'était tenu nulle part sur ce chemin — il tient l'allocation d'IMAGES, ce qui
 * est un autre compteur.
 *
 * ── ⚠ LE QUOTA EST TENU PAR LE SQL, PAS PAR CE FICHIER ──────────────────
 *
 * Ce module n'additionne rien et ne compare rien. `reserve_credit` réserve, et
 * `credit_ledger_apply()` lève `EK010` quand la borne est atteinte : c'est lui
 * l'arbitre. Un plafond recalculé ici serait un second arbitre, et celui des deux
 * qu'on oublie de mettre à jour est celui qui décide — la classe de F27, et celle
 * de F41 où un tirage dérivé d'un ratio tautologique s'est confirmé lui-même
 * pendant deux sessions.
 *
 * Le préalable (`lib/content/month/preflight.ts`) lit `credit_remaining()` pour
 * REFUSER TÔT, mais c'est une courtoisie, pas la garantie : deux invocations
 * simultanées passeraient toutes les deux ce préalable et l'une des deux serait
 * refusée par `reserve_credit`. La courtoisie évite de dépenser ; la garantie
 * empêche de dépasser.
 */

/** Le minimum que ce port demande d'un client Supabase. */
export type CreditRpcClient = {
  rpc(
    name: "reserve_credit" | "settle_credit",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

export type ServerCreditPortOptions = {
  /** Le fournisseur écrit au livre. Par défaut `anthropic`. */
  provider?: string;
  /** Le modèle écrit au livre. */
  model: string;
  /** Le mois auquel les appels s'imputent, `YYYY-MM-DD`. */
  month: string;
};

/**
 * Un `CreditPort` adossé aux deux RPC.
 *
 * ⚠ IL NE JOURNALISE PAS ET NE PLAFONNE PAS. Le harnais y ajoute `noteSpend`
 * pour son plafond de session, qui borne une exécution en ligne de commande ;
 * une route n'a pas de session, et son plafond est le quota SQL. Mettre un
 * plafond de session ici en ferait un troisième compteur.
 */
export function serverCreditPort(
  db: CreditRpcClient,
  options: ServerCreditPortOptions
): CreditPort {
  return {
    async reserve(spec: PaidCallSpec): Promise<ReserveOutcome> {
      const { data, error } = await db.rpc("reserve_credit", {
        p_user: spec.userId,
        p_kind: spec.kind,
        p_reason: spec.reason,
        p_provider: spec.provider ?? options.provider ?? "anthropic",
        p_model: spec.model ?? options.model,
        p_month: spec.month ?? options.month,
      });

      /*
       * ⚠ UNE PANNE DE TRANSPORT N'EST PAS UN REFUS DE QUOTA. La base tombée,
       * un réseau coupé, une policy qui refuse : aucun de ces cas ne dit quoi que
       * ce soit du droit de la praticienne. Ils remontent comme des erreurs, pas
       * comme `quota_exhausted` — c'est précisément le mensonge que F47 répare.
       */
      if (error) throw new Error(`reserve_credit: ${error.message}`);

      const row = data as { ok?: boolean; reservation_id?: string; reason?: string } | null;
      if (row?.ok === true && row.reservation_id) {
        return { ok: true, reservationId: row.reservation_id };
      }
      return { ok: false, reason: reserveRefusal(row?.reason) };
    },

    async settle(reservationId: string, costUsd: number, succeeded: boolean): Promise<void> {
      const { error } = await db.rpc("settle_credit", {
        p_reservation_id: reservationId,
        /*
         * ⚠ SIX DÉCIMALES, ET LE COÛT RÉEL. Un règlement à zéro efface la
         * dépense pour de bon : `settle_credit` rend `already_settled` sans
         * lever, donc la PREMIÈRE issue est celle qui reste au livre. C'est ce
         * que F40 a coûté sur le remplissage de banque — 1,20 $ dépensés, 0,0046
         * au registre.
         */
        p_actual_cost_usd: Number(costUsd.toFixed(6)),
        p_succeeded: succeeded,
      });
      /*
       * ⚠ UNE PANNE DE RÈGLEMENT REMONTE. Elle laisse une réservation ouverte —
       * qui tient un crédit — et l'avaler ferait disparaître un crédit sans que
       * personne l'apprenne. L'invariant
       * `credit_ledger_one_outcome_per_reservation` exige une issue ; ne pas la
       * donner doit se voir.
       */
      if (error) throw new Error(`settle_credit: ${error.message}`);
    },
  };
}
