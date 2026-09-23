/*
 * ── LE MOIS, VISÉ À TRENTE VISUELS SUR TRENTE ───────────────────────────
 *
 * La version du matin rendait 16 posts sur 30, dont 11 arrivaient en visuel.
 * Ce qui a changé, dans l'ordre où ça agit :
 *
 *   1. LE PRÉFIXE DIT LES COMPTES ET MONTRE UN EXEMPLE conforme par
 *      archétype, et demande une ligne de carte d'au plus 30 caractères —
 *      mesuré : au-delà, le titre se pose sous 102px et tout libellé de
 *      diagramme tombe sous 11px dans une vignette de 350.
 *   2. UN CHAMP QUI DÉPASSE EST RÉÉCRIT SEUL (`repair.ts`), deux passes au
 *      plus. Les dépassements mesurés étaient tous de 1 à 3 mots.
 *   3. ON EN DEMANDE PLUS QUE TRENTE, et les sujets non retenus sont rendus
 *      à la banque.
 *   4. UNE CARTE QUI NE TIENT PAS SE REPLIE (`fallback.ts`) au lieu d'être
 *      jetée : moins de libellés, puis carrousel, puis une phrase.
 *   5. LE PREMIER MOIS D'UN COMPTE EST ÉCRIT EN SYNCHRONE. Le Batch met 25 à
 *      30 minutes ; une nouvelle abonnée ne les attend pas.
 *   6. CHAQUE APPEL PAYANT ENTRE AU LEDGER, abouti ou non.
 *
 *   ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" \
 *     npx tsx scripts/local-render/20-month.ts --confirm [--email <compte>]
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  cachedPrefix,
  variablePart,
  validateCopy,
  buildBatchRequests,
  collectCopy,
  batchCostUsd,
  clampCardLine,
  syncCostUsd,
  massCopyModel,
  type BrandContext,
  type TopicRequest,
} from "../../lib/content/generate/copy-batch";
import { repairPayload } from "../../lib/content/generate/repair";
import { chooseArchetype, scheduleDates } from "../../lib/content/generate/plan";
import { anthropicContentModel } from "../../lib/content/generate/model";
import { deriveThemes } from "../../lib/content/generate/themes";
import { composeWithFallback } from "../../lib/compose/fallback";
import { cardPalette } from "../../lib/compose/palette";
import { checkEthics } from "../../lib/ethics/rules";
import { checkinLeaks } from "../../lib/content/leakage";
import { capitaliseTitle, eyebrowFor } from "../../lib/content/bands";
import type { ContentCheckin, ContentRegister } from "../../lib/data/content";
import { redundantAgainst } from "../../lib/content/dedup";
import { checkMonth, type Finding } from "../../lib/content/month-checks";
import { practitionerLines, identityAllowList, type PractitionerFacts } from "../../lib/content/practitioner";
import { loadJournal, rememberBatch, rememberResult, clearJournal } from "./journal";
import type { DirectionPalette } from "../../lib/compose/palette";
import { admin, anthropicKeyOrDie, accountFor, untypedTable, MONTH, SESSION_CAP_USD } from "./lib";

const WANTED = 30;

const ZERO = (): { input: number; output: number; cacheRead: number; cacheWrite: number } =>
  ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
/*
 * ⚠ QUARANTE-QUATRE POUR TRENTE. Le quota est de trente crédits ; un essai
 * refusé rend le sien tout de suite, donc la sur-génération n'est bornée que
 * par la banque et par le plafond de dépense. Mesuré : il faut environ 1,2
 * essai par post écrit.
 */
/*
 * ⚠ ASSEZ POUR QUE LA RÉSERVE EXISTE VRAIMENT. À 44, le rendement réel
 * (~75 % des candidats donnent un post utilisable) laissait 33 utilisables
 * pour 30 voulus : le sélecteur trouvait un banc VIDE et ne pouvait échanger
 * aucun post refusé. Un mois refusé sans remplaçant n'est pas une correction,
 * c'est un abandon.
 */
const CANDIDATES = 54;

/*
 * ── LE MÉLANGE DU MOIS ──────────────────────────────────────────────────
 *
 * Un tiers de cartes à une phrase, un tiers de diagrammes simples, un tiers de
 * carrousels et de formes larges. Mesuré le 2026-09-21 : à 350px — la largeur
 * d'une vignette dans un fil — une phrase se lit et un diagramme à quatre
 * cases ne se lit pas. Un mois composé à neuf dixièmes de diagrammes est un
 * mois que personne ne lit sur un téléphone.
 *
 * ⚠ LES FAMILLES SONT DÉFINIES PAR LE NOMBRE DE LIBELLÉS QU'ELLES PORTENT,
 * pas par leur nom. C'est le nombre de libellés qui décide de la taille du
 * texte, et la taille du texte décide de la lisibilité.
 */
const FAMILIES: Record<string, string[]> = {
  statement: ["single_statement", "practitioner_card"],
  simple: ["surface_and_beneath", "comparison_pair", "numbered_strategies", "cycle", "concentric_control"],
  varied: ["carousel", "quadrant_model", "annotated_curve", "lettered_technique"],
};

type Topic = { id: string; archetype_key: string; intent: string; title: string; hook: string };
type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

