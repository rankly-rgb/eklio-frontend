import { callRewrite } from "@/lib/generation/model";
import { rulesBlock } from "@/lib/ethics/guard";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { reviewText, type CheckFinding } from "@/lib/check/review";
import type { Degree, EthicsRule, LicenseType } from "@/lib/catalog/types";
import type { CheckRewriter } from "@/lib/check/rewrite";
import {
  reviewPositioning,
  type PositioningFinding,
  type UnusablePattern,
} from "@/lib/positioning/review";
import type { PositioningPattern, PositioningRule } from "@/lib/catalog/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * THE FIRST LINE — le palier gratuit, réduit à ce qui existe
 * ══════════════════════════════════════════════════════════════════════════
 *
 * « Collez votre profil Psychology Today actuel. On vous dit ce qui ne va pas,
 *   et on réécrit votre premier paragraphe. »
 *
 * Deux morceaux, pas quatre. L'audit de couverture et le relevé des chiffres
 * d'annuaire N'EXISTENT PAS et ne sont pas simulés ici : aucune source de
 * données des deux dépôts ne les porte — zéro intégration SERP, zéro annuaire,
 * zéro comparatif. Les inventer serait la seule chose pire que ne pas les
 * livrer.
 *
 * ── POURQUOI CE FICHIER EXISTE PLUTÔT QU'UN PARAMÈTRE SUR `rewrite.ts` ──
 *
 * `rewriteAndRescan` répare une INFRACTION : elle ne part au modèle que s'il y
 * a une violation bloquante, et son invite dit « change le moins possible ».
 * C'est juste pour ce qu'elle fait, et c'est l'inverse de ce qu'on vend ici.
 *
 *   `rewriteAndRescan`  un texte fautif → le même texte, sans la faute
 *   `rewriteFirstLine`  un texte correct mais fermé → un texte qui ouvre
 *
 * ⚠ ET LA DIFFÉRENCE EST OBSERVABLE, PAS COSMÉTIQUE. Un profil impeccable qui
 * ouvre sur « I hold a PhD from Berkeley and am licensed in California » ne
 * déclenche AUCUNE des six règles. `rewriteAndRescan` lui rendrait
 * `attempts: 0, unchanged: true` — c'est-à-dire rien. C'est exactement la
 * cliente qu'on veut servir, et l'ancienne fonction ne la voit pas.
 */

/**
 * ⚠ LONGUEUR CIBLE — VALEUR PROVISOIRE, À CHANGER ICI ET NULLE PART AILLEURS.
 *
 * Ce que Psychology Today affiche réellement dans ses RÉSULTATS DE RECHERCHE
 * n'a pas été vérifié : personne ne l'a mesuré, et cet environnement ne peut
 * pas atteindre le site (le proxy de sortie refuse tout HTTPS). 320 est donc un
 * nombre choisi pour être plausible et FAUX JUSQU'À PREUVE — de l'ordre de deux
 * à trois phrases, ce qu'un extrait de résultat de recherche tronque
 * habituellement.
 *
 * Elle est passée au modèle comme une CIBLE, pas comme une contrainte dure : on
 * ne coupe pas une phrase en deux pour tenir un nombre qu'on n'a pas vérifié.
 * `first-line.test.ts` épingle la valeur, donc la changer est un acte visible
 * dans un diff plutôt qu'une dérive.
 */
export const FIRST_LINE_TARGET_CHARS = 320;

/** Au plus une reprise : deux appels modèle, jamais une boucle. */
export const FIRST_LINE_MAX_ATTEMPTS = 2;

