import { preflight, type PreflightPort, type PreflightInput } from "@/lib/content/month/preflight";
import { drawMonth, type DrawPorts, type DrawnTopic } from "@/lib/content/month/draw";
import { composeCard, ComposeRefused } from "@/lib/content/month/compose-card";
import { assembleMonth, type AssemblePorts, type AssembleOutcome, type Assemblable } from "@/lib/content/month/assemble";
import {
  findResumableRun,
  markSettled,
  openRun,
  publishRun,
  rememberBatch,
  rememberCost,
  rememberResult,
  resumePlan,
  type JournalDb,
  type RunJournal,
} from "@/lib/content/month/journal-port";
import type { PostContext } from "@/lib/content/month-checks";
import type { CompletenessVerdicts } from "@/lib/content/writing-checks";
import type { DirectionPalette } from "@/lib/compose/palette";
import type { RenderInput } from "@/lib/compose/types";

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
};

export type WriteRequest = {
  topics: DrawnTopic[];
  /** Ce que le mois promet, pour que le port sache combien il écrit. */
  wanted: number;
  month: string;
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
};

export type WriterPort = {
  write(request: WriteRequest): Promise<WriteResult>;
};

export type OrchestratePorts = {
  preflight: PreflightPort;
  draw: DrawPorts;
  journal: JournalDb;
  writer: WriterPort;
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
  completeness: CompletenessVerdicts;
};

export type OrchestrateOutcome =
  | {
      ok: false;
      /** `preflight` quand le refus vient de l'étage A, sinon l'étape nommée. */
      stage: "preflight" | "draw" | "write" | "compose" | "assemble";
      /** Les constats de mois qui restaient, quand c'est eux qui refusent. */
      remaining?: Array<{ check: string; detail: string }>;
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
  /* ── 1. le préalable : rien n'est dépensé avant qu'il passe ──────────── */
  const verdict = await preflight(ports.preflight, {
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
  const resumable = await findResumableRun(ports.journal, input.brandKitId, input.month);
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
  let toSettle: string[] = [];

  if (fromJournal) {
    const plan = resumePlan(fromJournal);
    resumed.reused = plan.done.length + plan.toSettle.length;
    resumed.settledOnly = plan.toSettle.length;
    toSettle = plan.toSettle;
    for (const [topicId, entry] of Object.entries(fromJournal.entries)) {
      /*
       * ⚠ LE RÉSULTAT DU JOURNAL EST RELU, PAS REDEMANDÉ. C'est tout l'objet des
       * deux tables : le travail payé survit à la panne, et la publication reste
       * atomique.
       */
      alreadyWritten.set(topicId, entry.result as WrittenPost);
    }
  }

  const missing = topics.filter((t) => !alreadyWritten.has(t.id));
  if (missing.length > 0) {
    const written = await ports.writer.write({
      topics: missing,
      wanted: input.wanted,
      month: input.month,
    });
    costUsd += written.costUsd;

    /*
     * ⚠ L'IDENTIFIANT DU LOT ET LA LISTE DE SES SUJETS, DANS LE MÊME GESTE, et
     * AVANT toute attente. Un `batch_id` sans sa liste ne se reprend pas : on
     * aurait sauvé de quoi RETROUVER le travail payé, pas de quoi le RECONNAÎTRE.
     */
    if (written.batchId && !fromJournal) {
      await rememberBatch(ports.journal, runId, written.batchId, missing.map((t) => t.id));
    }
    for (const post of written.posts) {
      await rememberResult(ports.journal, runId, post.topicId, {
        result: post,
        usage: post.usage,
      });
      alreadyWritten.set(post.topicId, post);
    }
    await rememberCost(ports.journal, runId, costUsd, "collected");
  }

  if (alreadyWritten.size === 0) {
    await ports.closeMonthRow(monthId, "failed");
    return {
      ok: false,
      stage: "write",
      refusal: "la rédaction n'a rendu aucun post : rien à composer, rien à publier",
      costUsd,
      nothingWritten: true,
    };
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

  /* ── 7. l'assemblage : portillon, sélection, écriture, crédit ───────── */
  const assemblePorts = ports.assembleFor(monthId);
  const month = await assembleMonth(assemblePorts, {
    prepared,
    wanted: input.wanted,
    dates: input.dates,
    context: input.context,
    direction: input.direction,
    practiceName: input.practiceName,
    identityAllowList: input.identityAllowList,
    intentCatalogue: input.intentCatalogue,
    licenceMention: verdict.licenceMention,
    modalities: input.modalities,
    completeness: input.completeness,
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

  return { ok: true, month, costUsd, resumed, fallbacks: composeFallbacks, released, runId, monthId };
}