type Candidate = {
  topic: Topic;
  family: string;
  reservationId: string | null;
  result: ReturnType<typeof validateCopy> | null;
  /**
   * Ce que CE candidat a coûté.
   *
   * ⚠ IL MANQUAIT, ET LE LIVRE MENTAIT EN GRAND. `validateCopy` ne rend pas
   * d'`usage` ; le règlement retombait donc sur le cumul du mois, et chacun
   * des vingt-neuf succès inscrivait au ledger la dépense de tout le mois.
   * Un livre qui multiplie par trente est pire qu'un livre vide : le premier
   * a l'air d'un chiffre.
   */
  usage: Usage;
};

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("\n✗ Refusing without --confirm. This spends money.\n");
    process.exit(1);
  }
  const started = Date.now();
  const key = anthropicKeyOrDie();
  const db = admin();
  const client = new Anthropic({ apiKey: key });
  const { userId, kitId } = await accountFor(db, arg("email"));

  const { data: already } = await db
    .from("content_months").select("id, status").eq("brand_kit_id", kitId).eq("month", MONTH).maybeSingle();
  if (already) {
    console.error(`\n✗ Kit ${kitId} already has a ${MONTH} month (${already.status}).\n`);
    process.exit(1);
  }

  /*
   * ⚠ LE PREMIER MOIS EST SYNCHRONE, ET C'EST UNE PROMESSE PRODUIT. Aucun
   * `content_months` pour ce kit veut dire qu'elle vient de s'abonner et
   * qu'elle regarde l'écran. La Batch API met 25 à 30 minutes, quelle que
   * soit la taille du lot — mesuré quatre fois. Les mois suivants, eux,
   * tombent dans la nuit et le lot est le bon outil.
   */
  const { count: priorMonths } = await db
    .from("content_months").select("id", { count: "exact", head: true }).eq("brand_kit_id", kitId);
  const firstMonth = (priorMonths ?? 0) === 0;
  const useBatch = process.argv.includes("--batch") || (!firstMonth && !process.argv.includes("--sync"));

  /* ── Ce à partir de quoi le mois est écrit ─────────────────────────── */
  const { data: kit } = await db
    .from("brand_kits").select("voice_guide, directions, selected_direction_id").eq("id", kitId).single();
  const { data: preferences } = await db
    .from("content_preferences").select("cadence_per_week, accepted_registers, off_limits")
    .eq("brand_kit_id", kitId).single();
  const { data: checkinRow } = await db
    .from("content_checkins").select("brand_kit_id, month, sessions_theme, taking_clients, happening")
    .eq("brand_kit_id", kitId).eq("month", MONTH).maybeSingle();
  const { data: rules } = await db.from("ethics_rules").select("*");
  const { data: brief } = await db
    .from("project_briefs").select("practice_name, positioning, usp_statement, city, state, modality_ids").limit(1).single();
  if (!preferences || !rules?.length || !brief) throw new Error("the account is not complete");

  const directions = (kit?.directions ?? []) as Array<{ id: string; palette: never }>;
  const direction = directions.find((d) => d.id === kit?.selected_direction_id) ?? directions[0];
  const practiceName = brief.practice_name ?? "the practice";
  /*
   * La ville et l'État viennent du brief, pas du bilan — mais ils fuitaient
   * sur les cartes de la même façon (« Oakland, California » en libellé de
   * diagramme), et c'est le même contrôle qui les arrête.
   */
  const briefLocation = [brief.city, brief.state].filter(Boolean).join(", ") || null;

  /*
   * ── ⚠ LA CARTE PRATICIENNE SE REMPLIT, ELLE NE S'ÉCRIT PAS ────────────
   *
   * Ses lignes viennent du brief que la praticienne a saisi. Si le brief n'en
   * porte pas assez, `practitionerLines` rend `null` et l'archétype n'est PAS
   * TIRÉ du tout — le mélange se rééquilibre sur les dix autres plutôt que de
   * livrer une carte à moitié vide, ou pire, une carte inventée.
   */
  const facts: PractitionerFacts = {
    practiceName: brief.practice_name ?? null,
    city: brief.city ?? null,
    state: brief.state ?? null,
    // ⚠ Le libellé tel qu'il est en base, sinon l'identifiant en capitales :
    // « emdr » devient « EMDR », qui est ce qu'une carte doit porter.
    modalities: ((brief.modality_ids ?? []) as string[]).map((id) => id.toUpperCase()),
    takingClients: (checkinRow?.taking_clients ?? null) as PractitionerFacts["takingClients"],
  };
  const practitionerPayload = (() => {
    const lines = practitionerLines(facts);
    return lines ? { lines } : null;
  })();
  const allowList = identityAllowList(facts);
  if (!practitionerPayload) {
    console.error("▸ practitioner_card écarté : le brief ne porte pas assez de faits");
  }

  const voice = (() => {
    const guide = kit?.voice_guide as { tone?: string; sounds_like?: string[] } | null;
    return [guide?.tone, ...(guide?.sounds_like ?? [])].filter(Boolean).join(" · ") || "plain, warm, unhurried";
  })();
  const brand: BrandContext = {
    practiceName, voice, offLimits: preferences.off_limits ?? "", ethicsRules: rules,
  };

  const checkin = (checkinRow ?? null) as ContentCheckin | null;
  const themes = await deriveThemes(anthropicContentModel(rules), {
    month: MONTH,
    checkin,
    briefContext: [brief.positioning, brief.usp_statement].filter(Boolean).join("\n"),
    offLimits: preferences.off_limits ?? null,
  });
  console.error(`▸ themes (${themes.source}): ${themes.themes.join(" · ")}`);
  console.error(`▸ ${firstMonth ? "FIRST month → synchronous" : "a later month"} · ${useBatch ? "Batch API" : "sync calls"}`);

  /* ── Les candidats, tirés par famille ──────────────────────────────── */
  const perFamily = Math.ceil(CANDIDATES / 3);
  const candidates: Candidate[] = [];
  const drawnIds: string[] = [];
  const shortfall: string[] = [];
  /*
   * ── ⚠ LE DOUBLON SE REFUSE AU TIRAGE, ET SON SUJET EST RELÂCHÉ ────────
   *
   * Le mois du 2026-09-21b portait six paires de titres de même sens — « Life
   * rewrote itself » et « When life rewrites itself », trois variantes de
   * « competence masks ». Chacun passait tous les contrôles, parce qu'aucun ne
   * regardait les AUTRES titres du mois.
   *
   * Refuser à l'écriture arriverait trop tard : le sujet est déjà marqué
   * assigné et sort de la banque pour 90 jours. Il est donc écarté ICI, et son
   * assignation part dans `released` avec les sujets sur-générés non utilisés
   * — la règle du cahier des charges, « les sujets non utilisés ne sont pas
   * marqués assignés », vaut aussi pour ceux-là.
   */
  const rejected: Array<{ title: string; because: string }> = [];
  const releasedEarly: string[] = [];

  const accept = (topic: Topic, family: string): boolean => {
    /*
     * ⚠ SUR LE TITRE COMPLET **ET** SUR CE QUI SERA IMPRIMÉ.
     *
     * Le dédoublonnage lisait `topic.title`, la forme longue en banque. Mais
     * la carte porte `clampCardLine(title)` — trente caractères — et deux
     * titres distincts en banque peuvent s'y réduire au MÊME texte. Le mois de
     * marlow.quint est sorti avec deux cartes titrées « When the body
     * disagrees », l'une en quadrant, l'autre en courbe : aucune des deux
     * règles lexicales n'avait de raison de les rapprocher, puisqu'en banque
     * elles ne se ressemblaient pas.
     *
     * La ligne de carte est donc comparée telle qu'elle sera lue.
     */
    const line = clampCardLine(topic.title).toLowerCase();
    if (candidates.some((c) => clampCardLine(c.topic.title).toLowerCase() === line)) {
      rejected.push({ title: topic.title, because: `même ligne de carte une fois coupée : « ${line} »` });
      releasedEarly.push(topic.id);
      return false;
    }

    const clash = redundantAgainst(topic.title, candidates.map((c) => c.topic.title));
    if (clash) {
      rejected.push({ title: topic.title, because: clash });
      releasedEarly.push(topic.id);
      return false;
    }
    candidates.push({ topic, family, reservationId: null, result: null, usage: ZERO() });
    drawnIds.push(topic.id);
    return true;
  };

  /*
   * ── ⚠ À TOUR DE RÔLE DANS LA FAMILLE, ET PAS « LE PREMIER JUSQU'À
   *      ÉPUISEMENT DU QUOTA » ──────────────────────────────────────────
   *
   * La boucle interne était `while (taken < perFamily)` autour d'UN archétype :
   * le premier de la famille absorbait le quota entier, et les autres
   * n'étaient atteints que s'il manquait de stock. Le mélange d'un mois
   * dépendait donc de la PÉNURIE — et quand la banque a été remplie, il s'est
   * effondré : le mois de perrin.vale est sorti avec 5 archétypes sur 11, sans
   * un seul cycle, numbered_strategies ni annotated_curve, alors que la banque
   * en portait 23, 23 et 30. Six icebergs identiques et onze phrases seules.
   *
   * C'est l'inverse exact de ce qu'un lecteur doit voir, et c'est pour ça que
   * le mois PRÉCÉDENT, à court de stock, était plus varié que celui-ci.
   *
   * Un tour de rôle prend un sujet de chaque archétype, puis recommence. Un
   * archétype épuisé sort de la ronde ; les autres continuent.
   */
  for (const [family, archetypes] of Object.entries(FAMILIES)) {
    let taken = 0;
    // ⚠ Un archétype dont le brief ne porte pas les faits n'entre pas dans la
    // ronde : il ne sert à rien de tirer un sujet qu'on ne pourra pas composer.
    const live = archetypes.filter((a) => a !== "practitioner_card" || practitionerPayload !== null);
    while (taken < perFamily && live.length > 0) {
      for (let k = 0; k < live.length && taken < perFamily; ) {
        const { data: topicId, error } = await (db.rpc as unknown as (
          n: string, a: Record<string, unknown>
        ) => Promise<{ data: string | null; error: { message: string } | null }>)(
          "assign_topic_to_kit", { p_brand_kit_id: kitId, p_month: MONTH, p_archetype: live[k] }
        );
        if (error) throw new Error(`assign_topic_to_kit: ${error.message}`);
        if (!topicId) {
          live.splice(k, 1);
          continue;
        }
        const { data: topic } = await db
          .from("content_topics").select("id, archetype_key, intent, title, hook").eq("id", topicId).single();
        if (!topic) {
          live.splice(k, 1);
          continue;
        }
        if (accept(topic as Topic, family)) taken += 1;
        k += 1;
      }
    }
    if (taken < perFamily) shortfall.push(`${family}: ${taken} of ${perFamily} (the bank had no more)`);
  }

  /*
   * ── ⚠ CE QUI MANQUE DANS UNE FAMILLE EST PRIS AILLEURS ────────────────
   *
   * Mesuré le 2026-09-21 : le second compte de test n'a pu tirer que 28
   * candidats sur 36, parce que l'anti-collision lui refuse tout ce que la
   * première praticienne a pris dans les 90 jours — même État, même modalité,
   * utilisatrice différente. C'est la fenêtre qui fait son travail, et c'est
   * exactement le scénario que §10.8 du rapport d'implémentation décrit.
   *
   * Un mélange visé n'est pas un mélange garanti : mieux vaut trente posts
   * dont le mélange penche que vingt-deux posts bien répartis. Le rapport
   * publie le mélange obtenu, jamais celui qui était visé.
   */
  while (candidates.length < CANDIDATES) {
    const { data: topicId, error } = await (db.rpc as unknown as (
      n: string, a: Record<string, unknown>
    ) => Promise<{ data: string | null; error: { message: string } | null }>)(
      "assign_topic_to_kit", { p_brand_kit_id: kitId, p_month: MONTH }
    );
    if (error) throw new Error(`assign_topic_to_kit: ${error.message}`);
    if (!topicId) break;
    const { data: topic } = await db
      .from("content_topics").select("id, archetype_key, intent, title, hook").eq("id", topicId).single();
    if (!topic) break;
    const family =
      Object.entries(FAMILIES).find(([, keys]) => keys.includes(topic.archetype_key))?.[0] ?? "varied";
    accept(topic as Topic, family);
  }

  /*
   * ── ⚠ EN ALTERNANCE, PAS PAR PAQUETS ──────────────────────────────────
   *
   * Les candidats sont tirés famille par famille, ce qui est commode pour le
   * tirage et catastrophique pour l'écriture : si la génération s'arrête tôt —
   * quota atteint, plafond de dépense, panne — les premiers écrits sont tous
   * de la même famille. Mesuré : un arrêt à 11 posts a rendu 11 cartes à une
   * phrase et zéro diagramme.
   *
   * Alterner met le mélange à l'abri de l'arrêt : les onze premiers posts
   * d'un mois interrompu ressemblent au mois entier.
   */
  const byFamily = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const list = byFamily.get(candidate.family) ?? [];
    list.push(candidate);
    byFamily.set(candidate.family, list);
  }
  const interleaved: Candidate[] = [];
  for (let round = 0; interleaved.length < candidates.length; round += 1) {
    for (const family of Object.keys(FAMILIES)) {
      const item = byFamily.get(family)?.[round];
      if (item) interleaved.push(item);
    }
    if (round > candidates.length) break;
  }
  candidates.length = 0;
  candidates.push(...interleaved);

  console.error(`▸ ${candidates.length} candidates drawn for ${WANTED} posts`);

  /* ── L'écriture ────────────────────────────────────────────────────── */
  const checkinLine = [checkin?.sessions_theme, checkin?.happening].filter(Boolean).join(" ");
  const asRequest = (c: Candidate): TopicRequest => ({
    topicId: c.topic.id, archetypeKey: c.topic.archetype_key,
    title: c.topic.title, hook: c.topic.hook, intent: c.topic.intent, checkin: checkinLine,
  });

  const funnel = {
    candidates: candidates.length,
    generated: 0,
    conformantFirstCall: 0,
    repaired: 0,
    refusedAfterRepair: 0,
    quotaRefusals: 0,
  };
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const repairUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const failures: Array<{ topic: string; kind: string; because: string }> = [];

  /** Réserve un crédit, ou dit pourquoi elle ne peut pas. */
  async function reserve(reason: string): Promise<string | null> {
    const { data } = await db.rpc("reserve_credit", {
      p_user: userId, p_kind: "post_generation", p_reason: reason,
      p_provider: "anthropic", p_model: massCopyModel(), p_month: MONTH,
    } as never);
    const row = data as unknown as { ok?: boolean; reservation_id?: string; reason?: string } | null;
    if (row?.ok !== true) { funnel.quotaRefusals += 1; return null; }
    return row.reservation_id ?? null;
  }

  /** Règle : succès (le crédit est consommé) ou release AVEC son coût. */
  async function settle(reservationId: string | null, costUsd: number, succeeded: boolean) {
    if (!reservationId) return;
    await db.rpc("settle_credit", {
      p_reservation_id: reservationId,
      p_actual_cost_usd: Number(costUsd.toFixed(6)),
      p_succeeded: succeeded,
    } as never);
  }

  /** Les candidats retenus, dans l'ordre où ils se sont avérés utilisables. */
