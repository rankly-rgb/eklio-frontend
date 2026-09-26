/*
 * ── LA SEULE PORTE D'UN APPEL PAYANT ────────────────────────────────────
 *
 * ⚠ MESURÉ : DIX MOIS, TROIS CENTS POSTS, `credit_ledger` INCHANGÉ.
 *
 * Le chemin Batch ne réservait rien (F25), et c'est LE chemin de production :
 * le synchrone ne sert qu'au premier mois d'un compte. En bouchant ce trou,
 * trois autres appels payants se sont révélés n'être dans aucun compteur — la
 * réparation d'un payload, la dérivation des thèmes, le juge de complétude —
 * et un quatrième, la génération de kit, n'y était jamais entré.
 *
 * ── POURQUOI UN SEUL POINT, ET PAS CINQ CORRECTIFS ─────────────────────
 *
 * F18, F19, F21, F23 et F25 sont le même défaut cinq fois : une grandeur
 * juste, calculée, jamais consommée. On ne le répare pas en corrigeant cinq
 * endroits — on le répare en rendant impossible d'écrire un appel payant SANS
 * son écriture au livre. C'est ce que fait `withPaidCall` : la réservation et
 * le règlement encadrent l'appel, et un appel écrit à côté n'a pas de coût à
 * déclarer, donc se voit.
 *
 * ── DEUX GENRES, ET LA DIFFÉRENCE EST FACTURABLE ───────────────────────
 *
 * ⚠ CE MODULE N'EST PAS DANS `lib/billing/`, ET C'EST UN TEST QUI L'A DIT.
 * `wired-to-a-screen` couvre `lib/billing/` parce qu'un module de ce dossier
 * « décrit quelque chose que la cliente ACHÈTE ou PARCOURT ». Celui-ci décrit
 * la PLOMBERIE du livre, qu'aucun écran ne montre. Le garde-fou a refusé, et
 * il avait raison : le dossier était le mauvais.
 *
 * `post_generation` prend un crédit : c'est un post que la praticienne a
 * acheté. `overhead` n'en prend AUCUN et porte quand même son coût — une
 * réparation, un juge de syntaxe, une dérivation de thèmes sont des frais
 * généraux, et les facturer prendrait à la cliente un post qu'elle n'a pas
 * eu. La gratuité est tenue par un CHECK en base, pas par cette phrase.
 */

/** Ce qu'un appel a consommé chez le fournisseur. */
export type CallUsage = { input: number; output: number; cacheRead?: number; cacheWrite?: number };

export type PaidCallSpec = {
  userId: string;
  /** `post_generation` prend un crédit ; `overhead` n'en prend aucun. */
  kind: "post_generation" | "swap" | "regeneration" | "custom_visual" | "overhead";
  /** Ce qui sera lu dans le livre. Jamais vide. */
  reason: string;
  provider?: string;
  model?: string;
  /** Le mois auquel l'appel s'impute. */
  month?: string;
};

/*
 * ── ⚠ LA RPC DISTINGUE SEPT MOTIFS ; LE PORT EN ÉCRASAIT SIX ────────────
 *
 * `reserve_credit` rend `{ok:false, reason}` avec sept valeurs possibles, et son
 * propre code porte l'avertissement qui explique pourquoi :
 *
 *   « ranger une violation de forme sous `quota_exhausted` est un MENSONGE sur
 *     son compte, et aurait envoyé quelqu'un sur une page de paiement acheter
 *     des crédits qu'elle avait déjà. »
 *
 * Le port TypeScript rendait `string | null` : les six refus devenaient un
 * `null`, et `withPaidCall` levait `QuotaRefused` pour tous. Le SQL prenait soin
 * de distinguer, et la couche au-dessus jetait ce soin. C'est le quatrième
 * mécanisme trouvé branché d'un seul côté (F47), après le dénominateur de F41, la
 * porte de vérification d'État de F46 et le verdict en dur du générateur retiré.
 */
export type ReserveRefusal =
  /** Elle a épuisé ce qu'elle a acheté. Un achat y change quelque chose. */
  | "quota_exhausted"
  /** Son abonnement ne porte pas ce droit. Un achat y change quelque chose. */
  | "not_entitled"
  /** Le plan n'a pas de ligne pour ce genre de crédit. Défaut de configuration. */
  | "no_quota_configured"
  /** Défauts de programmation : ils doivent traverser la frontière comme tels. */
  | "no_user"
  | "unknown_kind"
  | "invalid_cost"
  /** La RPC a rendu un motif que ce code ne connaît pas. */
  | "unknown";

/**
 * Les deux motifs qu'un achat répare.
 *
 * ⚠ C'EST LA SEULE DISTINCTION QUI COMPTE POUR L'APPELANT. Les quatre autres
 * sont des défauts de notre côté : proposer un achat pour un `unknown_kind`
 * ferait payer une praticienne pour notre faute.
 */
export function aPurchaseWouldHelp(reason: ReserveRefusal): boolean {
  return reason === "quota_exhausted" || reason === "not_entitled";
}