const FIRST_LINE_SYSTEM = `You rewrite the opening paragraph of a licensed therapist's public directory profile (Psychology Today or similar), in the United States.

What is wrong with most of them, and what you are fixing:
- They open with the therapist: her degrees, her licence, her years of experience, her training.
- Someone reading a directory is not looking for a CV. She is looking for someone who already understands what is happening to her.

So: OPEN ON THE READER'S PROBLEM, in her own words, as she would describe it to a friend. The therapist's training, approach and credentials may follow, but they do not lead.

Rules, without exception:
- Never introduce a fact, name, credential, licence, degree, number, modality or claim that is not already in the text. If she did not say she is an LCSW, you may not write it.
- Never promise an outcome, a cure, or a result. No "you will heal", no "I can help you overcome". Describing what a person experiences is allowed; promising what happens next is not.
- No testimonials, no client stories, no diagnosis of the reader.
- Keep her voice and her facts. If she writes plainly, stay plain. Do not make it sound like marketing.
- American English. No exclamation marks, no hype words, no emoji.
- Reply with the rewritten paragraph only — no quotes, no explanation, no preamble, no list of what you changed.`;

function instructionFor(text: string, findings: CheckFinding[], targetChars: number): string {
  return [
    `Rewrite the opening paragraph below so it opens on the reader's problem rather than on the therapist's credentials.`,
    "",
    `Aim for about ${targetChars} characters — roughly two or three sentences. This is a target, not a hard limit: finish your sentences rather than cutting one in half to hit the number.`,
    ...(findings.length > 0
      ? [
          "",
          "It also breaks these advertising rules, and the rewrite must not:",
          ...findings.map(
            (finding) =>
              `- ${finding.label}: ${finding.description}` +
              (finding.exampleForbidden ? ` Never: "${finding.exampleForbidden}"` : "") +
              `\n  The words that broke it: "${finding.excerpt}"`
          ),
        ]
      : []),
    "",
    "TEXT:",
    text,
  ].join("\n");
}

/**
 * Un credential que le modèle a AJOUTÉ, c'est-à-dire présent dans le texte
 * rendu et absent du sien.
 *
 * ⚠ POURQUOI CE N'EST PAS `project_state_is_sellable` QUI GARDE ICI, et
 * pourquoi l'appeler serait une garde pour rien. Ce chemin n'a ni projet, ni
 * brief, ni État : elle colle un texte, c'est tout. Or `state_is_sellable`
 * rend VRAI pour un État vide — c'est une décision écrite
 * (`20260915101137`) : aucune juridiction revendiquée, donc aucun couple à
 * vérifier. L'appeler ici rendrait donc `true` à tous les coups et donnerait
 * l'apparence d'une vérification là où il n'y en a aucune. Une garde qui ne
 * peut pas refuser est pire que pas de garde : elle rassure.
 *
 * La question à laquelle on PEUT répondre sans État est différente, et c'est
 * celle qui compte : est-ce que NOUS avons écrit un titre d'exercice ? Un
 * titre qu'elle a publié elle-même sur un annuaire public la concerne et nous
 * le laissons ; un titre que le modèle a inventé est un credential faux, dans
 * une juridiction que nous ne connaissons même pas. Le second est refusé.
 */
