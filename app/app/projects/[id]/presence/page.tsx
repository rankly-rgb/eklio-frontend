import Link from "next/link";
import { redirect } from "next/navigation";

import { EthicsDisclaimer } from "@/components/ethics-disclaimer";
import { GenerationForm } from "@/components/generation-form";
import { CopyButton } from "@/components/kit/copy-button";
import { generateMonthForProject } from "@/lib/actions/monthly-presence";
import { getEntitlement } from "@/lib/billing/entitlements";
import { MONTHLY_PRESENCE } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import type { MonthlyPresenceContent } from "@/lib/ai/monthly-presence";

export default async function PresencePage(
  props: PageProps<"/app/projects/[id]/presence">
) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, user_id")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id) redirect("/app");

  const { hasMonthlyPresence } = await getEntitlement(id);

  const { data: deliveries } = await supabase
    .from("monthly_presence_deliveries")
    .select("period_start, content")
    .eq("project_id", id)
    .order("period_start", { ascending: false });

  const latest = (deliveries ?? [])[0];
  const content = latest?.content as unknown as MonthlyPresenceContent | undefined;
  const generateAction = generateMonthForProject.bind(null, id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/app"
          className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce hover:opacity-60"
        >
          {project.name}
        </Link>
        <h1 className="font-display text-3xl leading-tight md:text-4xl">
          {MONTHLY_PRESENCE.name}
        </h1>
        <p className="max-w-xl text-gris-fonce">{MONTHLY_PRESENCE.summary}</p>
      </header>

      {!hasMonthlyPresence ? (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-noir/30 bg-cream-light p-8">
          <p className="max-w-xl text-gris-fonce">
            Monthly Presence is not active on this account.{" "}
            {MONTHLY_PRESENCE.priceLabelWithInterval}, cancel anytime.
          </p>
          <Link
            href={`/app/projects/${id}/checkout`}
            className="rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light transition-colors hover:bg-gris-fonce"
          >
            Add Monthly Presence
          </Link>
        </div>
      ) : (
        <GenerationForm
          action={generateAction}
          label={content ? "Regenerate this month" : "Generate this month"}
          pendingLabel="Writing this month…"
        />
      )}

      {content && (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="border-b border-noir/10 pb-2 font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
              Editorial calendar
            </h2>
            <ol className="flex flex-col gap-3">
              {content.editorial_calendar.map((entry) => (
                <li
                  key={entry.week}
                  className="flex flex-col gap-1 border-b border-noir/10 pb-3"
                >
                  <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
                    Week {entry.week}
                  </span>
                  <span className="text-base">{entry.focus}</span>
                  <span className="text-sm text-gris-fonce">{entry.rationale}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="border-b border-noir/10 pb-2 font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
              Posts ({content.posts.length})
            </h2>
            <div className="flex flex-col gap-3">
              {content.posts.map((post, index) => (
                <details
                  key={`${post.week}-${index}`}
                  className="rounded-lg border border-noir/15 bg-cream-light p-5"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-mono text-sm">
                    <span>{post.theme}</span>
                    <span className="text-xs text-gris-fonce">
                      Week {post.week}
                    </span>
                  </summary>

                  <div className="mt-4 flex flex-col gap-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {post.caption}
                    </p>
                    <p className="text-sm">{post.call_to_action}</p>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
                        Visual
                      </span>
                      <p className="text-sm text-gris-fonce">
                        {post.visual_direction}
                      </p>
                    </div>
                    <CopyButton
                      value={`${post.caption}\n\n${post.call_to_action}`}
                      label="Copy caption"
                      className="self-start"
                    />
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="border-b border-noir/10 pb-2 font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
              Stories ({content.stories.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {content.stories.map((story, index) => (
                <article
                  key={`${story.theme}-${index}`}
                  className="flex flex-col gap-3 rounded-lg border border-noir/15 bg-cream-light p-5"
                >
                  <h3 className="font-display text-lg leading-tight">
                    {story.theme}
                  </h3>
                  <ol className="flex flex-col gap-2 text-sm leading-relaxed">
                    {story.frames.map((frame, frameIndex) => (
                      <li key={frameIndex} className="flex gap-2">
                        <span className="font-mono text-xs text-gris-fonce">
                          {frameIndex + 1}
                        </span>
                        <span>{frame}</span>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>

          <EthicsDisclaimer />
        </>
      )}
    </div>
  );
}
