import {
  checkMonth,
  type Finding,
  type PostUnderCheck,
} from "@/lib/content/month-checks";
import { checkMix, familyOf } from "@/lib/content/month-checks";
import { payloadShape } from "@/lib/compose/archetypes/schema";

const shapeOf = (archetype: string) => {
  try {
    return payloadShape(archetype);
  } catch {
    return null;
  }
};
import type { CompletenessVerdicts } from "@/lib/content/writing-checks";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'ASSEMBLAGE DU MOIS — ÉTAGE D6 DE F45
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Extrait de `scripts/local-render/20-month.ts`, où il était la seule chose qui
 * savait échanger un post refusé. Le chemin produit n'avait rien de tel : le
 * recensement du 2026-09-26 a montré qu'aucun des trente contrôles de mois n'y
 * était appelé.
 *
 * ⚠ IL EST PUR, ET C'EST POURQUOI IL SE PORTE SANS UN APPEL. Il prend des posts
 * déjà écrits et composés, et rend ceux qui partent, ceux qui restent et ce
 * qu'il reproche. Aucune base, aucun réseau, aucun `console`.
 */

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
/**
 * Les dessins rejoués sur l'ordre retenu : `assign` dit le dessin de chaque rang
 * (lexical, sans coût), `apply` recompose les cartes dont le dessin change.
 * `null` : aucun dessin à ce rang, ou une carte qui ne se recompose plus.
 */
export type Redraw<T> = {
  assign: (chosen: T[]) => Array<string | null>;
  apply: (chosen: T[], drawings: Array<string | null>) => Array<T | null>;
};

/**
 * Déplace dans le mois chaque post qu'aucun dessin ne dit à son rang, plutôt que
 * de le jeter.
 *
 * ⚠ L'ORDRE DU MOIS N'EST PAS UN CONTENU. Les dates sont posées après la
 * sélection, et les contrôles de variété comptent sans regarder l'ordre ; seul
 * l'écart des dessins le lit. Répétition locale du 2026-11-01 (décembre) : la
 * monotonie d'écriture avait déjà pris dix échanges au banc, et chaque post
 * « sans dessin à ce rang » en prenait un de plus — le mois est mort sur
 * `illustration.none` avec des posts qui avaient un dessin, ailleurs.
 *
 * Essaie chaque autre rang, du dernier au premier, pour le PREMIER post sans
 * dessin ; recommence tant qu'un déplacement en répare un. Rend l'ordre et ses
 * dessins ; ce qui reste `null` n'a de place nulle part.
 */
export function placeByDrawing<T>(chosen: T[], assign: (posts: T[]) => Array<string | null>): { posts: T[]; drawings: Array<string | null> } {
  let posts = chosen;
  let drawings = assign(posts);
  const tried = new Set<T>();
  for (;;) {
    const at = drawings.findIndex((d, i) => d === null && !tried.has(posts[i]));
    if (at === -1) return { posts, drawings };
    const post = posts[at];
    tried.add(post);
    const rest = [...posts.slice(0, at), ...posts.slice(at + 1)];
    for (let to = rest.length; to >= 0; to -= 1) {
      if (to === at) continue;
      const moved = [...rest.slice(0, to), post, ...rest.slice(to)];
      const trial = assign(moved);
      const before = drawings.filter((d) => d === null).length;
      if (trial[to] !== null && trial.filter((d) => d === null).length < before) {
        posts = moved;
        drawings = trial;
        break;
      }
    }
  }
}

/**
 * L'échange ciblé de `mix.list` (F130) : l'indice du post à liste qui sort et
 * celui du post à phrase du banc qui entre, ou `null` si aucune paire ne laisse
 * le mélange sans nouveau constat (plancher, distincts, carrousels, plafonds).
 * Les remplaçants dans l'ordre du banc ; les sortants du dernier au premier.
 */
