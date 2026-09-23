/*
 * ── LA PREUVE QUE LE COMPTEUR COMPTE ────────────────────────────────────
 *
 * ⚠ MESURÉ LE 2026-09-23 : DIX MOIS, TROIS CENTS POSTS, `credit_ledger`
 * INCHANGÉ À 844 LIGNES. Le chemin Batch ne réservait rien (F25), et c'est LE
 * chemin de production — le synchrone ne sert qu'au premier mois d'un compte.
 *
 * Ce script ne génère rien et ne dépense pas un centime. Il pose les deux
 * questions qu'on n'avait jamais posées :
 *
 *   1. le plafond est-il tenu PAR LE SQL, et pas par du TypeScript ?
 *   2. un compte au quota épuisé se voit-il refuser la génération ?
 *
 * ⚠ IL TRAVAILLE SUR UN MOIS FICTIF, JAMAIS SUR CELUI D'UN MOIS RÉEL. Épuiser
 * le quota d'octobre d'un compte de test rendrait son mois ingénérable pour le
 * reste de la session, et la preuve coûterait plus qu'elle ne prouve.
 *
 *   npx tsx scripts/local-render/96-credit-proof.ts --email <compte>
 */
import { admin, accountFor } from "./lib";

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

/** Un mois qui n'existe nulle part ailleurs : la preuve ne casse rien. */
const PROOF_MONTH = "2030-01-01";

type Verdict = { ok?: boolean; reason?: string; reservation_id?: string };

async function main() {
  const db = admin();
  const { userId } = await accountFor(db, arg("email"));

  const reserve = async (kind: string, reason: string): Promise<Verdict> => {
    const { data, error } = await db.rpc("reserve_credit", {
      p_user: userId, p_kind: kind, p_reason: reason,
      p_provider: "anthropic", p_model: "proof", p_month: PROOF_MONTH,
    } as never);
    if (error) throw new Error(`reserve_credit: ${error.message}`);
    return data as unknown as Verdict;
  };

  /*
   * ⚠ LA PREUVE SE NETTOIE AVANT DE COMMENCER, PAS SEULEMENT APRÈS. Le premier
   * passage a levé au milieu — sur une troisième table qui portait la même
   * liste de genres — et a laissé trente réservations ouvertes. Le passage
   * suivant a donc mesuré « refusé dès la première », ce qui était vrai et ne
   * prouvait plus rien. Une preuve qui dépend de l'état laissé par la
   * précédente n'est pas une preuve.
   */
  const { data: stale } = await db
    .from("credit_ledger").select("id, entry_type")
    .eq("user_id", userId).eq("month", PROOF_MONTH).eq("entry_type", "reservation");
  for (const row of stale ?? []) {
    await db.rpc("settle_credit", {
      p_reservation_id: row.id, p_actual_cost_usd: 0, p_succeeded: false,
    } as never);
  }
  if ((stale ?? []).length > 0) console.error(`▸ ${stale!.length} réservations d'un passage précédent rendues`);

  const { data: quota } = await db
    .from("credit_quotas").select("monthly_limit").eq("plan", "standard").eq("kind", "post_generation").single();
  const limit = quota?.monthly_limit ?? 0;

  /* ── 1. Le plafond, atteint par le SQL et pas par un compteur local ──── */
  const taken: string[] = [];
  let refusal: Verdict | null = null;
  for (let i = 0; i < limit + 1; i += 1) {
    const verdict = await reserve("post_generation", `proof ${i + 1}`);
    if (verdict.ok === true && verdict.reservation_id) taken.push(verdict.reservation_id);
    else { refusal = verdict; break; }
  }

  /* ── 2. Les frais généraux ne prennent pas de crédit ─────────────────── */
  const overhead = await reserve("overhead", "proof overhead");

  /* ── 3. Ce que le livre en dit ────────────────────────────────────────── */
  const { data: rows } = await db
    .from("credit_ledger").select("kind, entry_type")
    .eq("user_id", userId).eq("month", PROOF_MONTH);
  const audit: Record<string, Record<string, number>> = {};
  for (const row of rows ?? []) {
    const kind = (audit[row.kind] ??= {});
    kind[row.entry_type] = (kind[row.entry_type] ?? 0) + 1;
  }

  console.log(JSON.stringify({
    step: "credit-proof",
    month: PROOF_MONTH,
    quotaLimit: limit,
    reservationsAccepted: taken.length,
    /* ⚠ C'EST LA LIGNE QUI COMPTE : le refus vient du SQL, nommé par lui. */
    refusedAtNumber: taken.length + 1,
    refusalReason: refusal?.reason ?? null,
    refusedBySql: refusal?.ok === false && refusal.reason === "quota_exhausted",
    overheadAcceptedAtQuotaExhausted: overhead.ok === true,
    book: audit,
  }, null, 2));

  /* ── 4. On rend ce qu'on a pris : la preuve ne laisse pas de dette ───── */
  for (const id of taken) {
    await db.rpc("settle_credit", {
      p_reservation_id: id, p_actual_cost_usd: 0, p_succeeded: false,
    } as never);
  }
  if (overhead.reservation_id) {
    await db.rpc("settle_credit", {
      p_reservation_id: overhead.reservation_id, p_actual_cost_usd: 0, p_succeeded: false,
    } as never);
  }
  console.error(`▸ ${taken.length} réservations rendues`);
}

main().catch((error) => { console.error(error); process.exit(1); });
