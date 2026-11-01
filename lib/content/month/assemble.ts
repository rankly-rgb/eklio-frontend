import { checkAcrossPosts, checkPostAlone, type Finding, type PostContext } from "@/lib/content/month-checks";
import { asMonthPost, selectDeliverable, type Deliverable } from "@/lib/content/month/select";
import { aPurchaseWouldHelp, type CreditPort, type ReserveRefusal } from "@/lib/credits/paid-call";
import type { CompletenessVerdicts } from "@/lib/content/writing-checks";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'ASSEMBLAGE D'UN MOIS — ÉTAGES D5, D6, E1, E2, E3 DE F45
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ce qui se passe entre « les posts sont écrits » et « le mois est en base ».
 * C'était inline dans `scripts/local-render/20-month.ts`, et le chemin produit
 * n'en avait rien : le recensement du 2026-09-26 a montré qu'aucun des trente
 * contrôles de mois n'y était appelé.
 *
 * ── ⚠ AUCUN APPEL DE MODÈLE ICI, ET C'EST POURQUOI TOUT EST ÉPROUVABLE ───
 *
 * Les posts arrivent déjà écrits. Ce module contrôle, échange, écrit et compte —
 * rien d'autre. Ses deux seuls accès au monde sont des ports : l'`insert` et le
 * crédit. Une doublure suffit donc à éprouver le portillon, l'échange, le
 * remplaçant d'insert et la comptabilité, sans dépenser un centime.
 *
 * ── LES QUATRE MOMENTS, ET POURQUOI DANS CET ORDRE ──────────────────────
 *
 *   1. LE PORTILLON     chaque post est jugé SEUL, à son arrivée. Un défaut par
 *                       post ne consomme alors aucun échange du banc.
 *   2. LA SÉLECTION     `checkMonth` sur les trente retenus, et un échange par
 *                       constat transversal — compte, mélange, doublons.
 *   3. L'ÉCRITURE       un `insert` par post, et un REMPLAÇANT au même créneau
 *                       quand la base refuse.
 *   4. LE CRÉDIT        un par post RÉELLEMENT écrit. La praticienne a acheté
 *                       trente posts, pas soixante-douze tentatives.
 */

/** Ce qu'un post préparé doit porter pour être assemblé. */
export type Assemblable = {
  cardLine: string;
  /** Le dessin de la bibliothèque que la carte porte, choisi par le sens. */
  illustration?: string | null;
  /** La famille de mise en page, `content_items.archetype`, NOT NULL en base. */
  layout: string;
  composeArchetype: string;
  payload: unknown;
  svg: string | null;
  eyebrow: string;
  footer: string;
  candidate: {
    topic: { id: string; title: string; hook?: string | null };
    result?: { caption?: string; altText?: string; rationale?: string } | null;
    /** Rempli par ce module quand le crédit est pris. */
    reservationId?: string | null;
  };
};

/** La ligne écrite dans `content_items`. Le port décide comment. */
export type ContentItemRow = {
  topicId: string;
  cardLine: string;
  /*
   * ⚠ DEUX COLONNES D'ARCHÉTYPE, ET CE N'EST PAS UNE REDONDANCE.
   *
   * `content_items.archetype` est la famille de MISE EN PAGE — « statement »,
   * « story », « question », « notes », « signature » — et elle est NOT NULL.
   * `compose_archetype` est la forme qui a VRAIMENT tenu après les replis du
   * moteur. Confondre les deux ferait relire une carte avec le mauvais gabarit.
   *
   * ⚠ ET ELLE MANQUAIT ICI, donc l'assemblage ne pouvait pas écrire en vraie
   * base : trouvé le 2026-09-26 en câblant l'orchestrateur sur PostgreSQL. Une
   * doublure d'`insert` acceptait la ligne sans la colonne ; la base, non.
   */
  layout: string;
  composeArchetype: string;
  payload: unknown;
  onImageText: string | null;
  caption: string;
  altText: string;
  rationale: string;
  scheduledFor: string;
  /**
   * L'État pour lequel la mention de ce post a été tirée (F76). La base refuse
   * la ligne s'il n'est plus celui de `project_briefs.state` au moment d'écrire.
   */
  licenceStateCode: string;
  /** Le dessin de la carte (`content_items.illustration_key`), ou null. */
  illustrationKey: string | null;
};

/** Ce que la base répond à une écriture refusée : son code SQL, et son message. */
export type InsertError = { code: string | null; message: string };

