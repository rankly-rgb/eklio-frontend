import {
  checkMonth,
  writtenLinesIn,
  type Finding,
  type PostUnderCheck,
} from "@/lib/content/month-checks";
import { familyOf, FORMAT_FAMILIES } from "@/lib/content/month-checks";
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
  eyebrow: string; footer: string;
  candidate: { topic: { title: string }; result?: { caption?: string; altText?: string } | null };
}): PostUnderCheck {
  return {
    archetype: p.composeArchetype,
    title: p.candidate.topic.title,
    cardLine: p.cardLine,
    payload: p.payload,
    svg: p.svg ?? undefined,
    eyebrow: p.eyebrow,
    caption: p.candidate.result?.caption ?? undefined,
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
  completeness: CompletenessVerdicts
): Deliverable<T> {
  const asPost = asMonthPost;

  let chosen = prepared.slice(0, wanted);
  const bench = prepared.slice(wanted);
  const dropped: Array<{ title: string; why: string }> = [];

  for (;;) {
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
