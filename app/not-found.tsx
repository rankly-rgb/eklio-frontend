import { ButtonLink } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";

export default function NotFound() {
  return (
    <main className="route-enter mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center gap-5 px-[var(--gutter-sm)] py-24">
      <MonoLabel tracking="18">404</MonoLabel>
      <h1 className="font-display text-question font-medium leading-tight tracking-h1">
        This page doesn&rsquo;t exist.
      </h1>
      <p className="text-helper leading-prose text-ink-2">
        The link may be wrong, or this content may not be yours.
      </p>
      <ButtonLink href="/app" variant="secondary" className="mt-2 self-start">
        Back to your brand
      </ButtonLink>
    </main>
  );
}