/**
 * ⚠ UNE ÉCRITURE REFUSÉE N'EST PAS UN REFUS DE CONTENU — SAUF QUAND LA BASE
 * REFUSE LE CONTENU (F77).
 *
 * Les gâchettes de contenu de `content_items` — déontologie publicitaire, mots
 * usés, cachet d'État, budget de mots — lèvent toutes `check_violation` (23514).
 * Tout le reste — `null value` (23502), clé étrangère, unicité, réseau — est une
 * ERREUR TECHNIQUE : le post n'y est pour rien. Novembre 2026 : 28 écritures
 * refusées pour `archetype` nul, et rien ne les distinguait d'un refus de
 * contenu.
 */
export function insertRefusalKind(code: string | null): "technical" | "content" {
  return code === "23514" ? "content" : "technical";
}

export type InsertRefusal = {
  topic: string;
  kind: "technical" | "content";
  code: string | null;
  message: string;
};

export type AssemblePorts = {
  /** Rend `null` en cas de succès, le code et le message de la base sinon. */
  insert(row: ContentItemRow): Promise<InsertError | null>;
  /**
   * Retire les posts que ce mois vient d'écrire (F77) : un mois qui n'atteint
   * pas son compte n'est jamais publié, même en partie.
   */
  remove(topicIds: string[]): Promise<void>;
  credits: CreditPort;
};

export type AssembleInput<T extends Assemblable> = {
  /** Les posts écrits et composés, dans l'ordre de préférence. */
  prepared: T[];
  /** Combien le mois doit livrer. */
  wanted: number;
  /** Les dates, une par créneau. */
  dates: string[];
  /** Le contexte que les contrôles par post lisent. */
  context: PostContext;
  direction: DirectionPalette;
  practiceName: string;
  identityAllowList: string[];
  intentCatalogue: Array<{ id: string; label: string }>;
  licenceMention: string;
  /** L'État pour lequel `licenceMention` a été tirée (F76) : le cachet de chaque post écrit. */
  licenceStateCode: string;
  modalities: string[];
  completeness: CompletenessVerdicts;
  /** Ce qui sera lu au livre de crédit. */
  userId: string;
  month: string;
};

export type GateRefusal = { topic: string; checks: string[]; detail: string };

export type AssembleOutcome<T extends Assemblable> = {
  /** Combien de posts sont réellement en base. */
  written: number;
  /** Les posts écrits, pour que l'appelant garde leurs sujets. */
  inserted: T[];
  /** Ce que le portillon a écarté, par post et par classe. */
  gate: {
    arrived: number;
    passedAlone: number;
    refused: GateRefusal[];
    byCheck: Record<string, number>;
  };
  /** Ce que la sélection a échangé, et ce qu'elle n'a pas pu réparer. */
  selection: Deliverable<T>;
  /** Les refus d'écriture de la base, par nature, et les remplaçants consommés. */
  inserts: {
    refused: InsertRefusal[];
    /** Erreurs techniques : le post n'y est pour rien. */
    technical: number;
    /** Refus de contenu par la base (`check_violation`). */
    content: number;
    replacements: number;
    attempted: number;
  };
  /**
   * ⚠ LE CONSTAT DE COMPTE APRÈS ÉCRITURE (F77), ou `null`.
   *
   * La sélection a validé trente posts ; si la base n'en a gardé que vingt-quatre,
   * le mois n'est PAS publié : les posts écrits sont retirés, leurs crédits
   * rendus, et ce constat dit pourquoi — refus techniques et refus de contenu
   * comptés à part. C'est le défaut qui a laissé passer novembre 2026 en `ok`.
   */
  shortfall: Finding | null;
  /** L'entonnoir du mois : ce qui est arrivé, a passé, a été retenu, tenté, écrit. */
  funnel: { arrived: number; passedAlone: number; selected: number; attempted: number; written: number };
  /**
   * Combien de posts ont dû partager une date, faute de créneaux.
   *
   * ── ⚠ IL ÉTAIT SILENCIEUX, ET C'EST COMME ÇA QU'ON PUBLIE DEUX FOIS LE
   *      MÊME JOUR ────────────────────────────────────────────────────────
   *
   * `input.dates[index] ?? dates[dates.length - 1]` empile sur le dernier
   * créneau tout ce qui dépasse. Mesuré le 2026-09-26 : un mois de trente posts
   * en FÉVRIER 2028 est sorti sur vingt-neuf dates — le mois n'en a pas trente.
   *
   * ⚠ ET CE N'EST PAS UN DÉFAUT QU'ON PEUT REFUSER : un mois de trente posts ne
   * PEUT pas avoir trente dates distinctes en février. Ce qui était faux était de
   * le taire. Le compte est donc rendu, et l'appelant décide s'il le montre.
   */
  dateCollisions: number;
  /**
   * Le refus de crédit qui a arrêté l'écriture, s'il y en a eu un.
   *
   * ⚠ AVEC SON MOTIF (F47). Les sept issues de `reserve_credit` traversent
   * jusqu'ici : un abonnement expiré ne se lit pas comme un quota épuisé, et
   * `aPurchaseWouldHelp` dit lequel des deux mérite une page de paiement.
   */
  creditRefusal: { reason: ReserveRefusal; buyable: boolean } | null;
};