export function listSwap(chosen: string[], bench: string[]): [number, number] | null {
  const others = (list: string[]) => checkMix(list).filter((f) => f.check !== "mix.list").map((f) => f.check);
  const before = new Set(others(chosen));
  for (let s = 0; s < bench.length; s += 1) {
    if (shapeOf(bench[s]) !== "phrase") continue;
    for (let out = chosen.length - 1; out >= 0; out -= 1) {
      if (shapeOf(chosen[out]) !== "list") continue;
      const trial = [...chosen.slice(0, out), ...chosen.slice(out + 1), bench[s]];
      if (others(trial).every((c) => before.has(c))) return [out, s];
    }
  }
  return null;
}

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE RYTHME DES FORMATS SUR LA GRILLE (F131, 2026-11-05)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mars 2027 se lisait en trois pavés : neuf carrousels, quatorze piles de
 * blocs, sept phrases seules. Un profil s'ouvre sur une grille de neuf : c'est
 * le rythme des FORMATS que l'œil voit, et rien ne le tenait.
 *
 * Trois formats : carrousel, liste (charge utile en liste), phrase (le reste).
 * Chaque post reçoit une position cible, (k + ½) / n de son format, et le mois
 * est trié sur elle : chaque format est étalé régulièrement sur les trente. Un
 * tri stable, sans hasard — le même mois donne le même ordre. Une permutation,
 * jamais une substitution : aucun post n'entre ni ne sort.
 *
 * Ce que l'étalement tient, et que `formatRhythm` mesure : dans toute fenêtre de
 * neuf, au moins trois formats et aucun au-delà de cinq ; jamais plus de trois
 * d'un même format à la suite. Si la composition du mois le rend impossible (un
 * format au-delà de quinze), l'étalement reste la meilleure répartition, et la
 * mesure le dit.
 */
export type Format = "carousel" | "list" | "phrase";

export function formatOf(archetype: string): Format {
  if (archetype === "carousel") return "carousel";
  return shapeOf(archetype) === "list" ? "list" : "phrase";
}

export function orderByFormat<T>(posts: T[], archetypeOf: (p: T) => string): T[] {
  const byFormat = new Map<Format, number>();
  for (const p of posts) byFormat.set(formatOf(archetypeOf(p)), (byFormat.get(formatOf(archetypeOf(p))) ?? 0) + 1);
  const seen = new Map<Format, number>();
  const ORDER: Format[] = ["carousel", "list", "phrase"];
  return posts
    .map((p, i) => {
      const f = formatOf(archetypeOf(p));
      const k = seen.get(f) ?? 0;
      seen.set(f, k + 1);
      return { p, i, f, at: (k + 0.5) / byFormat.get(f)! };
    })
    .sort((a, b) => a.at - b.at || ORDER.indexOf(a.f) - ORDER.indexOf(b.f) || a.i - b.i)
    .map((x) => x.p);
}

/** La mesure : formats distincts et format le plus présent par fenêtre de neuf, plus longue série. */
export function formatRhythm(formats: Format[], window = 9): { distinct: number[]; maxInWindow: number[]; longestRun: number } {
  const distinct: number[] = [];
  const maxInWindow: number[] = [];
  for (let i = 0; i + window <= formats.length; i += 1) {
    const w = formats.slice(i, i + window);
    distinct.push(new Set(w).size);
    maxInWindow.push(Math.max(...(["carousel", "list", "phrase"] as Format[]).map((f) => w.filter((x) => x === f).length)));
  }
  let longestRun = 0;
  for (let i = 0, run = 0; i < formats.length; i += 1) {
    run = i > 0 && formats[i] === formats[i - 1] ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
  }
  return { distinct, maxInWindow, longestRun };
}

export type Deliverable<T> = { chosen: T[]; remaining: Finding[]; dropped: Array<{ title: string; why: string }> };

/**
 * La projection d'un post préparé vers ce que les contrôles lisent.
 *
 * ── ⚠ ÉCRITE UNE FOIS, PARCE QU'IL Y A MAINTENANT DEUX LECTEURS ─────────
 *
 * Elle vivait dans `selectDeliverable`, qui était le seul endroit où les
 * contrôles tournaient. Le portillon par post la lit aussi, et une projection
 * recopiée est une surface qui se perd d'un côté : la légende et l'alternatif
 * ont déjà manqué UNE fois à cette liste, et c'est le plus gros trou que
 * l'audit du corpus ait trouvé — 341 annonces de disponibilité sur 400
 * légendes, alors que `checkSellsSlots` existait depuis F26.
 */
export function asMonthPost(p: {
  cardLine: string; composeArchetype: string; payload: unknown; svg: string | null;
  eyebrow: string; footer: string; illustration?: string | null;
  candidate: { topic: { title: string; hook?: string | null }; result?: { caption?: string; altText?: string } | null };
}): PostUnderCheck {
  return {
    archetype: p.composeArchetype,
    title: p.candidate.topic.title,
    cardLine: p.cardLine,
    payload: p.payload,
    svg: p.svg ?? undefined,
    eyebrow: p.eyebrow,
    caption: p.candidate.result?.caption ?? undefined,
    hook: p.candidate.topic.hook ?? undefined,
    illustration: p.illustration ?? undefined,
    altText: p.candidate.result?.altText ?? undefined,
    footer: p.footer,
  };
}

