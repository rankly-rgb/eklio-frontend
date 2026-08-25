import type { Metadata } from "next";
import Link from "next/link";
import {
  formatUsd,
  KIT_PLANS,
  MONTHLY_PRESENCE,
  ORDERED_PLANS,
  RECOMMENDED_TIER,
} from "@/lib/billing/plans";
import { KIT_TIERS, KIT_TIER_RULES, type KitTier } from "@/lib/kit/tiers";

/*
 * Page de tarifs — publique, hors `/app`, donc hors du middleware d'auth.
 *
 * Écrite en anglais : c'est la première page que voit un clinicien américain,
 * et le reste du périmètre facturation l'est aussi. Le ton est celui du
 * produit — posé, factuel, sans urgence ni superlatif. Ce n'est pas qu'une
 * préférence de style : cette page s'adresse à des praticiens tenus à leur
 * propre déontologie publicitaire, et leur vendre avec les tactiques qu'on
 * leur interdit d'employer serait incohérent.
 *
 * Aucun montant n'est écrit en dur ici : tout vient de `lib/billing/plans.ts`,
 * qui sert aussi à créer la session Checkout. Un prix affiché ne peut donc pas
 * diverger du prix facturé.
 */

export const metadata: Metadata = {
  title: "Pricing — Eklio",
  description:
    "One-time pricing for a complete brand kit, plus an optional monthly content subscription. Starter $79, Practice $149, Signature $249.",
};

/** Ce que chaque ligne du comparatif vaut pour un tier donné. */
const COMPARISON: {
  label: string;
  value: (tier: KitTier) => string;
}[] = [
  {
    label: "Creative directions",
    value: () => "3",
  },
  {
    label: "Palette & typefaces",
    value: () => "Included",
  },
  {
    label: "Positioning & brand story",
    value: () => "Included",
  },
  {
    label: "Voice guide",
    value: () => "Included",
  },
  {
    label: "Website copy",
    value: (tier) => {
      const max = KIT_TIER_RULES[tier].maxPages;
      return max === null ? "Every page you ask for" : `${max} pages`;
    },
  },
  {
    label: "Branded social templates",
    value: (tier) => (KIT_TIER_RULES[tier].includeSocialTemplates ? "Included" : "—"),
  },
  {
    label: "Multi-platform website prompt",
    value: () => "Included",
  },
];

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Is this a subscription?",
    answer:
      "The brand kit is a one-time payment. Monthly Presence is the only recurring part, it is optional, and you can cancel it at any time from your account.",
  },
  {
    question: "What happens after I pay?",
    answer:
      "You fill in a guided brief, we generate three creative directions, you pick one, and the full kit is built from it. Payment confirms through our payment provider before the kit unlocks, which usually takes a few seconds.",
  },
  {
    question: "Can I move up a tier later?",
    answer:
      "Yes. Buy the higher tier whenever you want and rebuild your kit — the wider scope applies from that point on. You are never charged the difference twice, and the kit you already have stays as it is until you rebuild it.",
  },
  {
    question: "Is the copy safe to publish as a licensed clinician?",
    answer:
      "Every line we generate is checked against advertising-ethics rules drawn from the ACA Code of Ethics and the APA Ethics Code: psychoeducation only, no outcome promises, no testimonials, no invented credentials. Your license, your state board and your final read still govern what you publish — we say so on every deliverable.",
  },
  {
    question: "Do you write the website itself?",
    answer:
      "We write everything that goes into it, plus one prompt you can paste into Squarespace, Lovable, Framer or Webflow to have the site built around it.",
  },
  {
    question: "What if I cancel Monthly Presence?",
    answer:
      "Your brand kit is yours permanently — it was a one-time purchase. You keep every month of content already generated, and nothing new is generated after the period you have paid for ends.",
  },
];