export async function assembleMonth<T extends Assemblable>(
  ports: AssemblePorts,
  input: AssembleInput<T>
): Promise<AssembleOutcome<T>> {
  /* ── 1. le portillon : chaque post jugé seul ────────────────────────── */
  /*
   * ⚠ CE QUI EST GAGNÉ N'EST PAS DU TEMPS, C'EST DU BANC. Un post écarté ici ne
   * consomme aucun échange, et la sélection ne voit plus que des constats
   * transversaux. Mesuré : `sable.ingram` a réussi dix échanges — tous ses
   * constats de contenu levés — puis est mort sur `month.short`, et les dix
   * défauts se lisaient chacun sur un post seul.
   */
  const clean: T[] = [];
  const refused: GateRefusal[] = [];
  for (const post of input.prepared) {
    const findings = checkPostAlone(asMonthPost(post), input.context);
    if (findings.length === 0) {
      clean.push(post);
      continue;
    }
    refused.push({
      topic: post.candidate.topic.title,
      checks: [...new Set(findings.map((f: Finding) => f.check))],
      detail: findings.map((f: Finding) => f.detail).join("; ").slice(0, 200),
    });
  }

  const byCheck: Record<string, number> = {};
  for (const r of refused) for (const c of r.checks) byCheck[c] = (byCheck[c] ?? 0) + 1;

  /* ── 2. la sélection, et les échanges du banc ───────────────────────── */
  const selection = selectDeliverable(
    clean,
    input.direction,
    input.wanted,
    input.practiceName,
    input.identityAllowList,
    input.intentCatalogue,
    input.licenceMention,
    input.modalities,
    input.completeness
  );

  /*
   * ══════════════════════════════════════════════════════════════════════
   *  ⚠ F55 — UN MOIS QUI ÉCHOUE N'EST JAMAIS LIVRÉ, ET CE N'ÉTAIT PAS TENU
   * ══════════════════════════════════════════════════════════════════════
   *
   * ⚠ MESURÉ LE 2026-09-26 SUR LA BASE LOCALE, pas craint.
   *
   * `content_months` porte un mois de trente posts en `proposed`, avec trente
   * posts en base — et son livre de crédit dit trente réservations, ZÉRO
   * règlement, TRENTE libérations. Or le harnais ne libère les crédits d'un
   * mois livré que dans un seul cas : `monthPasses === false`, c'est-à-dire
   * quand il RESTE des constats après les échanges.
   *
   * Ce mois-là a donc été REFUSÉ par ses propres contrôles, et il est en base,
   * en `proposed`, indistinguable d'un bon mois. Le seul endroit où son refus
   * était écrit est un code de sortie non nul dans un terminal que personne ne
   * garde — et une session ultérieure l'a relu comme un mois livré.
   *
   * La cause est un ORDRE : les posts étaient écrits AVANT que le verdict de
   * mois existe, et le verdict ne décidait plus que des crédits. « Un mois qui
   * échoue n'est jamais livré » n'était donc pas un contrôle, c'était une
   * phrase.
   *
   * ⚠ ICI, RIEN N'EST ÉCRIT TANT QU'IL RESTE UN CONSTAT. Le banc a servi, les
   * échanges ont eu lieu, et s'il reste quelque chose le mois ne s'écrit pas du
   * tout. Ce qui a été payé au fournisseur reste payé — c'est un frais
   * général — mais rien n'est publié et aucun crédit n'est pris.
   */
  if (selection.remaining.length > 0) {
    return {
      written: 0,
      inserted: [],
      gate: { arrived: input.prepared.length, passedAlone: clean.length, refused, byCheck },
      selection,
      inserts: { refused: [], technical: 0, content: 0, replacements: 0, attempted: 0 },
      shortfall: null,
      funnel: {
        arrived: input.prepared.length,
        passedAlone: clean.length,
        selected: selection.chosen.length,
        attempted: 0,
        written: 0,
      },
      dateCollisions: 0,
      creditRefusal: null,
    };
  }

  /* ── 3 et 4. l'écriture, le remplaçant, le crédit ───────────────────── */
  /*
   * ⚠ UNE FILE, PAS UN TABLEAU FIGÉ. Le remplaçant doit être VISITÉ, et sur le
   * créneau du refusé : itérer une copie l'ignorerait, et l'insérer au rang
   * suivant lui donnerait la date du post d'après — un mois de trente posts sur
   * vingt-neuf jours.
   */
  const queue = [...selection.chosen];
  const spare = clean.filter((p) => !selection.chosen.includes(p));
  const inserted: T[] = [];
  const insertRefused: InsertRefusal[] = [];
  let replacements = 0;
  let attempted = 0;
  let creditRefusal: AssembleOutcome<T>["creditRefusal"] = null;

  for (let index = 0; index < queue.length; index += 1) {
    const post = queue[index];
    const { candidate } = post;

    attempted += 1;
    const error = await ports.insert({
      topicId: candidate.topic.id,
      cardLine: post.cardLine,
      layout: post.layout,
      composeArchetype: post.composeArchetype,
      payload: post.payload,
      onImageText: candidate.topic.hook ?? null,
      caption: candidate.result?.caption ?? "",
      altText: candidate.result?.altText ?? "",
      rationale: candidate.result?.rationale ?? "",
      scheduledFor: input.dates[index] ?? input.dates[input.dates.length - 1] ?? input.month,
      licenceStateCode: input.licenceStateCode,
      illustrationKey: post.illustration ?? null,
    });

    if (error) {
      insertRefused.push({
        topic: candidate.topic.title.slice(0, 34),
        kind: insertRefusalKind(error.code),
        code: error.code,
        message: error.message.slice(0, 160),
      });
      /*
       * ⚠ LA BASE PORTE DES CONTRAINTES QUE LE CODE NE RÉPLIQUE PAS TOUTES — un
       * budget de mots, cinq gâchettes déontologiques. La bonne réponse à un
       * refus d'écriture n'est pas de rendre le mois court : c'est de prendre le
       * suivant, qui est déjà passé par le portillon.
       *
       * ⚠ ET LE SUIVANT DOIT GARDER LE MOIS PROPRE (2026-10-31). Le premier du
       * banc était pris tel quel, sans repasser les contrôles TRANSVERSAUX :
       * répétition de novembre, une écriture refusée, et le remplaçant a
       * ramené « You do not have to… » une seconde fois — un mois livré avec un
       * constat de variété que la sélection avait écarté. Le remplaçant est donc
       * le premier qui laisse le mois prévu sans constat transversal ; s'il n'y
       * en a aucun, le créneau reste vide, et le mois court est refusé (F77).
       */
      const at = spare.findIndex((candidate) => {
        const planned = queue.map((p, i) => (i === index ? candidate : p));
        return checkAcrossPosts({ ...input.context, posts: planned.map(asMonthPost), wanted: input.wanted }).length === 0;
      });
      if (at === -1) continue;
      const [replacement] = spare.splice(at, 1);
      replacements += 1;
      queue[index] = replacement;
      index -= 1;
      continue;
    }

    inserted.push(post);

    /*
     * ── ⚠ LE CRÉDIT SE PREND APRÈS L'ÉCRITURE, ET UN PAR POST ────────────
     *
     * C'est le seul endroit où le quota a un sens. Un refus ici arrête
     * l'écriture — elle n'en a pas acheté plus — et le mois sortira court, ce
     * que `checkCount` refusera.
     */
    const reserved = await ports.credits.reserve({
      userId: input.userId,
      kind: "post_generation",
      reason: `month ${input.month}: ${candidate.topic.title.slice(0, 40)}`,
      month: input.month,
    });
    if (!reserved.ok) {
      creditRefusal = {
        reason: reserved.reason,
        buyable: aPurchaseWouldHelp(reserved.reason),
      };
      break;
    }
    candidate.reservationId = reserved.reservationId;
  }

  /*
   * ⚠ COMPTÉ SUR CE QUI A ÉTÉ ÉCRIT, pas sur ce qui était prévu. Un insert refusé
   * libère son créneau, donc compter les prévisions surestimerait.
   */
  const technical = insertRefused.filter((r) => r.kind === "technical").length;
  const content = insertRefused.length - technical;
  const inserts = { refused: insertRefused, technical, content, replacements, attempted };
  const gate = { arrived: input.prepared.length, passedAlone: clean.length, refused, byCheck };

  /*
   * ══════════════════════════════════════════════════════════════════════
   *  ⚠ F77 — UN MOIS QUI N'ATTEINT PAS SON COMPTE N'EST JAMAIS PUBLIÉ
   * ══════════════════════════════════════════════════════════════════════
   *
   * Novembre 2026 : trente posts sélectionnés, vingt-huit écritures refusées par
   * la base, le banc épuisé, vingt-quatre écrits — et le mois est sorti en
   * `proposed`, `ok: true`. Le commentaire plus haut disait « ce que `checkCount`
   * refusera » ; `checkCount` ne tourne qu'AVANT l'écriture, et personne ne
   * recomptait après.
   *
   * Décidé : refusé, pas livré avec mention. Elle paie trente posts. Ce qui a été
   * écrit est retiré, les réservations ouvertes sont rendues (elles n'ont pas
   * encore d'issue — `settle_credit(…, false)` est la libération légitime), et le
   * constat nomme la cause en séparant les erreurs techniques des refus de contenu.
   */
  if (inserted.length < input.wanted) {
    const shortfall: Finding = {
      check: "count.written",
      detail: shortfallDetail(inserted.length, input.wanted, insertRefused, creditRefusal),
    };
    if (inserted.length > 0) {
      await ports.remove(inserted.map((p) => p.candidate.topic.id));
      for (const post of inserted) {
        const reservationId = post.candidate.reservationId;
        if (reservationId) await ports.credits.settle(reservationId, 0, false);
        post.candidate.reservationId = null;
      }
    }
    return {
      written: 0,
      inserted: [],
      dateCollisions: 0,
      gate,
      selection,
      inserts,
      shortfall,
      funnel: {
        arrived: gate.arrived,
        passedAlone: gate.passedAlone,
        selected: selection.chosen.length,
        attempted,
        written: 0,
      },
      creditRefusal,
    };
  }

  const slots = inserted.map(
    (_, i) => input.dates[i] ?? input.dates[input.dates.length - 1] ?? input.month
  );
  const dateCollisions = slots.length - new Set(slots).size;

  return {
    written: inserted.length,
    inserted,
    dateCollisions,
    gate,
    selection,
    inserts,
    shortfall: null,
    funnel: {
      arrived: gate.arrived,
      passedAlone: gate.passedAlone,
      selected: selection.chosen.length,
      attempted,
      written: inserted.length,
    },
    creditRefusal,
  };
}

