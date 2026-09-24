/*
 * ── LA BANQUE DE SUJETS, REMPLIE ────────────────────────────────────────
 *
 * ⚠ CE PILOTE N'EXISTAIT PAS. Le dépôt porte tout ce qu'il faut pour TIRER
 * dans la banque — `next_topic_for_kit`, `assign_topic_to_kit`, la fenêtre de
 * 90 jours, les onze validateurs de payload, les deux gardes déontologiques en
 * trigger — et rien du tout pour l'ALIMENTER. Aucune ligne de TypeScript ni de
 * SQL de ces deux dépôts n'écrit dans `content_topics` : un `grep` ne rend que
 * des lectures, des tests et une simulation. La banque est un stock, et le
 * stock n'avait pas de fournisseur.
 *
 * Ce fichier est ce fournisseur, et c'est la seule chose ici qui soit neuve.
 * Ce qui juge ce qu'il écrit ne l'est pas : les payloads passent
 * `content_topic_payload_valid`, le texte passe `content_topics_ethics_gate`
 * et `content_topics_banned_phrases_gate` en base, et `ethics_reviewed_at`
 * n'est posé qu'après un passage du garde déontologique du produit
 * (`lib/ethics/rules.ts`). Un sujet que la base refuse n'est pas réparé : il
 * est compté comme un échec, avec sa cause.
 *
 *   ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" \
 *     npx tsx scripts/local-render/10-topic-bank.ts --confirm
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  archetypeInstruction, MASS_COPY_MODEL_FALLBACK, batchCostUsd, syncCostUsd,
} from "../../lib/content/generate/copy-batch";

/*
 * ── ⚠ LA BANQUE RESTE SUR HAIKU, ET C'EST UNE DÉCISION DE BUDGET ────────
 *
 * La rédaction est passée sur Sonnet parce que c'est elle que la notation
 * mesure. La banque, elle, n'écrit pas de posts : elle écrit des GRAINES —
 * un titre, un hameçon, une intention — que la rédaction relit ensuite. Rien
 * n'a été mesuré sur ce point.
 *
 * ⚠ ET CE N'EST PAS « mesuré, aucun gain », C'EST « pas mesuré ». Le
 * dimensionnement pour un segment simultané demande 2 405 sujets à cinq
 * praticiennes ; les écrire deux fois, sur deux modèles, pour comparer leurs
 * notes, coûterait à soi seul plus que le plafond de la session qui pose la
 * question. La comparaison honnête se fait à banque égale, sur deux mois
 * générés depuis deux banques, et elle reste à faire.
 */
const BANK_MODEL = MASS_COPY_MODEL_FALLBACK;
import { budgetErrors } from "../../lib/compose/budget";
import { checkEthics } from "../../lib/ethics/rules";
import { bankPayloadFor } from "../../lib/content/practitioner";
import { bankTarget, WINDOW_ROUNDS } from "../../lib/content/bank";
import {
  admin, anthropicKeyOrDie, untypedTable, SESSION_CAP_USD, noteSpend, runSpendUsd,
} from "./lib";

/*
 * ── 26 PAR SEGMENT, DANS LES PROPORTIONS QUE LE MOIS VEUT ───────────────
 *
 * Le seuil de 26 vient de §10.8 du rapport d'implémentation. La RÉPARTITION,
 * elle, vient de la mesure du 2026-09-21 : à 350px — la largeur d'une vignette
 * dans un fil — une carte à une phrase se lit et un diagramme à quatre cases
 * ne se lit pas. Une banque remplie à neuf dixièmes de diagrammes ne peut
 * produire qu'un mois de diagrammes ; le mélange se décide donc ici, au
 * stock, et pas seulement au tirage.
 *
 * Un tiers de cartes à une phrase, un tiers de diagrammes simples, un tiers de
 * formes larges — vingt chacun, soit 60 par segment.
 *
 * ⚠ 45 ET PAS 26. Le 26 de §10.8 est le seuil à 3 mois POUR UNE PRATICIENNE ;
 * la même section donne 65 à 12 mois. Mesuré le 2026-09-21 avec deux comptes
 * de test dans le même État et la même modalité : le second n'a pu tirer que
 * 28 candidats sur 36, parce que l'anti-collision lui refusait tout ce que la
 * première avait pris. La contention entre consœurs est réelle, elle est ce
 * que la fenêtre de 90 jours existe pour produire, et elle se paie en stock.
 */
