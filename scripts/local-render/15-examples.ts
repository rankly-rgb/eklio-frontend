/*
 * ── 15 · LES EXEMPLES, CHOISIS PARMI CE QUI A ÉTÉ PRODUIT ───────────────
 *
 * ⚠ LE MODÈLE N'A JAMAIS VU UN BON POST. Le préfixe lui donne des RÈGLES —
 * trente caractères, pas de promesse de résultat, quatre mots par libellé — et
 * une règle dit ce qu'il ne faut pas faire. Aucune ne montre ce qu'il faut
 * faire. La notation indépendante met l'écriture à 1,6 sur 5 depuis trois
 * planches, et les sept contrôles de F26 n'ont pas bougé ce chiffre : ils ont
 * supprimé les sept défauts qu'ils nomment, et rien d'autre. Un contrôle
 * refuse, il n'améliore pas.
 *
 * Ce script choisit, parmi les 701 posts déjà produits, ceux qu'on peut
 * montrer. Il n'en écrit aucun.
 *
 * ── CE QU'UN EXEMPLE DOIT PASSER ───────────────────────────────────────
 *
 * 1. les vingt-trois contrôles, entiers — un exemple qui ne passerait pas
 *    enseignerait le défaut que le contrôle refuse ;
 * 2. le juge de complétude, sur les lignes que le lexique ne tranche pas. Le
 *    premier tirage avait retenu « Your body knows what rest » et « When
 *    busyness feels like » : conformes aux vingt-trois, et arrêtées au milieu ;
 * 3. aucune des formules que F29 a nommées — « Body says no » sept fois en
 *    libellé, « X is not failure, it's information » trois fois ;
 * 4. pas deux exemples du même archétype qui partagent une chaîne, ni les deux
 *    mêmes premiers mots : quatre variations d'une idée enseignent une idée.
 *
 * ⚠ ET LA NORMALISATION TYPOGRAPHIQUE EST LA SEULE RETOUCHE AUTORISÉE. Les
 * apostrophes droites des planches anciennes datent d'AVANT `deepTypographic` ;
 * les corriger, c'est appliquer à un enregistrement ce que la chaîne applique
 * depuis. Tout le reste est ÉCARTÉ, jamais réparé — un exemple retouché
 * enseignerait une conformité que la production n'a pas produite.
 *
 * Usage :
 *   ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" npx tsx scripts/local-render/15-examples.ts
 */
import { writeFileSync } from "node:fs";
import { admin, untypedTable, anthropicKeyOrDie } from "./lib";
import { checkMonth, type PostUnderCheck } from "../../lib/content/month-checks";
import {
  deepTypographic, typographicQuotes, CARD_LINE_MAX, MODEL_WRITTEN_ARCHETYPES,
} from "../../lib/content/generate/copy-batch";
import { undecidedIn } from "../../lib/content/writing-checks";
import { judgeCompleteness } from "../../lib/content/generate/completeness-judge";
import Anthropic from "@anthropic-ai/sdk";

