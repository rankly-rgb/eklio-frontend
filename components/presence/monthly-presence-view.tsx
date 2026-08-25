import { CopyButton } from "@/components/kit/copy-button";
import { EthicsDisclaimer } from "@/components/ethics-disclaimer";
import { weekdayOf } from "@/lib/presence/month";
import type { MonthlyPresence } from "@/lib/presence/content";

/*
 * Le mois tel que le praticien le lit, le copie et le publie.
 *
 * Composant serveur : la seule interactivité est la copie au presse-papiers et
 * le dépliage des posts, confié à `<details>` natif — rien à hydrater, et tout
 * reste ouvrable sans JavaScript. Mêmes conventions que la page de kit.
 *
 * Le disclaimer déontologique ferme le document, comme sur tout livrable
 * publiable. Il n'est pas optionnel : c'est le garde-fou de niveau 3, et ce
 * livrable-ci part en ligne douze fois par mois.
 */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-rule pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="label-mono text-ink-muted">{title}</h2>
        {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      {text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph !== "")
        .map((paragraph, index) => (
          <p key={index} className="whitespace-pre-wrap leading-relaxed">
            {paragraph}
          </p>
        ))}
    </div>
  );
}

export function MonthlyPresenceView({
  month,
  monthLabel,
  content,
}: {
  month: string;
  monthLabel: string;
  content: MonthlyPresence;
}) {
  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.08em] text-ink-muted">
          Monthly Presence · {monthLabel}
        </p>
        <h1 className="font-display text-[40px] leading-tight">
          Your month, written.
        </h1>
        <div className="max-w-[65ch] text-lg leading-relaxed text-ink-soft">
          <Prose text={content.month_focus} />
        </div>
      </header>

      <Section
        title="Editorial calendar"
        hint="What goes out, and when. Two or three publishing days a week, spread so you're never posting twice in a row."
      >
        <ol className="flex flex-col">
          {content.calendar.map((entry) => (
            <li
              key={`${entry.day}-${entry.publish}`}
              className="flex gap-4 border-b border-rule py-3 last:border-b-0"
            >
              <span className="w-28 shrink-0 font-mono text-xs text-ink-muted">
                {String(entry.day).padStart(2, "0")} ·{" "}
                {weekdayOf(month, entry.day).slice(0, 3)}
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-medium">{entry.publish}</span>
                <span className="text-sm text-ink-muted">{entry.note}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title={`Posts · ${content.posts.length}`}
        hint="Each one is finished copy. Open a post to read it, then copy it as it is."
      >
        <div className="flex flex-col gap-3">
          {content.posts.map((post, index) => (
            <details
              key={`${index}-${post.title}`}
              className="group border border-rule bg-paper-raised"
            >
              <summary className="flex cursor-pointer flex-col gap-1 px-5 py-4">
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-ink-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{post.title}</span>
                </span>
                <span className="pl-8 text-sm text-ink-soft">{post.hook}</span>
              </summary>
              <div className="flex flex-col gap-4 border-t border-rule px-5 py-5">
                <div className="max-w-[65ch] text-ink-soft">
                  <Prose text={post.caption} />
                </div>
                <p className="text-sm text-ink-muted">
                  <span className="label-mono">Teaches</span> — {post.teaches}
                </p>
                <CopyButton value={post.caption} label="Copy this post" />
              </div>
            </details>
          ))}
        </div>
      </Section>

      <Section
        title={`Stories · ${content.stories.length}`}
        hint="Lighter and more immediate. Each says what to show and what words go on screen."
      >
        <div className="flex flex-col gap-4">
          {content.stories.map((story, index) => (
            <div
              key={`${index}-${story.title}`}
              className="flex flex-col gap-2 border border-rule px-5 py-4"
            >
              <p className="font-medium">{story.title}</p>
              <div className="max-w-[65ch] text-sm text-ink-soft">
                <Prose text={story.prompt} />
              </div>
              <p className="text-sm text-ink-muted">{story.purpose}</p>
              <CopyButton value={story.prompt} label="Copy this story" />
            </div>
          ))}
        </div>
      </Section>

      <EthicsDisclaimer />
    </article>
  );
}
