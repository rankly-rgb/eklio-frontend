import Link from "next/link";

import { BRIEF_STEPS } from "@/lib/brief/steps";
import { MONTHLY_PRESENCE, TIERS } from "@/lib/billing/plans";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-noir/10 px-6 py-5 md:px-12">
        <span className="font-mono text-sm tracking-[0.2em] uppercase">
          Eklio
        </span>
        <nav className="flex items-center gap-6 font-mono text-sm">
          <Link href="/login" className="hover:opacity-60">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-noir px-4 py-2 hover:bg-noir hover:text-cream-light transition-colors"
          >
            Build my brand
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-24 md:px-12 md:py-36">
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-gris-fonce">
            Brand identity — therapists in private practice
          </p>
          <h1 className="font-display text-4xl leading-[1.1] md:text-6xl">
            A brand that sounds like your practice, not like a directory
            listing.
          </h1>
          <p className="max-w-xl text-lg text-gris-fonce">
            Answer a seven-minute guided brief. Get three distinct creative
            directions, a complete brand kit, and finished website copy you can
            paste into Squarespace, Lovable, Framer, or Webflow.
          </p>
          <p className="max-w-xl text-lg text-gris-fonce">
            Every line is written for clinicians: psychoeducation instead of
            promises, no testimonials, credentials stated exactly. Built to
            respect ACA and APA advertising principles.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light hover:bg-gris-fonce transition-colors"
            >
              Build my brand
            </Link>
            <span className="font-mono text-sm text-gris-fonce">
              From {TIERS[0].priceLabel} — one time
            </span>
          </div>
        </section>

        <section className="border-t border-noir/10 bg-cream-light px-6 py-16 md:px-12">
          <div className="mx-auto max-w-4xl">
            <p className="mb-8 font-mono text-sm uppercase tracking-[0.2em] text-gris-fonce">
              The brief
            </p>
            <ol className="grid grid-cols-2 gap-x-6 gap-y-4 font-mono text-sm sm:grid-cols-4">
              {BRIEF_STEPS.map((step, i) => (
                <li key={step.id} className="flex items-baseline gap-2">
                  <span className="text-gris-fonce/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{step.title}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="border-t border-noir/10 px-6 py-16 md:px-12">
          <div className="mx-auto flex max-w-4xl flex-col gap-8">
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-gris-fonce">
              Pricing
            </p>

            <div className="grid gap-6 md:grid-cols-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className="flex flex-col gap-3 rounded-lg border border-noir/15 p-6"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-xl">{tier.name}</span>
                    <span className="font-mono text-lg">{tier.priceLabel}</span>
                  </span>
                  <p className="text-sm text-gris-fonce">{tier.summary}</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {tier.includes.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="text-gris-fonce">
                          —
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="mt-auto font-mono text-xs text-gris-fonce">
                    One-time payment
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-noir/15 bg-cream-light p-6">
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="font-display text-xl">
                  {MONTHLY_PRESENCE.name}
                </span>
                <span className="font-mono text-sm">
                  {MONTHLY_PRESENCE.priceLabelWithInterval}
                </span>
              </span>
              <p className="text-sm text-gris-fonce">
                {MONTHLY_PRESENCE.summary} Cancel anytime.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center gap-4 border-t border-noir/10 px-6 py-8 font-mono text-xs text-gris-fonce md:px-12">
        <span>© {new Date().getFullYear()} Eklio</span>
        <Link href="/terms" className="underline hover:opacity-60">
          Terms
        </Link>
      </footer>
    </div>
  );
}
