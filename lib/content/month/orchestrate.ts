import { preflight, type PreflightPort, type PreflightInput } from "@/lib/content/month/preflight";
import { drawMonth, type DrawPorts, type DrawnTopic } from "@/lib/content/month/draw";
import { composeCard, ComposeRefused } from "@/lib/content/month/compose-card";
import { assembleMonth, type AssemblePorts, type AssembleOutcome, type Assemblable } from "@/lib/content/month/assemble";
import {
  findResumableRun,
  markSettled,
  openRun,
  publishRun,
  isRefusedResult,
  rememberBatchId,
  rememberCost,
  rememberResult,
  rememberTopics,
  resumePlan,
  type JournalDb,
  type RunJournal,
} from "@/lib/content/month/journal-port";
import type { PostContext } from "@/lib/content/month-checks";
import { undecidedIn } from "@/lib/content/writing-checks";
import { writtenLinesIn } from "@/lib/content/month-checks";
import { judgeCompleteness } from "@/lib/content/generate/completeness-judge";
import { reviseMonth } from "@/lib/content/generate/revise";
import type { TextModel } from "@/lib/content/generate/provider";
import type { DirectionPalette } from "@/lib/compose/palette";
import type { RenderInput } from "@/lib/compose/types";
import { withinCeiling, type SpendCeiling } from "@/lib/content/month/spend-ceiling";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'ORCHESTRATEUR PRODUIT — L'APPELANT QUE LES HUIT MODULES ATTENDAIENT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ C'EST LE SEUL MODULE MANQUANT, ET F50 LE DISAIT DÉJÀ.
 *
 * Le recensement du 2026-09-26 a montré que huit modules portés — le préalable,
 * le port de crédit, la garde de banque, la sélection, l'assemblage, le tirage,
 * sa couture, la composition — sont justes, éprouvés, et qu'AUCUN point d'entrée
 * ne les atteint. Ils attendaient tous le même appelant. Le voici.
 *
 * ── ⚠ LA RÉDACTION EST UN PORT, ET C'EST CE QUI REND CE MODULE ÉPROUVABLE ─
 *
 * `WriterPort` est le SEUL accès payant de tout l'enchaînement. Tout le reste —
 * le préalable, le tirage, la composition, les trente contrôles, l'écriture, le
 * crédit — est du calcul ou du SQL. Une doublure de `WriterPort` permet donc
 * d'éprouver l'enchaînement ENTIER sans dépenser un centime, et c'est exactement
 * ce qu'il fallait le jour où le compte fournisseur est sous limite d'usage.
 *
 * ⚠ ET UNE DOUBLURE DANS UN TEST N'EST PAS UN STUB DANS LE PRODUIT. Ce module
 * n'embarque aucune implémentation de `WriterPort` : l'appelant la fournit. Tant
 * qu'aucune n'existe côté produit, la route reste en 501 — ce que deux serrures
 * indépendantes du recensement vérifient.
 *
 * ── LES SEPT MOMENTS, ET POURQUOI DANS CET ORDRE ────────────────────────
 *
 *   1. LE PRÉALABLE     mois existant → licence → État vérifié → quota → banque.
 *                       Le premier refus arrête, et rien n'a été dépensé.
 *   2. LA REPRISE       un lot déjà payé se rattache ; il ne se resoumet jamais.
 *   3. LE TIRAGE        la ronde par famille, puis le rattrapage.
 *   4. LA RÉDACTION     le seul port payant, et chaque réponse entre au journal
 *                       DÈS SON ARRIVÉE — la panne du 2026-09-23 a coûté 0,81 $
 *                       parce que 695 réponses attendaient en mémoire.
 *   5. LA COMPOSITION   une carte par post, et le pied porte la licence.
 *   6. L'ASSEMBLAGE     portillon, sélection, écriture, crédit.
 *   7. LA PUBLICATION   le journal se ferme, et ce que le mois a coûté reste
 *                       lisible.
 *
 * ⚠ LE CRÉDIT EST PRIS À L'ÉTAPE 6, PAS À L'ÉTAPE 4. La praticienne a acheté
 * trente posts publiés, pas soixante-douze tentatives de rédaction. Ce que le
 * fournisseur facture est un frais général ; ce que le quota décompte est un post
 * en base.
 */

/** Ce qu'un sujet devient une fois rédigé. La forme que le port doit rendre. */
export type WrittenPost = {
  topicId: string;
  /** La ligne imprimée sur la carte, trente caractères au plus. */
  cardLine: string;
  /** Le payload de l'archétype, tel que la validation l'a rendu. */
  payload: unknown;
  caption: string;
  altText: string;
  rationale?: string;
  /** Le surtitre de la bande mono. */
  eyebrow: string;
  /** Ce que cet appel a consommé, pour que le coût reste juste après reprise. */
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /**
   * Ce que ce post a coûté, réparation comprise, dit par le fournisseur qui a
   * répondu. Facultatif : un rejeu n'a rien payé.
   */
  costUsd?: number;
  /**
   * ⚠ LA PASSE DE RÉVISION L'A DÉJÀ LU. Posé après la révision et journalisé avec
   * le post, pour qu'une reprise qui n'a rien rédigé de neuf ne repaie pas une
   * relecture que le journal porte déjà.
   */
  revisionSeen?: boolean;
};