/**
 * « 24 posts écrits sur 30 attendus : 28 écritures refusées par la base (erreur
 * technique — « null value in column "archetype"… » ×28) ; 0 refusée pour son
 * contenu ».
 *
 * ⚠ LES DEUX NATURES SONT COMPTÉES À PART, ET LES MESSAGES SONT REGROUPÉS. Un
 * refus de contenu dit quelque chose du texte ; une erreur technique dit quelque
 * chose du code. Les mélanger enverrait relire des posts innocents.
 */
export function shortfallDetail(
  written: number,
  wanted: number,
  refused: InsertRefusal[],
  creditRefusal: { reason: string } | null
): string {
  const group = (kind: InsertRefusal["kind"]) => {
    const counts = new Map<string, number>();
    for (const r of refused.filter((x) => x.kind === kind)) {
      counts.set(r.message, (counts.get(r.message) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([message, n]) => `« ${message} » ×${n}`)
      .join(", ");
  };
  const technical = refused.filter((r) => r.kind === "technical").length;
  const content = refused.length - technical;
  const parts = [
    `${written} posts écrits sur ${wanted} attendus`,
    technical > 0
      ? `${technical} écritures refusées par la base (erreur technique — ${group("technical")})`
      : "aucune erreur technique",
    content > 0
      ? `${content} refusées par la base pour leur contenu (${group("content")})`
      : "aucune refusée pour son contenu",
  ];
  if (creditRefusal) parts.push(`crédit refusé : ${creditRefusal.reason}`);
  return `${parts[0]} : ${parts.slice(1).join(" ; ")}`;
}
