import {
  clampCardLine,
  copyCallFor,
  validateCopy,
  type BrandContext,
  type CopyResult,
  type TopicRequest,
} from "@/lib/content/generate/copy-batch";
import { openAiBody, openAiText, type CopyUsage } from "@/lib/content/generate/provider";
import {
  ProviderRejected,
  ProviderUnavailable,
  SpendCapReached,
  meteredCall,
  openAiRefusal,
  openAiTextModel,
  type OpenAiTransport,
  type SpendMeter,
} from "@/lib/content/generate/openai";
import { repairPayload } from "@/lib/content/generate/repair";
import { eyebrowFor } from "@/lib/content/bands";
import { PRACTITIONER_ARCHETYPE } from "@/lib/content/practitioner";
import type { DrawnTopic } from "@/lib/content/month/draw";
import type { WriteResult, WriterPort, WrittenPost } from "@/lib/content/month/orchestrate";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE RÉDACTEUR PRODUIT — `WriterPort` SUR OPENAI
 * ══════════════════════════════════════════════════════════════════════════
 *
 * L'orchestrateur attendait une implémentation de ce port depuis F50 ; c'est le
 * seul accès payant de tout l'enchaînement. Celle-ci est SYNCHRONE : un appel
 * `/v1/responses` par sujet, quelques-uns en parallèle.
 *
 * ── ⚠ POURQUOI PAS LE LOT ───────────────────────────────────────────────
 *
 * Le lot OpenAI coûte moitié prix, et sa seule fenêtre déclarée est de 24 h
 * (`OPENAI_BATCH`). Un mois qui attend un jour sa rédaction n'est pas le mois que
 * la praticienne a acheté pour le 1ᵉʳ ; et l'identifiant de lot n'atteint le
 * journal qu'au retour de `write()`, ce qui laisse vingt-quatre heures où le
 * travail payé n'existe nulle part chez nous. La remise est réelle et reste une
 * décision à prendre sur la mesure de ce mois-ci, pas avant.
 *
 * ── CE QU'IL FAIT POUR CHAQUE SUJET, DANS L'ORDRE ───────────────────────
 *
 *   1. la carte de praticienne n'est PAS rédigée : elle s'assemble depuis le
 *      brief, comme dans le harnais, et rien n'est payé pour elle ;
 *   2. un appel, en sortie stricte sur le schéma de SON archétype ;
 *   3. `validateCopy` — la même validation que le harnais, budget compris ;
 *   4. un dépassement de budget part à la réparation champ par champ, par le
 *      même compteur ;
 *   5. le post, ou le refus, entre au journal par le puits AVANT le suivant.
 *
 * ⚠ IL NE DÉCIDE PAS DE CE QUI EST PUBLIÉ. Il rend ce qui a passé `validateCopy` ;
 * le portillon, la sélection et les trente contrôles du mois sont à
 * l'orchestrateur. Un rédacteur qui filtrerait plus serait un second arbitre.
 */

export type OpenAiWriterConfig = {
  transport: OpenAiTransport;
  meter: SpendMeter;
  /** Le modèle retenu. Son tarif doit être lu : `openAiCostUsd` refuse sinon. */
  model: string;
  brand: BrandContext;
  /** Ce que son check-in a dit ce mois-ci, en une ligne. */
  checkin: string;
  /** Le catalogue des intentions, par identifiant — le surtitre en vient. */
  intentLabels: Map<string, string>;
  /** Les thèmes du mois, pour le surtitre quand l'intention ne le donne pas. */
  themes: string[];
  practiceName: string;
  /** Les lignes de la carte de praticienne, ou `null` quand le brief n'en a pas assez. */
  practitionerLines: string[] | null;
  /** Combien d'appels à la fois. ⚠ Le compteur réserve le pire coût de chacun. */
  concurrency?: number;
};

