import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadLaunchFlow } from "@/lib/data/launch-flow";
import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";

/*
 * /app/launch — the seven steps, one screen at a time.
 *
 * The accordion on home answers "where am I?" in a glance. This flow answers
 * "what do I do now?", which needs room: the real copy she pastes, where to
 * paste it, and one decision at the end.
 *
 * SAME ROWS, SAME RPC. `launch_checklist_items` through `get_launch_progress`
 * and `set_launch_step`, exactly as the accordion uses them. There is no
 * second checklist, no second table, and no progress number computed here —
 * marking a step done in either place is the same write.
 */
export default async function LaunchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/launch");

  const home = await loadHome(supabase, user.id);
  const kit = home.brandKit;
  if (!kit) redirect("/app");

  const brandKitId = kit.row.id;
  if (!(await isBrandKitEntitled(supabase, brandKitId))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  const flow = await loadLaunchFlow(supabase, brandKitId, user.id);
  if (!flow) redirect("/app");

  const { items, resolvedCount, total } = flow.progress;
  const next = items.find((item) => item.status === "todo") ?? null;

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-8 max-md:px-[var(--gutter-sm)]">
      <div className="max-w-[720px]">
        <MonoLabel tracking="16">Your first week</MonoLabel>
        <h1 className="mt-3 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
          Put your brand where people look
        </h1>
        <p className="mt-4 text-body leading-prose text-ink-2">
          Seven places. Each one is a screen with the exact words to paste and where to paste them.
          Do one, or do them all — nothing here expires.
        </p>

        {total > 0 ? (
          <div className="mt-8 flex items-center gap-3.5">
            <div className="h-0.5 flex-1 overflow-hidden rounded-pill bg-line">
              <div
                className="h-0.5 bg-accent"
                style={{ width: `${(resolvedCount / total) * 100}%` }}
              />
            </div>
            <MonoLabel tracking="14" className="flex-none">
              {`${resolvedCount} of ${total}`}
            </MonoLabel>
          </div>
        ) : null}

        {next ? (
          <ButtonLink href={`/app/launch/${next.key}`} className="mt-8 self-start">
            {resolvedCount === 0 ? "Start with the first one" : "Continue where you left off"}
          </ButtonLink>
        ) : (
          <p className="mt-8 text-body leading-prose text-ink">
            Your brand is live in seven places. Nothing is left on this list.
          </p>
        )}

        <ol className="mt-10 flex flex-col">
          {items.map((item, index) => (
            <li key={item.key} className="border-b border-line first:border-t">
              <Link
                href={`/app/launch/${item.key}`}
                className="flex items-baseline gap-4 py-4 hover:bg-paper-2"
              >
                <MonoLabel tracking="14" className="w-8 flex-none">
                  {String(index + 1).padStart(2, "0")}
                </MonoLabel>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span
                    className={`text-ui leading-body ${
                      item.status === "done"
                        ? "text-ink-3 line-through decoration-[var(--ink-3)]"
                        : item.status === "skipped"
                          ? "text-ink-3"
                          : "text-ink"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="text-helper leading-prose text-ink-2">
                      {item.description}
                    </span>
                  ) : null}
                </span>
                <span className="flex-none text-meta text-ink-3">
                  {item.status === "done"
                    ? "Done"
                    : item.status === "skipped"
                      ? "Skipped"
                      : "To do"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
