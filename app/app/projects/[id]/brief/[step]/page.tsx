import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefStepForm } from "@/components/brief/brief-step-form";
import { loadBriefAnswers } from "@/lib/actions/brief";
import {
  BRIEF_STEPS,
  getBriefStep,
  getBriefStepIndex,
  type BriefStepId,
} from "@/lib/brief/steps";

export default async function BriefStepPage(
  props: PageProps<"/app/projects/[id]/brief/[step]">
) {
  const { id, step: stepParam } = await props.params;

  const step = getBriefStep(stepParam);
  if (!step) notFound();

  const answers = await loadBriefAnswers(id);
  const index = getBriefStepIndex(step.id);
  const previous = BRIEF_STEPS[index - 1];
  const next = BRIEF_STEPS[index + 1];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-12">
      <ProgressRail currentStepId={step.id} projectId={id} />

      <BriefStepForm
        projectId={id}
        step={step}
        initialAnswer={answers[step.id] ?? {}}
        previousHref={
          previous ? `/app/projects/${id}/brief/${previous.id}` : null
        }
        nextHref={
          next
            ? `/app/projects/${id}/brief/${next.id}`
            : `/app/projects/${id}/brief/review`
        }
        nextLabel={next ? "Continue" : "Review your brief"}
      />
    </div>
  );
}

function ProgressRail({
  currentStepId,
  projectId,
}: {
  currentStepId: BriefStepId;
  projectId: string;
}) {
  const currentIndex = getBriefStepIndex(currentStepId);

  return (
    <nav aria-label="Brief progress" className="flex flex-col gap-3">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
        Step {currentIndex + 1} of {BRIEF_STEPS.length}
      </p>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
        {BRIEF_STEPS.map((step, index) => {
          const isCurrent = step.id === currentStepId;
          // Only steps already reached are linkable — jumping ahead would skip
          // the required-field gate.
          const isReachable = index <= currentIndex;

          return (
            <li key={step.id}>
              {isReachable ? (
                <Link
                  href={`/app/projects/${projectId}/brief/${step.id}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={isCurrent ? "underline" : "text-gris-fonce hover:opacity-60"}
                >
                  {step.title}
                </Link>
              ) : (
                <span className="text-gris-fonce/40">{step.title}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
