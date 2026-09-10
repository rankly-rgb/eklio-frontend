import Link from "next/link";

import { StartBriefButton } from "@/components/brief/start-brief-button";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * Page publique. Elle ne fait pas partie des huit références : elle en reprend
 * le vocabulaire — blanc chaud, encre, argile, un seul bouton plein — sans
 * inventer de nouveau motif.
 */

const STEPS = [
  "Practice",
  "Positioning",
  "Ideal client",
  "Voice & tone",
  "Palette",
  "Typography",
  "Website",
];

export default function LandingPage() {
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
          <StartBriefButton label="Build my brand" />
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-[880px] flex-col gap-6 px-[var(--gutter)] py-[120px] max-md:px-[var(--gutter-sm)] max-md:py-16">
          <MonoLabel tracking="18">
            For therapists in private practice
          </MonoLabel>
          <h1 className="font-display text-generation font-medium leading-tight tracking-h1 text-pretty max-md:text-question-sm">
            A brand that sounds like the way you actually work.
          </h1>
          {/*
            ⚠ THE COUNT HAS TO SURVIVE THE WALK. This said "Answer a seven-step
            brief. Get three complete directions", which reads as seven screens
            between here and the reveal. The brief is seven steps; after it come
            a review and a positioning screen. Two more is nothing to hide — but
            arriving at them unannounced, on a path sold by its step count, is
            the kind of small lie a nervous audience feels.
          */}
          <p className="max-w-[560px] text-body leading-prose text-ink-2">
            Answer a seven-step brief, check it over, and get three complete
            directions — palette, typefaces, voice and site copy — plus a prompt
            you can paste straight into your website builder.
          </p>
          {/*
            ⚠ THIS USED TO POINT AT `/signup`, AND THAT WAS THE WALL.
            The acquisition walk found that the first click after a cold email
            demanded an email address and a password before a stranger had
            received anything at all — then sent her off to her inbox to
            confirm before she could answer question one.

            It now starts the brief. `StartBriefButton` POSTs to `/api/briefs`,
            which creates an anonymous brief owned by a token in a cookie. The
            account comes later, when she wants to keep what she is looking at.
          */}
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
            <StartBriefButton label="Start my brief" />
            <span className="text-helper text-ink-2">
              About seven minutes. No account needed. One-time from $79.
            </span>
          </div>
        </section>

        <section className="border-t border-line px-[var(--gutter)] py-16 max-md:px-[var(--gutter-sm)]">
          <div className="mx-auto flex max-w-[880px] flex-col gap-8">
            <MonoLabel tracking="18">The brief</MonoLabel>
            <ol className="grid grid-cols-4 gap-x-6 gap-y-4 text-ui max-sm:grid-cols-2">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-baseline gap-3">
                  <MonoLabel tracking="14" tone="ink-3">
                    {String(index + 1).padStart(2, "0")}
                  </MonoLabel>
                  <span className="text-ink">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-[var(--gutter)] py-8 max-md:px-[var(--gutter-sm)]">
        <MonoLabel tracking="14" tone="ink-3">
          {`© ${new Date().getFullYear()} Eklio`}
        </MonoLabel>
      </footer>
    </div>
  );
}