/**
 * Ce que le port de rédaction dit au journal PENDANT qu'il rédige.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  ⚠ L'EN-TÊTE DE CE FICHIER LE PROMETTAIT, ET LE CODE NE LE FAISAIT PAS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * « Chaque réponse entre au journal DÈS SON ARRIVÉE. » Mesuré le 2026-10-04 en
 * branchant le premier rédacteur réel : l'orchestrateur écrivait au journal
 * APRÈS que `write()` était revenu, c'est-à-dire après la dernière réponse. Une
 * panne au vingtième appel perdait les dix-neuf réponses payées — la panne du
 * 2026-09-23, à la même place.
 *
 * Le port reçoit donc ce puits et l'appelle à chaque réponse : un post rédigé,
 * un refus payé, une dépense. L'orchestrateur, lui, écrit en base.
 */
export type WriteSink = {
  post(post: WrittenPost): Promise<void>;
  refused(topicId: string, reason: string, family?: string): Promise<void>;
  /** Une dépense, en dollars, dès qu'elle est connue — refus compris. */
  spent(deltaUsd: number): Promise<void>;
};

export type WriteRequest = {
  topics: DrawnTopic[];
  /** Ce que le mois promet, pour que le port sache combien il écrit. */
  wanted: number;
  month: string;
  /** Le journal, au fil des réponses. Un port qui ne l'appelle pas reste juste, mais perd tout sur une panne. */
  sink: WriteSink;
};

export type WriteResult = {
  /** Les posts rédigés. Le port peut en rendre moins qu'il n'a reçu de sujets. */
  posts: WrittenPost[];
  /**
   * L'identifiant du lot chez le fournisseur, s'il y en a un.
   *
   * ⚠ IL EST ÉCRIT AU JOURNAL AVANT TOUTE ATTENTE. Un lot est facturé à la
   * SOUMISSION : entre l'envoi et la première réponse il passe vingt-cinq à
   * trente minutes pendant lesquelles l'argent est dépensé et le résultat
   * n'existe nulle part chez nous.
   */
  batchId: string | null;
  /** Ce que la rédaction a coûté en tout, en dollars. */
  costUsd: number;
  /**
   * Pourquoi le port s'est arrêté avant d'avoir tout tenté, s'il l'a fait.
   *
   * ⚠ UN ARRÊT N'EST PAS UN REFUS DE RÉDACTION. Un plafond atteint ou un solde
   * épuisé laissent des sujets JAMAIS tentés ; les compter comme refusés ferait
   * mesurer un taux de réussite sur des appels qui n'ont pas eu lieu.
   */
  stopped?: { reason: "spend_cap" | "no_credit" | "unavailable"; detail: string; untried: number };
};

export type WriterPort = {
  write(request: WriteRequest): Promise<WriteResult>;
};

export type OrchestratePorts = {
  preflight: PreflightPort;
  draw: DrawPorts;
  journal: JournalDb;
  writer: WriterPort;
  /**
   * ⚠ LE SECOND ACCÈS PAYANT : LA RELECTURE DU MOIS ET LE JUGE DE COMPLÉTUDE.
   *
   * Ils étaient les deux dernières exemptions du recensement (« il n'y a aucun
   * payload côté produit ») et une ENTRÉE figée — `completeness: {}` — que les
   * appelants passaient vide. Un juge qu'on n'appelle pas ne refuse rien : chaque
   * ligne coupée avant son sens passait le portillon. Ils sont appelés ici, sur
   * les posts de CE mois, par le même port de texte que le fournisseur retenu.
   */
  editor: TextModel;
  /*
   * ⚠ LA LIGNE DU MOIS, ET PERSONNE NE L'ÉCRIVAIT CÔTÉ PRODUIT.
   *
   * `content_months.status` porte quatre valeurs et `generating` n'avait qu'un
   * seul écrivain : `lib/content/generate/queue.ts`, appelé par le webhook Stripe
   * à l'achat. Le harnais, lui, insère la ligne À LA FIN, directement en
   * `proposed` — donc une exécution tuée ne laisse aucune ligne, et l'écran
   * « en cours » que `lib/content/month-screen.ts` sait afficher n'est jamais
   * atteint par une génération.
   *
   * L'orchestrateur ouvre donc la ligne en `generating` et la ferme en
   * `proposed` ou `failed`. Trois choses en découlent : la cliente voit où en est
   * son mois, une exécution tuée laisse une trace que la reprise retrouve, et
   * `generating` garde un écrivain quand F45 retirera l'ancien générateur.
   */
  openMonthRow(input: { brandKitId: string; month: string }): Promise<string>;
  closeMonthRow(monthId: string, status: "proposed" | "failed"): Promise<void>;
  /*
   * ⚠ L'ASSEMBLAGE DÉPEND DE LA LIGNE DU MOIS, ET LE TYPE LE DIT. `content_items`
   * porte `month_id NOT NULL` : écrire un post avant que le mois existe est
   * impossible en base, et une fabrique rend cette dépendance visible plutôt que
   * de la laisser se découvrir à l'exécution.
   */
  assembleFor(monthId: string): AssemblePorts;
  /** Rend les sujets tirés mais non retenus. Un sujet gardé pour rien bloque le segment. */
  releaseTopics(topicIds: string[]): Promise<void>;
};

