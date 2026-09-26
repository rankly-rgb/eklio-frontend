import { guardBank, type BankGuardPort, type BankVerdict } from "@/lib/content/bank-guard";
import { licenceMention, licenceMissingMessage, type LicenceFacts } from "@/lib/content/licence";
import { POSTS_PER_MONTH, type BankDemand } from "@/lib/content/bank";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'ÉTAGE A DE F45 — CE QUI SE DÉCIDE AVANT LA PREMIÈRE DÉPENSE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Premier étage du portage du générateur du harnais vers le chemin produit
 * (`docs/production/F45-portage.md`). C'est celui qui porte les deux choses
 * qu'on ne peut pas rattraper après coup :
 *
 *   le blocage LÉGAL      un brief sans mention de licence ne génère pas.
 *                         Californie B&P §4980.44, §4996.2, §4999.80 l'exigent
 *                         dans TOUTE publicité. Quatre cents posts en sont
 *                         sortis sans (F35) : quatre cents infractions.
 *   l'ARGENT              une génération qui ne peut pas aboutir est refusée
 *                         avant d'avoir payé le premier appel.
 *
 * ⚠ AUCUN ACCÈS RÉSEAU ICI, ET AUCUNE DÉPENSE. Tout est port injecté, donc tout
 * est éprouvable hors ligne — ce qui est la seule façon d'écrire ce module
 * pendant que le compte fournisseur est sous limite d'usage.
 *
 * ── ⚠ L'ORDRE DES QUATRE N'EST PAS ARBITRAIRE ───────────────────────────
 *
 * Le moins cher et le plus définitif d'abord, et ce qui ÉCRIT en dernier :
 *
 *   1. le mois existe déjà      une lecture. Refuser ici évite tout le reste.
 *   2. la licence               deux lectures, et c'est le refus légal.
 *   3. le quota                 une lecture. `credit_remaining` ne réserve pas —
 *                              sonder le quota en réservant laisserait une
 *                              réservation à solder pour une question.
 *   4. la banque               ELLE ÉCRIT (elle rend les assignations
 *                              orphelines). Un mois qu'on refuse pour les trois
 *                              raisons d'avant n'a pas à déclencher un balayage.
 *
 * ⚠ ET LE PREMIER REFUS ARRÊTE. On ne rend pas une liste de tout ce qui manque :
 * une praticienne dont le brief n'a pas de numéro de licence n'a pas besoin
 * d'apprendre en plus que sa banque est courte. Le message nomme UN champ et se
 * règle en trente secondes — c'est la règle de `licenceMissingMessage`.
 */

export type PreflightRefusal =
  | "month_exists"
  | "licence_missing"
  | "state_unverified"
  | "quota_exhausted"
  | "bank_short";

/** Les quatre valeurs de `content_months.status`, telles que la base les borne. */
export type MonthStatus = "generating" | "proposed" | "approved" | "failed";

/*
 * ⚠ CE QUI REFUSE EST UN MOIS LIVRÉ, ET LA LISTE EST COURTE EXPRÈS.
 *
 *   generating  la ligne posée par l'achat, ou une exécution tuée → ON CONTINUE,
 *               et la reprise du journal fait le reste
 *   failed      un essai qui n'a rien livré → ON RECOMMENCE
 *   proposed    trente posts attendent sa relecture → refus
 *   approved    elle les a validés → refus
 *
 * Ajouter `generating` ici refuserait les mois payés (F54) ; l'enlever de
 * `proposed` écrirait le mois deux fois.
 */
const MONTH_ALREADY_DELIVERED: MonthStatus[] = ["proposed", "approved"];

