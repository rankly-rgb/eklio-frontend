import type { PositioningPattern, PositioningRule } from "@/lib/catalog/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * LE POSITIONNEMENT — LA SECONDE FAMILLE DE CONSTATS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `lib/check/review.ts` détecte une FAUTE : six motifs, une infraction
 * publicitaire, « à corriger ». Il ne voit rien dans un profil irréprochable —
 * et c'est exactement le profil de la cliente type :
 *
 *   « I hold a PhD from Berkeley and have been licensed in California for
 *     twelve years. »  →  zéro constat déontologique.
 *
 * Ce module détecte l'autre chose : « voilà pourquoi personne ne vous écrit ».
 *
 * ⚠ LES DEUX FAMILLES NE SE MÉLANGENT NULLE PART, ET SURTOUT PAS DANS LA
 * SÉVÉRITÉ. Un `block` déontologique REFUSE une écriture. Un constat de
 * positionnement ne refuse jamais rien : il explique. Les valeurs sont donc
 * disjointes — `block | warn` d'un côté, `costly | minor` de l'autre — et rien
 * ici ne sait produire un `block`.
 *
 * ⚠ AUCUNE RÈGLE DE CONTENU N'EST ÉCRITE ICI. Ce fichier est une MÉCANIQUE :
 * il sait appliquer cinq formes de détection à des règles qui vivent en base
 * (`positioning_rules`, `positioning_patterns`). Une règle s'ajoute par un
 * INSERT, sans déploiement. Si vous cherchez « quelle est la règle », ce n'est
 * pas ce fichier — c'est la table.
 */

/** Les cinq formes. Miroir de `positioning_patterns.kind`, et rien de plus. */
export const POSITIONING_KINDS = [
  "present",
  "absent",
  "absent_in_opening",
  "present_without",
  "length",
] as const;

export type PositioningKind = (typeof POSITIONING_KINDS)[number];

/** Miroir de `positioning_patterns.severity`. Disjoint de la déontologie. */
export type PositioningSeverity = "costly" | "minor";

export type PositioningFinding = {
  ruleId: string;
  patternId: string;
  severity: PositioningSeverity;
  /** Le constat, tel qu'elle le lit. Vient de la base. */
  label: string;
  description: string;
  /** Une ouverture faible, et la même chose autrement. `null` quand la règle n'en donne pas. */
  exampleWeak: string | null;
  exampleStrong: string | null;
  /*
   * ⚠ `null` SUR UNE ABSENCE, ET C'EST LA DIFFÉRENCE QUI COMPTE. Un constat
   * déontologique cite TOUJOURS les mots fautifs, parce qu'une faute est
   * quelque chose de présent. « Vous ne parlez jamais d'elle » n'a aucun mot à
   * citer : l'extrait serait inventé. On rend donc `null`, et `locus` dit ce
   * qui a été regardé.
   */
  excerpt: string | null;
  /** Ce qui a été mesuré : « the first 320 characters », « 703 characters ». */
  locus: string;
};

/**
 * Un motif que ce module N'A PAS SU APPLIQUER.
 *
 * ⚠ IL REMONTE, IL N'EST PAS AVALÉ. Un motif illisible silencieusement ignoré
 * produirait un diagnostic qui a l'air complet et ne l'est pas — la pire des
 * sorties, parce que rien ne la signale. L'appelant décide quoi en faire ;
 * ce module refuse seulement de faire semblant.
 */
export type UnusablePattern = { patternId: string; reason: string };

export type PositioningReview = {
  findings: PositioningFinding[];
  unusable: UnusablePattern[];
};

/*
 * ⚠ POSTGRES ET JAVASCRIPT N'ÉCRIVENT PAS LA MÊME FRONTIÈRE DE MOT.
 * `ethics_patterns` et `positioning_patterns` portent des motifs POSIX, où la
 * frontière de mot est `\y` ; en JavaScript c'est `\b`. Traduire est une ligne,
 * NE PAS traduire est un motif qui ne correspond jamais à rien — encore un
 * constat silencieusement absent.
 *
 * Les autres échappements POSIX qui n'ont pas d'équivalent JS (`\m`, `\M`,
 * `\A`, `\Z`) ne sont PAS traduits approximativement : le motif est déclaré
 * inutilisable et remonte. Une traduction « à peu près » d'une frontière est
 * exactement le genre d'erreur qu'on ne voit qu'en production.
 */
const POSIX_SANS_EQUIVALENT = /\\[mMAZ]/;

export function compilePattern(pattern: string): RegExp | string {
  if (POSIX_SANS_EQUIVALENT.test(pattern)) {
    return "POSIX escape with no JavaScript equivalent (\\m, \\M, \\A or \\Z)";
  }
  try {
    return new RegExp(pattern.replace(/\\y/g, "\\b"), "iu");
  } catch (error) {
    return error instanceof Error ? error.message : "unreadable pattern";
  }
}

function excerptOf(text: string, match: RegExpMatchArray | null): string | null {
  return match?.[0] ?? null;
}

/**
 * Applique les règles de positionnement à un texte. Déterministe, gratuit,
 * aucun appel modèle — comme le scan déontologique, et pour la même raison :
 * ce que le palier gratuit promet de DIRE ne doit rien coûter.
 */