export type OrchestrateInput = {
  brandKitId: string;
  projectId: string;
  userId: string;
  /** Le premier du mois, `YYYY-MM-DD`. */
  month: string;
  stateCode: string | null;
  wanted: number;
  /** Combien de candidats tirer — surgénération comprise. */
  candidates: number;
  perFamily: number;
  families: Record<string, string[]>;
  drawOrder: string[];
  practitionerCap: number;
  practitionerPayload: boolean;
  demand: PreflightInput["demand"];
  /*
   * ⚠ OBLIGATOIRE, ET SANS VALEUR PAR DÉFAUT (F58). Sans plafond, l'orchestrateur
   * fait rédiger autant de sujets que la banque en porte — 1 331 tirables le
   * 2026-09-26. Une valeur par défaut serait un plafond hérité que personne ne
   * relit ; le compilateur exige donc que chaque appelant dise le sien.
   */
  ceiling: SpendCeiling;
  /* ── ce que la composition et les contrôles demandent ────────────────── */
  direction: DirectionPalette;
  paletteFor(index: number): RenderInput["palette"];
  practiceName: string;
  /** La famille de mise en page du post, `content_items.archetype`. */
  layoutFor(index: number): string;
  dates: string[];
  context: PostContext;
  identityAllowList: string[];
  intentCatalogue: Array<{ id: string; label: string }>;
  modalities: string[];
};

export type OrchestrateOutcome =
  | {
      ok: false;
      /** `preflight` quand le refus vient de l'étage A, sinon l'étape nommée. */
      stage: "preflight" | "draw" | "ceiling" | "write" | "compose" | "assemble";
      /** Les constats de mois qui restaient, quand c'est eux qui refusent. */
      remaining?: Array<{ check: string; detail: string }>;
      /**
       * ⚠ CE QUI A MENÉ AU REFUS, QUAND C'EST L'ASSEMBLAGE QUI REFUSE. Trouvé le
       * 2026-10-04 : le premier mois OpenAI est tombé sur `mix.*` — cinq
       * archétypes sur trente — alors que le tirage en portait onze. Le refus ne
       * disait pas si la variété s'était perdue au repli de composition ou au
       * portillon ; il fallait le redemander. Un refus qui ne dit pas où se
       * trouve sa cause envoie la chercher au mauvais endroit.
       */
      diagnostics?: {
        fallbacks: Array<{ topicId: string; from: string; to: string; steps: string }>;
        gate: { arrived: number; passedAlone: number; byCheck: Record<string, number> };
        selectedArchetypes: Record<string, number>;
        composedArchetypes: Record<string, number>;
        dropped: Array<{ title: string; why: string }>;
        gateRefused: Array<{ topic: string; checks: string[]; detail: string }>;
      };
      refusal: string;
      /** Ce qui a été dépensé avant le refus. Zéro quand le préalable refuse. */
      costUsd: number;
      /** Vrai quand rien n'a été écrit en base et rien débité. */
      nothingWritten: true;
    }
  | {
      ok: true;
      /** Le mois assemblé, avec son portillon, sa sélection et ses refus. */
      month: AssembleOutcome<PreparedPost>;
      costUsd: number;
      /** Ce qui a été repris d'un lot déjà payé, plutôt que réécrit. */
      resumed: { reattached: boolean; reused: number; settledOnly: number };
      /** Les replis de composition, pour que le rapport dise la forme obtenue. */
      fallbacks: Array<{ topicId: string; from: string; to: string; steps: string }>;
      /** Les sujets rendus à la banque : tirés et non publiés. */
      released: string[];
      runId: string;
      /** La ligne `content_months`, pour que l'appelant sache quoi relire. */
      monthId: string;
      /** Ce que la relecture et le juge ont fait, pour que le rapport le dise. */
      editing: {
        revised: number;
        revisionRefused: number;
        revisionSkipped: boolean;
        judged: number;
        /** ⚠ Combien de lignes ont REÇU un verdict. Inférieur à `judged`, le juge s'est tu en partie. */
        judgedAnswered: number;
        judgedIncomplete: number;
        costUsd: number;
      };
      /** Ce que la rédaction de CE passage a dit d'elle-même. */
      writing: { asked: number; returned: number; refusedInJournal: number; stopped: WriteResult["stopped"] | null };
    };

/** Un post rédigé ET composé, prêt pour l'assemblage. */
export type PreparedPost = Assemblable & {
  topicId: string;
  caption: string;
  altText: string;
};

/**
 * Fait sortir un mois, ou refuse en disant à quelle étape et ce qui a été dépensé.
 */