function PlanCard({ tier }: { tier: KitTier }) {
  const plan = KIT_PLANS[tier];
  const recommended = tier === RECOMMENDED_TIER;

  return (
    <div
      className={`flex flex-col gap-6 rounded border p-6 ${
        recommended
          ? "border-rule-strong bg-accent-tint"
          : "border-rule bg-paper"
      }`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-2xl">{plan.label}</h3>
          {recommended && (
            <span className="label-mono text-ink-muted">Most chosen</span>
          )}
        </div>
        <p className="font-display text-4xl">{formatUsd(plan.amountCents)}</p>
        <p className="font-mono text-xs text-ink-muted">one-time</p>
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">{plan.tagline}</p>

      <ul className="flex flex-col gap-2 text-sm text-ink-soft">
        {plan.highlights.map((highlight) => (
          <li key={highlight} className="flex gap-2">
            <span aria-hidden="true" className="text-ink-muted">
              —
            </span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      <Link
        href={`/signup?plan=${plan.tier}`}
        className={`mt-auto rounded px-5 py-2.5 text-center font-mono text-sm transition-colors ${
          recommended
            ? "bg-ink text-paper hover:bg-ink-soft"
            : "border border-rule hover:bg-paper-raised"
        }`}
      >
        Choose {plan.label}
      </Link>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-rule px-6 py-5 md:px-12">
        <Link href="/" className="label-mono hover:opacity-60">
          Eklio
        </Link>
        <nav className="flex items-center gap-6 font-mono text-sm">
          <Link href="/login" className="hover:opacity-60">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded border border-rule px-4 py-2 transition-colors hover:bg-paper-raised"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-20 md:px-12 md:py-28">
          <p className="label-mono text-ink-muted">Pricing</p>
          <h1 className="max-w-2xl font-display text-4xl leading-[1.1] md:text-5xl">
            One payment for the whole brand. One optional subscription for the
            months after.
          </h1>
          <p className="max-w-xl text-lg text-ink-soft">
            Every tier includes three creative directions, your palette and
            typefaces, your positioning and voice, finished website copy, and a
            prompt that builds the site. The tiers differ in how many pages you
            get written.
          </p>
        </section>

        <section className="border-t border-rule px-6 py-16 md:px-12">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            {ORDERED_PLANS.map((plan) => (
              <PlanCard key={plan.tier} tier={plan.tier} />
            ))}
          </div>
        </section>

        {/* Comparatif — la même source que le gating, donc jamais en décalage. */}
        <section className="border-t border-rule px-6 py-16 md:px-12">
          <div className="mx-auto flex max-w-5xl flex-col gap-8">
            <h2 className="font-display text-3xl">What each tier includes</h2>
            {/*
              La table déborde sous 640px : on la fait défiler dans son propre
              conteneur plutôt que de laisser la page défiler latéralement.
            */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-rule-strong">
                    <th scope="col" className="label-mono py-3 text-left text-ink-muted">
                      &nbsp;
                    </th>
                    {ORDERED_PLANS.map((plan) => (
                      <th
                        key={plan.tier}
                        scope="col"
                        className="label-mono py-3 text-left text-ink-muted"
                      >
                        {plan.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-rule">
                      <th
                        scope="row"
                        className="py-3 pr-4 text-left font-normal text-ink-soft"
                      >
                        {row.label}
                      </th>
                      {KIT_TIERS.map((tier) => (
                        <td key={tier} className="py-3 pr-4 text-ink">
                          {row.value(tier)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th
                      scope="row"
                      className="py-3 pr-4 text-left font-normal text-ink-soft"
                    >
                      Price
                    </th>
                    {ORDERED_PLANS.map((plan) => (
                      <td key={plan.tier} className="py-3 pr-4 font-mono">
                        {formatUsd(plan.amountCents)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Add-on Monthly Presence. */}
        <section className="border-t border-rule px-6 py-16 md:px-12">
          <div className="mx-auto flex max-w-5xl flex-col gap-8 rounded border border-rule bg-paper-raised p-8 md:flex-row md:items-start md:justify-between md:gap-16">
            <div className="flex max-w-xl flex-col gap-4">
              <p className="label-mono text-ink-muted">Add-on</p>
              <h2 className="font-display text-3xl">
                {MONTHLY_PRESENCE.label} ·{" "}
                <span className="whitespace-nowrap">
                  {formatUsd(MONTHLY_PRESENCE.amountCents)}/{MONTHLY_PRESENCE.interval}
                </span>
              </h2>
              <p className="text-base leading-relaxed text-ink-soft">
                {MONTHLY_PRESENCE.tagline} Written from your own kit — your
                palette, your voice, your specialties — and held to the same
                advertising-ethics rules as the rest of your copy.
              </p>
              <p className="font-mono text-xs text-ink-muted">
                {MONTHLY_PRESENCE.defaultOnMicrocopy}
              </p>
            </div>
            <ul className="flex shrink-0 flex-col gap-2 text-sm text-ink-soft">
              {MONTHLY_PRESENCE.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2">
                  <span aria-hidden="true" className="text-ink-muted">
                    —
                  </span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-rule px-6 py-16 md:px-12">
          <div className="mx-auto flex max-w-3xl flex-col gap-8">
            <h2 className="font-display text-3xl">Questions</h2>
            <dl className="flex flex-col">
              {FAQ.map(({ question, answer }) => (
                <div
                  key={question}
                  className="flex flex-col gap-2 border-t border-rule py-6"
                >
                  <dt className="font-medium">{question}</dt>
                  <dd className="max-w-[65ch] leading-relaxed text-ink-soft">
                    {answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule px-6 py-8 font-mono text-xs text-ink-muted md:px-12">
        © {new Date().getFullYear()} Eklio
      </footer>
    </div>
  );
}
