import { isEntitledToMonthlyPresence, type Subscription } from "@/lib/billing/entitlements";
import type { MonthStatus } from "@/lib/content/month/preflight";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  QUELS COMPTES SONT DUS CE MOIS-CI — LA DÉCISION PRODUIT, TRANCHÉE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `app/api/cron/content-month/route.ts` disait, depuis sa première version, que
 * l'ÉNUMÉRATION était la seule chose qui lui manquait : « quelles abonnées sont
 * dues, dans quel ordre, avec quelle limite, et que devient un kit dont le mois
 * échoue à moitié ». C'est une question produit, pas une question de code, et elle
 * a été tranchée le 2026-09-27 :
 *
 *   le cron mensuel ne génère que pour les comptes dont l'ABONNEMENT EST ACTIF et
 *   le QUOTA NON ÉPUISÉ, un mois par compte et par mois, IDEMPOTENT sur
 *   (compte, mois). Un compte déjà servi n'est jamais resservi, même si le cron
 *   rejoue.
 *
 * ── ⚠ « ACTIF » N'EST PAS REDÉFINI ICI ──────────────────────────────────
 *
 * `isEntitledToMonthlyPresence` répond déjà à « a-t-elle accès ? », et sa réponse
 * est plus subtile qu'une comparaison de statut : un `past_due` garde un délai de
 * grâce tant que sa période payée n'est pas close. Écrire une seconde règle ici en
 * ferait un second arbitre, et celui des deux qu'on oublie de mettre à jour est
 * celui qui décide — la classe de F27, et de F41 où un ratio tautologique s'est
 * confirmé lui-même pendant deux sessions.
 *
 * ── ⚠ CE QUI COMPTE COMME « DÉJÀ SERVI », ET CE QUI N'EN EST PAS ────────
 *
 *   proposed    trente posts attendent sa relecture → SERVI, jamais resservi
 *   approved    elle les a validés → SERVI
 *   generating  la ligne que le webhook Stripe pose À L'ACHAT, ou une exécution
 *               tuée → PAS servi : c'est même le signal « elle a payé et attend »,
 *               et c'est exactement ce que ce cron existe pour ramasser (F54)
 *   failed      un essai qui n'a rien livré → PAS servi
 *   absent      rien encore → dû
 *
 * ⚠ ET `failed` EST DÛ, CE QUI MÉRITE SA RAISON. Ne pas le reprendre laisserait une
 * praticienne qui a payé sans rien ce mois-là. Le reprendre est peu coûteux : le
 * journal (`content_generation_runs` / `content_generation_results`) porte les
 * réponses déjà payées, et `findResumableRun` les relit au lieu de les redemander.
 * Le plafond de dépense (F58) borne le reste.
 *
 * ⚠ LA SEULE FENÊTRE OÙ CE CHOIX COÛTE : un `failed` de plus de vingt-neuf jours a
 * vu son lot fermé par `abandon_stale_generation_runs()`, donc sa reprise repaie.
 * Le cron visant le mois À VENIR, un tel écart ne peut apparaître qu'à un rejeu
 * tardif, et le plafond le couvre. Noté plutôt que tu.
 *
 * ── ⚠ L'IDEMPOTENCE N'EST PAS TENUE PAR CE MODULE ───────────────────────
 *
 * Ce module SÉLECTIONNE. Ce qui garantit « un mois par compte et par mois » est la
 * base : `content_months_kit_month_key` est unique sur `(brand_kit_id, month)`, et
 * `content_generation_runs_unique` l'est sur la même paire. Deux invocations
 * simultanées passeraient toutes deux cette sélection ; la seconde est refusée par
 * la contrainte, et une reprise RATTACHE le lot au lieu d'en créer un second.
 *
 * Cette sélection existe pour ne pas DÉPENSER inutilement, pas pour tenir
 * l'unicité. La courtoisie évite la dépense ; la garantie empêche le doublon.
 */

/** Un compte, tel que le cron a besoin de le connaître. */
export type Candidate = {
  userId: string;
  projectId: string;
  brandKitId: string;
  /** `null` quand le compte n'a aucun abonnement — donc pas dû. */
  subscription: Subscription | null;
};

