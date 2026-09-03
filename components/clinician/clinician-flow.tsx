"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress7, StepCounter } from "@/components/ui/progress7";
import { MonoLabel } from "@/components/ui/mono-label";
import { SaveStateLabel } from "@/components/brief/save-state";
import { CompletenessRail, CompletenessSheet } from "@/components/clinician/completeness-panel";
import { useClinicianAutosave } from "@/components/clinician/use-clinician-autosave";
import {
  IdentityStep,
  LicensedStatesStep,
  ModalitiesStep,
  PopulationsStep,
  PhilosophyStep,
  PracticalitiesStep,
  ReviewStep,
  type StepBodyProps,
} from "@/components/clinician/step-bodies";
import {
  STEPS,
  STEP_COUNT,
  stepIssue,
  resumeStep,
  type StepId,
  type ClinicianStepDraft,
} from "@/lib/tenancy/clinician-brief/flow";
import type { ClinicianCatalog } from "@/lib/data/clinician-brief";
import type { ClinicianProfileCompleteness } from "@/lib/tenancy/clinician-profile";

/*
 * The clinician brief's step engine — one question per screen, on one
 * route, same as components/brief/brief-flow.tsx. `Enter` continues except
 * from a textarea, same rule.
 *
 * WHAT'S DELIBERATELY DIFFERENT FROM THE PROJECT BRIEF: there is no
 * separate `/review` route — screen 7 IS the review screen, since lot D5
 * specifies exactly 7 screens including review, not 7 plus a review page.
 * And there is no persisted `progress_step`: resumeStep() derives where to
 * start from the data itself on every load (see lib/tenancy/clinician-brief/flow.ts).
 */

const BODIES: Record<StepId, (props: StepBodyProps) => React.ReactElement> = {
  identity: IdentityStep,
  licensed_states: LicensedStatesStep,
  modalities: ModalitiesStep,
  populations: PopulationsStep,
  philosophy: PhilosophyStep,
  practicalities: PracticalitiesStep,
  review: ReviewStep,
};

export function ClinicianFlow({
  projectId,
  catalog,
  practiceName,
  hasOrgDefaultSupervisor,
  initialDraft,
  initialCompleteness,
}: {
  projectId: string;
  catalog: ClinicianCatalog;
  practiceName: string;
  hasOrgDefaultSupervisor: boolean;
  initialDraft: ClinicianStepDraft;
  initialCompleteness: ClinicianProfileCompleteness | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [stepNumber, setStepNumber] = useState(() =>
    resumeStep(initialDraft, hasOrgDefaultSupervisor)
  );
  const [issue, setIssue] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const autosave = useClinicianAutosave(projectId, initialCompleteness);
  const step = STEPS[stepNumber - 1];

  const update = useCallback(
    (patch: Partial<ClinicianStepDraft>) => {
      setIssue(null);
      setDraft((current) => {
        const next = { ...current, ...patch };

        if (
          "fullName" in patch ||
          "credentials" in patch ||
          "status" in patch ||
          "supervisorName" in patch ||
          "philosophyQuote" in patch ||
          "outsideTheRoom" in patch ||
          "personalityNote" in patch ||
          "sessionRateCents" in patch ||
          "rateIsPublic" in patch ||
          "bookingUrl" in patch ||
          "photoProvided" in patch ||
          "acceptingClients" in patch
        ) {
          autosave.save({
            profile: {
              fullName: next.fullName,
              credentials: next.credentials,
              status: next.status,
              supervisorName: next.supervisorName,
              philosophyQuote: next.philosophyQuote,
              outsideTheRoom: next.outsideTheRoom,
              personalityNote: next.personalityNote,
              sessionRateCents: next.sessionRateCents,
              rateIsPublic: next.rateIsPublic,
              bookingUrl: next.bookingUrl,
              photoProvided: next.photoProvided,
              acceptingClients: next.acceptingClients,
            },
          });
        }
        if ("stateCodes" in patch) autosave.save({ stateCodes: next.stateCodes });
        if ("modalities" in patch) autosave.save({ modalities: next.modalities });
        if ("populationIds" in patch) autosave.save({ populationIds: next.populationIds });

        return next;
      });
    },
    [autosave]
  );

  const goTo = useCallback(
    async (target: number) => {
      const bounded = Math.min(STEP_COUNT, Math.max(1, target));
      setStepNumber(bounded);
      setIssue(null);
      await autosave.flush();
    },
    [autosave]
  );

  async function onContinue() {
    const problem = stepIssue(step.id, draft, hasOrgDefaultSupervisor);
    if (problem) {
      setIssue(problem);
      return;
    }

    if (stepNumber === STEP_COUNT) {
      setLeaving(true);
      await autosave.flush();
      router.push("/app");
      return;
    }
    await goTo(stepNumber + 1);
  }

  async function onSkip() {
    await goTo(stepNumber + 1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    event.preventDefault();
    void onContinue();
  }

  const Body = BODIES[step.id];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none p-[20px_var(--gutter)_0] max-md:p-[40px_var(--gutter-sm)_0]">
        <div className="mb-2.5 flex justify-end max-md:hidden">
          <StepCounter step={stepNumber} />
        </div>
        <Progress7 step={stepNumber} className="max-md:hidden" />
        <Progress7 step={stepNumber} dense className="md:hidden" />
        <div className="mt-6 md:hidden">
          <StepCounter step={stepNumber} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          onKeyDown={onKeyDown}
          className="flex min-w-0 flex-1 flex-col pt-8 pl-[var(--gutter)] pr-14 max-md:px-[var(--gutter-sm)] max-lg:pb-[168px]"
        >
          <div key={step.id} className="question-enter flex max-w-brief flex-col">
            <MonoLabel tracking="18">{step.eyebrow}</MonoLabel>
            <h1 className="mt-4 text-pretty font-display text-question font-medium leading-title tracking-question text-ink max-md:text-question-sm">
              {step.question}
            </h1>
            <p className="mt-3 max-w-[560px] text-helper leading-prose text-ink-2">
              {step.helper}
            </p>

            <div className="mt-7">
              <Body
                draft={draft}
                catalog={catalog}
                hasOrgDefaultSupervisor={hasOrgDefaultSupervisor}
                practiceName={practiceName}
                update={update}
              />
            </div>

            {issue ? (
              <p role="alert" className="mt-6 border-l border-accent pl-3 text-helper leading-prose text-ink">
                {issue}
              </p>
            ) : null}

            <div className="mt-8 flex items-center gap-4">
              {stepNumber > 1 ? (
                <Button variant="secondary" onClick={() => void goTo(stepNumber - 1)}>
                  Back
                </Button>
              ) : null}
              <Button onClick={() => void onContinue()} disabled={leaving}>
                {stepNumber === STEP_COUNT ? "Done" : "Continue"}
              </Button>
              {step.optional ? (
                <Button variant="tertiary" onClick={() => void onSkip()} className="ml-2">
                  Skip for now
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex-1" />
          <SaveStateLabel state={autosave.state} error={autosave.error} />
        </div>

        <CompletenessRail completeness={autosave.completeness} />
      </div>

      <CompletenessSheet completeness={autosave.completeness} />
    </div>
  );
}