export function selectDeliverable<
  T extends { cardLine: string; composeArchetype: string; payload: unknown; svg: string | null;
              eyebrow: string; footer: string;
              candidate: { topic: { title: string }; result?: { caption?: string; altText?: string } | null } }
>(
  prepared: T[], direction: DirectionPalette, wanted: number, practiceName: string,
  allowList: string[],
  /**
   * Le catalogue des intentions, pour le contrôle de surtitre.
   *
   * ⚠ IL VIENT DE LA BASE. Un contrôle qui tirerait la liste des libellés
   * des cartes qu'il surveille les autoriserait toutes.
   */
  intentCatalogue: Array<{ id: string; label: string }>,
  /** La mention de licence exigée sur chaque post. */
  licenceMention: string,
  /** Les modalités du brief, pour le contrôle de sigle (F26). */
  modalities: string[],
  /**
   * Ce qu'un juge a dit des lignes que le lexique n'a pas su trancher.
   *
   * ⚠ CALCULÉ UNE FOIS, AVANT LA SÉLECTION. Le sélecteur boucle : demander le
   * verdict à chaque tour paierait un appel par échange, et l'ensemble des
   * lignes ne change pas — seul le sous-ensemble retenu change.
   */
  completeness: CompletenessVerdicts,
  /**
   * Réattribue les dessins sur l'ORDRE RETENU, et recompose les cartes dont le
   * dessin change. `null` à un rang : aucun dessin ne dit ce post à cette place.
   *
   * ⚠ L'ÉCART DE DIX SE JUGE SUR LE MOIS LIVRÉ, PAS SUR LA RÉSERVE. Les dessins
   * étaient attribués sur les quarante-cinq posts préparés ; le sélecteur en
   * retire et ajoute les remplaçants en fin de mois, et deux dessins séparés
   * de quinze dans la réserve se retrouvaient à neuf dans le mois — la
   * répétition locale du 2026-11-01 a été refusée pour ça (`prot-thorn-branch`).
   */
  redraw?: Redraw<T>
): Deliverable<T> {
  const asPost = asMonthPost;

  let chosen = prepared.slice(0, wanted);
  const bench = prepared.slice(wanted);
  const dropped: Array<{ title: string; why: string }> = [];

  for (;;) {
    /*
     * ⚠ L'ORDRE DES FORMATS AVANT LE REDESSIN (2026-11-05). Le plan des fonds et
     * l'espacement des dessins se calculent sur l'ordre retenu : permuter ici,
     * à chaque tour, les fait recalculer sur l'ordre final au lieu de le casser.
     */
    chosen = orderByFormat(chosen, (p) => p.composeArchetype);
    if (redraw) {
      const placed = placeByDrawing(chosen, redraw.assign);
      chosen = placed.posts;
      const drawn = redraw.apply(chosen, placed.drawings);
      const none = drawn.findIndex((p) => p === null);
      if (none !== -1) {
        const why = `illustration.none — aucun dessin au-dessus du seuil ne dit « ${chosen[none].cardLine} » à ce rang`;
        if (bench.length === 0) {
          return { chosen, remaining: [{ check: "illustration.none", detail: why.slice("illustration.none — ".length) }], dropped };
        }
        dropped.push({ title: chosen[none].cardLine, why });
        chosen = [...chosen.slice(0, none), ...chosen.slice(none + 1), bench.shift()!];
        continue;
      }
      chosen = drawn as T[];
    }
    const findings = checkMonth({
      posts: chosen.map(asPost), direction, practiceName, identityAllowList: allowList,
      modalities, completeness, eyebrowCatalogue: intentCatalogue,
      licenceMention,
      /*
       * ⚠ LE NOMBRE EST UN CONTRÔLE, PAS UNE LIGNE DE RAPPORT. Un mois de
       * quinze posts est sorti « sans constat » le 2026-09-23 : le rapport
       * disait bien « the bank had no more », mais rien ne refusait le mois.
       * Aucun échange ne peut le réparer — s'il manque des posts, le banc est
       * vide par construction — donc le constat sort du premier tour et le
       * mois est refusé, ce qui est le bon verdict.
       */
      wanted,
    });
    if (findings.length === 0) return { chosen, remaining: [], dropped };
    if (bench.length === 0) return { chosen, remaining: findings, dropped };

    /*
     * Quel post retirer : celui que le constat désigne. Un constat de mélange
     * ne nomme pas un post mais un ARCHÉTYPE — on retire alors l'un des siens,
     * le dernier, pour que l'échange change vraiment les proportions.
     */
    const finding = findings[0];
    let victim = -1;

    /*
     * ── ⚠ UN CONSTAT QUE LE BANC NE PEUT PAS RÉPARER ARRÊTE LA BOUCLE ───
     *
     * `mix.carousel` dit qu'il MANQUE un format, pas qu'un post est de trop.
     * Le traiter comme les autres constats de mélange ferait retirer le post
     * le plus représenté et le remplacer par le premier du banc — qui n'est
     * pas un carrousel — puis recommencer, jusqu'à vider le banc en
     * dégradant le mois à chaque tour.
     *
     * S'il reste un carrousel au banc, on échange CONTRE lui. Sinon, le mois
     * est refusé tout de suite : c'est le bon verdict, et il coûte zéro tour.
     */
    if (finding.check === "mix.carousel") {
      const spare = bench.findIndex((p) => p.composeArchetype === "carousel");
      if (spare === -1) return { chosen, remaining: findings, dropped };
      const counts = new Map<string, number>();
      for (const p of chosen) counts.set(p.composeArchetype, (counts.get(p.composeArchetype) ?? 0) + 1);
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const out = chosen.map((p) => p.composeArchetype).lastIndexOf(dominant ?? "");
      if (out === -1) return { chosen, remaining: findings, dropped };
      dropped.push({ title: chosen[out].cardLine, why: `${finding.check} — ${finding.detail}` });
      const [replacement] = bench.splice(spare, 1);
      chosen = [...chosen.slice(0, out), ...chosen.slice(out + 1), replacement];
      continue;
    }

    /*
     * ── ⚠ TROP DE LISTES : UNE LISTE SORT, UNE PHRASE ENTRE (F130, 2026-11-05) ─
     *
     * Traité par la branche générique, `mix.list` retirait le dernier post de
     * l'archétype le plus fréquent — la phrase seule — et prenait le premier du
     * banc, quelle que soit sa forme : février 2027 a été refusé à 16 listes sur
     * 14 avec 25 posts à phrase au banc.
     *
     * L'échange est maintenant ciblé : un post à LISTE sort, un post à PHRASE
     * entre. ⚠ ET IL NE BRISE AUCUN PLANCHER. Chaque paire est essayée sur le
     * mélange (`checkMix`) : elle n'est retenue que si elle ne fait naître aucun
     * autre constat de mélange — plancher de famille, archétypes distincts,
     * carrousels, plafonds par archétype. Si aucune paire ne le permet, le mois
     * est refusé tel quel : on ne corrige pas un constat en en créant un autre.
     */
    if (finding.check === "mix.list") {
      const pair = listSwap(chosen.map((p) => p.composeArchetype), bench.map((p) => p.composeArchetype));
      if (!pair) return { chosen, remaining: findings, dropped };
      const [out, spare] = pair;
      dropped.push({ title: chosen[out].cardLine, why: `${finding.check} — ${finding.detail}` });
      const [replacement] = bench.splice(spare, 1);
      chosen = [...chosen.slice(0, out), ...chosen.slice(out + 1), replacement];
      continue;
    }

    /*
     * ── ⚠ UN PLANCHER DIT QU'IL MANQUE, PAS QU'IL Y EN A DE TROP ────────
     *
     * Même piège que `mix.carousel`, et pour la même raison : traiter un
     * plancher comme les autres constats de mélange ferait retirer le post le
     * plus représenté pour le remplacer par le premier du banc — qui n'est pas
     * de la famille qui manque — puis recommencer, en dégradant le mois à
     * chaque tour jusqu'à vider le banc.
     *
     * On échange donc CONTRE un post de la famille affamée, s'il en reste un.
     * Sinon le mois est refusé tout de suite, ce qui est le bon verdict et
     * coûte zéro tour.
     */
    if (finding.check.startsWith("mix.floor.")) {
      const starved = finding.check.slice("mix.floor.".length);
      const spare = bench.findIndex((p) => familyOf(p.composeArchetype) === starved);
      if (spare === -1) return { chosen, remaining: findings, dropped };
      const counts = new Map<string, number>();
      for (const p of chosen) {
        const family = familyOf(p.composeArchetype);
        if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
      }
      const fattest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const out = chosen.map((p) => familyOf(p.composeArchetype)).lastIndexOf(fattest ?? "");
      if (out === -1) return { chosen, remaining: findings, dropped };
      dropped.push({ title: chosen[out].cardLine, why: `${finding.check} — ${finding.detail}` });
      const [replacement] = bench.splice(spare, 1);
      chosen = [...chosen.slice(0, out), ...chosen.slice(out + 1), replacement];
      continue;
    }

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
