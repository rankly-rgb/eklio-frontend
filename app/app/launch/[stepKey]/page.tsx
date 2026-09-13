import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadLaunchFlow } from "@/lib/data/launch-flow";
import { LAUNCH_STEP_KEYS, type LaunchStepKey } from "@/lib/data/checklist";
import { StepMaterial } from "@/components/launch/step-material";
import { LaunchStepActions } from "@/components/launch/step-actions";
import { STEP_PLACES } from "@/lib/launch/places";
import { loadDirectoryFields } from "@/lib/launch/directory";
import { loadSiteSetupMaterial } from "@/lib/launch/site-setup";
import { buildLovablePrompt } from "@/lib/site/lovable";
import { launchSlots } from "@/lib/launch/slots";
import { Breadcrumb } from "@/components/app/breadcrumb";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * /app/launch/[stepKey] — one step, with room.
 *
 * The material is `StepMaterial`: every string this step hands over, every
 * file it needs, and — for the five that finish on someone else's website —
 * the door out, last. Its strings come from `stepTextBlocks`, the same four
 * helpers the accordion's `LaunchStepDetail` calls, so the board-safe
 * statement cannot say one thing here and another there.
 *
 * ⚠ THE PLACE IS NAMED AT THE TOP. "Update your Psychology Today profile"
 * reads like an Eklio feature and is not one. Five of these seven are errands
 * on someone else's site, and a screen that does not say so sends her looking
 * for a button that was never going to exist.
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

  /*
   * Only the directory step pays for this. It is four small reads — the brief's
   * three id arrays and the catalogue rows they name — and every other step
   * screen would be paying for a join it never renders.
   */
  const directoryFields =
    key === "update_directory"
      ? await loadDirectoryFields(supabase, kit.projectId, flow.context.practiceDetails)
      : [];

  /*
   * Step 1 only, same rule as the directory fields: the extra reads happen on
   * the one screen that renders them.
   *
   * The prompt's BODY is the database's, carried on the envelope this flow
   * already fetched. `buildLovablePrompt` adds what that generator does not
   * carry and scans the whole thing before it is shown.
   */
  let siteSetup = null;
  if (key === "site_setup") {
    const material = await loadSiteSetupMaterial(supabase, kit, flow.manifest);
    siteSetup = {
      prompt:
        flow.siteOutput && flow.siteOutput.kind === "prompt"
          ? buildLovablePrompt({
              core: flow.siteOutput.text,
              practiceDetails: flow.context.practiceDetails,
              bookingUrl: flow.context.bookingUrl,
              toneWords: material.toneWords,
              wordmark: material.wordmark,
              imageSlots: material.imageSlots,
            })
          : null,
      slots: launchSlots(),
    };
  }

  const previous = index > 0 ? flow.progress.items[index - 1] : null;
  const next = index < flow.progress.items.length - 1 ? flow.progress.items[index + 1] : null;

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <div className="max-w-[680px]">
        <Breadcrumb
          items={[{ label: "Your first week", href: "/app/launch" }, { label: step.label }]}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <MonoLabel tracking="16">
            {`Step ${index + 1} of ${flow.progress.items.length}`}
          </MonoLabel>
          <span className="rounded-pill bg-card px-2.5 py-1">
            <MonoLabel tracking="10" tone="ink-2">
              {STEP_PLACES[key].label}
            </MonoLabel>
          </span>
        </div>

        <h1 className="mt-3 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
          {step.label}
        </h1>

        {step.description ? (
          <p className="mt-4 text-body leading-prose text-ink-2">{step.description}</p>
        ) : null}

        <div className="mt-8">
          <StepMaterial
            brandKitId={brandKitId}
            stepKey={key}
            context={flow.context}
            manifest={flow.manifest}
            directoryFields={directoryFields}
            siteSetup={siteSetup}
          />
        </div>

        <div className="mt-10 border-t border-line pt-6">
          <LaunchStepActions
            brandKitId={brandKitId}
            stepKey={key}
            status={step.status}
            doneLabel={STEP_PLACES[key].declared ? "Mark as done" : "Mark done"}
          />
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
