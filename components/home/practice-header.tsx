import { MonoLabel } from "@/components/ui/mono-label";

/*
 * The header, replacing "Good evening." as a 48px hero.
 *
 * A date line in mono, then the practice name at its own size -- neither one
 * pretending to be the biggest thing on the screen. No greeting, no emoji,
 * never "Welcome back": the practice name says whose brand this is, and the
 * date says when, which is the whole job of a header for a screen titled
 * "your practice this week."
 */
export function PracticeHeader({
  dateLabel,
  practiceName,
}: {
  dateLabel: string;
  practiceName: string;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <MonoLabel tracking="16">{dateLabel}</MonoLabel>
      <p className="truncate font-display text-[28px] font-medium leading-tight tracking-h1 text-ink">
        {practiceName}
      </p>
    </header>
  );
}
