import Link from "next/link";

import { BRIEF_STEPS } from "@/lib/brief/steps";

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
              From $79 — one time
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