/*
 * ⚠ ON EN GÉNÈRE PLUS QUE TRENTE, ET C'EST CE QUI REND LA CORRECTION
 * POSSIBLE. Les contrôles de mois peuvent refuser un post — titre en double,
 * archétype trop représenté, champ qui recopie le titre — et un pipeline sans
 * remplaçant n'a alors que deux réponses : livrer quand même, ou livrer
 * vingt-neuf posts. Six de rab coûtent un cinquième du mois et donnent au
 * sélecteur de quoi échanger.
 */
const SPARE_POOL = 6;

  const usable: Candidate[] = [];

  /*
   * ⚠ LE JOURNAL S'OUVRE AVANT LE PREMIER APPEL PAYANT. S'il porte déjà des
   * résultats, ils ont été payés lors d'un passage précédent : on les reprend
   * au lieu de les racheter.
   */
  let journal = loadJournal(MONTH, arg("email") ?? "default");
  const resumed = Object.keys(journal.entries).length;
  if (resumed > 0) console.error(`▸ journal : ${resumed} résultats déjà payés repris`);

  if (useBatch) {
    /*
     * ⚠ UN LOT DÉJÀ SOUMIS SE RATTACHE, IL NE SE RE-SOUMET PAS. Le lot est
     * facturé à la soumission : si un passage précédent l'a créé puis est
     * mort pendant les vingt-cinq minutes d'attente, re-soumettre paierait
     * une seconde fois le même travail. L'identifiant est dans le journal.
     */
    const requests = candidates.map(asRequest);
    let batch;
    if (journal.batchId) {
      console.error(`▸ reprise du lot ${journal.batchId}`);
      batch = await client.messages.batches.retrieve(journal.batchId);
    } else {
      batch = await client.messages.batches.create({ requests: buildBatchRequests(brand, requests) });
      // ⚠ ÉCRIT AVANT D'ATTENDRE. C'est la seule fenêtre où ça change quelque chose.
      journal = rememberBatch(journal, batch.id);
      console.error(`▸ batch ${batch.id} · ${requests.length} candidates`);
    }

    let status = batch;
    while (status.processing_status !== "ended") {
      await new Promise((r) => setTimeout(r, 15000));
      status = await client.messages.batches.retrieve(batch.id);
      console.error(`  … ${status.processing_status} ${JSON.stringify(status.request_counts)}`);
    }

    /*
     * ⚠ CHAQUE RÉSULTAT EST ÉCRIT DÈS QU'IL ARRIVE. Le flux rendait tout en
     * mémoire avant qu'une seule ligne ne soit persistée : une panne à la
     * dernière réponse jetait les trente précédentes, toutes payées.
     */
    const entries: Array<{ custom_id: string; result: { type: string; message?: Anthropic.Message } }> = [];
    const byCustom = new Map(requests.map((r, i) => [buildBatchRequests(brand, requests)[i].custom_id, candidates[i]]));
    for await (const entry of await client.messages.batches.results(batch.id)) {
      entries.push(entry as never);
      const candidate = byCustom.get((entry as { custom_id: string }).custom_id);
      const message = (entry as { result?: { message?: Anthropic.Message } }).result?.message;
      if (candidate && message) {
        journal = rememberResult(journal, candidate.topic.id, {
          result: null,
          usage: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
            cacheRead: message.usage.cache_read_input_tokens ?? 0,
            cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
          },
          settled: false,
        });
      }
    }
    const byTopic = new Map(candidates.map((c) => [c.topic.id, c.topic.archetype_key]));
    for (const result of collectCopy(entries, byTopic)) {
      const candidate = candidates.find((c) => c.topic.id === result.topicId);
      if (candidate) candidate.result = result;
    }
    funnel.generated = candidates.filter((c) => c.result).length;
    for (const candidate of candidates) {
      if (candidate.result?.usage) candidate.usage = candidate.result.usage;
      if (usable.length >= WANTED + SPARE_POOL) break;
      if (await settleCandidate(candidate)) {
        usable.push(candidate);
      } else {
        await settle(candidate.reservationId, batchCostUsd([candidate.usage]), false);
        candidate.reservationId = null;
      }
    }
    for (const u of candidates.map((c) => c.result?.usage).filter(Boolean)) {
      usage.input += u!.input; usage.output += u!.output;
      usage.cacheRead += u!.cacheRead; usage.cacheWrite += u!.cacheWrite;
    }
  } else {
    /*
     * ⚠ SÉQUENTIEL, ET C'EST CE QUI REND LE CACHE UTILE. Le préfixe d'un
     * archétype est identique d'un candidat au suivant ; les envoyer l'un
     * après l'autre laisse le cache se remplir puis servir. En parallèle, les
     * premiers partent tous avant que le premier soit revenu, et chacun paie
     * l'écriture du cache.
     */
    for (const candidate of candidates) {
      if (usable.length >= WANTED + SPARE_POOL) break;

      const reservationId = await reserve(`month ${MONTH}: ${candidate.topic.title.slice(0, 40)}`);
      /*
       * ⚠ UN REFUS DE QUOTA ARRÊTE LE MOIS, ET C'EST JUSTE. `credit_quotas`
       * accorde 30 `post_generation` par mois et par personne ; passer outre
       * serait écrire des posts qu'elle n'a pas achetés. Le rapport le compte
       * plutôt que de le taire.
       */
      if (!reservationId) break;
      candidate.reservationId = reservationId;

      /*
       * ── ⚠ LA CARTE PRATICIENNE NE PASSE PAS PAR LE MODÈLE ──────────────
       *
       * Ses lignes sont déjà assemblées depuis le brief. L'appeler ici ne
       * coûterait pas seulement un appel pour rien : c'est exactement
       * l'appel qui a fabriqué « Rowan Mercier Therapy ». On garde la
       * légende et le texte alternatif, qui eux sont du contenu — mais le
       * payload, jamais.
       */
      if (candidate.topic.archetype_key === "practitioner_card") {
        candidate.result = {
          topicId: candidate.topic.id, ok: true,
          payload: practitionerPayload,
          cardLine: clampCardLine(candidate.topic.title),
          caption: candidate.topic.hook ?? "",
          altText: (practitionerPayload?.lines ?? []).join(". "),
          rationale: "Assembled from the brief, not written.",
          usage: ZERO(),
        } as never;
        funnel.generated += 1;
        funnel.conformantFirstCall += 1;
        if (await settleCandidate(candidate)) usable.push(candidate);
        continue;
      }

      /*
       * ⚠ UN RÉSULTAT DÉJÀ PAYÉ NE SE RACHÈTE PAS. Le journal porte la sortie
       * du modèle et le fait qu'un crédit ait été soldé pour elle ; une
       * reprise saute l'appel ET le règlement, sinon le second passage
       * facturerait un crédit de plus pour le même post.
       */
      const already = journal.entries[candidate.topic.id];
      if (already?.result) {
        candidate.result = already.result as typeof candidate.result;
        candidate.usage = already.usage;
        funnel.generated += 1;
        if (already.settled) {
          usable.push(candidate);
        } else if (await settleCandidate(candidate)) {
          journal = rememberResult(journal, candidate.topic.id, { ...already, settled: true });
          usable.push(candidate);
        }
        continue;
      }

      const request = asRequest(candidate);
      const message = await client.messages.create({
        model: massCopyModel(),
        max_tokens: 2000,
        system: cachedPrefix(brand, candidate.topic.archetype_key),
        messages: [{ role: "user", content: variablePart(request) }],
      });
      funnel.generated += 1;
      usage.input += message.usage.input_tokens;
      usage.output += message.usage.output_tokens;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      candidate.result = { ...validateCopy(candidate.topic.archetype_key, text), topicId: candidate.topic.id };

      /*
       * ⚠ ÉCRIT ICI, PAS À LA FIN DE LA BOUCLE. L'appel est payé : à partir de
       * cet instant, une panne ne doit plus pouvoir effacer ce qu'il a rendu.
       */
      journal = rememberResult(journal, candidate.topic.id, {
        result: candidate.result,
        usage: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
          cacheRead: message.usage.cache_read_input_tokens ?? 0,
          cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
        },
        settled: false,
      });

      /*
       * ⚠ LE VERDICT TOMBE ICI, ET LE CRÉDIT AVEC. Un candidat refusé rend sa
       * réservation tout de suite — avec son coût — et la place se libère
       * pour l'essai suivant. C'est ce qui rend la sur-génération possible
       * sous un quota de trente.
       */
      candidate.usage = {
        input: message.usage.input_tokens, output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens ?? 0,
        cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
      };
      const cost = syncCostUsd(candidate.usage);
      if (await settleCandidate(candidate)) {
        // Le crédit est réglé : le journal le dit, pour qu'une reprise ne le règle pas deux fois.
        const entry = journal.entries[candidate.topic.id];
        if (entry) journal = rememberResult(journal, candidate.topic.id, { ...entry, settled: true });
        usable.push(candidate);
      } else {
        await settle(candidate.reservationId, cost, false);
        candidate.reservationId = null;
      }
    }
  }

  /* ── La réparation, champ par champ ────────────────────────────────── */

  /**
   * Rend `true` quand le candidat est utilisable après réparation.
   *
   * ⚠ APPELÉE DANS LA BOUCLE, PAS APRÈS. Tant que la réparation tournait en
   * seconde passe, la réservation d'un candidat raté restait ouverte jusqu'à
   * la fin ; trente essais suffisaient à remplir un quota de trente, échecs
   * compris, et le trente-et-unième était refusé. Mesuré : 26 posts écrits,
   * 4 crédits immobilisés par des essais qui avaient déjà échoué.
   */
  async function settleCandidate(candidate: Candidate): Promise<boolean> {
    const result = candidate.result;
    if (!result) return false;
    if (result.ok) { funnel.conformantFirstCall += 1; return true; }

    if (result.reason !== "over_budget" || !result.budget?.length || result.payload === undefined) {
      failures.push({
        topic: candidate.topic.title, kind: result.reason === "over_budget" ? "word budget" : "schema",
        because: result.reason ?? "unknown",
      });
      return false;
    }

    const repair = await repairPayload(
      (params) => client.messages.create(params),
      candidate.topic.archetype_key,
      result.payload
    );
    repairUsage.input += repair.usage.input; repairUsage.output += repair.usage.output;
    repairUsage.cacheRead += repair.usage.cacheRead; repairUsage.cacheWrite += repair.usage.cacheWrite;

    if (repair.ok) {
      funnel.repaired += 1;
      candidate.result = { ...result, ok: true, payload: repair.payload, reason: undefined, budget: undefined };
      return true;
    }
    funnel.refusedAfterRepair += 1;
    failures.push({
      topic: candidate.topic.title, kind: "word budget",
      because: repair.remaining.map((b) => `${b.path} said ${b.said}, allowed ${b.allowed}`).join("; "),
    });
    return false;
  }

  
