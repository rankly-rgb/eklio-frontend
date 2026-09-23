/*
 * ── ⚠ CE QU'UNE GÉNÉRATION MORTE GARDE EN OTAGE ─────────────────────────
 *
 * Mesuré le 2026-09-24. Dix générations mensuelles ont été interrompues
 * pendant l'attente de leur lot. Elles ont laissé derrière elles :
 *
 *   * **720 sujets assignés** et jamais rendus — la banque est passée à
 *     TROIS sujets libres, et le tirage suivant a rendu « 0 candidates » ;
 *   * **31 réservations ouvertes par compte**, ni soldées ni relâchées : le
 *     quota affichait `consumed = 30` sur 30 pour un mois inexistant.
 *
 * ⚠ LE JOURNAL (F17) NE COUVRE PAS ÇA. Il sait RETROUVER un lot déjà payé ;
 * il ne sait pas rendre ce que le processus mort tenait. Deux choses
 * différentes, et une seule était écrite.
 *
 * En production, une génération qui meurt — redémarrage, dépassement de
 * temps, base tombée — laisse donc une praticienne au quota épuisé pour un
 * mois qu'elle n'a pas reçu, et retire à tout son segment les sujets qu'elle
 * avait tirés, pour quatre-vingt-dix jours.
 *
 * ── CE QUE CE SCRIPT REND, ET CE QU'IL NE TOUCHE PAS ────────────────────
 *
 * Il ne rend QUE ce qui n'a pas abouti :
 *   * une assignation dont le kit n'a pas de mois en base ;
 *   * une réservation sans règlement ni restitution.
 *
 * ⚠ IL NE RÈGLE RIEN À `true`. Une réservation orpheline se relâche — le
 * travail n'a pas été livré — et son coût reste inconnu, donc nul. Le
 * contraire ferait payer un mois que personne n'a reçu.
 *
 *   npx tsx scripts/local-render/98-release-orphans.ts --confirm [--email <compte>]
 */
import { admin, untypedTable, MONTH } from "./lib";

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("\n✗ Refusing without --confirm. This releases reservations and assignments.\n");
    process.exit(1);
  }
  const db = admin();
  const only = arg("email");

  /* ── 1. Les sujets tenus par un kit sans mois ────────────────────────── */
  const { data: months } = await db
    .from("content_months").select("brand_kit_id").eq("month", MONTH);
  const withMonth = new Set((months ?? []).map((m) => m.brand_kit_id));

  const { data: held } = await untypedTable<{ brand_kit_id: string; topic_id: string }>(
    db, "topic_assignments"
  ).select("brand_kit_id, topic_id");

  const orphanKits = [...new Set((held ?? []).map((h) => h.brand_kit_id))]
    .filter((k) => !withMonth.has(k));

  let topicsReleased = 0;
  for (const kit of orphanKits) {
    await untypedTable(db, "topic_assignments").delete().eq("brand_kit_id", kit);
    topicsReleased += (held ?? []).filter((h) => h.brand_kit_id === kit).length;
  }

  /* ── 2. Les réservations sans issue ──────────────────────────────────── */
  let query = db.from("credit_ledger").select("id, user_id, entry_type, reservation_id").eq("month", MONTH);
  if (only) {
    const { data: profile } = await db.from("profiles").select("id").eq("email", only).single();
    if (profile) query = query.eq("user_id", profile.id);
  }
  const { data: rows } = await query;

  const settled = new Set(
    (rows ?? []).filter((r) => r.entry_type !== "reservation").map((r) => r.reservation_id)
  );
  const open = (rows ?? []).filter((r) => r.entry_type === "reservation" && !settled.has(r.id));

  let released = 0;
  for (const row of open) {
    // ⚠ `succeeded: false`, et un coût nul. Le travail n'a pas été livré, et
    // ce qu'il a réellement coûté est perdu avec le processus qui le savait.
    const { data } = await db.rpc("settle_credit", {
      p_reservation_id: row.id, p_actual_cost_usd: 0, p_succeeded: false,
    } as never);
    if ((data as unknown as { ok?: boolean } | null)?.ok === true) released += 1;
  }

  console.log(JSON.stringify({
    step: "release-orphans", month: MONTH,
    orphanKits: orphanKits.length, topicsReleased,
    reservationsOpen: open.length, reservationsReleased: released,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