export type ReserveOutcome =
  | { ok: true; reservationId: string }
  | { ok: false; reason: ReserveRefusal };

/** Ce dont le wrapper a besoin : deux RPC, rien d'autre. */
export type CreditPort = {
  reserve(spec: PaidCallSpec): Promise<ReserveOutcome>;
  settle(reservationId: string, costUsd: number, succeeded: boolean): Promise<void>;
};

/**
 * Une réservation refusée, AVEC son motif.
 *
 * ⚠ LE NOM NE DIT PLUS « QUOTA », parce que cinq des sept motifs n'en sont pas
 * un. `aPurchaseWouldHelp` dit lequel des deux cas mérite une page de paiement.
 */
export class ReserveRefused extends Error {
  constructor(
    readonly spec: PaidCallSpec,
    readonly reason: ReserveRefusal
  ) {
    super(`réservation refusée pour ${spec.kind} (${reason}) : ${spec.reason}`);
    this.name = "ReserveRefused";
  }

  /** Vrai quand un achat y change quelque chose. */
  get buyable(): boolean {
    return aPurchaseWouldHelp(this.reason);
  }
}

/**
 * Réserve, appelle, règle. Dans cet ordre, et sans sortie possible.
 *
 * ⚠ LA RÉSERVATION EST AVANT L'APPEL, ET CE N'EST PAS COSMÉTIQUE. Un lot
 * Batch est facturé À LA SOUMISSION : réserver après, c'est réserver pour une
 * dépense déjà faite, et un quota épuisé découvert à ce moment-là ne peut plus
 * rien empêcher.
 *
 * ⚠ ET LE RÈGLEMENT PASSE MÊME QUAND L'APPEL ÉCHOUE. Un appel raté a dépensé
 * des jetons chez le fournisseur et ne doit rien à la praticienne : il se
 * solde à `succeeded: false`, ce qui lui rend son crédit en gardant le coût
 * écrit. C'est la règle que F19 a établie en la violant.
 */
export async function withPaidCall<T>(
  port: CreditPort,
  spec: PaidCallSpec,
  run: () => Promise<{ value: T; usage: CallUsage; costUsd: number }>
): Promise<{ value: T; usage: CallUsage; costUsd: number; reservationId: string }> {
  const reserved = await port.reserve(spec);
  if (!reserved.ok) throw new ReserveRefused(spec, reserved.reason);
  const reservationId = reserved.reservationId;

  try {
    const outcome = await run();
    await port.settle(reservationId, outcome.costUsd, true);
    return { ...outcome, reservationId };
  } catch (error) {
    // ⚠ Le coût réel est inconnu quand l'appel a levé : on solde à zéro plutôt
    // que d'inventer un chiffre. Le crédit revient, la ligne reste.
    await port.settle(reservationId, 0, false);
    throw error;
  }
}

/**
 * Un appel de frais généraux : il coûte, il ne facture pas.
 *
 * ⚠ IL NE LÈVE PAS SUR UN REFUS DE QUOTA. `overhead` est illimité par
 * construction ; si la réservation échoue quand même — entitlement retiré,
 * base tombée — un contrôle de syntaxe ne doit pas faire tomber un mois. Le
 * défaut est alors visible par l'ABSENCE de ligne, qui est ce que
 * `credit_month_audit` sert à voir.
 */
export async function withOverhead<T>(
  port: CreditPort,
  spec: Omit<PaidCallSpec, "kind">,
  run: () => Promise<{ value: T; usage: CallUsage; costUsd: number }>
): Promise<{ value: T; usage: CallUsage; costUsd: number }> {
  try {
    return await withPaidCall(port, { ...spec, kind: "overhead" }, run);
  } catch (error) {
    if (error instanceof ReserveRefused) {
      /*
       * ⚠ ON APPELLE QUAND MÊME, ET LE MOTIF NE CHANGE RIEN ICI. `overhead` est
       * illimité par construction : un refus signifie que la comptabilité est en
       * panne, pas que le droit manque. Un contrôle de syntaxe ne doit pas faire
       * tomber un mois pour une ligne de livre absente — et l'absence de ligne
       * est précisément ce que `credit_month_audit` sert à voir.
       */
      const outcome = await run();
      return outcome;
    }
    throw error;
  }
}

/**
 * Le motif rendu par `reserve_credit`, ramené au type.
 *
 * ⚠ UN MOTIF INCONNU DEVIENT `"unknown"`, PAS `"quota_exhausted"`. Si la RPC
 * gagne un huitième motif, l'appelant doit apprendre qu'il ne le connaît pas —
 * pas se le faire raconter comme un quota épuisé. C'est exactement l'erreur que
 * F47 répare.
 */
export function reserveRefusal(reason: string | null | undefined): ReserveRefusal {
  const known: ReserveRefusal[] = [
    "quota_exhausted",
    "not_entitled",
    "no_quota_configured",
    "no_user",
    "unknown_kind",
    "invalid_cost",
  ];
  return known.find((r) => r === reason) ?? "unknown";
}