/*
 * ── LA CORRECTION : ÉCHANGER, PAS RELÂCHER ──────────────────────────────
 *
 * Quand un contrôle refuse un post — titre en double, champ qui recopie le
 * titre, ligne suspendue, archétype trop représenté — la réponse n'est jamais
 * d'abaisser le seuil. C'est de prendre un REMPLAÇANT dans la réserve
 * sur-générée, et de reposer la question.
 *
 * ⚠ LA BOUCLE EST BORNÉE PAR LA RÉSERVE, PAS PAR UN COMPTEUR ARBITRAIRE.
 * Chaque tour retire exactement un post et en essaie un autre ; s'il n'y a
 * plus de remplaçant, la boucle s'arrête et le mois est refusé. Un « au bout
 * de N essais, on livre quand même » remettrait sur la table ce que ces
 * contrôles existent pour empêcher.
 */
type Deliverable<T> = { chosen: T[]; remaining: Finding[]; dropped: Array<{ title: string; why: string }> };

function selectDeliverable<
  T extends { cardLine: string; composeArchetype: string; payload: unknown; svg: string | null;
              candidate: { topic: { title: string } } }
>(prepared: T[], direction: DirectionPalette, wanted: number, practiceName: string, allowList: string[]): Deliverable<T> {
  const asPost = (p: T) => ({
    archetype: p.composeArchetype,
    title: p.candidate.topic.title,
    cardLine: p.cardLine,
    payload: p.payload,
    svg: p.svg ?? undefined,
  });

  let chosen = prepared.slice(0, wanted);
  const bench = prepared.slice(wanted);
  const dropped: Array<{ title: string; why: string }> = [];

  for (;;) {
    const findings = checkMonth({ posts: chosen.map(asPost), direction, practiceName, identityAllowList: allowList });
    if (findings.length === 0) return { chosen, remaining: [], dropped };
    if (bench.length === 0) return { chosen, remaining: findings, dropped };

    /*
     * Quel post retirer : celui que le constat désigne. Un constat de mélange
     * ne nomme pas un post mais un ARCHÉTYPE — on retire alors l'un des siens,
     * le dernier, pour que l'échange change vraiment les proportions.
     */
    const finding = findings[0];
    let victim = -1;
    if (finding.check.startsWith("mix.")) {
      const counts = new Map<string, number>();
      for (const p of chosen) counts.set(p.composeArchetype, (counts.get(p.composeArchetype) ?? 0) + 1);
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      victim = chosen.map((p) => p.composeArchetype).lastIndexOf(dominant ?? "");
    } else {
      victim = chosen.findIndex((p) => finding.detail.includes(p.cardLine));
      if (victim === -1) victim = chosen.length - 1;
    }
    if (victim === -1) return { chosen, remaining: findings, dropped };

    dropped.push({ title: chosen[victim].cardLine, why: `${finding.check} — ${finding.detail}` });
    const replacement = bench.shift()!;
    chosen = [...chosen.slice(0, victim), ...chosen.slice(victim + 1), replacement];
  }
}

