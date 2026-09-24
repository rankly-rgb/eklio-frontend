/*
 * ── ⚠ LA BANQUE PROMETTAIT DES RÉSULTATS, ET ELLE LE FAISAIT DEPUIS LE
 *      PREMIER REMPLISSAGE ──────────────────────────────────────────────
 *
 * Une notation indépendante a relevé, sur un mois livré À CONTRÔLES GELÉS,
 * sans un seul constat :
 *
 *   « Bilateral stimulation gives an overworked nervous system a way to
 *     power down. »
 *
 * ⚠ CE N'ÉTAIT PAS LE MOIS, C'ÉTAIT LA BANQUE. `checkClinicalClaim` a été
 * renforcé le jour même, et passé sur les 2 187 sujets en stock il en refuse
 * **deux cent trente-quatre** — un sur dix. Tous écrits avant que le motif
 * existe, tous tirables, et chacun produira un mois refusé ou, pire, un mois
 * livré si un jour le contrôle faiblit.
 *
 * ── ⚠ Y COMPRIS DANS LE CHAMP QUI N'EST PAS PUBLIÉ ─────────────────────
 *
 * Vingt-six sujets ne portent l'affirmation que dans `rationale_template`,
 * qui devient le « Pourquoi celui-ci » de l'écran de relecture et ne part
 * jamais au public. Ils sont supprimés QUAND MÊME : cette phrase est ce que
 * le modèle lit pour savoir ce qu'on attend de lui. Un sujet dont la
 * justification dit « positioning therapy as expansion » enseigne la promesse
 * même s'il ne l'imprime pas.
 *
 * C'est le même geste que `99-purge-borrowed.ts` et `90-purge-identity.ts` :
 * un contrôle nouveau ne corrige pas les données déjà écrites.
 *
 *   npx tsx scripts/local-render/99-purge-claims.ts --confirm
 *   npx tsx scripts/local-render/99-purge-claims.ts            # à blanc
 */
import { admin, untypedTable } from "./lib";
import { checkClinicalClaim } from "../../lib/content/writing-checks";
import { writtenLinesIn } from "../../lib/content/month-checks";

type Row = {
  id: string; title: string; hook: string; caption_seed: string;
  rationale_template: string; payload: unknown; archetype_key: string;
};

/**
 * ⚠ LES MODALITÉS NE VIENNENT PAS D'UN BRIEF ICI, ET C'EST LE SEUL ENDROIT OÙ
 * C'EST JUSTE. F16 exige qu'un contrôle tire sa référence du brief et non du
 * contenu — mais un sujet de banque n'appartient encore à personne : il sera
 * tiré par n'importe quelle praticienne du segment. On purge donc sur la
 * réunion des modalités que la banque sert, ce qui est plus strict qu'aucun
 * brief particulier, jamais moins.
 */
async function modalitiesServed(db: ReturnType<typeof admin>): Promise<string[]> {
  const { data } = await untypedTable<{ modality_id: string }>(db, "content_segments")
    .select("modality_id");
  const ids = [...new Set((data ?? []).map((r) => r.modality_id).filter(Boolean))];
  const { data: labels } = await untypedTable<{ id: string; label: string }>(db, "modalities")
    .select("id, label");
  const byId = new Map((labels ?? []).map((m) => [m.id, m.label]));
  return ids.flatMap((id) => [id, byId.get(id) ?? ""].filter(Boolean));
}

async function main() {
  const dry = !process.argv.includes("--confirm");
  const db = admin();
  const modalities = await modalitiesServed(db);

  const { data: topics } = await untypedTable<Row>(db, "content_topics")
    .select("id, title, hook, caption_seed, rationale_template, payload, archetype_key");

  const guilty: Array<{ id: string; field: string; why: string }> = [];
  for (const t of topics ?? []) {
    const flat = (["title", "hook", "caption_seed", "rationale_template"] as const)
      .map((f) => ({ where: f, text: (t[f] as string) ?? "" }))
      .filter((l) => l.text);
    /* ⚠ Le payload se lit champ par champ, pas en JSON aplati : une promesse
     * peut vivre dans une glose de trois mots, et `JSON.stringify` collerait
     * deux champs voisins en une phrase qui n'existe pas. */
    const deep = writtenLinesIn([
      { archetype: t.archetype_key, title: t.title ?? "", cardLine: "", payload: t.payload },
    ]);
    const found = checkClinicalClaim([...flat, ...deep], modalities);
    if (found.length > 0) {
      /*
       * ⚠ GROUPÉ PAR MOTIF, PAS PAR CHAMP. Un premier jet découpait le détail
       * sur « promet » pour en tirer le champ : les autres motifs du contrôle
       * ne contiennent pas ce mot, et le tableau récapitulatif s'est rempli de
       * phrases entières servant de clés. Le motif est la grandeur utile — il
       * dit quelle règle a parlé.
       */
      const reason = /promet un résultat/.test(found[0].detail) ? "promesse de résultat"
        : /diagnostic prédicat/.test(found[0].detail) ? "diagnostic en prédicat"
        : /promet de guérir/.test(found[0].detail) ? "promesse de guérison"
        : /effondrement/.test(found[0].detail) ? "effondrement annoncé"
        : "autre";
      guilty.push({ id: t.id, field: reason, why: found[0].detail.slice(0, 140) });
    }
  }

  /*
   * ⚠ ON SUPPRIME, ON NE RÉÉCRIT PAS. Nuancer la phrase à notre main
   * produirait un sujet que personne n'a écrit — c'est la règle du dépôt
   * depuis la première réparation refusée.
   */
  let removed = 0;
  if (!dry) {
    for (const g of guilty) {
      const { error } = await db.from("content_topics").delete().eq("id", g.id);
      if (!error) removed += 1;
    }
  }

  const byField: Record<string, number> = {};
  for (const g of guilty) byField[g.field] = (byField[g.field] ?? 0) + 1;

  console.log(JSON.stringify({
    step: "purge-claims",
    dryRun: dry,
    modalities,
    scanned: topics?.length ?? 0,
    found: guilty.length,
    byField,
    removed,
    examples: guilty.slice(0, 6).map((g) => g.why),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