type Row = {
  archetype: string; month: string; topic: string; hook: string; intent: string;
  card_line: string; payload: unknown; caption: string; alt_text: string; rationale: string;
};
async function main() {
  const db = admin();
  const { data: items, error } = await untypedTable<{
    compose_archetype: string; month_id: string; title: string; payload: unknown;
    caption: string; alt_text: string; rationale: string; topic_id: string;
  }>(db, "content_items").select("compose_archetype, month_id, title, payload, caption, alt_text, rationale, topic_id");
  if (error) throw new Error(`content_items: ${JSON.stringify(error)}`);
  const { data: topics } = await untypedTable<{ id: string; title: string; hook: string; intent: string }>(
    db, "content_topics"
  ).select("id, title, hook, intent");
  const byId = new Map((topics ?? []).map((t) => [t.id, t]));

  /* ⚠ Les deux mois NOTÉS d'abord : eux seuls ont une note à opposer. */
  const GRADED: Record<string, string> = {
    "41779584-4476-46d2-93da-759b627776a8": "pia",
    "1a30006d-68b2-4ce6-a064-0cb4e681907e": "odile",
  };

  const rows: Row[] = (items ?? []).flatMap((i) => {
    const t = byId.get(i.topic_id);
    if (!t) return [];
    return [{
      archetype: i.compose_archetype, month: GRADED[i.month_id] ?? "autre",
      topic: t.title, hook: t.hook, intent: t.intent,
      card_line: i.title, payload: i.payload,
      caption: i.caption, alt_text: i.alt_text, rationale: i.rationale,
    }];
  });
  console.error(`▸ ${rows.length} posts en base, dont ${rows.filter((r) => r.month !== "autre").length} notés`);

  const FLAGGED = ["Looking stable. Burning", "Competence can trap", "EMDR for unwanted turning", "Your body learned before"];
  const FLAGGED_INSIDE = ["is not failure", "Body says no", "body says no"];
  const DIRECTION = { paper: "#FAF6EE", light: "#F4EEE3", secondary: "#C08A3E", primary: "#B4674A", dark: "#2B2A27" } as never;

  const normalised = (r: Row): Row => ({
    ...r,
    card_line: typographicQuotes(r.card_line),
    payload: deepTypographic(r.payload),
    caption: typographicQuotes(r.caption),
    alt_text: typographicQuotes(r.alt_text),
    rationale: typographicQuotes(r.rationale),
  });

  const conforms = (r: Row) => {
    const post: PostUnderCheck = { archetype: r.archetype, title: r.topic, cardLine: r.card_line, payload: r.payload };
    return checkMonth({ posts: [post], direction: DIRECTION, modalities: ["EMDR"] }).length === 0;
  };

  /**
   * Les chaînes d'un payload, pour interdire deux exemples qui se ressemblent.
   *
   * ⚠ `archetype_key` N'EST PAS DU TEXTE, et le prendre pour tel a coûté sept
   * carrousels sur huit : ils portent tous « single_statement » dans leur
   * premier volet, donc le premier retenu bloquait tous les suivants. Un
   * comparateur qui compare des noms de champ compare les mêmes choses partout.
   */
  const stringsOf = (v: unknown): string[] =>
    typeof v === "string" ? [v]
    : Array.isArray(v) ? v.flatMap(stringsOf)
    : v && typeof v === "object"
      ? Object.entries(v).flatMap(([k, x]) => (k === "archetype_key" ? [] : stringsOf(x)))
      : [];

  const RANK: Record<string, number> = { pia: 0, odile: 1, autre: 2 };

  const pool: Record<string, Row[]> = {};
  for (const raw of rows) {
    const r = normalised(raw);
    if (FLAGGED.some((f) => r.card_line.includes(f))) continue;
    if (FLAGGED_INSIDE.some((f) => JSON.stringify(r.payload).includes(f))) continue;
    if (r.card_line.length > CARD_LINE_MAX) continue;
    if (!conforms(r)) continue;
    (pool[r.archetype] ??= []).push(r);
  }

  /*
   * ── ⚠ UNE LIGNE QUI S'ARRÊTE AVANT SON SENS NE S'ENSEIGNE PAS ──────────
   *
   * Le premier tirage a retenu « Your body knows what rest » et « When busyness
   * feels like » : les deux passent les vingt-trois contrôles, et les deux
   * s'arrêtent au milieu. C'est exactement ce que F29 décrit — le lexique ne
   * tranche pas, et personne ne lui a demandé. Ici, on demande.
   */
  const client = new Anthropic({ apiKey: anthropicKeyOrDie() });
  const shortlist: Record<string, Row[]> = {};
  for (const [archetype, list] of Object.entries(pool)) {
    list.sort((a, b) => (RANK[a.month] - RANK[b.month]) || (b.card_line.length - a.card_line.length));
    shortlist[archetype] = list.slice(0, 14);
  }
  const lines = [...new Set(Object.values(shortlist).flat().map((r) => r.card_line))];
  const undecided = undecidedIn(lines.map((text) => ({ where: text, text, archetype: "" })));
  console.error(`▸ ${undecided.length} lignes indécises sur ${lines.length} candidates`);
  const verdicts: Record<string, boolean> = {};
  for (let i = 0; i < undecided.length; i += 40) {
    const { verdicts: v, usage } = await judgeCompleteness(client, undecided.slice(i, i + 40));
    Object.assign(verdicts, v);
    console.error(`  jugé ${Object.keys(v).length} · ${usage.input} in / ${usage.output} out`);
  }
  const refused = Object.entries(verdicts).filter(([, ok]) => ok === false).map(([l]) => l);
  console.error(`▸ ${refused.length} refusées : ${refused.join(" | ")}`);
  for (const [archetype, list] of Object.entries(shortlist)) {
    shortlist[archetype] = list.filter((r) => verdicts[r.card_line] !== false);
  }

  const chosen: Record<string, Row[]> = {};
  for (const [archetype, list] of Object.entries(shortlist)) {
    /*
     * ⚠ LES NOTÉS D'ABORD, puis la ligne qui remplit le mieux la bande : à
     * budget égal, une ligne de 28 caractères en dit plus qu'une de 12, et
     * c'est la longueur que le modèle sous-utilise.
     */
    const picked: Row[] = [];
    const seenIntent = new Set<string>();
    const seenString = new Set<string>();
    const seenOpening = new Set<string>();

    for (const pass of [0, 1]) {
      for (const r of list) {
        if (picked.length >= 4) break;
        /* Premier tour : une intention chacun. Second : on complète. */
        if (pass === 0 && seenIntent.has(r.intent)) continue;
        /*
         * ⚠ LE CARROUSEL EMPILE TROIS À SIX PAYLOADS : comparer TOUTES ses
         * chaînes fait qu'un seul exemple bloque tous les autres. On ne compare
         * que sa phrase d'ouverture, qui est ce qu'il a de propre.
         */
        const strings = (r.archetype === "carousel"
          ? stringsOf((r.payload as { cards?: unknown[] }).cards?.[0] ?? r.payload)
          : stringsOf(r.payload)).map((s) => s.toLowerCase());
        if (strings.some((s) => seenString.has(s))) continue;
        const opening = r.card_line.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
        if (seenOpening.has(opening)) continue;
        picked.push(r);
        seenIntent.add(r.intent);
        seenOpening.add(opening);
        for (const s of strings) seenString.add(s);
      }
    }
    chosen[archetype] = picked;
  }

  /*
   * ⚠ LA CARTE PRATICIENNE N'EST PAS ÉCRITE PAR LE MODÈLE. Son payload vient
   * du brief — modalité, ville, disponibilité — et lui montrer des exemples
   * d'un champ qu'il ne remplit pas lui apprendrait à le remplir.
   *
   * ⚠ ET LE CARROUSEL S'ARRÊTE À TROIS. Il empile trois à six payloads : un
   * quatrième exemple ajoute un bon millier de jetons au préfixe pour une
   * variation de plus, et le préfixe est ce qui est mis en cache à chaque
   * appel du mois.
   */
  for (const key of Object.keys(chosen)) {
    if (!MODEL_WRITTEN_ARCHETYPES.includes(key)) delete chosen[key];
  }
  chosen.carousel = (chosen.carousel ?? []).slice(0, 3);

  const out = Object.fromEntries(
    Object.entries(chosen).map(([k, list]) => [
      k,
      list.map((r) => ({
        topic: r.topic, intent: r.intent, cardLine: r.card_line, payload: r.payload,
      })),
    ])
  );
  writeFileSync(
    "lib/content/generate/fixtures/conforming-examples.json",
    JSON.stringify(out, null, 2) + "\n"
  );
  for (const [k, v] of Object.entries(out)) {
    console.log(`${k.padEnd(22)} ${v.length}`);
    for (const e of v) console.log(`   [${e.intent.padEnd(19)}] ${e.cardLine}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
