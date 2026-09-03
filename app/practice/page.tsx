import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { SeatCalculator } from "@/components/practice/seat-calculator";
import { createAdminClient } from "@/lib/supabase/server";
import { loadPracticeSeatsPlan } from "@/lib/data/practice-plan";

/*
 * Lot I — the practice landing page. Public, not flag-gated, reusing the
 * same chrome and vocabulary as app/page.tsx (the solo landing page) —
 * warm white, ink, clay, one filled button, no second design system.
 *
 * The comparison this page argues from is a directory subscription, not
 * a design tool: a practice already pays per clinician to be a line in a
 * list (Psychology Today and the like). The purchase trigger is a
 * clinician starting Monday with no caseload, not a rebrand — the hero
 * and the primary CTA say so directly.
 */

export const metadata: Metadata = {
  title: "Eklio for practices",
  description:
    "A page for every clinician on your team, live the day they start — priced per seat, not per rebrand.",
};

// Reads plans via the admin client (createAdminClient — no cookies(), so
// Next has no other signal to avoid statically prerendering this page at
// build time, which would call Supabase before any request exists).
export const dynamic = "force-dynamic";

export default async function PracticeLandingPage() {
  const admin = createAdminClient();
  const plan = await loadPracticeSeatsPlan(admin);

  return (
    <div className="route-enter flex min-h-full flex-col">
      <header className="flex h-[var(--header-h)] flex-none items-center gap-12 border-b border-line px-[var(--gutter)] max-md:px-[var(--gutter-sm)]">
        <Link
          href="/"
          className="font-display text-wordmark font-semibold tracking-wordmark text-ink"
        >
          Eklio
        </Link>
        <div className="flex-1" />
        <nav className="flex items-center gap-8 text-ui">
          <Link href="/pricing" className="text-ink-2 hover:text-ink">
            Pricing
          </Link>
          <Link href="/login" className="text-ink-2 hover:text-ink">
            Sign in
          </Link>
          <ButtonLink href="/signup" variant="primary">
            Get started
          </ButtonLink>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-[880px] flex-col gap-6 px-[var(--gutter)] py-[120px] max-md:px-[var(--gutter-sm)] max-md:py-16">
          <MonoLabel tracking="18">For group practices</MonoLabel>
          <h1 className="font-display text-generation font-medium leading-tight tracking-h1 text-pretty max-md:text-question-sm">
            A clinician starts Monday with no caseload. She needs a page
            that day, not a rebrand.
          </h1>
          <p className="max-w-[560px] text-body leading-prose text-ink-2">
            Every clinician you bring on gets her own page — her modalities,
            her licensed states, who she works with, in her own words —
            live the day she accepts your invite. Your practice's look and
            colors carry over automatically. Nobody waits on a designer.
          </p>
          <div className="mt-2 flex items-center gap-6">
            <ButtonLink href="/signup" variant="primary">
              Get started
            </ButtonLink>
            <span className="text-helper text-ink-2">
              No credit card to start. Add seats as you grow the team.
            </span>
          </div>
        </section>

        <section className="border-t border-line px-[var(--gutter)] py-16 max-md:px-[var(--gutter-sm)]">
          <div className="mx-auto flex max-w-[880px] flex-col gap-8">
            <MonoLabel tracking="18">The comparison that matters</MonoLabel>
            <p className="max-w-[640px] text-body leading-prose text-ink-2">
              Your practice already pays, per clinician, to be a line in a
              directory listing — a name, a photo, a paragraph, buried
              between a hundred others in the same city. Eklio is the
              opposite: a page your practice owns, that reads as written by
              the clinician on it, findable on its own — not a listing you
              rent space in.
            </p>
            <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
              <div className="rounded-card border border-line p-6">
                <MonoLabel tracking="16" tone="ink-3">
                  A directory listing
                </MonoLabel>
                <ul className="mt-4 flex flex-col gap-2 text-ui text-ink-2">
                  <li>Priced per clinician, every month, indefinitely</li>
                  <li>A profile inside someone else's site</li>
                  <li>Reads like every other listing on the page</li>
                </ul>
              </div>
              <div className="rounded-card border border-accent bg-card p-6">
                <MonoLabel tracking="16" tone="accent">
                  A page on your practice's site
                </MonoLabel>
                <ul className="mt-4 flex flex-col gap-2 text-ui text-ink">
                  <li>Priced per clinician, on your own site</li>
                  <li>Your practice's brand, applied automatically</li>
                  <li>Her own words — modalities, states, who she sees</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {plan ? (
          <section className="border-t border-line px-[var(--gutter)] py-16 max-md:px-[var(--gutter-sm)]">
            <div className="mx-auto flex max-w-[560px] flex-col gap-6">
              <MonoLabel tracking="18">What it costs</MonoLabel>
              <SeatCalculator plan={plan} />
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-line px-[var(--gutter)] py-8 max-md:px-[var(--gutter-sm)]">
        <MonoLabel tracking="14" tone="ink-3">
          {`© ${new Date().getFullYear()} Eklio`}
        </MonoLabel>
      </footer>
    </div>
  );
}