export function introducedCredentials(
  before: string,
  after: string,
  licenseTypes: readonly Pick<LicenseType, "label" | "description">[],
  degrees: readonly Pick<Degree, "label">[] = []
): string[] {
  const termes = [
    ...licenseTypes.flatMap((type) => [type.label, type.description]),
    ...degrees.map((degree) => degree.label),
  ].filter((terme): terme is string => typeof terme === "string" && terme.trim().length > 0);

  const present = (haystack: string, terme: string) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(terme)}($|[^\\p{L}\\p{N}])`, "iu").test(haystack);

  return [...new Set(termes)]
    .filter((terme) => present(after, terme) && !present(before, terme))
    .sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type FirstLineOutcome = {
  /** Ce que SON texte déclenche en DÉONTOLOGIE. Rendu même si la réécriture échoue. */
  before: CheckFinding[];
  /*
   * ⚠ LA SECONDE FAMILLE, À CÔTÉ ET JAMAIS MÉLANGÉE. Ce sont les constats de
   * POSITIONNEMENT sur son texte à elle. Ils ne bloquent RIEN : ni la
   * réécriture, ni le rendu, ni quoi que ce soit. Une faute déontologique est
   * « à corriger » ; ceci est « voilà pourquoi personne ne vous écrit », et on
   * ne refuse pas un texte parce qu'il est fade.
   *
   * ⚠ ET C'EST LA MOITIÉ QUI MANQUAIT. Sans elle, un profil irréprochable et
   * générique recevait « rien » — la réponse la plus inutile possible à celle
   * qui en a le plus besoin.
   */
  positioning: PositioningFinding[];
  /** Les motifs que le lecteur n'a pas su appliquer. Remontent, jamais avalés. */
  positioningUnusable: UnusablePattern[];
  /** Le paragraphe réécrit, ou `null` quand on a refusé de le rendre. */
  rewritten: string | null;
  /** Ce que le texte RENDU déclenche. Toujours mesuré, jamais supposé. */
  after: CheckFinding[];
  attempts: number;
  /** Vrai quand le texte rendu ne déclenche rien de bloquant. Jamais « conforme ». */
  resolved: boolean;
  /** Pourquoi rien n'est rendu, le cas échéant. */
  refusal: "ethics" | "credential_introduced" | "empty" | null;
  /** Les titres que le modèle a ajoutés, quand c'est la cause du refus. */
  introduced: string[];
};

/**
 * Réécrit le premier paragraphe, puis repasse le résultat par le scanner ET
 * par la garde de credential. Les deux, toujours, sur le texte réellement
 * rendu.
 */
export async function rewriteFirstLine(
  text: string,
  rules: EthicsRule[],
  licenseTypes: readonly Pick<LicenseType, "label" | "description">[],
  degrees: readonly Pick<Degree, "label">[] = [],
  rewrite: CheckRewriter = callRewrite,
  targetChars: number = FIRST_LINE_TARGET_CHARS,
  maxAttempts: number = FIRST_LINE_MAX_ATTEMPTS,
  positioningRules: readonly PositioningRule[] = [],
  positioningPatterns: readonly PositioningPattern[] = []
): Promise<FirstLineOutcome> {
  const before = reviewText(text, rules).findings;
  /*
   * Sur SON texte, pas sur la réécriture : le constat porte sur ce qu'elle a
   * publié, et il reste vrai quoi qu'il advienne de la réécriture.
   */
  const pos = reviewPositioning(text, positioningRules, positioningPatterns);

  const system = [FIRST_LINE_SYSTEM, "", ETHICS_SYSTEM_RULES, "", rulesBlock(rules)]
    .join("\n")
    .trim();

  let attempts = 0;
  let produced = "";
  let findings: CheckFinding[] = [];
  let introduced: string[] = [];

  while (attempts < maxAttempts) {
    attempts += 1;

    const problems = (attempts === 1 ? before : findings).filter(
      (finding) => finding.severity === "block"
    );
    const candidate = (await rewrite(system, instructionFor(text, problems, targetChars))).trim();

    // Une réponse vide n'est pas une réécriture.
    if (candidate.length === 0) continue;

    produced = candidate;
    findings = reviewText(produced, rules).findings;
    introduced = introducedCredentials(text, produced, licenseTypes, degrees);

    if (!findings.some((finding) => finding.severity === "block") && introduced.length === 0) {
      return {
        before,
        positioning: pos.findings,
        positioningUnusable: pos.unusable,
        rewritten: produced,
        after: findings,
        attempts,
        resolved: true,
        refusal: null,
        introduced: [],
      };
    }
  }

  /*
   * ⚠ ON NE REND PAS UN TEXTE QU'ON VIENT DE JUGER MAUVAIS. `rewriteAndRescan`
   * rend le sien avec `resolved: false`, et c'est juste là-bas : la cliente a
   * payé, elle voit les deux et tranche. Ici elle n'a rien demandé d'autre
   * qu'un exemple, et lui tendre une réécriture qui invente un titre ou
   * promet un résultat serait lui faire courir NOTRE risque. Ce qu'elle
   * reçoit alors est le diagnostic — qui, lui, est vrai — et la raison.
   */
  const cause: FirstLineOutcome["refusal"] =
    produced.length === 0
      ? "empty"
      : introduced.length > 0
        ? "credential_introduced"
        : "ethics";

  return {
    before,
    positioning: pos.findings,
    positioningUnusable: pos.unusable,
    rewritten: null,
    after: findings,
    attempts,
    resolved: false,
    refusal: cause,
    introduced,
  };
}