export function reviewPositioning(
  text: string,
  rules: readonly PositioningRule[],
  patterns: readonly PositioningPattern[]
): PositioningReview {
  const parRegle = new Map(rules.filter((rule) => rule.active).map((rule) => [rule.id, rule]));
  const findings: PositioningFinding[] = [];
  const unusable: UnusablePattern[] = [];

  const actifs = [...patterns]
    .filter((pattern) => pattern.active)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const pattern of actifs) {
    const rule = parRegle.get(pattern.rule_id);
    // Une règle inactive désactive ses motifs : une seule chose à basculer.
    if (!rule) continue;

    const base = {
      ruleId: rule.id,
      patternId: pattern.id,
      severity: pattern.severity as PositioningSeverity,
      label: rule.short_label,
      description: rule.description,
      exampleWeak: rule.example_weak,
      exampleStrong: rule.example_strong,
    };

    const compile = (source: string | null, quoi: string): RegExp | null => {
      if (source === null) {
        unusable.push({ patternId: pattern.id, reason: `${quoi} is missing` });
        return null;
      }
      const compiled = compilePattern(source);
      if (typeof compiled === "string") {
        unusable.push({ patternId: pattern.id, reason: compiled });
        return null;
      }
      return compiled;
    };

    switch (pattern.kind as PositioningKind) {
      case "present": {
        const re = compile(pattern.pattern, "pattern");
        if (!re) break;
        const found = text.match(re);
        if (found) {
          findings.push({ ...base, excerpt: excerptOf(text, found), locus: "the whole text" });
        }
        break;
      }

      case "absent": {
        const re = compile(pattern.pattern, "pattern");
        if (!re) break;
        if (!re.test(text)) {
          findings.push({ ...base, excerpt: null, locus: "the whole text" });
        }
        break;
      }

      case "absent_in_opening": {
        const re = compile(pattern.pattern, "pattern");
        if (!re) break;
        const window = pattern.window_chars;
        if (window === null || window <= 0) {
          unusable.push({ patternId: pattern.id, reason: "window_chars is missing" });
          break;
        }
        if (!re.test(text.slice(0, window))) {
          findings.push({
            ...base,
            excerpt: null,
            locus: `the first ${window} characters`,
          });
        }
        break;
      }

      case "present_without": {
        const a = compile(pattern.pattern, "pattern");
        const b = compile(pattern.secondary_pattern, "secondary_pattern");
        if (!a || !b) break;
        const found = text.match(a);
        if (found && !b.test(text)) {
          findings.push({ ...base, excerpt: excerptOf(text, found), locus: "the whole text" });
        }
        break;
      }

      case "length": {
        const { min_chars: min, max_chars: max } = pattern;
        if (min === null && max === null) {
          unusable.push({ patternId: pattern.id, reason: "neither min_chars nor max_chars is set" });
          break;
        }
        const n = text.trim().length;
        if ((min !== null && n < min) || (max !== null && n > max)) {
          findings.push({ ...base, excerpt: null, locus: `${n} characters` });
        }
        break;
      }

      default:
        unusable.push({ patternId: pattern.id, reason: `unknown kind "${pattern.kind}"` });
    }
  }

  return { findings, unusable };
}

/**
 * Les constats, du plus coûteux au moins, puis dans l'ordre des motifs.
 *
 * ⚠ CE TRI N'EST PAS UN ARBITRAGE DE PRODUIT, c'est la définition de `costly`
 * rendue visible : « ceci seul explique plausiblement qu'on ne lui écrive
 * pas ». Montrer un `minor` avant un `costly` contredirait la colonne.
 *
 * Le tri est STABLE, donc l'ordre des motifs (`sort_order`, déjà appliqué par
 * `reviewPositioning`) est conservé à l'intérieur de chaque bande.
 */
export function rankPositioning(
  findings: readonly PositioningFinding[]
): PositioningFinding[] {
  const rang = (f: PositioningFinding) => (f.severity === "costly" ? 0 : 1);
  return [...findings].sort((a, b) => rang(a) - rang(b));
}

/**
 * Ce que le rapport gratuit montre, et combien il replie.
 *
 * ⚠ LE NOMBRE EST UNE DÉCISION DE PRODUIT ET IL VIT EN BASE
 * (`app_settings.first_line_findings_shown`). Dix règles peuvent mordre à la
 * fois sur un profil médiocre, et dix reproches d'un coup humilient au lieu de
 * convaincre — mais QUAND s'arrêter n'est pas une question que le code sait
 * trancher, donc il ne la tranche pas : il lit.
 *
 * ⚠ ET CE QUI EST REPLIÉ EST COMPTÉ. Tronquer en silence serait mentir par
 * omission ; rendre `hidden` laisse l'écran dire « et trois autres » et la
 * lectrice décider.
 */
export function capPositioning(
  findings: readonly PositioningFinding[],
  shown: number
): { shown: PositioningFinding[]; hidden: number } {
  const ordonnes = rankPositioning(findings);
  const n = Math.max(1, Math.trunc(shown));
  return { shown: ordonnes.slice(0, n), hidden: Math.max(0, ordonnes.length - n) };
}