export type PreflightPort = {
  /**
   * Le `status` de la ligne `content_months` de ce mois, ou `null` s'il n'y en a
   * pas.
   *
   * ── ⚠ C'ÉTAIT UN BOOLÉEN, ET LE BOOLÉEN REFUSAIT LES MOIS PAYÉS (F54) ──
   *
   * `lib/content/generate/queue.ts` — appelé par le webhook Stripe à l'achat —
   * insère la ligne du mois avec `status: "generating"` AVANT toute génération.
   * C'est sa raison d'être : la cliente voit un écran « en cours » dès qu'elle a
   * payé, et la clé unique `(brand_kit_id, month)` rend un rejeu Stripe
   * idempotent.
   *
   * Un préalable qui demande « ce mois existe-t-il ? » répond donc OUI sur
   * exactement les mois qu'on a été payé pour produire, et refuse en disant
   * « rien n'a été dépensé » — vrai, et inutile. La cliente resterait sur son
   * écran « en cours » indéfiniment.
   *
   * ⚠ ET LE MÊME BOOLÉEN RENDAIT LA REPRISE INATTEIGNABLE. Une exécution tuée
   * laisse une ligne `generating` ; le préalable la lisait comme « déjà fait ».
   * Les deux tables du journal, le drapeau `settled`, la leçon des 0,81 $ perdus :
   * rien de tout cela ne pouvait servir sur le chemin produit.
   *
   * Ce qui refuse est donc un mois LIVRÉ, pas un mois annoncé.
   */
  monthStatus(brandKitId: string, month: string): Promise<MonthStatus | null>;
  /**
   * Les faits de licence du brief.
   *
   * ⚠ L'ABRÉVIATION VIENT DE `license_type_states`, PAS DU BRIEF. C'est la
   * matrice qui dit comment un type de licence s'écrit dans un État donné, et
   * elle est vérifiée à la main, État par État (F12). Un brief ne l'invente pas.
   */
  licenceFacts(projectId: string): Promise<LicenceFacts>;
  /**
   * L'État de licence a-t-il été vérifié à la main contre son board ?
   *
   * ── ⚠ CETTE PORTE MANQUAIT, ET L'ABRÉVIATION NE LA TIENT PAS ──────────
   *
   * `license_type_states` porte 240 couples (type, État) et une colonne
   * `verified_at` : c'est tout l'objet de F12 — un État n'est vendable que
   * lorsqu'une personne a lu la règle de son board. `lib/brief/license-state.ts`
   * le respecte et ne rend l'abréviation que si `verified_at` n'est pas nul.
   *
   * Le harnais, lui, lisait `abbreviation` SANS regarder `verified_at`. Et même
   * une abréviation nulle ne refuserait pas : `licenceMention` retombe sur
   * `LICENCE_ABBREVIATION`, une table du code, et imprimerait quand même.
   * L'absence d'abréviation n'est donc PAS un contrôle de vérification — d'où
   * cette porte, explicite et séparée.
   *
   * ⚠ ELLE ÉCHOUE FERMÉ : pas de couple, pas de vente.
   */
  stateVerified(licenseTypeId: string, stateCode: string): Promise<boolean>;
  /**
   * Ce qui reste du quota de posts pour ce mois.
   *
   * ⚠ `remaining: null` VEUT DIRE ILLIMITÉ, pas zéro. La RPC
   * `credit_remaining` le dit aussi par `unlimited`, et les deux doivent être
   * lus ensemble : confondre « pas de borne » et « rien de restant » refuserait
   * tous les comptes sans plafond.
   */
  creditRemaining(
    userId: string,
    month: string
  ): Promise<{ remaining: number | null; unlimited: boolean }>;
  /** Le port du garde-fou de banque, tel quel. */
  bank: BankGuardPort;
};

export type PreflightInput = {
  brandKitId: string;
  projectId: string;
  userId: string;
  /** Le premier jour du mois, `YYYY-MM-DD`. */
  month: string;
  /**
   * L'État de licence, `license_state_code` ou à défaut l'État du cabinet.
   *
   * ⚠ LE MÊME REPLI QUE LE HARNAIS : `license_state_code ?? state`. Un brief
   * rempli avant que le champ dédié existe porte l'État du cabinet, et c'est
   * presque toujours le bon.
   */
  stateCode: string | null;
  /** Ce que le tirage demandera. */
  demand: BankDemand;
  /** Combien de posts ce mois doit livrer. Par défaut `POSTS_PER_MONTH`. */
  wanted?: number;
};

