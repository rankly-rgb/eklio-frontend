/*
 * ── ⚠ UN MOIS REFUSÉ BLOQUE TRENTE SUJETS POUR QUATRE-VINGT-DIX JOURS ──
 *
 * Mesuré le 2026-09-23 sur neuf essais. Un mois qui échoue ses contrôles reste
 * en `proposed` — c'est voulu, on le relit pour savoir ce qui cloche — mais
 * ses trente posts sont écrits, donc ses trente sujets restent ASSIGNÉS. La
 * fenêtre anti-collision les retire alors à TOUTES les praticiennes du
 * segment pendant quatre-vingt-dix jours, pour un mois que personne ne
 * publiera jamais.
 *
 * La banque est passée de 372 sujets libres à 88 en quatre essais, dont trois
 * refusés. Au neuvième, le tirage ne rendait plus que 24 candidats pour 30
 * posts : la banque ne portait plus de quoi composer un mois.
 *
 * ⚠ ET CE N'EST PAS UN DÉFAUT DE HARNAIS. En production la reprise se fait
 * sur LE MÊME compte, et `20-month.ts` refuse d'écrire par-dessus un mois
 * existant — « un mois, une fois, jusqu'à ce qu'il soit lu ». Sans un
 * abandon explicite, une praticienne dont le mois est refusé n'en a jamais
 * d'autre.
 *
 * Abandonner, c'est donc : supprimer les posts, supprimer le mois, et RENDRE
 * les sujets. Les trois ensemble, ou rien — un mois supprimé dont les sujets
 * restent pris est le même défaut sous un autre nom.
 *
 *   npx tsx scripts/local-render/95-abandon-month.ts --email <compte> --confirm
 */
import { admin, accountFor, untypedTable, MONTH } from "./lib";

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("\n✗ Refusing without --confirm. This deletes a month.\n");
    process.exit(1);
  }
  const db = admin();
  const email = arg("email");
  const { kitId } = await accountFor(db, email);

  const { data: month } = await db
    .from("content_months").select("id, status").eq("brand_kit_id", kitId).eq("month", MONTH).maybeSingle();
  if (!month) {
    console.log(JSON.stringify({ step: "abandon", email, month: MONTH, found: false }));
    return;
  }

  /*
   * ⚠ SEUL UN MOIS QUE PERSONNE N'A ENCORE REÇU S'ABANDONNE. Un mois livré,
   * approuvé ou publié a été LU : le supprimer effacerait ce qu'une
   * praticienne a déjà vu, et rendrait des sujets qui ont réellement servi.
   */
  if (month.status !== "proposed") {
    throw new Error(`le mois est « ${month.status} », pas « proposed » : il a été lu, on ne l'abandonne pas`);
  }

  const { data: items } = await db
    .from("content_items").select("id, topic_id").eq("month_id", month.id);
  const topicIds = (items ?? []).map((i) => i.topic_id).filter((t): t is string => Boolean(t));

  // Les posts d'abord : une ligne de `content_items` sans son mois n'existe pas.
  const { error: itemsError } = await db.from("content_items").delete().eq("month_id", month.id);
  if (itemsError) throw new Error(`content_items: ${itemsError.message}`);

  const { error: monthError } = await db.from("content_months").delete().eq("id", month.id);
  if (monthError) throw new Error(`content_months: ${monthError.message}`);

  // ⚠ Et les sujets reviennent. Sans cette ligne, l'abandon ne rend rien.
  let released = 0;
  if (topicIds.length > 0) {
    const { error } = await untypedTable<{ topic_id: string }>(db, "topic_assignments")
      .delete().eq("brand_kit_id", kitId).in("topic_id", topicIds);
    if (error) throw new Error(`topic_assignments: ${(error as { message: string }).message}`);
    released = topicIds.length;
  }

  console.log(JSON.stringify({
    step: "abandon", email, month: MONTH, monthId: month.id,
    postsDeleted: items?.length ?? 0, topicsReleased: released,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
