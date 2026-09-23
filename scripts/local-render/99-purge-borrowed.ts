/*
 * ── ⚠ LA BANQUE PORTE LE TITRE D'UN OUVRAGE ─────────────────────────────
 *
 * Mesuré sur huit essais gelés : `text.borrowed` a refusé la moitié des mois,
 * neuf fois, et toujours sur la même phrase — « body keeps score », le titre
 * de van der Kolk, dans la voix de la praticienne et sans une ligne de source.
 *
 * ⚠ ET ELLE VENAIT DE LA BANQUE, PAS DU MOIS. Quatre des neuf constats
 * portaient sur une LIGNE DE CARTE, c'est-à-dire sur le titre du sujet tiré :
 * ces sujets ont été écrits avant que le contrôle existe, et aucun mois ne
 * peut passer tant qu'ils sont tirables.
 *
 * C'est le même geste que `90-purge-identity.ts` : un contrôle nouveau ne
 * corrige pas les données déjà écrites, et les laisser en place ferait refuser
 * indéfiniment des mois pour une faute qu'on a déjà cessé de commettre.
 *
 *   npx tsx scripts/local-render/99-purge-borrowed.ts --confirm
 */
import { admin, untypedTable } from "./lib";
import { checkBorrowed } from "../../lib/content/writing-checks";

type Row = { id: string; title: string; hook: string; caption_seed: string; payload: unknown };

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("\n✗ Refusing without --confirm. This deletes bank topics.\n");
    process.exit(1);
  }
  const db = admin();

  const { data: topics } = await untypedTable<Row>(db, "content_topics")
    .select("id, title, hook, caption_seed, payload");

  const guilty: Array<{ id: string; why: string }> = [];
  for (const t of topics ?? []) {
    const lines = [
      { where: "title", text: t.title ?? "" },
      { where: "hook", text: t.hook ?? "" },
      { where: "caption_seed", text: t.caption_seed ?? "" },
      { where: "payload", text: JSON.stringify(t.payload ?? {}) },
    ];
    const found = checkBorrowed(lines);
    if (found.length > 0) guilty.push({ id: t.id, why: found[0].detail.slice(0, 120) });
  }

  /*
   * ⚠ ON SUPPRIME, ON NE RÉÉCRIT PAS. Recouper une phrase pour qu'elle passe
   * produirait un sujet que personne n'a écrit — c'est la règle du dépôt
   * depuis la première réparation refusée.
   */
  let removed = 0;
  for (const g of guilty) {
    const { error } = await db.from("content_topics").delete().eq("id", g.id);
    if (!error) removed += 1;
  }

  console.log(JSON.stringify({
    step: "purge-borrowed",
    scanned: topics?.length ?? 0,
    found: guilty.length,
    removed,
    examples: guilty.slice(0, 5).map((g) => g.why),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