export type PreflightVerdict =
  | {
      ok: true;
      /** La mention à poser au pied de chaque carte. Jamais vide quand `ok`. */
      licenceMention: string;
      bank: BankVerdict;
      quota: { remaining: number | null; unlimited: boolean };
    }
  | {
      ok: false;
      code: PreflightRefusal;
      /** Une phrase qui nomme ce qui manque, destinée à être lue telle quelle. */
      refusal: string;
      /** Rendu quand la banque est la cause, pour que l'appelant sache quoi remplir. */
      bank?: BankVerdict;
    };

export async function preflight(
  port: PreflightPort,
  input: PreflightInput
): Promise<PreflightVerdict> {
  const wanted = input.wanted ?? POSTS_PER_MONTH;

  /* ── 1. le mois existe déjà ─────────────────────────────────────────── */
  /*
   * ⚠ LA CLÉ UNIQUE `(brand_kit_id, month)` EST LA VRAIE GARANTIE, et cette
   * lecture ne la remplace pas : deux invocations simultanées la passeraient
   * toutes les deux. Elle est là pour rendre un message plutôt qu'une violation
   * de contrainte — la base reste l'arbitre.
   */
  const status = await port.monthStatus(input.brandKitId, input.month);
  if (status !== null && MONTH_ALREADY_DELIVERED.includes(status)) {
    return {
      ok: false,
      code: "month_exists",
      refusal: `un mois ${input.month} est déjà livré pour ce kit (${status}) — rien n'a été généré et rien n'a été dépensé`,
    };
  }

  /* ── 2. la licence ──────────────────────────────────────────────────── */
  const facts = await port.licenceFacts(input.projectId);
  const missing = licenceMissingMessage(facts);
  if (missing) {
    /*
     * ⚠ LA PHRASE SUR LA DÉPENSE EST AJOUTÉE ICI, pas dans
     * `licenceMissingMessage`. Ce message est partagé avec le harnais et avec
     * l'écran de brief, où « rien n'a été dépensé » ne veut rien dire. Le
     * préalable, lui, est le seul endroit où la question se pose.
     */
    return {
      ok: false,
      code: "licence_missing",
      refusal: `${missing} Rien n'a été généré et rien n'a été dépensé.`,
    };
  }
  /*
   * ⚠ LE `!` EST SÛR ICI, ET SEULEMENT ICI. `licenceMissingMessage` rend une
   * phrase exactement quand `licenceMention` rend `null` : les deux lisent les
   * mêmes trois champs. Ailleurs, le `!` serait un pari.
   */
  const mention = licenceMention(facts)!;

  /* ── 2b. l'État est-il vérifié ? ────────────────────────────────────── */
  const typeId = facts.licenseTypeId!.trim();
  const stateCode = (input.stateCode ?? "").trim().toUpperCase();
  if (stateCode === "" || !(await port.stateVerified(typeId, stateCode))) {
    return {
      ok: false,
      code: "state_unverified",
      refusal:
        `l'État « ${stateCode || "(absent du brief)"} » n'est pas vérifié pour une licence ` +
        `« ${typeId} » : personne n'a encore lu la règle publicitaire de ce board. ` +
        `Voir docs/production/F12-comment-verifier.md — 20 minutes pour la Californie. ` +
        `Rien n'a été généré et rien n'a été dépensé.`,
    };
  }

  /* ── 3. le quota ────────────────────────────────────────────────────── */
  const quota = await port.creditRemaining(input.userId, input.month);
  const enough = quota.unlimited || (quota.remaining ?? 0) >= wanted;
  if (!enough) {
    return {
      ok: false,
      code: "quota_exhausted",
      refusal:
        `le quota de ce mois ne porte plus que ${quota.remaining ?? 0} post(s) sur les ${wanted} ` +
        `qu'un mois demande — rien n'a été généré et rien n'a été dépensé`,
    };
  }

  /* ── 4. la banque, et c'est elle qui écrit ──────────────────────────── */
  const bank = await guardBank(port.bank, input.brandKitId, input.demand);
  if (!bank.ok) {
    return {
      ok: false,
      code: "bank_short",
      refusal:
        `la banque ne porte pas de quoi composer ce mois — ${bank.said}. ` +
        `Rien n'a été généré et rien n'a été dépensé.`,
      bank,
    };
  }

  return { ok: true, licenceMention: mention, bank, quota };
}