/**
 * De combien multiplier les cibles ci-dessous — `--scale 2` double la banque.
 *
 * ⚠ SANS ÇA, LA SIXIÈME PRATICIENNE D'UN SEGMENT N'A PAS DE MOIS. Les cibles
 * sont des NOMBRES DE SUJETS EXISTANTS, pas de sujets disponibles : une fois
 * atteintes, le script répond « the bank is already at target » et s'arrête,
 * même quand l'anti-collision a rendu tout le stock indisponible pour le
 * prochain kit. C'est exactement ce qui est arrivé au sixième compte de test —
 * 118 sujets en banque, 2 tirables.
 *
 * Ce n'est pas un artefact du bac à sable : cinq consœurs EMDR en Californie,
 * c'est le cas que la fenêtre de 90 jours existe pour produire, et il se paie
 * en stock. Le paramètre rend ce coût explicite au lieu de le laisser
 * apparaître comme une pénurie inexpliquée au tirage.
 */

/*
 * ── ⚠ LE STOCK SUIT LE RYTHME DU TIRAGE, ET LE TIRAGE EST SIMULTANÉ ─────
 *
 * Deux corrections empilées, et la seconde annule l'hypothèse de la première.
 *
 * 1. Les cibles ont d'abord été calquées sur le MÉLANGE D'UN MOIS PUBLIÉ.
 *    Mauvaise grandeur : ce qui vide la banque est le TIRAGE, qui prend 72
 *    candidats pour 30 posts et ne les prend pas dans les mêmes proportions.
 * 2. Elles ont ensuite été posées à la main, pour « dix mois consécutifs ».
 *    ⚠ LE PRODUIT NE FERA PAS DIX MOIS CONSÉCUTIFS : un `cron` mensuel génère
 *    UN SEGMENT ENTIER LE MÊME JOUR, et la fenêtre de 90 jours interdit à
 *    chaque praticienne ce que ses consœurs viennent de prendre — le même
 *    matin, pas trois mois plus tard.
 *
 * ⚠ ET LA TABLE ÉCRITE À LA MAIN AVAIT VIEILLI SANS LE DIRE. Elle datait de
 * `CANDIDATES = 54` et annonçait 9 `practitioner_card` par mois pour un
 * plafond de 2, et 5 `carousel` pour un format tiré deux fois par tour. Trois
 * chiffres faux sur onze, invisibles tant que personne ne refaisait le calcul.
 * Les cibles sont donc CALCULÉES sur la boucle de tirage (`lib/content/bank`),
 * et le calcul est testé.
 */

/** Combien de praticiennes le segment sert, toutes générées le même jour. */
const PRACTITIONERS = numberArg("--practitioners", 1);

/**
 * Combien d'essais il faut pour un mois livré.
 *
 * ⚠ QUATRE, MESURÉ — pas un, espéré. À contrôles gelés, deux mois livrés sur
 * dix essais (F28). Un mois refusé garde ses trente sujets quatre-vingt-dix
 * jours comme un mois livré : l'essai est l'unité qui vide la banque.
 */
const ATTEMPTS = numberArg("--attempts", 4);

/**
 * Combien de tours de génération restent bloqués en même temps.
 *
 * ⚠ TROIS POUR LE PRODUIT — la fenêtre dure 90 jours. Mais dix mois générés
 * dans la même journée, ce que fait la mesure, en bloquent DIX : la fenêtre ne
 * s'ouvre pas entre deux essais lancés à dix minutes d'intervalle.
 */
const ROUNDS = numberArg("--rounds", WINDOW_ROUNDS);

function numberArg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  const n = i === -1 ? fallback : Number(process.argv[i + 1]);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

const PER_SEGMENT: Array<[string, number]> = Object.entries(
  bankTarget({ practitioners: PRACTITIONERS, attempts: ATTEMPTS, rounds: ROUNDS })
).filter(([, target]) => target > 0);

const INTENTS = ["normalise", "educate", "correct_a_myth", "invite", "behind_the_practice"];

type Seg = { id: string; modality_id: string; persona_id: string; state_code: string | null };

/**
 * ⚠ LE PRÉFIXE NE PORTE NI SEGMENT NI NUMÉRO. Il ne dépend que de
 * l'archétype et des six règles, triées. Tout ce qui varie — la modalité, la
 * population, l'intention, l'angle — vient APRÈS, dans le message.
 */
