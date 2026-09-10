import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";

/*
 * The one screen for every way a resume link can fail: expired, purged, or
 * already claimed by an account.
 *
 * ⚠ ONE SCREEN FOR ALL THREE, ON PURPOSE. The difference is not something she
 * can act on differently — and telling whoever is holding the link which it
 * was would say something about a brief that may not be theirs.
 *
 * It offers the two real ways forward and does not apologise at length. She
 * came here from an email expecting her work; the useful thing is a way on.
 */
export const metadata = { title: "That link has expired — Eklio" };

export default function ResumeExpiredPage() {
  return (
    <main className="route-enter mx-auto flex min-h-[70vh] w-full max-w-[520px] flex-col justify-center gap-6 px-[var(--gutter-sm)] py-16">
      <MonoLabel tracking="16">Your brief</MonoLabel>

      <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
        That link doesn&rsquo;t work any more.
      </h1>

      <p className="text-body leading-prose text-ink-2">
        Links we email you last 30 days. If you made an account since, your
        brief is already there — sign in and you&rsquo;ll find it waiting.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <ButtonLink href="/login">Sign in</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Start a new brief
        </ButtonLink>
      </div>
    </main>
  );
}
