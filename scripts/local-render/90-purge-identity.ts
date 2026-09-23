/*
 * ── PURGER LES SUJETS ÉCRITS AVANT L'INTERDICTION D'IDENTITÉ ────────────
 *
 * ⚠ LA CORRECTION DU 2026-09-23 EMPÊCHE D'EN ÉCRIRE DE NOUVEAUX. Elle ne
 * touche pas à ceux qui sont DÉJÀ EN BANQUE : `practitioner_card` a passé des
 * semaines à demander au modèle « des faits sur sa façon de travailler », et
 * chaque sujet ainsi produit porte un `payload` d'exemple — potentiellement un
 * nom de cabinet, une adresse, un identifiant, tous inventés.
 *
 * Un sujet reste tirable 90 jours. Sans purge, la correction ne ferait donc
 * effet qu'au bout d'un trimestre, et un mois généré demain pourrait encore
 * publier « Rowan Mercier Therapy ».
 *
 * ⚠ ON SUPPRIME, ON NE RÉPARE PAS. Réécrire le payload d'un sujet demanderait
 * de décider à la place de la praticienne ce que sa carte doit dire. Un sujet
 * retiré est un sujet que la banque régénère ; c'est le moins cher des deux.
 */
import { admin, untypedTable } from "./lib";
import { checkInventedIdentity } from "../../lib/content/month-checks";

type Topic = { id: string; archetype_key: string; title: string; hook: string; payload: unknown };

const DRY = !process.argv.includes("--confirm");

async function main() {
  const db = admin();
  const { data: topics } = await untypedTable<Topic>(db, "content_topics")
    .select("id, archetype_key, title, hook, payload");

  const rows = (topics ?? []) as Topic[];
  const doomed: Array<{ id: string; archetype: string; why: string }> = [];

  for (const t of rows) {
    /*
     * ⚠ AUCUNE LISTE BLANCHE ICI, ET C'EST VOULU. Un sujet de banque n'est
     * rattaché à aucune praticienne : il sera tiré par n'importe quel kit du
     * segment. Tout nom de cabinet, toute coordonnée y est donc inventée par
     * construction, quel que soit le brief qui le tirera.
     */
    const findings = [
      ...checkInventedIdentity(t.payload, "", []),
      ...checkInventedIdentity({ title: t.title, hook: t.hook }, "", []),
    ];
    if (findings.length > 0) {
      doomed.push({ id: t.id, archetype: t.archetype_key, why: findings[0].detail.slice(0, 120) });
    }
  }

  console.log(
    JSON.stringify(
      {
        step: "purge-identity",
        scanned: rows.length,
        doomed: doomed.length,
        byArchetype: Object.fromEntries(
          [...new Set(doomed.map((d) => d.archetype))].map((a) => [
            a,
            doomed.filter((d) => d.archetype === a).length,
          ])
        ),
        samples: doomed.slice(0, 8),
        applied: !DRY,
      },
      null,
      2
    )
  );

  if (DRY || doomed.length === 0) return;

  // Les assignations d'abord : une clef étrangère les retient.
  const ids = doomed.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    await untypedTable(db, "topic_assignments").delete().in("topic_id", batch);
    await untypedTable(db, "content_topics").delete().in("id", batch);
  }
  console.error(`▸ ${ids.length} sujets retirés de la banque`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