function prefix(archetypeKey: string, rules: Array<{ id: string; short_label: string; description: string }>) {
  const ethics = [...rules]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => `- ${r.short_label}: ${r.description}`)
    .join("\n");

  const text = [
    `You are stocking a shared library of post ideas for licensed psychotherapists`,
    `in private practice in the United States. Each idea is later handed to ONE`,
    `practitioner and written up in her own voice, so write the IDEA, never her.`,
    ``,
    `ADVERTISING ETHICS (ACA / APA). A board reads what is published under a`,
    `licensee's name. A promise of outcome is the kind of sentence that costs a`,
    `licence rather than a client.`,
    ethics,
    ``,
    `NEVER: guarantee an outcome, diagnose, imply a cure, name or describe a`,
    `client (real, composite or anonymised), compare practitioners, promise`,
    `speed, or write in the first person about a specific practice.`,
    ``,
    `OUTPUT FORMAT. Reply with ONE JSON object and nothing else — no prose`,
    `before it, no code fence around it:`,
    `{"title": "...", "hook": "...", "payload": {...}, "caption_seed": "...", "rationale_template": "..."}`,
    ``,
    `- "title" names the idea for a practitioner browsing: at most 8 words.`,
    `- "hook" is the line that makes her stop: one sentence, at most 20 words.`,
    `- "payload" follows the archetype shape below, exactly.`,
    `- "caption_seed" is a publishable caption: 40 to 900 characters.`,
    `- "rationale_template" completes "Why this one:" in at most 20 words.`,
    ``,
    `⚠ WORD COUNTS ARE HARD LIMITS, AND THIS IS WHERE MOST ANSWERS DIE. A`,
    `database CHECK counts the words and refuses the whole idea; nothing is`,
    `repaired. In the first run of this prompt, 29 ideas out of 52 were thrown`,
    `away on this alone.`,
    ``,
    `A "label" is 1 to 3 words. A "gloss" is 1 to 6 words. Count articles,`,
    `prepositions and hyphenated halves as words. Write the shortest true`,
    `phrase, not a sentence.`,
    ``,
    `GOOD: {"label": "Sunday dread", "gloss": "starts before the alarm"}`,
    `      (label 2 words, gloss 4 words)`,
    `BAD:  {"label": "The Sunday evening dread", "gloss": "it starts long before`,
    `      the alarm goes off on Monday"}  (label 4, gloss 11 — both refused)`,
    ``,
    `Count every label and every gloss before you answer. If one is too long,`,
    `cut it rather than rephrase it.`,
    ``,
    /*
     * ── ⚠ UN SUJET N'EST PAS UN PAYLOAD ───────────────────────────────
     *
     * La banque écrit des SUJETS — un titre, une accroche, un angle. Le
     * payload vient plus tard, au mois. Pour dix archétypes les deux vont
     * ensemble et la forme aide le modèle à viser juste.
     *
     * `practitioner_card` fait exception depuis que ses lignes viennent du
     * brief : lui demander sa forme lève, et c'est voulu. Son sujet reste
     * légitime — « Where to start », « How I work » — donc on lui décrit la
     * carte en mots, sans schéma à remplir.
     */
    archetypeKey === "practitioner_card"
      ? [
          `Archetype "practitioner_card". Write ONLY the topic: a title and a`,
          `hook for a card that says, plainly, how she works.`,
          ``,
          `⚠ You do NOT write its content. The card's lines are filled from her`,
          `own brief at composition time — modality, city, availability — and`,
          `never by a model. Do not invent a practice name, an email, a phone`,
          `number, a website or a handle anywhere in your answer.`,
        ].join("\n")
      : archetypeInstruction(archetypeKey),
  ].join("\n");

  return [{ type: "text" as const, text, cache_control: { type: "ephemeral" as const } }];
}

