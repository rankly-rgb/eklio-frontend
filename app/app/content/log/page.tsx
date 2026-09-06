import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import { ARCHETYPE_LABELS, CHANNEL_LABELS, getPublishingLog, type PublishChannel } from "@/lib/data/content";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * /app/content/log — the publishing log.
 *
 * Every line is an event that happened: she marked something posted, or she
 * took it back. The rows are append-only in the database and no client can
 * write them, so this page cannot show a publication that was quietly edited
 * into existence afterwards.
 *
 * This is also why un-posting shows as its own line rather than removing the
 * first one. "I posted this, then I did not" is the truth, and a log that
 * erased the first half would be a status field wearing a log's clothes.
 */
export default async function PublishingLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/content/log");

  const home = await loadHome(supabase, user.id);
  const kit = home.brandKit;
  if (!kit) redirect("/app/content");

  if (!(await isBrandKitEntitled(supabase, kit.row.id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  const result = await getPublishingLog(supabase, kit.row.id);
  const entries = result.ok ? result.data.entries : [];

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <Breadcrumb items={[{ label: "Content", href: "/app/content" }, { label: "Publishing log" }]} />

      <h1 className="mt-4 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
        Publishing log
      </h1>
      <p className="mt-3 max-w-[560px] text-helper leading-prose text-ink-2">
        What you have marked as posted, most recent first. Eklio never posts anything for you, so
        this is your record rather than ours.
      </p>

      {entries.length > 0 ? (
        <ol className="mt-8 flex max-w-[720px] flex-col">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline justify-between gap-4 border-b border-line py-4"
            >
              <div className="flex flex-col gap-1">
                <Link
                  href={`/app/content/${entry.item_id}`}
                  className="text-body text-ink underline decoration-line hover:decoration-ink"
                >
                  {entry.title ?? "Untitled"}
                </Link>
                <MonoLabel tracking="16">
                  {ARCHETYPE_LABELS[entry.archetype]}
                  {entry.action === "published"
                    ? entry.channel
                      ? ` · ${CHANNEL_LABELS[entry.channel as PublishChannel]}`
                      : ""
                    : " · Taken back"}
                </MonoLabel>
              </div>
              <time
                dateTime={entry.occurred_at}
                className="shrink-0 text-helper tabular-nums text-ink-2"
              >
                {new Intl.DateTimeFormat("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(entry.occurred_at))}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-8 max-w-[520px] text-helper leading-prose text-ink-2">
          Nothing here yet. When you post something, mark it on the item and it will appear.
        </p>
      )}
    </main>
  );
}