/** Ce que ce rédacteur a vu, sujet par sujet, pour le rapport. */
export type WriterLedger = {
  attempted: number;
  /** Le modèle a répondu (refus compris). ⚠ Le seul dénominateur juste. */
  answered: number;
  conformantFirstCall: number;
  repaired: number;
  refused: Array<{ topicId: string; reason: string }>;
  fromBrief: number;
  usage: CopyUsage;
  costUsd: number;
};

export function openAiWriter(config: OpenAiWriterConfig): WriterPort & { ledger: WriterLedger } {
  const ledger: WriterLedger = {
    attempted: 0,
    answered: 0,
    conformantFirstCall: 0,
    repaired: 0,
    refused: [],
    fromBrief: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    costUsd: 0,
  };
  const repairModel = openAiTextModel(config.transport, config.meter, config.model, "réparation");

  const add = (u: CopyUsage) => {
    ledger.usage.input += u.input;
    ledger.usage.output += u.output;
    ledger.usage.cacheRead += u.cacheRead;
    ledger.usage.cacheWrite += u.cacheWrite;
  };

  return {
    ledger,
    async write({ topics, sink }) {
      const posts: WrittenPost[] = [];
      let costUsd = 0;
      let stopped: WriteResult["stopped"] = undefined;
      let next = 0;
      let untried = 0;

      const eyebrowOf = (topic: DrawnTopic, cardLine: string, index: number) =>
        eyebrowFor(
          {
            angleLabel: config.intentLabels.get(topic.intent) ?? null,
            title: cardLine,
            theme: config.themes.length > 0 ? config.themes[index % config.themes.length] : null,
          },
          config.practiceName
        );

      async function one(topic: DrawnTopic, index: number): Promise<void> {
        /* ── 1. la carte de praticienne s'assemble, elle ne se rédige pas ── */
        if (topic.archetype_key === PRACTITIONER_ARCHETYPE) {
          if (!config.practitionerLines) {
            await sink.refused(topic.id, "practitioner_facts_missing", "refused");
            ledger.refused.push({ topicId: topic.id, reason: "practitioner_facts_missing" });
            return;
          }
          const cardLine = clampCardLine(topic.title);
          const post: WrittenPost = {
            topicId: topic.id,
            cardLine,
            payload: { lines: config.practitionerLines },
            caption: topic.hook ?? "",
            altText: config.practitionerLines.join(". "),
            rationale: "Assembled from the brief, not written.",
            eyebrow: eyebrowOf(topic, cardLine, index),
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            costUsd: 0,
          };
          ledger.fromBrief += 1;
          await sink.post(post);
          posts.push(post);
          return;
        }

        /* ── 2. un appel, en sortie stricte sur le schéma de l'archétype ── */
        const request: TopicRequest = {
          topicId: topic.id,
          archetypeKey: topic.archetype_key,
          title: topic.title,
          hook: topic.hook ?? "",
          intent: topic.intent,
          checkin: config.checkin,
        };
        const call = { ...copyCallFor(config.brand, request), model: config.model };
        ledger.attempted += 1;
        const { response, usage, costUsd: callUsd } = await meteredCall(
          config.transport,
          config.meter,
          config.model,
          openAiBody(call),
          `rédaction ${topic.id}`
        );
        ledger.answered += 1;
        add(usage);
        costUsd += callUsd;
        ledger.costUsd += callUsd;
        await sink.spent(callUsd);

        /* ── 3. la même validation que le harnais ───────────────────────── */
        const refusal = openAiRefusal(response);
        let verdict: CopyResult = refusal
          ? { topicId: topic.id, ok: false, reason: "model_refusal", family: "refused" }
          : { ...validateCopy(topic.archetype_key, openAiText(response)), topicId: topic.id };
        /*
         * ⚠ UNE RÉPONSE TRONQUÉE EST DITE COMME TELLE. `status: incomplete` veut
         * dire que le plafond de sortie a coupé le JSON : `validateCopy` dirait
         * `not_json`, ce qui est vrai et envoie chercher au mauvais endroit.
         */
        if (!verdict.ok && response.status === "incomplete") {
          verdict = { ...verdict, reason: `incomplete:${response.incomplete_details?.reason ?? "?"}` };
        }
        let postUsage = usage;
        let postCost = callUsd;

        /* ── 4. un dépassement de budget part à la réparation ───────────── */
        if (!verdict.ok && verdict.reason === "over_budget" && verdict.payload !== undefined) {
          const repair = await repairPayload(repairModel, topic.archetype_key, verdict.payload);
          add(repair.usage);
          costUsd += repair.costUsd;
          ledger.costUsd += repair.costUsd;
          postCost += repair.costUsd;
          postUsage = {
            input: usage.input + repair.usage.input,
            output: usage.output + repair.usage.output,
            cacheRead: usage.cacheRead + repair.usage.cacheRead,
            cacheWrite: usage.cacheWrite + repair.usage.cacheWrite,
          };
          if (repair.costUsd > 0) await sink.spent(repair.costUsd);
          if (repair.ok) {
            ledger.repaired += 1;
            verdict = { ...verdict, ok: true, payload: repair.payload, reason: undefined, budget: undefined };
          }
        } else if (verdict.ok) {
          ledger.conformantFirstCall += 1;
        }

        if (!verdict.ok) {
          const reason = verdict.reason ?? "refused";
          ledger.refused.push({ topicId: topic.id, reason });
          await sink.refused(topic.id, reason, verdict.family);
          return;
        }

        /* ── 5. le post entre au journal avant le suivant ───────────────── */
        const cardLine = verdict.cardLine ?? clampCardLine(topic.title);
        const post: WrittenPost = {
          topicId: topic.id,
          cardLine,
          payload: verdict.payload,
          caption: verdict.caption ?? "",
          altText: verdict.altText ?? "",
          rationale: verdict.rationale ?? "",
          eyebrow: eyebrowOf(topic, cardLine, index),
          usage: postUsage,
          costUsd: postCost,
        };
        await sink.post(post);
        posts.push(post);
      }

      /*
       * ⚠ UN ARRÊT ARRÊTE TOUT LE MONDE. Un plafond atteint ou un solde épuisé ne
       * se rétablissent pas au sujet suivant : les autres travailleurs cessent de
       * prendre des sujets, et ceux qui restent sont comptés comme JAMAIS tentés.
       */
      async function worker(): Promise<void> {
        while (!stopped) {
          const index = next;
          next += 1;
          if (index >= topics.length) return;
          try {
            await one(topics[index], index);
          } catch (error) {
            if (error instanceof SpendCapReached) {
              stopped = { reason: "spend_cap", detail: error.message, untried: 0 };
            } else if (error instanceof ProviderUnavailable && error.reason === "no_credit") {
              stopped = { reason: "no_credit", detail: error.message, untried: 0 };
            } else if (error instanceof ProviderUnavailable) {
              stopped = { reason: "unavailable", detail: error.message, untried: 0 };
            } else if (error instanceof ProviderRejected) {
              /*
               * ⚠ UN 400 EST NOTRE FAUTE, ET IL SE RÉPÈTERAIT SUR CHAQUE SUJET. Il
               * arrête la rédaction plutôt que de payer cinquante-sept fois le même
               * refus — un 400 n'est pas facturé, mais il ne dit rien du sujet.
               */
              stopped = { reason: "unavailable", detail: error.message, untried: 0 };
            } else {
              throw error;
            }
            untried += 1;
          }
        }
      }

      const workers = Math.max(1, Math.min(config.concurrency ?? 4, topics.length));
      await Promise.all(Array.from({ length: workers }, () => worker()));
      if (stopped) {
        const s = stopped as NonNullable<WriteResult["stopped"]>;
        stopped = { ...s, untried: untried + Math.max(0, topics.length - next) };
      }

      return { posts, batchId: null, costUsd, ...(stopped ? { stopped } : {}) };
    },
  };
}