export type DuePort = {
  /**
   * Les comptes à examiner.
   *
   * ⚠ LE PORT REND LES CANDIDATS, PAS LES DUS. Filtrer en SQL mettrait la règle
   * d'éligibilité dans une requête, où `isEntitledToMonthlyPresence` ne peut pas
   * l'appliquer — et le délai de grâce d'un `past_due` y serait réécrit à la main.
   */
  candidates(): Promise<Candidate[]>;
  monthStatus(brandKitId: string, month: string): Promise<MonthStatus | null>;
  quotaRemaining(
    userId: string,
    month: string
  ): Promise<{ remaining: number | null; unlimited: boolean }>;
};

/** Pourquoi un compte n'est pas dû. Fermé, pour que le rapport les compte. */
export type SkipReason =
  | "not_entitled"
  | "already_served"
  | "quota_exhausted"
  | "duplicate_kit";

export type DueOutcome = {
  /** Les comptes à générer, un par compte, dans l'ordre reçu. */
  due: Candidate[];
  /** Ce qui a été écarté, avec la raison — un rapport qui ne compte pas ne dit rien. */
  skipped: Array<{ brandKitId: string; reason: SkipReason; detail?: string }>;
};

/** Les états qui veulent dire « ce mois est déjà livré ». Cf. F54. */
const SERVED: readonly MonthStatus[] = ["proposed", "approved"];

/**
 * Les comptes dus pour ce mois, et pourquoi les autres ne le sont pas.
 *
 * ⚠ AUCUNE DÉPENSE, AUCUNE ÉCRITURE. Trois lectures par compte, et une décision
 * pure. C'est ce qui permet de l'éprouver entier par des doublures.
 */
export async function selectDueMonths(
  port: DuePort,
  input: { month: string; now?: Date; posts: number }
): Promise<DueOutcome> {
  const now = input.now ?? new Date();
  const due: Candidate[] = [];
  const skipped: DueOutcome["skipped"] = [];
  const seen = new Set<string>();

  for (const candidate of await port.candidates()) {
    /*
     * ⚠ UN KIT DEUX FOIS EST UN KIT UNE FOIS. Une jointure qui rendrait deux lignes
     * — deux abonnements, un projet dupliqué — ferait générer deux fois le même
     * mois, et la seconde serait refusée par la contrainte APRÈS avoir dépensé.
     * « Un mois par compte et par mois » se tient donc aussi ici.
     */
    if (seen.has(candidate.brandKitId)) {
      skipped.push({ brandKitId: candidate.brandKitId, reason: "duplicate_kit" });
      continue;
    }
    seen.add(candidate.brandKitId);

    /* ── 1. l'abonnement, par la règle qui existe déjà ─────────────────── */
    if (!isEntitledToMonthlyPresence(candidate.subscription, now)) {
      skipped.push({
        brandKitId: candidate.brandKitId,
        reason: "not_entitled",
        detail: candidate.subscription?.status ?? "aucun abonnement",
      });
      continue;
    }

    /* ── 2. déjà servi ? ──────────────────────────────────────────────── */
    /*
     * ⚠ AVANT LE QUOTA, ET C'EST L'ORDRE UTILE. Un mois déjà livré a CONSOMMÉ son
     * quota : demander le quota d'abord le ferait écarter pour « quota épuisé », ce
     * qui enverrait chercher un problème de facturation là où le mois est
     * simplement fait.
     */
    const status = await port.monthStatus(candidate.brandKitId, input.month);
    if (status !== null && SERVED.includes(status)) {
      skipped.push({
        brandKitId: candidate.brandKitId,
        reason: "already_served",
        detail: status,
      });
      continue;
    }

    /* ── 3. le quota ──────────────────────────────────────────────────── */
    const quota = await port.quotaRemaining(candidate.userId, input.month);
    /*
     * ⚠ « PAS DE BORNE » ET « RIEN DE RESTANT » NE SE CONFONDENT PAS. Un compte sans
     * plafond rend `unlimited`, et lire `remaining` seul écarterait tous les comptes
     * sans plafond — la forme exacte du défaut que le préalable a déjà corrigée.
     */
    if (!quota.unlimited && (quota.remaining ?? 0) < input.posts) {
      skipped.push({
        brandKitId: candidate.brandKitId,
        reason: "quota_exhausted",
        detail: `${quota.remaining ?? 0} restant(s) pour ${input.posts} promis`,
      });
      continue;
    }

    due.push(candidate);
  }

  return { due, skipped };
}