export async function orchestrateMonth(
  ports: OrchestratePorts,
  input: OrchestrateInput
): Promise<OrchestrateOutcome> {
  /*
   * ── 0. CE QUE CE MOIS DÉTIENT DÉJÀ, LU AVANT LE PRÉALABLE ──────────────
   *
   * ⚠ EN LECTURE SEULE, ET AVANT. Le préalable juge la banque ; une reprise
   * détient des sujets assignés que la banque ne compte plus comme tirables, et
   * le préalable la refusait pour une pénurie qu'elle a elle-même créée (trouvé
   * le 2026-10-04 en tuant un mois à mi-rédaction). La lecture du journal ne
   * dépense rien et n'écrit rien : elle peut précéder le préalable.
   */
  const resumable = await findResumableRun(ports.journal, input.brandKitId, input.month);
  const heldByThisMonth: Record<string, number> = {};
  if (resumable) {
    for (const id of resumable.topicIds) {
      const held = await ports.draw.topic(id);
      if (held) heldByThisMonth[held.archetype_key] = (heldByThisMonth[held.archetype_key] ?? 0) + 1;
    }
  }

  /* ── 1. le préalable : rien n'est dépensé avant qu'il passe ──────────── */
  const verdict = await preflight(ports.preflight, {
    heldByThisMonth,
    brandKitId: input.brandKitId,
    projectId: input.projectId,
    userId: input.userId,
    month: input.month,
    stateCode: input.stateCode,
    demand: input.demand,
    wanted: input.wanted,
  });
  if (!verdict.ok) {
    return {
      ok: false,
      stage: "preflight",
      refusal: verdict.refusal,
      costUsd: 0,
      nothingWritten: true,
    };
  }

  /*
   * ── 2. LA LIGNE DU MOIS, OUVERTE EN `generating` ──────────────────────
   *
   * Après le préalable, parce qu'un mois refusé n'a pas à laisser de ligne ;
   * avant la rédaction, parce qu'une exécution tuée doit laisser une trace.
   */
  const monthId = await ports.openMonthRow({
    brandKitId: input.brandKitId,
    month: input.month,
  });

  /* ── 3. la reprise : un lot déjà payé ne se resoumet pas ────────────── */
  const { runId } = resumable
    ? { runId: resumable.runId }
    : await openRun(ports.journal, input.brandKitId, input.month);

  let costUsd = resumable?.costUsd ?? 0;
  const resumed = { reattached: resumable !== null, reused: 0, settledOnly: 0 };

  /*
   * ⚠ LES SUJETS VIENNENT DU JOURNAL QUAND IL Y EN A UN, JAMAIS D'UN NOUVEAU
   *   TIRAGE.
   *
   * Rencontré en vrai le 2026-09-23 : une reprise a rattaché le bon lot — déjà
   * payé — puis a REFAIT son tirage. Les deux ensembles se sont trouvés
   * identiques et le mois est passé, parce que `next_topic_for_kit` trie par
   * `created_at desc, id`. C'est une coïncidence d'ordonnancement, pas une
   * garantie : un sujet ajouté, expiré ou pris par une autre praticienne entre
   * les deux, et la reprise paie un lot dont elle ne sait plus lire les réponses.
   */
  let topics: DrawnTopic[];
  let drawnIds: string[];
  let fromJournal: RunJournal | null = resumable;

  if (fromJournal && fromJournal.topicIds.length > 0) {
    const read = await Promise.all(fromJournal.topicIds.map((id) => ports.draw.topic(id)));
    topics = read.filter((t): t is DrawnTopic => t !== null);
    drawnIds = topics.map((t) => t.id);
  } else {
    /* ── 4. le tirage ─────────────────────────────────────────────────── */
    const draw = await drawMonth(ports.draw, {
      families: input.families,
      drawOrder: input.drawOrder,
      perFamily: input.perFamily,
      candidates: input.candidates,
      practitionerCap: input.practitionerCap,
      practitionerPayload: input.practitionerPayload,
    });
    /*
     * ⚠ LES REFUSÉS SONT RENDUS TOUT DE SUITE, pas à la fin. Un sujet assigné
     * puis refusé est retiré à TOUT LE SEGMENT pendant quatre-vingt-dix jours
     * (F13) jusqu'au balai des trois heures. La banque locale en portait 994 le
     * 2026-09-26, et deux essais sur cinq étaient refusés avant toute dépense
     * pour cette seule raison.
     */
    if (draw.releasedEarly.length > 0) await ports.releaseTopics(draw.releasedEarly);
    topics = draw.drawn.map((c) => c.topic);
    drawnIds = topics.map((t) => t.id);
    if (topics.length === 0) {
      await ports.closeMonthRow(monthId, "failed");
      return {
        ok: false,
        stage: "draw",
        refusal: `la banque n'a rendu aucun sujet tirable : ${draw.shortfall.join(" ; ") || "aucun motif"}`,
        costUsd: 0,
        nothingWritten: true,
      };
    }
    fromJournal = null;
  }

  /* ── 5. la rédaction : le seul port qui coûte ───────────────────────── */
  const alreadyWritten = new Map<string, WrittenPost>();
  /* ⚠ Les sujets dont la rédaction a été payée et refusée : ni réécrits, ni publiés. */
  const refusedInJournal = new Set<string>();
  let toSettle: string[] = [];

  if (fromJournal) {
    const plan = resumePlan(fromJournal);
    resumed.reused = plan.done.length + plan.toSettle.length;
    resumed.settledOnly = plan.toSettle.length;
    toSettle = plan.toSettle;
    for (const [topicId, entry] of Object.entries(fromJournal.entries)) {
      if (isRefusedResult(entry.result)) {
        refusedInJournal.add(topicId);
        continue;
      }
      /*
       * ⚠ LE RÉSULTAT DU JOURNAL EST RELU, PAS REDEMANDÉ. C'est tout l'objet des
       * deux tables : le travail payé survit à la panne, et la publication reste
       * atomique.
       */
      alreadyWritten.set(topicId, entry.result as WrittenPost);
    }
  }

  const missing = topics.filter((t) => !alreadyWritten.has(t.id) && !refusedInJournal.has(t.id));
  let writing: { asked: number; returned: number; refusedInJournal: number; stopped: WriteResult["stopped"] | null } = {
    asked: 0, returned: 0, refusedInJournal: refusedInJournal.size, stopped: null,
  };
  let wroteSomethingNew = false;
  if (missing.length > 0) {
    /*
     * ══════════════════════════════════════════════════════════════════════
     *  ⚠ LE PLAFOND, AVANT LE SEUL PORT QUI COÛTE (F58)
     * ══════════════════════════════════════════════════════════════════════
     *
     * Il est ici et nulle part ailleurs : c'est le dernier point du chemin où
     * refuser ne coûte rien. Un octet plus loin, l'argent est parti — un lot est
     * facturé à la SOUMISSION, et entre l'envoi et la première réponse il passe
     * vingt-cinq à trente minutes.
     *
     * ⚠ ET IL COMPTE LE DÉJÀ-DÉPENSÉ. `costUsd` porte le coût du journal sur une
     * reprise : un plafond qui ne regarderait que l'appel courant se contournerait
     * en reprenant, ce qu'une panne fait toute seule.
     */
    const room = withinCeiling(input.ceiling, {
      topics: missing.length,
      spentUsd: costUsd,
    });
    if (!room.ok) {
      /*
       * ⚠ LA LIGNE DU MOIS PASSE EN `failed`, ET LES SUJETS SONT RENDUS. Un mois
       * laissé en `generating` parce qu'on a refusé de le payer ferait attendre la
       * praticienne indéfiniment, et garderait ses sujets au segment.
       */
      await ports.releaseTopics(drawnIds);
      await ports.closeMonthRow(monthId, "failed");
      return {
        ok: false,
        stage: "ceiling",
        refusal: room.refusal,
        costUsd,
        nothingWritten: true,
      };
    }

    /*
     * ⚠ LES SUJETS SONT INSCRITS AVANT LE PREMIER APPEL, pas après le dernier.
     * Voir `rememberTopics` : sans ces lignes, aucune réponse d'un rédacteur
     * synchrone n'entrait au journal, et une reprise refaisait son tirage.
     */
    if (!fromJournal) await rememberTopics(ports.journal, runId, missing.map((t) => t.id));

    const journaled = new Set<string>();
    const writeBase = costUsd;
    let streamedUsd = 0;
    const sink: WriteSink = {
      async post(post) {
        await rememberResult(ports.journal, runId, post.topicId, { result: post, usage: post.usage });
        journaled.add(post.topicId);
        alreadyWritten.set(post.topicId, post);
      },
      async refused(topicId, reason, family) {
        const result: Record<string, unknown> = { refused: true, reason, ...(family ? { family } : {}) };
        await rememberResult(ports.journal, runId, topicId, {
          result,
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        });
        refusedInJournal.add(topicId);
      },
      async spent(deltaUsd) {
        streamedUsd += deltaUsd;
        /*
         * ⚠ LE COÛT SUIT LES RÉPONSES, ET L'ÉTAT RESTE `submitted`. Une reprise
         * qui relit ce chiffre le compte comme déjà dépensé — c'est ce qui
         * empêche un plafond de se contourner par une panne.
         */
        await rememberCost(ports.journal, runId, writeBase + streamedUsd, "submitted");
      },
    };

    const written = await ports.writer.write({
      topics: missing,
      wanted: input.wanted,
      month: input.month,
      sink,
    });
    costUsd = writeBase + written.costUsd;
    writing = {
      asked: missing.length,
      returned: written.posts.length,
      refusedInJournal: refusedInJournal.size,
      stopped: written.stopped ?? null,
    };

    if (written.batchId) await rememberBatchId(ports.journal, runId, written.batchId);
    /*
     * ⚠ UN PORT QUI N'A PAS APPELÉ LE PUITS EST RATTRAPÉ ICI. Il reste juste —
     * ses posts entrent au journal — mais il perd tout sur une panne, et c'est
     * à lui de le dire, pas à l'orchestrateur de le cacher.
     */
    for (const post of written.posts) {
      if (journaled.has(post.topicId)) continue;
      await rememberResult(ports.journal, runId, post.topicId, {
        result: post,
        usage: post.usage,
      });
      alreadyWritten.set(post.topicId, post);
    }
    wroteSomethingNew = written.posts.length > 0;
    await rememberCost(ports.journal, runId, costUsd, "collected");
  }

  if (alreadyWritten.size === 0) {
    await ports.closeMonthRow(monthId, "failed");
    return {
      ok: false,
      stage: "write",
      refusal: writing.stopped
        ? `la rédaction s'est arrêtée avant d'avoir rien rendu : ${writing.stopped.detail}`
        : "la rédaction n'a rendu aucun post : rien à composer, rien à publier",
      costUsd,
      nothingWritten: true,
    };
  }

  /*
   * ── 5b. LA RELECTURE DU MOIS, AVANT LA COMPOSITION ──────────────────────
   *
   * ⚠ AVANT, PARCE QU'ELLE CHANGE CE QUI SERA DESSINÉ. Elle réécrit une ligne de
   * carte ou un libellé répété ; composer d'abord puis réviser ferait dessiner
   * une carte qu'on jette.
   *
   * ⚠ ET ELLE NE SE REPAIE PAS SUR UNE REPRISE QUI N'A RIEN RÉDIGÉ. Les posts
   * qu'elle a lus portent `revisionSeen` au journal ; si tous le portent et que
   * rien de neuf n'est arrivé, la relecture est déjà faite et payée.
   */
  const editing = {
    revised: 0, revisionRefused: 0, revisionSkipped: false, judged: 0, judgedAnswered: 0, judgedIncomplete: 0, costUsd: 0,
  };
  const inOrder = topics.filter((t) => alreadyWritten.has(t.id));
  const alreadyRevised = !wroteSomethingNew && inOrder.every((t) => alreadyWritten.get(t.id)!.revisionSeen === true);
  if (alreadyRevised) {
    editing.revisionSkipped = true;
  } else {
    const revision = await reviseMonth(
      ports.editor,
      inOrder.map((t) => {
        const post = alreadyWritten.get(t.id)!;
        return {
          archetype: t.archetype_key,
          cardLine: post.cardLine,
          payload: post.payload,
          caption: post.caption,
          altText: post.altText,
        };
      })
    );
    editing.costUsd += revision.costUsd;
    editing.revised = revision.revisions.length;
    editing.revisionRefused = revision.refused.length;
    for (const r of revision.revisions) {
      const topic = inOrder[r.index];
      const post = alreadyWritten.get(topic.id)!;
      alreadyWritten.set(topic.id, { ...post, cardLine: r.cardLine, payload: r.payload });
    }
    for (const topic of inOrder) {
      const post = { ...alreadyWritten.get(topic.id)!, revisionSeen: true };
      alreadyWritten.set(topic.id, post);
      await rememberResult(ports.journal, runId, topic.id, { result: post, usage: post.usage });
    }
    costUsd += revision.costUsd;
    await rememberCost(ports.journal, runId, costUsd, "collected");
  }

  /* ── 6. la composition : le pied porte la licence ───────────────────── */
  const prepared: PreparedPost[] = [];
  const composeFallbacks: Array<{ topicId: string; from: string; to: string; steps: string }> = [];
  const footer = `${input.practiceName} · ${verdict.licenceMention}`;
  let composeRefusal: string | null = null;

  let index = 0;
  for (const topic of topics) {
    const post = alreadyWritten.get(topic.id);
    if (!post) continue;
    try {
      const card = composeCard({
        archetype: topic.archetype_key,
        payload: post.payload,
        palette: input.paletteFor(index),
        eyebrow: post.eyebrow,
        headline: post.cardLine,
        footer,
        licenceMention: verdict.licenceMention,
      });
      if (card.steps.length > 0) {
        composeFallbacks.push({
          topicId: topic.id,
          from: topic.archetype_key,
          to: card.landedOn,
          steps: card.steps.join("; "),
        });
      }
      prepared.push({
        topicId: topic.id,
        cardLine: post.cardLine,
        /*
         * ⚠ LA MISE EN PAGE VIENT DE L'APPELANT, pas de l'archétype composé. Elle
         * décide du gabarit de relecture ; la déduire de `composeArchetype`
         * ferait changer le gabarit chaque fois que le moteur replie une carte.
         */
        layout: input.layoutFor(index),
        composeArchetype: card.archetype,
        payload: card.payload,
        svg: card.svg,
        eyebrow: post.eyebrow,
        footer,
        caption: post.caption,
        altText: post.altText,
        candidate: {
          topic: { id: topic.id, title: topic.title, hook: topic.hook ?? null },
          result: { caption: post.caption, altText: post.altText, rationale: post.rationale },
          reservationId: null,
        },
      });
    } catch (error) {
      /*
       * ⚠ UN REFUS DE LICENCE ARRÊTE LE MOIS ENTIER, pas seulement sa carte. Si
       * le pied ne porte pas la mention pour un post, il ne la porte pour aucun :
       * c'est la même chaîne pour les trente. Publier les vingt-neuf autres
       * mettrait en ligne vingt-neuf publicités sans numéro de licence.
       */
      if (error instanceof ComposeRefused) {
        composeRefusal = error.message;
        break;
      }
      /* Une panne du moteur sur UNE carte n'est qu'une carte de moins. */
    }
    index += 1;
  }

  if (composeRefusal) {
    await ports.releaseTopics(drawnIds);
    /*
     * ⚠ `failed`, PAS UNE LIGNE LAISSÉE EN `generating`. Un mois qui reste
     * « en cours » pour toujours est le pire des trois états : la cliente attend,
     * et le préalable du tour suivant le laisserait passer en croyant reprendre
     * un travail qui n'existe pas.
     */
    await ports.closeMonthRow(monthId, "failed");
    return {
      ok: false,
      stage: "compose",
      refusal: composeRefusal,
      costUsd,
      nothingWritten: true,
    };
  }

  /*
   * ── 6b. LE JUGE DE COMPLÉTUDE, SUR CE QUI A ÉTÉ COMPOSÉ ─────────────────
   *
   * ⚠ APRÈS LA COMPOSITION, PARCE QU'IL JUGE CE QUI SERA IMPRIMÉ. Un repli de
   * composition change l'archétype, donc les lignes ; juger le payload rédigé
   * plutôt que le composé jugerait une carte qui ne sortira pas.
   *
   * ⚠ ET SEULES LES LIGNES INDÉCISES LUI SONT SOUMISES. Le lexique tranche le
   * reste, gratuitement ; `undecidedIn` est la même sélection que le harnais.
   */
  const toJudge = undecidedIn(
    writtenLinesIn(
      prepared.map((p) => ({
        archetype: p.composeArchetype,
        title: p.candidate.topic.title,
        cardLine: p.cardLine,
        payload: p.payload,
      }))
    )
  );
  /*
   * ⚠ PAR LOTS DE QUARANTE LIGNES, ET LE NOMBRE DE VERDICTS EST COMPTÉ.
   *
   * Mesuré le 2026-10-04 sur le premier mois OpenAI : 352 lignes en UN appel, zéro
   * ligne refusée — et rejoué sur les trente posts publiés, le même juge en refuse
   * une (« EMDR does not erase »), qui était partie. Un juge qui ne rend pas tous
   * ses verdicts ne refuse rien, par construction ; le seul moyen de le voir est
   * de compter ce qu'il a rendu. Quarante est la taille de lot que le harnais
   * employait déjà pour la même raison (`15-examples.ts`).
   */
  const verdicts: Record<string, boolean> = {};
  for (let i = 0; i < toJudge.length; i += JUDGE_BATCH) {
    const judged = await judgeCompleteness(ports.editor, toJudge.slice(i, i + JUDGE_BATCH));
    Object.assign(verdicts, judged.verdicts);
    editing.costUsd += judged.costUsd;
    costUsd += judged.costUsd;
  }
  const judged = { verdicts };
  editing.judged = toJudge.length;
  editing.judgedAnswered = toJudge.filter((line) => line in verdicts).length;
  editing.judgedIncomplete = Object.values(verdicts).filter((v) => v === false).length;

  /* ── 7. l'assemblage : portillon, sélection, écriture, crédit ───────── */
  const assemblePorts = ports.assembleFor(monthId);
  const month = await assembleMonth(assemblePorts, {
    prepared,
    wanted: input.wanted,
    dates: input.dates,
    /*
     * ⚠ LE PORTILLON REÇOIT CE QUE L'ORCHESTRATEUR SAIT, PAS SEULEMENT CE QUE
     * L'APPELANT A PENSÉ À PASSER.
     *
     * Trouvé le 2026-10-04 : `checkPostAlone` lit la mention de licence et les
     * verdicts du juge dans `context`, et chaque champ y est FACULTATIF — absent,
     * le contrôle se tait. Le lanceur de rejeu passait un contexte sans mention
     * ni verdicts : le portillon ne vérifiait donc ni l'une ni les autres, et seul
     * le contrôle du mois, en aval, les rattrapait — trop tard pour échanger le
     * post fautif contre un remplaçant. Les valeurs que l'orchestrateur détient
     * (la mention lue par le préalable, les verdicts qu'il vient d'obtenir)
     * l'emportent ici sur celles de l'appelant.
     */
    context: {
      ...input.context,
      direction: input.direction,
      practiceName: input.practiceName,
      identityAllowList: input.identityAllowList,
      modalities: input.modalities,
      eyebrowCatalogue: input.intentCatalogue,
      licenceMention: verdict.licenceMention,
      completeness: judged.verdicts,
    },
    direction: input.direction,
    practiceName: input.practiceName,
    identityAllowList: input.identityAllowList,
    intentCatalogue: input.intentCatalogue,
    licenceMention: verdict.licenceMention,
    modalities: input.modalities,
    completeness: judged.verdicts,
    userId: input.userId,
    month: input.month,
  });

  /*
   * ══════════════════════════════════════════════════════════════════════
   *  ⚠ F55 — UN MOIS QUI ÉCHOUE N'EST JAMAIS LIVRÉ
   * ══════════════════════════════════════════════════════════════════════
   *
   * `assembleMonth` n'a rien écrit s'il restait un constat. Ici on le DIT, on
   * rend les sujets, et la ligne du mois passe en `failed` — pas en `proposed`.
   * Le mois de 2027-04 de la base locale est exactement ce qu'on évite : refusé
   * par ses contrôles, et en base en `proposed` avec trente posts.
   */
  if (month.selection.remaining.length > 0) {
    await ports.releaseTopics(drawnIds);
    await ports.closeMonthRow(monthId, "failed");
    await rememberCost(ports.journal, runId, costUsd, "collected");
    return {
      ok: false,
      stage: "assemble",
      refusal:
        `le mois garde ${month.selection.remaining.length} constat(s) après les échanges : ` +
        month.selection.remaining.map((f) => `${f.check} — ${f.detail}`).join(" ; "),
      remaining: month.selection.remaining,
      diagnostics: {
        fallbacks: composeFallbacks,
        gate: { arrived: month.gate.arrived, passedAlone: month.gate.passedAlone, byCheck: month.gate.byCheck },
        selectedArchetypes: tally(month.selection.chosen.map((p) => p.composeArchetype)),
        composedArchetypes: tally(prepared.map((p) => p.composeArchetype)),
        dropped: month.selection.dropped,
        gateRefused: month.gate.refused,
      },
      costUsd,
      nothingWritten: true,
    };
  }

  /*
   * ══════════════════════════════════════════════════════════════════════
   *  ⚠ LES RÉSERVATIONS SE SOLDENT, SINON LE LIVRE NE DIT PAS LE COÛT
   * ══════════════════════════════════════════════════════════════════════
   *
   * Mesuré le 2026-09-26 : le premier mois sorti du chemin produit a laissé
   * VINGT-NEUF réservations sans issue. `credit_month_audit` le disait —
   * 29 réservations, 0 règlement, 0 libération, coût 0,00000 $. Le quota était
   * juste (consommé 29) et les livres étaient muets sur ce que le mois a coûté.
   *
   * ⚠ ET LE COÛT EST RÉPARTI, PAS RECOPIÉ. Solder chaque post au coût TOTAL du
   * mois multiplierait la dépense par vingt-neuf — c'est le défaut que le
   * harnais a déjà payé une fois (« un livre qui multiplie par trente est pire
   * qu'un livre vide : le premier a l'air d'un chiffre »).
   */
  const perPost = month.written > 0 ? costUsd / month.written : 0;
  for (const post of month.inserted) {
    const reservationId = post.candidate.reservationId;
    if (!reservationId) continue;
    await assemblePorts.credits.settle(reservationId, perPost, true);
  }

  /*
   * ⚠ ET LE JOURNAL MARQUE SOLDÉ CE QUI VIENT D'ÊTRE PAYÉ. Sans ce geste, une
   * reprise réserverait un second crédit pour un post déjà débité — trente posts
   * achetés, soixante décomptés.
   */
  if (toSettle.length > 0) await markSettled(ports.journal, runId, toSettle);
  const publishedIds = month.inserted.map((p) => p.topicId);
  if (publishedIds.length > 0) await markSettled(ports.journal, runId, publishedIds);

  /* ── 8. la publication : le coût reste lisible ──────────────────────── */
  /*
   * ⚠ LA LIGNE DU MOIS PASSE À `proposed` QUAND IL Y A QUELQUE CHOSE À RELIRE, et
   * à `failed` sinon. Un mois vide laissé en `proposed` mettrait la cliente devant
   * un écran de relecture sans rien à relire.
   */
  await ports.closeMonthRow(monthId, month.written > 0 ? "proposed" : "failed");
  await publishRun(ports.journal, runId, costUsd);

  /*
   * ⚠ CE QUI A ÉTÉ TIRÉ ET NON PUBLIÉ EST RENDU. La règle du cahier des charges
   * — « les sujets non utilisés ne sont pas marqués assignés » — vaut aussi pour
   * la surgénération : soixante-douze tirés pour trente publiés, ce sont
   * quarante-deux sujets qu'on rendrait au segment ou qu'on lui volerait.
   */
  const kept = new Set(publishedIds);
  const released = drawnIds.filter((id) => !kept.has(id));
  if (released.length > 0) await ports.releaseTopics(released);

  return {
    ok: true, month, costUsd, resumed, fallbacks: composeFallbacks, released, runId, monthId, editing, writing,
  };
}

/** La taille d'un lot de lignes soumis au juge de complétude. */
export const JUDGE_BATCH = 40;

function tally(keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = (out[k] ?? 0) + 1;
  return out;
}