function variable(seg: Seg, modalityLabel: string, personaLabel: string, personaDesc: string, intent: string, angle: number) {
  return [
    `MODALITY: ${modalityLabel}`,
    `WHO IT IS FOR: ${personaLabel} — ${personaDesc}`,
    seg.state_code ? `STATE: ${seg.state_code}` : `STATE: any`,
    `INTENT: ${intent}`,
    `ANGLE ${angle}: give an idea no other angle in this set would produce.`,
  ].join("\n");
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("\n✗ Refusing without --confirm. This spends money.\n");
    process.exit(1);
  }
  const key = anthropicKeyOrDie();
  const db = admin();
  const client = new Anthropic({ apiKey: key });

  const { data: segments } = await untypedTable<Seg>(db, "content_segments")
    .select("id, modality_id, persona_id, state_code");
  if (!segments?.length) throw new Error("No segments. Run 00-account.ts first.");
  const { data: modalities } = await db.from("modality_cards").select("id, label");
  const { data: personas } = await db.from("client_persona_cards").select("id, label, description");
  const { data: rules } = await db.from("ethics_rules").select("id, short_label, description");
  if (!rules?.length) throw new Error("No ethics rules in the catalogue.");

  /*
   * ⚠ ON COMPLÈTE, ON NE REFAIT PAS. Un sujet déjà en banque est payé ; une
   * seconde passe qui redemanderait les 52 paierait deux fois les 19 qui sont
   * passées. Ce qui manque est lu en base, par segment et par archétype.
   */
  /*
   * ── ⚠ CE QUI COMPTE EST CE QUI EST TIRABLE, PAS CE QUI EXISTE ─────────
   *
   * Cette requête lisait TOUS les sujets de la banque. Un sujet déjà assigné
   * en est pourtant sorti pour 90 jours : il existe, et il ne sert plus à
   * personne. Le script répondait donc « the bank is already at target » sur
   * une banque intégralement bloquée — c'est F13, et c'est ce qui a rendu un
   * mois de 10 posts puis un mois de 23.
   *
   * Le décompte ne retient que les sujets LIBRES.
   */
  const { data: held } = await untypedTable<{ segment_id: string; archetype_key: string; id: string }>(db, "content_topics")
    .select("id, segment_id, archetype_key");
  const { data: assigned } = await untypedTable<{ topic_id: string }>(db, "topic_assignments")
    .select("topic_id");
  const taken = new Set((assigned ?? []).map((r) => r.topic_id));

  const heldCount = new Map<string, number>();
  for (const row of held ?? []) {
    if (taken.has(row.id)) continue;
    const k = `${row.segment_id}|${row.archetype_key}`;
    heldCount.set(k, (heldCount.get(k) ?? 0) + 1);
  }

  type Job = { customId: string; seg: Seg; archetype: string; intent: string; modalityLabel: string; personaLabel: string; personaDesc: string };
  const jobs: Job[] = [];
  const requests: Anthropic.Messages.Batches.BatchCreateParams["requests"] = [];

  for (const seg of segments) {
    const modality = modalities?.find((m) => m.id === seg.modality_id);
    const persona = personas?.find((p) => p.id === seg.persona_id);
    let angle = 0;
    for (const [archetype, target] of PER_SEGMENT) {
      const already = heldCount.get(`${seg.id}|${archetype}`) ?? 0;
      const count = target;
      for (let i = already; i < count; i += 1) {
        const intent = INTENTS[angle % INTENTS.length];
        const customId = `${seg.persona_id}-${archetype}-${i}-${Date.now().toString(36)}`;
        jobs.push({
          customId, seg, archetype, intent,
          modalityLabel: modality?.label ?? seg.modality_id,
          personaLabel: persona?.label ?? seg.persona_id,
          personaDesc: persona?.description ?? "",
        });
        requests.push({
          custom_id: customId,
          params: {
            model: BANK_MODEL,
            max_tokens: 1200,
            system: prefix(archetype, rules),
            messages: [{
              role: "user" as const,
              content: variable(seg, modality?.label ?? seg.modality_id, persona?.label ?? seg.persona_id,
                                persona?.description ?? "", intent, angle + 1),
            }],
          },
        });
        angle += 1;
      }
    }
  }

  if (requests.length === 0) {
    console.log(JSON.stringify({ step: "topic-bank", asked: 0, note: "the bank is already at target" }, null, 2));
    return;
  }
  console.error(`▸ ${requests.length} ideas across ${segments.length} segments, ${PER_SEGMENT.length} archetypes`);
  console.error(`▸ model ${BANK_MODEL} · Batch API · prompt caching on the archetype prefix`);

  /*
   * ⚠ `--sync` EXISTE PARCE QUE LE LOT MET VINGT-CINQ MINUTES. Mesuré six
   * fois : la Batch API rend en 25 à 30 minutes, quelle que soit la taille du
   * lot — trois requêtes comme cinquante-deux. Pour un appoint de quelques
   * sujets, c'est une demi-heure d'attente pour six centièmes de dollar
   * d'économie. Le lot reste le bon outil pour remplir une banque vide.
   */
  /* ── Ce que le lot a rendu ─────────────────────────────────────────── */
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const failures: Array<{ id: string; because: string }> = [];

  /*
   * ── ⚠ LE GESTIONNAIRE D'ERREUR LEVAIT LUI-MÊME ────────────────────────
   *
   * `note` était déclaré APRÈS la boucle synchrone qui l'appelle, et il lit
   * `seenReasons` : une zone morte temporelle. Tant que rien n'échouait, rien
   * ne s'en apercevait ; au premier sujet refusé — le vingt-et-unième d'un
   * remplissage de 498 — le script est tombé sur « Cannot access
   * 'seenReasons' before initialization », et les 477 appels restants n'ont
   * pas eu lieu.
   *
   * ⚠ C'EST LE DÉFAUT QUE `note` EXISTE POUR RÉPARER, une couche plus bas.
   * Il a été écrit parce que des réponses jetées l'avaient été EN SILENCE
   * pendant seize minutes ; il a remplacé le silence par un plantage. Les deux
   * fois, on perdait la même chose : ce que le lot avait déjà payé.
   */
  /*
   * ⚠ UN ÉCHEC SE DIT À L'ÉCRAN, PAS AU BILAN. Les 36 cartes praticiennes
   * jetées le 2026-09-23 l'ont été en silence pendant seize minutes, parce
   * que `failures` n'était lu qu'après la dernière vidange — et le script a
   * été interrompu avant. Le premier échec de chaque MOTIF est donc imprimé
   * dès qu'il arrive ; les suivants restent comptés.
   */
  const seenReasons = new Set<string>();
  function note(id: string, because: string) {
    failures.push({ id, because });
    const kind = `${id.split("-").slice(1, -2).join("-")}|${because.split(":")[0]}`;
    if (!seenReasons.has(kind)) {
      seenReasons.add(kind);
      console.error(`  ⚠ premier échec « ${kind} » — ${because}`);
    }
  }

  let written = 0;
  let reviewed = 0;
  let retries = 0;
  let repaired = 0;
  const retryUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

  const sync = process.argv.includes("--sync");
  type Entry = { custom_id: string; result: { type: string; message?: Anthropic.Message } };
  const entries: Entry[] = [];
  let batchId = "sync";

  if (sync) {
    console.error(`▸ synchronous, ${requests.length} calls`);
    /*
     * ⚠ UN COMPTEUR, PARCE QU'UN REMPLISSAGE DE BANQUE DURE DIX MINUTES SANS
     * RIEN DIRE. Les appels sont sériels et le script n'écrivait qu'à la fin :
     * pendant un quart d'heure, « en cours » et « bloqué » se ressemblaient
     * exactement, et la seule façon de trancher était de compter les lignes en
     * base depuis un autre terminal.
     */
    const started = Date.now();
    /*
     * ── ⚠ ON ÉCRIT EN CHEMIN, PAS À LA FIN ────────────────────────────
     *
     * Cette boucle accumulait TOUT puis insérait après. Le 2026-09-23,
     * PostgreSQL est tombé au 280ᵉ appel sur 695 : le script est mort avant
     * l'insertion et **280 appels payés — environ 0,81 $ — ont été jetés**.
     * La banque n'a pas bougé d'un sujet.
     *
     * Le remède n'est pas de rendre la base plus fiable, c'est de ne plus
     * faire dépendre un travail déjà payé d'un écrit qui vient une demi-heure
     * plus tard. `flushEvery` vide le tampon régulièrement : une panne coûte
     * désormais au plus ce qui n'a pas encore été écrit.
     */
    const flushEvery = 25;
    for (const [i, request] of requests.entries()) {
      const message = await client.messages.create(
        request.params as Anthropic.Messages.MessageCreateParamsNonStreaming
      );
      entries.push({ custom_id: request.custom_id, result: { type: "succeeded", message } });
      if (entries.length >= flushEvery) {
        await persist(entries.splice(0, entries.length));
      }
      if ((i + 1) % 10 === 0 || i + 1 === requests.length) {
        const elapsed = Math.round((Date.now() - started) / 1000);
        const eta = Math.round((elapsed / (i + 1)) * (requests.length - i - 1));
        console.error(`  … ${i + 1}/${requests.length} · ${elapsed}s écoulées · ~${eta}s restantes`);
      }
    }
  } else {
    const batch = await client.messages.batches.create({ requests });
    batchId = batch.id;
    console.error(`▸ batch ${batch.id} submitted at ${batch.created_at}`);

    /* ── Suivi, jamais bloquant : on relit l'état, on ne l'attend pas ─── */
    let status = batch;
    while (status.processing_status !== "ended") {
      await new Promise((resolve) => setTimeout(resolve, 15000));
      status = await client.messages.batches.retrieve(batch.id);
      console.error(`  … ${status.processing_status} ${JSON.stringify(status.request_counts)}`);
    }
    for await (const entry of await client.messages.batches.results(batch.id)) {
      entries.push(entry as unknown as Entry);
    }
  }


  /**
   * Écrire ce qui est revenu. Appelée en chemin ET à la fin.
   *
   * ⚠ IDEMPOTENTE PAR CONSTRUCTION : chaque appel consomme le tampon qui
   * lui est passé et ne relit rien. Deux appels ne peuvent pas écrire deux
   * fois le même sujet, parce qu'un sujet n'est dans le tampon qu'une fois.
   */
  async function persist(batch: Entry[]) {
    for (const entry of batch) {
      const job = jobs.find((j) => j.customId === entry.custom_id);
      if (!job) continue;
      if (entry.result.type !== "succeeded" || !entry.result.message) {
        note(entry.custom_id, `batch:${entry.result.type}`);
        continue;
      }
      const message = entry.result.message;
      usage.input += message.usage.input_tokens;
      usage.output += message.usage.output_tokens;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;

      const raw = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      let parsed: { title?: string; hook?: string; payload?: unknown; caption_seed?: string; rationale_template?: string };
      try {
        parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
      } catch {
        note(entry.custom_id, "schema: not JSON");
        continue;
      }
      /*
       * ── ⚠ UNE CARTE PRATICIENNE N'A PAS DE PAYLOAD, ET C'EST MESURÉ ────
       *
       * Le 2026-09-23, un remplissage a écrit 224 sujets pour 260 appels. Les
       * 36 manquants étaient TOUS des `practitioner_card`, refusés ici sur
       * « a required field is missing », et personne ne l'a vu : les échecs
       * étaient comptés pour la fin, et la fin n'est jamais venue.
       *
       * La cause était une moitié de correction. On avait cessé de DEMANDER
       * au modèle le contenu d'une carte praticienne — ses lignes viennent du
       * brief à la composition — sans cesser de l'EXIGER de sa réponse. On
       * payait donc des lignes qu'on refusait ensuite d'écrire.
       *
       * Le sujet reste légitime : un titre et une accroche qui ne nomment
       * personne. Le corps est vide, et la banque le refuse s'il ne l'est pas
       * (`content_topic_bank_payload_valid`).
       */
      const bankBody = bankPayloadFor(job.archetype);
      if (bankBody) parsed.payload = bankBody;

      if (!parsed.title || !parsed.hook || !parsed.payload || !parsed.caption_seed || !parsed.rationale_template) {
        note(entry.custom_id, "schema: a required field is missing");
        continue;
      }

      /*
       * ── LE BUDGET DE MOTS, MESURÉ ICI PLUTÔT QUE DEVINÉ EN BASE ────────
       *
       * `content_topics_payload_check` dit « refusé » et rien d'autre : sur la
       * première passe, 29 idées sur 52 sont mortes là sans qu'on sache quel
       * champ débordait. `budgetErrors` est le miroir TypeScript du validateur
       * SQL ; il nomme le chemin, ce qui a été dit, et ce qui était permis.
       *
       * ⚠ ET UNE SEULE RELANCE, AVEC LE REPROCHE EXACT. C'est la politique que
       * `write-one.ts` applique déjà côté produit : une relance nourrie de
       * l'erreur, puis un échec marqué. Rien n'est réparé à la main — un
       * payload recoupé ici serait une carte que personne n'a écrite.
       */
      let over = budgetErrors(job.archetype, parsed.payload);
      if (over.length > 0) {
        const reproach = over.map((e) => `- ${e.path}: you wrote ${e.said} words, at most ${e.allowed} are allowed`).join("\n");
        const retry = await client.messages.create({
          model: BANK_MODEL,
          max_tokens: 1200,
          system: prefix(job.archetype, rules ?? []),
          messages: [
            { role: "user", content: variable(job.seg, job.modalityLabel, job.personaLabel, job.personaDesc, job.intent, 0) },
            { role: "assistant", content: raw },
            { role: "user", content: `The database refused this payload on its word budget:\n${reproach}\n\nSend the WHOLE JSON object again, with those fields shortened to fit. Change nothing else.` },
          ],
        });
        retries += 1;
        retryUsage.input += retry.usage.input_tokens;
        retryUsage.output += retry.usage.output_tokens;
        const retryRaw = retry.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        try {
          const reparsed = JSON.parse(retryRaw.trim().replace(/^```(?:json)?\n?|```$/g, ""));
          if (reparsed?.payload) {
            const stillOver = budgetErrors(job.archetype, reparsed.payload);
            if (stillOver.length === 0) {
              parsed = { ...parsed, ...reparsed };
              over = [];
              repaired += 1;
            } else {
              over = stillOver;
            }
          }
        } catch {
          /* la relance n'a pas rendu du JSON : l'échec reste l'échec */
        }
      }
      if (over.length > 0) {
        note(entry.custom_id, `word budget: ${over.map((e) => `${e.path} said ${e.said}, allowed ${e.allowed}`).join("; ")}`);
        continue;
      }

      /*
       * ⚠ LE GARDE DU PRODUIT, AVANT LA DATE DE RELECTURE. `ethics_reviewed_at`
       * est ce qui rend un sujet tirable ; le poser sans avoir rien lu serait un
       * tampon. Le texte passe donc `checkEthics`, et un sujet signalé entre en
       * banque SANS date — visible, non tirable, en attente d'un humain.
       */
      /* La relance a pu rendre un objet incomplet : on revérifie avant d'écrire. */
      const { title, hook, caption_seed: captionSeed, rationale_template: rationaleTemplate, payload } = parsed;
      if (!title || !hook || !captionSeed || !rationaleTemplate || !payload) {
        note(entry.custom_id, "schema: a required field is missing after the retry");
        continue;
      }

      const scanned = [title, hook, captionSeed, JSON.stringify(payload)].join("\n");
      const verdict = checkEthics(scanned);
      const clean = verdict.violations.length === 0;

      const { error } = await db.from("content_topics").insert({
        segment_id: job.seg.id,
        archetype_key: job.archetype,
        intent: job.intent,
        title,
        hook,
        payload: payload as never,
        caption_seed: captionSeed,
        rationale_template: rationaleTemplate,
        ethics_reviewed_at: clean ? new Date().toISOString() : null,
      });
      if (error) {
        note(entry.custom_id, `db: ${error.message.slice(0, 120)}`);
        continue;
      }
      written += 1;
      if (clean) reviewed += 1;
    }
  }


  // Ce qui reste dans le tampon après la dernière vidange.
  await persist(entries.splice(0, entries.length));

  const costUsd = (sync ? syncCostUsd(usage) : batchCostUsd([usage])) + syncCostUsd(retryUsage);
  /*
   * ⚠ LE PLAFOND EST LU ICI AUSSI. `capUsd` figurait au bas de ce rapport sans
   * que rien ne l'applique — le même défaut que dans `20-month.ts`, dans le
   * même paragraphe de sortie. Il arrête le run suivant, pas celui-ci : un
   * remplissage déclenché par le garde-fou d'un mois ne doit pas pouvoir
   * s'enchaîner sans que quelqu'un le décide.
   */
  noteSpend(costUsd, "remplissage de banque");

  console.log(JSON.stringify({
    step: "topic-bank",
    batch: batchId,
    asked: requests.length,
    written,
    drawable: reviewed,
    failures,
    usage,
    retries,
    repairedOnRetry: repaired,
    retryUsage,
    costUsd: Number(costUsd.toFixed(5)),
    capUsd: SESSION_CAP_USD,
    spentThisRunUsd: Number(runSpendUsd().toFixed(5)),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
