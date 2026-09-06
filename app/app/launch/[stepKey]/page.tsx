import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadLaunchFlow } from "@/lib/data/launch-flow";
import { LAUNCH_STEP_KEYS, type LaunchStepKey } from "@/lib/data/checklist";
import { LaunchStepDetail } from "@/components/checklist/launch-checklist";
import { LaunchStepActions } from "@/components/launch/step-actions";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * /app/launch/[stepKey] — one step, with room.
 *
 * The detail is `LaunchStepDetail`, the SAME component the accordion renders
 * inside its expanded row. Writing a second version of the copy blocks for
 * this screen would have meant two places to keep the board-safe statement
 * correct, and only one of them would have been reviewed the next time the
 * ethics rules changed.
 *
 * An unknown step key is a 404 rather than a redirect to the overview: the
 * address was wrong, and pretending it was right teaches the wrong thing.
 */
export default async function LaunchStepPage({ params }: PageProps<"/app/launch/[stepKey]">) {
  const { stepKey } = await params;
  if (!LAUNCH_STEP_KEYS.includes(stepKey as LaunchStepKey)) notFound();
  const key = stepKey as LaunchStepKey;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/launch/${key}`);

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

  const index = flow.progress.items.findIndex((item) => item.key === key);
  const step = flow.progress.items[index];
  /*
   * The rows exist but this one does not: the seed has not run for this kit,
   * or the key was retired in the database and not here. Either way the
   * honest answer is 404 — inventing an empty screen for a step that has no
   * row would show a checkbox that writes nowhere.
   */
  if (!step) notFound();

  const previous = index > 0 ? flow.progress.items[index - 1] : null;
  const next = index < flow.progress.items.length - 1 ? flow.progress.items[index + 1] : null;

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <div className="max-w-[680px]">
        <Breadcrumb
          items={[{ label: "Your first week", href: "/app/launch" }, { label: step.label }]}
        />

        <MonoLabel tracking="16" className="mt-4 block">
          {`Step ${index + 1} of ${flow.progress.items.length}`}
        </MonoLabel>

        <h1 className="mt-3 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
          {step.label}
        </h1>

        {step.description ? (
          <p className="mt-4 text-body leading-prose text-ink-2">{step.description}</p>
        ) : null}

        <div className="mt-8 flex flex-col gap-4">
          <LaunchStepDetail step={key} context={flow.context} />
        </div>

        <div className="mt-10 border-t border-line pt-6">
          <LaunchStepActions brandKitId={brandKitId} stepKey={key} status={step.status} />
        </div>

        <nav className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6">
          {previous ? (
            <Link
              href={`/app/launch/${previous.key}`}
              className="text-helper text-ink-2 underline hover:text-ink"
            >
              {`Back: ${previous.label}`}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/app/launch/${next.key}`}
              className="text-right text-helper text-ink-2 underline hover:text-ink"
            >
              {`Next: ${next.label}`}
            </Link>
          ) : (
            <Link href="/app/launch" className="text-helper text-ink-2 underline hover:text-ink">
              Back to all seven
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
