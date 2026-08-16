import type { KitScope } from "@/lib/ai/kit";

/**
 * Pricing. USD everywhere — there is no other currency in this product.
 *
 * Amounts are in cents because that is what Stripe speaks; `priceLabel` is the
 * only string the UI should ever render, so a price can never be formatted two
 * different ways on two different screens.
 */

export type TierId = "starter" | "practice" | "signature";

export type Tier = {
  id: TierId;
  name: string;
  amountCents: number;
  priceLabel: string;
  summary: string;
  includes: string[];
  /** Env var holding this tier's Stripe Price id. */
  priceEnvVar: string;
  /** Deliverable scope this tier buys. */
  scope: {
    /** Cap on website pages, or null for every page the brief requested. */
    maxPages: number | null;
    socialTemplates: boolean;
    seoStructure: boolean;
    humanReview: boolean;
  };
};

export const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    amountCents: 7900,
    priceLabel: "$79",
    summary: "The full identity, and enough of a site to open with.",
    includes: [
      "Three creative directions",
      "Full brand identity: palette and typography",
      "Base website copy for up to 3 pages",
      "The site-builder prompt",
    ],
    priceEnvVar: "STRIPE_PRICE_STARTER",
    scope: {
      maxPages: 3,
      socialTemplates: false,
      seoStructure: false,
      humanReview: false,
    },
  },
  {
    id: "practice",
    name: "Practice",
    amountCents: 14900,
    priceLabel: "$149",
    summary: "Every page you asked for, plus the pieces that carry the brand.",
    includes: [
      "Everything in Starter",
      "Copy for every page in your brief",
      "Branded social templates",
      "SEO structure",
    ],
    priceEnvVar: "STRIPE_PRICE_PRACTICE",
    scope: {
      maxPages: null,
      socialTemplates: true,
      seoStructure: true,
      humanReview: false,
    },
  },
  {
    id: "signature",
    name: "Signature",
    amountCents: 24900,
    priceLabel: "$249",
    summary: "A person reads every line before you publish it.",
    includes: [
      "Everything in Practice",
      "Human review of your full kit",
      "Launch support",
    ],
    priceEnvVar: "STRIPE_PRICE_SIGNATURE",
    scope: {
      maxPages: null,
      socialTemplates: true,
      seoStructure: true,
      humanReview: true,
    },
  },
];

export const MONTHLY_PRESENCE = {
  id: "monthly_presence" as const,
  name: "Monthly Presence",
  amountCents: 3900,
  priceLabel: "$39",
  interval: "month" as const,
  priceLabelWithInterval: "$39/mo",
  summary:
    "12 social posts, 4 stories, and a monthly editorial calendar, in your palette and your voice.",
  /**
   * Honest microcopy for the default-checked add-on. It says plainly that we
   * ticked the box and that keeping it is a decision the practitioner makes —
   * a dark pattern here would be both wrong and, for this audience, a poor
   * trade against the trust the product is selling.
   */
  addOnMicrocopy:
    "Added by default — keep it only if it earns its place. Cancel anytime.",
  priceEnvVar: "STRIPE_PRICE_MONTHLY_PRESENCE",
} as const;

export function getTier(id: string): Tier | undefined {
  return TIERS.find((tier) => tier.id === id);
}

/**
 * Turns a purchased tier plus the pages the practitioner asked for into the
 * scope the kit generator is allowed to produce.
 *
 * Starter's page cap takes the first N requested pages in the brief's own
 * order, so the practitioner gets Home before FAQ rather than an arbitrary cut.
 */
export function kitScopeForTier(
  tier: Tier,
  requestedPages: string[]
): KitScope {
  const pages =
    tier.scope.maxPages === null
      ? requestedPages
      : requestedPages.slice(0, tier.scope.maxPages);

  return {
    pages,
    includeSocialTemplates: tier.scope.socialTemplates,
  };
}
