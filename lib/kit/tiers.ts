import { z } from "zod";
import { PAGES_WANTED } from "@/lib/brief/schemas";

/*
 * Périmètre du livrable par tier — la couture (« seam ») du gating.
 *
 * Le Lot 3 GÉNÈRE le kit ; le Lot 4 décidera QUI a droit à quoi (pricing,
 * Stripe, Monthly Presence). Ce module existe pour que ce branchement soit un
 * changement d'une ligne côté appelant et non une réécriture de la génération :
 * tout ce qui fait varier le scope du kit est ici, nulle part ailleurs.
 *
 * Concrètement, au Lot 4 :
 * - lire le tier acheté (table de facturation, `generation_credits.has_paid`
 *   ou ce que le lot décidera) au lieu de `DEFAULT_KIT_TIER` ;
 * - passer ce tier à `resolveKitScope()` — rien d'autre ne bouge.
 *
 * Module pur : ni I/O, ni SDK, ni React. Testable seul.
 */

export const KIT_TIERS = ["starter", "practice", "signature"] as const;

export const kitTierSchema = z.enum(KIT_TIERS);

export type KitTier = (typeof KIT_TIERS)[number];

export type PageKey = (typeof PAGES_WANTED)[number];

/*
 * Tier servi tant que le paiement n'est pas branché (Lot 4).
 *
 * Volontairement le plus généreux : pendant que Stripe n'existe pas, dégrader
 * le livrable ne protégerait aucun revenu et donnerait une fausse idée du
 * produit. Le jour où le Lot 4 câble le tier réel, cette constante n'est plus
 * lue que comme repli.
 */
export const DEFAULT_KIT_TIER: KitTier = "signature";

/*
 * Pages retenues quand le praticien n'en a coché aucune à l'étape 7. Un site
 * de cabinet ne tient pas debout sans elles, et générer zéro page serait un
 * livrable vide plutôt qu'un livrable minimal.
 */
const FALLBACK_PAGES: PageKey[] = ["home", "about", "approach", "contact"];

/*
 * Priorité de rabotage quand le tier plafonne le nombre de pages : les
 * premières de cette liste survivent. L'ordre n'est pas alphabétique, il est
 * éditorial — une page « home » sans « contact » ne convertit pas, une page
 * « blog » sans le reste ne sert à rien.
 */
const PAGE_PRIORITY: PageKey[] = [
  "home",
  "about",
  "approach",
  "contact",
  "specialties",
  "fees",
  "faq",
  "blog",
];

type TierRule = {
  label: string;
  /** Plafond de pages du site ; `null` = toutes celles demandées. */
  maxPages: number | null;
  /** Les specs de gabarits sociaux sont un livrable de Practice et au-dessus. */
  includeSocialTemplates: boolean;
};

export const KIT_TIER_RULES: Record<KitTier, TierRule> = {
  starter: { label: "Starter", maxPages: 3, includeSocialTemplates: false },
  practice: { label: "Practice", maxPages: 6, includeSocialTemplates: true },
  signature: { label: "Signature", maxPages: null, includeSocialTemplates: true },
};

export type KitScope = {
  tier: KitTier;
  /** Pages effectivement générées, dans l'ordre éditorial, après plafonnement. */
  pages: PageKey[];
  includeSocialTemplates: boolean;
  /**
   * Pages demandées au brief mais écartées par le plafond du tier. Sert à le
   * DIRE dans l'interface : un livrable rogné en silence se lit comme un bug.
   */
  omittedPages: PageKey[];
};

function isPageKey(value: string): value is PageKey {
  return (PAGES_WANTED as readonly string[]).includes(value);
}

/**
 * Périmètre du kit pour un tier et les pages demandées au brief.
 *
 * Les pages sont dédoublonnées, remises dans l'ordre éditorial, puis coupées
 * au plafond du tier. Ce qui tombe est rendu dans `omittedPages` plutôt que
 * perdu.
 */
export function resolveKitScope(
  tier: KitTier,
  pagesWanted: string[] | undefined
): KitScope {
  const rule = KIT_TIER_RULES[tier];

  const asked = (pagesWanted ?? []).filter(isPageKey);
  const unique = asked.length > 0 ? [...new Set(asked)] : FALLBACK_PAGES;
  const ordered = PAGE_PRIORITY.filter((page) => unique.includes(page));

  const pages =
    rule.maxPages === null ? ordered : ordered.slice(0, rule.maxPages);
  const omittedPages = ordered.filter((page) => !pages.includes(page));

  return {
    tier,
    pages,
    includeSocialTemplates: rule.includeSocialTemplates,
    omittedPages,
  };
}
