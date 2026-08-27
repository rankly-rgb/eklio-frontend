import { z } from "zod";
/*
 * Les pages qu'un kit peut livrer.
 *
 * Pas d'entrée `testimonials`, volontairement : la sollicitation de
 * témoignages clients est interdite aux praticiens licenciés (ACA C.3.a,
 * APA 5.05). Ce sont les diplômes, formations, publications et affiliations
 * qui en tiennent lieu.
 */
export const PAGES_WANTED = [
  "home",
  "about",
  "approach",
  "specialties",
  "fees",
  "faq",
  "contact",
  "blog",
] as const;

/*
 * Périmètre du livrable par tier — la couture (« seam ») du gating.
 *
 * Le Lot 3 GÉNÈRE le kit ; le Lot 4 BRANCHE qui a droit à quoi. La couture a
 * tenu sa promesse : le branchement s'est fait chez l'appelant
 * (`app/app/projets/[id]/kit/actions.ts` lit maintenant le tier acheté via
 * `resolveEntitledTier`), et pas une ligne de la génération n'a bougé. Tout ce
 * qui fait varier le scope du kit est toujours ici, nulle part ailleurs.
 *
 * Trois valeurs de tier circulent, et elles ne veulent pas dire la même chose :
 * - le tier ACHETÉ, dans `purchases` — le droit courant (`lib/billing`) ;
 * - le tier LIVRÉ, dans `brand_kits.tier` — l'instantané de ce qui a été
 *   généré, qui reste vrai même si le praticien monte en gamme ensuite ;
 * - le tier de ce module, qui n'est qu'un paramètre de `resolveKitScope()`.
 *
 * Module pur : ni I/O, ni SDK, ni React. Testable seul.
 */

export const KIT_TIERS = ["starter", "practice", "signature"] as const;

export const kitTierSchema = z.enum(KIT_TIERS);

export type KitTier = (typeof KIT_TIERS)[number];

export type PageKey = (typeof PAGES_WANTED)[number];

/*
 * Repli quand `brand_kits.tier` porte une valeur que le front ne connaît pas.
 *
 * Le plus PETIT des tiers, à l'inverse de ce que servait le Lot 3 : depuis que
 * le paiement existe, une valeur inattendue ne doit jamais ouvrir le livrable
 * le plus complet. Ce n'est PAS une porte d'entrée — aucune génération ne part
 * de cette constante, elles partent toutes d'un achat payé (cf.
 * `lib/billing/entitlements.ts`). Elle ne sert qu'à RELIRE un kit déjà livré.
 */
export const FALLBACK_KIT_TIER: KitTier = "starter";

/**
 * Relit une valeur de tier venue de la base (`brand_kits.tier`,
 * `purchases.tier`) ou des métadonnées Stripe.
 *
 * Ces colonnes sont des `text` contraints par un CHECK, pas des enums
 * Postgres : le type généré les rend en `string`, et c'est ici que la chaîne
 * redevient un `KitTier`. Rend `null` sur l'inconnu — à l'appelant de décider
 * si ça vaut un repli (lecture) ou un refus (facturation).
 */
export function parseKitTier(value: string | null | undefined): KitTier | null {
  return (KIT_TIERS as readonly string[]).includes(value ?? "")
    ? (value as KitTier)
    : null;
}

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