/* ── Le mois, puis les posts ───────────────────────────────────────── */
  const prepared = usable;

  const { data: monthRow, error: monthError } = await db
    .from("content_months").insert({
      brand_kit_id: kitId, month: MONTH, themes: themes.themes, status: "proposed",
      theme_source: themes.source, theme_source_text: themes.sourceText,
    }).select("id").single();
  if (monthError || !monthRow) throw new Error(`could not write the month: ${monthError?.message}`);

  const registers = preferences.accepted_registers as ContentRegister[];
  const dates = scheduleDates(MONTH.slice(0, 7), [1, 2, 3, 4, 5, 6, 7], WANTED);
  const fallbacks: Array<{ topic: string; from: string; to: string; steps: string }> = [];
  const ethicsFlags: Array<{ topic: string; rule: string; excerpt: string }> = [];
  const checkinLeakFlags: Array<{ topic: string; quoted: string[] }> = [];
  let written = 0;
  let previousArchetype: Parameters<typeof chooseArchetype>[1] = null;

  /*
   * ── ON PRÉPARE TOUT, ON CONTRÔLE, PUIS ON ÉCRIT ──────────────────────
   *
   * ⚠ L'ORDRE COMPTE. Écrire au fil de la boucle rendait les contrôles de mois
   * inapplicables : quand le trentième post révèle que l'archétype dominant
   * dépasse 30 %, les vingt-neuf premiers sont déjà en base. Rien n'est inséré
   * avant que `checkMonth` se taise.
   */
  type Prepared = {
    candidate: Candidate;
    cardLine: string;
    composeArchetype: string;
    payload: unknown;
    svg: string | null;
    register: ContentRegister;
    layout: Parameters<typeof chooseArchetype>[1];
    theme: string;
  };
  const readyPosts: Prepared[] = [];

  for (const [index, candidate] of prepared.entries()) {
    const result = candidate.result!;
    const register = registers[index % registers.length];
    const layout = chooseArchetype(register, previousArchetype);
    previousArchetype = layout;

    // ⚠ La majuscule est posée ici comme elle l'est sur l'écran de relecture :
    // par `capitaliseTitle`, qui ne touche pas à un mot portant déjà une
    // capitale. Les titres du mois précédent sortaient tout en minuscules.
    // ⚠ `clampCardLine`, PAS UN `slice(0, 34)`. Une seconde borne, à un autre
    // nombre, dans un autre fichier : celle-ci coupait en plein mot ce que
    // l'autre avait déjà coupé proprement.
    const cardLine = capitaliseTitle(clampCardLine(result.cardLine ?? candidate.topic.title));
    const scanned = [result.caption, result.altText, JSON.stringify(result.payload)].join("\n");
    for (const violation of checkEthics(scanned).violations) {
      ethicsFlags.push({ topic: candidate.topic.title, rule: violation.ruleId, excerpt: violation.excerpt.slice(0, 80) });
    }

    /*
     * ⚠ CE QUE LE BILAN A DIT NE SE RECOPIE PAS SUR LA CARTE. « Oakland,
     * California » et « Evening slots opening October » sont sortis comme
     * libellés de diagramme le mois dernier : le bilan oriente le CHOIX des
     * sujets, il n'est pas du contenu de carte. Seule `practitioner_card` a le
     * droit de le citer, et `checkinLeaks` la nomme.
     */
    const leaks = checkinLeaks(candidate.topic.archetype_key, JSON.stringify(result.payload), {
      sessionsTheme: checkin?.sessions_theme,
      happening: checkin?.happening,
      location: briefLocation,
    });
    if (leaks.length > 0) {
      checkinLeakFlags.push({ topic: candidate.topic.title, quoted: leaks });
    }

    /*
     * ⚠ ON COMPOSE AVANT D'ÉCRIRE, et on enregistre la forme qui a vraiment
     * tenu. Écrire l'archétype demandé sur un post que le moteur a replié
     * donnerait une carte que l'écran de relecture ne saurait pas redessiner.
     */
    let composeArchetype = candidate.topic.archetype_key;
    let payload = result.payload;
    let composedSvg: string | null = null;
    try {
      const composed = composeWithFallback({
        archetype: candidate.topic.archetype_key,
        payload: result.payload,
        palette: cardPalette(`${monthRow.id}-${index}`, direction.palette, false),
        /*
         * ⚠ LE THÈME EN CAPITALES N'EST PAS UN SURTITRE, ET C'ÉTAIT ÇA LA
         * LIGNE. Un thème dérivé est une PHRASE : les dix cartes d'un même
         * thème portaient les mêmes quatorze mots dans la bande mono. C'est
         * maintenant la règle partagée avec l'écran de relecture — une
         * étiquette d'un à quatre mots, tirée d'abord de ce qui est propre à
         * cette carte.
         */
        eyebrow: eyebrowFor(
          { angleLabel: candidate.topic.intent, title: cardLine, theme: themes.themes[index % themes.themes.length] },
          practiceName
        ),
        headline: cardLine,
        footer: practiceName,
      }, cardLine);
      composeArchetype = composed.archetype;
      payload = composed.payload;
      composedSvg = composed.kind === "carousel" ? composed.slides[0].svg : composed.result.svg;
      if (composed.steps.length > 0) {
        fallbacks.push({
          topic: candidate.topic.title, from: candidate.topic.archetype_key,
          to: composed.kind === "carousel" ? `carousel×${composed.slides.length}` : composed.archetype,
          steps: composed.steps.join("; "),
        });
      }
    } catch (error) {
      failures.push({
        topic: candidate.topic.title, kind: "engine",
        because: error instanceof Error ? error.message.slice(0, 140) : String(error),
      });
      await settle(candidate.reservationId, 0, false);
      continue;
    }

    readyPosts.push({
      candidate, cardLine, composeArchetype, payload, svg: composedSvg,
      register, layout, theme: themes.themes[index % themes.themes.length],
    });
  }

  /* ── Les contrôles de mois, et la correction ───────────────────────── */
  const selection = selectDeliverable(
    readyPosts, direction.palette as DirectionPalette, WANTED, practiceName, allowList
  );
  const succeeded = selection.chosen.map((p: Prepared) => p.candidate);

  for (const [index, post] of selection.chosen.entries()) {
    const { candidate } = post;
    const { error } = await db.from("content_items").insert({
      brand_kit_id: kitId, month_id: monthRow.id, topic_id: candidate.topic.id,
      theme: post.theme,
      register: post.register, archetype: post.layout ?? "statement", compose_archetype: post.composeArchetype,
      payload: post.payload as never, status: "proposed",
      title: post.cardLine, on_image_text: candidate.topic.hook,
      caption: candidate.result!.caption ?? "", alt_text: candidate.result!.altText ?? "",
      rationale: candidate.result!.rationale ?? "",
      scheduled_for: dates[index] ?? dates[dates.length - 1],
    });
    if (error) {
      failures.push({ topic: candidate.topic.title, kind: "database", because: error.message.slice(0, 160) });
      await settle(candidate.reservationId, 0, false);
      continue;
    }
    written += 1;
    await settle(candidate.reservationId, useBatch ? batchCostUsd([candidate.usage]) : syncCostUsd(candidate.usage), true);
  }

  /*
   * ⚠ LE JOURNAL S'EFFACE QUAND LE MOIS EST EN BASE, PAS AVANT. Tant que
   * `content_items` ne porte pas les trente posts, le travail payé n'existe
   * que là.
   */
  clearJournal(journal);

  // Les préparés non retenus n'ont rien publié : leur réservation se solde.
  for (const post of readyPosts) {
    if (!selection.chosen.includes(post)) await settle(post.candidate.reservationId, 0, false);
  }

  /*
   * ── ⚠ ON REND AVANT DE REFUSER, ET L'ORDRE EST LE DÉFAUT ──────────────
   *
   * Ce bloc était APRÈS le refus, donc après un `throw`. Un mois refusé
   * gardait alors pour quatre-vingt-dix jours les sujets sur-générés qu'il
   * n'avait pas publiés — environ vingt-quatre par essai — et leurs crédits
   * n'étaient jamais soldés.
   *
   * ⚠ CHAQUE ESSAI REFUSÉ RENDAIT DONC LE SUIVANT PLUS PAUVRE. C'est le
   * mécanisme de F13 vu de l'intérieur : la banque s'asséchait à mesure qu'on
   * réessayait, et le mois d'après sortait plus court — 23 posts, puis 16 —
   * sans que rien ne dise pourquoi. On cherchait le défaut dans le tirage ; il
   * était dans l'ordre de deux blocs.
   *
   * La restitution ne dépend pas du verdict : ce qui n'a pas été publié n'a
   * rien coûté à la praticienne, qu'on livre ou qu'on refuse.
   */
  /*
   * ── LES CANDIDATS NON RETENUS ─────────────────────────────────────────
   *
   * ⚠ LEUR SUJET RETOURNE À LA BANQUE. Un sujet tiré et non écrit n'a rien
   * coûté à personne et ne doit pas être perdu pour elle : la règle « jamais
   * deux fois » vaut sur ce qui a été PUBLIÉ, pas sur ce qui a été envisagé.
   *
   * ⚠ ET LEUR CRÉDIT REVIENT, AVEC LE COÛT ÉCRIT. Un appel refusé a dépensé
   * des jetons chez le fournisseur et ne doit rien à la praticienne.
   */
  const keptTopicIds = new Set(succeeded.map((c: Candidate) => c.topic.id));
  const discarded = candidates.filter((c) => !succeeded.includes(c));
  /*
   * ⚠ LES DOUBLONS ÉCARTÉS AU TIRAGE SONT RELÂCHÉS AVEC LE RESTE. Ils ne sont
   * jamais entrés dans `drawnIds` — `accept` les refuse avant — mais
   * `assign_topic_to_kit` les a bel et bien marqués assignés avant qu'on
   * lise leur titre. Sans cette ligne, chaque doublon refusé retirerait un
   * sujet de la banque pour 90 jours en échange de rien.
   */
  const released = [...releasedEarly, ...drawnIds.filter((id) => !keptTopicIds.has(id))];
  if (released.length > 0) {
    await untypedTable(db, "topic_assignments").delete().eq("brand_kit_id", kitId).in("topic_id", released);
  }
  for (const candidate of discarded) {
    await settle(candidate.reservationId, useBatch ? batchCostUsd([candidate.usage]) : syncCostUsd(candidate.usage), false);
  }

  /*
   * ⚠ UN MOIS QUI ÉCHOUE N'EST JAMAIS LIVRÉ. S'il reste un constat après la
   * correction, le mois reste en `proposed` et le script SORT EN ERREUR : la
   * preuve doit s'arrêter là plutôt que de produire une planche qu'on
   * commenterait comme si elle était bonne.
   */
  if (selection.remaining.length > 0) {
    console.log(JSON.stringify({
      step: "month", refused: true, monthId: monthRow.id,
      // ⚠ La taille du banc est dans le rapport : sans elle, « aucun post
      // échangé » et « aucun remplaçant disponible » se ressemblent, et on
      // cherche le défaut dans le sélecteur au lieu de la sur-génération.
      prepared: readyPosts.length, wanted: WANTED, bench: readyPosts.length - WANTED,
      findings: selection.remaining, dropped: selection.dropped,
    }, null, 2));
    throw new Error(
      `le mois ne passe pas ses contrôles : ${selection.remaining.map((f: Finding) => f.check).join(", ")}`
    );
  }

  const batchCost = useBatch ? batchCostUsd([usage]) : 0;
  const syncCost = useBatch ? 0 : syncCostUsd(usage);
  const costUsd = batchCost + syncCost + syncCostUsd(repairUsage);
  const elapsedSeconds = Math.round((Date.now() - started) / 1000);

  console.log(JSON.stringify({
    step: "month",
    mode: useBatch ? "batch" : "sync",
    firstMonth,
    monthId: monthRow.id,
    elapsedSeconds,
    funnel: {
      ...funnel,
      keptForWriting: succeeded.length,
      written,
      fallbacks: fallbacks.length,
      visualsOnThirty: written,
    },
    mix: Object.fromEntries(
      Object.keys(FAMILIES).map((f) => [f, succeeded.filter((c) => c.family === f).length])
    ),
    shortfall,
    fallbacks,
    failures,
    ethicsFlags,
    releasedTopics: released.length,
    rejectedAsRedundant: rejected,
    themes: { source: themes.source, themes: themes.themes },
    usage, repairUsage,
    costUsd: Number(costUsd.toFixed(5)),
    capUsd: SESSION_CAP_USD,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
