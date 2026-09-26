import {
  checkEthics,
  hasBlockingViolation,
  type EthicsRuleId,
  type EthicsViolation,
} from "@/lib/ethics/rules";
import { EthicsComplianceError } from "@/lib/ethics/enforce";
import type { EthicsCheck } from "@/lib/brand/shapes";
import type { EthicsRule } from "@/lib/catalog/types";

/*
 * L'Ethics Guard — le garde-fou de NIVEAU 2, étendu (§7).
 *
 * IL ÉTEND, IL NE DOUBLE PAS. Les trois garde-fous existants restent en place
 * et gardent leur rôle :
 *   niveau 1 — `ETHICS_SYSTEM_RULES` injecté dans le prompt (`rules.ts`) ;
 *   niveau 2 — la passe déterministe `checkEthics` (`rules.ts`) ;
 *   niveau 3 — le disclaimer affiché au praticien (`disclaimer.ts`).
 *
 * Ce module ajoute exactement trois choses au niveau 2, et rien d'autre :
 *
 * 1. LES RÈGLES VIENNENT DE LA BASE. `ethics_rules` porte le texte des six
 *    règles ; chaque pattern de `rules.ts` porte l'id de celle qu'il fait
 *    respecter. L'infobulle du badge BOARD-SAFE COPY et le chemin
 *    d'application lisent donc la même source et ne peuvent pas diverger.
 *
 * 2. RÉÉCRITURE CIBLÉE plutôt que régénération complète.
 *    `generateWithEthicsGuard` rejoue TOUTE la génération quand une phrase
 *    dérape — deux minutes de travail perdues pour un mot. Ici on ne réécrit
 *    que le champ fautif, en citant l'extrait et la règle.
 *
 * 3. LE VERDICT EST PERSISTÉ, dans la forme que `brand_kit_ethics_check_valid`
 *    impose : `{ passed, flagged: [{ field, excerpt, rule_id }], checked_at }`.
 *
 * Ce qui NE change pas : rien de bloquant n'est jamais persisté. Réécritures
 * épuisées, on lève — l'écran de révélation dit la panne, il ne publie pas.
 */

export type PublishableField = {
  /** Chemin lisible du champ, repris tel quel dans `ethics_check.flagged`. */
  field: string;
  text: string;
};

/** Une demande de réécriture, telle qu'elle part au modèle. */
export type RewriteRequest = {
  field: string;
  text: string;
  /** Extraits fautifs et la règle correspondante, texte de la base compris. */
  problems: {
    excerpt: string;
    ruleId: EthicsRuleId;
    description: string;
    exampleForbidden: string;
  }[];
};

export type Rewriter = (request: RewriteRequest) => Promise<string>;

export type GuardOutcome = {
  /** Les champs, réécrits là où il le fallait. */
  fields: PublishableField[];
  check: EthicsCheck;
};

const MAX_REWRITES_PER_FIELD = 2;

/**
 * Le bloc de règles à injecter dans un prompt, construit depuis la BASE.
 *
 * Il complète `ETHICS_SYSTEM_RULES` — qui reste le cadrage de fond — avec les
 * six règles exactement telles qu'elles sont affichées au praticien. Quelqu'un
 * qui corrige une règle en base corrige donc aussi ce que le modèle reçoit,
 * sans déploiement.
 */
export function rulesBlock(rules: EthicsRule[]): string {
  if (rules.length === 0) return "";
  return [
    "THE SIX RULES THIS COPY IS CHECKED AGAINST:",
    ...rules.map(
      (rule) =>
        `- ${rule.short_label}: ${rule.description} Never: "${rule.example_forbidden}"`
    ),
  ].join("\n");
}

function describe(
  violations: EthicsViolation[],
  rules: EthicsRule[]
): RewriteRequest["problems"] {
  return violations.map((violation) => {
    const rule = rules.find((entry) => entry.id === violation.ruleId);
    return {
      excerpt: violation.excerpt,
      ruleId: violation.ruleId,
      // Le texte de la base d'abord ; la formulation du pattern en repli, pour
      // qu'une règle absente de la table ne rende pas la consigne muette.
      description: rule?.description ?? violation.reason,
      exampleForbidden: rule?.example_forbidden ?? "",
    };
  });
}

/**
 * Passe déterministe, puis réécriture ciblée des passages signalés.
 *
 * `rewrite` est injecté : la pipeline lui passe un appel modèle, les tests lui
 * passent une fonction pure. Ce module ne connaît pas Anthropic.
 */
export async function enforceEthics(
  fields: PublishableField[],
  rules: EthicsRule[],
  rewrite: Rewriter,
  now: Date = new Date()
): Promise<GuardOutcome> {
  const flagged: EthicsCheck["flagged"] = [];
  const settled: PublishableField[] = [];
  const unresolved: EthicsViolation[] = [];

  for (const field of fields) {
    let text = field.text;
    let violations = checkEthics(text).violations;

    // Tout ce qui est trouvé est CONSIGNÉ, y compris les avertissements et y
    // compris ce qui sera réécrit : le badge doit pouvoir dire ce qui a été
    // rattrapé, pas seulement ce qui restait à la fin.
    for (const violation of violations) {
      flagged.push({
        field: field.field,
        excerpt: violation.excerpt,
        rule_id: violation.ruleId,
      });
    }

    let attempt = 0;
    while (hasBlockingViolation(violations) && attempt < MAX_REWRITES_PER_FIELD) {
      attempt += 1;
      const rewritten = await rewrite({
        field: field.field,
        text,
        problems: describe(
          violations.filter((violation) => violation.severity === "block"),
          rules
        ),
      });

      text = rewritten.trim() || text;
      violations = checkEthics(text).violations;

      for (const violation of violations) {
        flagged.push({
          field: field.field,
          excerpt: violation.excerpt,
          rule_id: violation.ruleId,
        });
      }
    }

    if (hasBlockingViolation(violations)) {
      unresolved.push(...violations.filter((v) => v.severity === "block"));
    }

    settled.push({ field: field.field, text });
  }

  if (unresolved.length > 0) {
    /*
     * On ne persiste RIEN de bloquant. L'appelant marque le job en échec et
     * l'écran de révélation propose « Try again » — le brief est intact.
     */
    console.error(
      `[ethics] ${unresolved.length} violation(s) bloquante(s) après réécriture.`
    );
    throw new EthicsComplianceError(unresolved, MAX_REWRITES_PER_FIELD + 1);
  }

  return {
    fields: settled,
    check: {
      passed: true,
      flagged,
      checked_at: now.toISOString(),
    },
  };
}

/** Réapplique les textes gardés sur l'objet d'origine, par chemin de champ. */
export function fieldMap(fields: PublishableField[]): Map<string, string> {
  return new Map(fields.map((field) => [field.field, field.text]));
}
