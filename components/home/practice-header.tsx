import { MonoLabel } from "@/components/ui/mono-label";
import type { HomeQuote } from "@/lib/data/home";

/*
 * The header row: a mono date, the practice name, a calm sub-line, and — over
 * the middle column — the quote slot.
 *
 * ⚠ WHAT THIS SLOT IS NOT. The mockup puts `Welcome back, Coline 👋` on the
 * serif line. Emoji are out by the voice rules, "Welcome back" is the hype
 * register the product avoids, and the name is data in any case — the mockup
 * says Coline, production says whatever her kit says. The shape stays (mono
 * date over a large serif line); what fills it is the practice name, which is
 * the one thing a header for "your practice this week" has to say.
 */
export function PracticeHeader({
  dateLabel,
  practiceName,
  quote,
}: {
  dateLabel: string;
  practiceName: string;
  /** Her own confirmed positioning line, or `null` — then the slot collapses. */
  quote: HomeQuote | null;
}) {
  return (
    <header className="grid grid-cols-[48fr_26fr] items-start gap-8 max-lg:grid-cols-1 max-lg:gap-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <MonoLabel tracking="16">{dateLabel}</MonoLabel>
        <h1 className="truncate font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
          {practiceName}
        </h1>
        <p className="text-body leading-body text-ink-2">Your practice this week.</p>
      </div>

      {quote ? <HeaderQuote quote={quote} /> : null}
    </header>
  );
}

/*
 * Her sentence, in her own words, labelled with where it came from.
 *
 * The label is the PROVENANCE, never the practice name: `EMBER CONSULTING`
 * under a line she did not write is an attribution, and a false one. This one
 * says which answer of her brief it is quoting, which is checkable.
 */
function HeaderQuote({ quote }: { quote: HomeQuote }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2 justify-self-end max-lg:justify-self-start">
      <blockquote className="text-pretty font-display text-subsection font-normal italic leading-card text-ink">
        &ldquo;{quote.text}&rdquo;
      </blockquote>
      <figcaption>
        <MonoLabel tracking="16" tone="ink-3">
          {quote.provenance}
        </MonoLabel>
      </figcaption>
    </figure>
  );
}
