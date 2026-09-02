"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress7, StepCounter } from "@/components/ui/progress7";
import { MonoLabel } from "@/components/ui/mono-label";
import { PreviewRail } from "@/components/brief/preview-rail";
import { PreviewSheet } from "@/components/brief/preview-sheet";
import { SaveStateLabel } from "@/components/brief/save-state";
import { useBriefAutosave } from "@/components/brief/use-brief-autosave";
import {
  ClientStep,
  HowYouWorkStep,
  LookStep,
  PositioningStep,
  PracticeStep,
  VoiceStep,
  WebsiteStep,
  type StepBodyProps,
} from "@/components/brief/step-bodies";
import { applyOptimistic } from "@/lib/brief/optimistic";
import {
  STEPS,
  STEP_COUNT,
  stepIssue,
  withCompletedStep,
  type StepDraft,
  type StepId,
} from "@/lib/brief/flow";
import type { Catalog } from "@/lib/catalog/types";
import type { PreviewModel } from "@/lib/brand/shapes";
import type { ToneCards } from "@/lib/generation/how-you-work-shapes";

/*
 * Le brief — une question par écran, sur une seule route.
 *
 * POURQUOI UNE SEULE ROUTE : l'étape n'est pas dans l'URL parce qu'elle n'est
 * pas dans l'URL qui fait autorité — c'est `project_briefs.progress_step` qui
 * décide où l'on reprend (§0.5). Un lien profond vers l'étape 4 d'un brief
 * arrêté à l'étape 2 serait un état que rien ne soutient. Le §3 le confirme :
 * le passage d'une question à l'autre est une transition de QUESTION (fondu +
 * glissement de 8px), pas un changement de route.
 *
 * `Enter` continue quand l'étape est valide, sauf dans une zone de texte.
 */

const BODIES: Record<StepId, (props: StepBodyProps) => React.ReactElement> = {
  practice: PracticeStep,
  positioning: PositioningStep,
  client: ClientStep,
  how_you_work: HowYouWorkStep,
  voice: VoiceStep,
  look: LookStep,
  website: WebsiteStep,
};

export function BriefFlow({
  projectId,
  catalog,
  initialDraft,
  initialStep,
  initialCompleted,
  initialPreview,
  initialToneCards,
}: {
  projectId: string;
  catalog: Catalog;
  initialDraft: StepDraft;
  initialStep: number;
  initialCompleted: number[];
  initialPreview: PreviewModel | null;
  initialToneCards: ToneCards | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<StepDraft>(initialDraft);
  const [stepNumber, setStepNumber] = useState(initialStep);
  const [completed, setCompleted] = useState<number[]>(initialCompleted);
  const [issue, setIssue] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [toneCards, setToneCards] = useState<ToneCards | null>(initialToneCards);

  const autosave = useBriefAutosave(projectId, initialPreview);
  const step = STEPS[stepNumber - 1];

  /*
   * Réouverture d'une étape après un brief déjà entièrement complété : les
   * sept étapes sont dans `completed` avant même que cet écran ne touche
   * quoi que ce soit (`withCompletedStep` n'enlève jamais rien, donc ça ne
   * redevient jamais faux une fois vrai). Dans ce cas, « Continue » doit
   * enregistrer CETTE étape puis revenir directement au récapitulatif — pas
   * remonter la cascade des questions suivantes, qu'elle a déjà toutes
   * répondues lors du premier passage.
   */
  const revisiting = completed.length === STEP_COUNT;

  /*
   * Le rail montre le modèle du serveur repeint par les choix déjà faits :
   * la couleur arrive au clic, pas 600 ms plus tard. La réponse du PATCH
   * remplace ensuite le modèle — `brief_preview()` reste l'autorité.
   * `toneCards` (§2.2) vit ICI, pas dans `VoiceStep` : le rail en a besoin
   * lui aussi, et il rend hors de l'étape 5.
   */
  const preview = useMemo(
    () =>
      autosave.preview
        ? applyOptimistic(autosave.preview, draft, catalog, toneCards)
        : null,
    [autosave.preview, draft, catalog, toneCards]
  );

  const update = useCallback(
    (patch: Partial<StepDraft>) => {
      setIssue(null);
      setDraft((current) => {
        const next = { ...current, ...patch };
        autosave.save({ ...patch, progress_step: stepNumber });
        return next;
      });
    },
    [autosave, stepNumber]
  );

  const goTo = useCallback(
    async (target: number) => {
      const bounded = Math.min(STEP_COUNT, Math.max(1, target));
      setStepNumber(bounded);
      setIssue(null);
      autosave.save({ progress_step: bounded });
      await autosave.flush();
    },
    [autosave]
  );

  async function onContinue() {
    const problem = stepIssue(step.id, draft);
    if (problem) {
      setIssue(problem);
      return;
    }

    const nextCompleted = withCompletedStep(completed, stepNumber);
    setCompleted(nextCompleted);
    autosave.save({ completed_steps: nextCompleted });

    if (stepNumber === STEP_COUNT || revisiting) {
      setLeaving(true);
      await autosave.flush();
      router.push(`/app/briefs/${projectId}/review`);
      return;
    }
    await goTo(stepNumber + 1);
  }

  async function onSkip() {
    if (stepNumber === STEP_COUNT) {
      setLeaving(true);
      await autosave.flush();
      router.push(`/app/briefs/${projectId}/review`);
      return;
    }
    await goTo(stepNumber + 1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    const target = event.target as HTMLElement;
    // Entrée dans une zone de texte fait un retour à la ligne, pas un « Continue ».
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    event.preventDefault();
    void onContinue();
  }

  const Body = BODIES[step.id];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none p-[20px_var(--gutter)_0] max-md:p-[40px_var(--gutter-sm)_0]">
        {/* Bureau : compteur à droite AU-DESSUS de la jauge (Écrans 1 et 2).
            Mobile : la jauge passe tout en haut, le compteur dessous (Écran 8). */}
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
          className={`flex min-w-0 flex-1 flex-col ${
            // L'Écran « Look » (grilles palette + typographie) respire à 44px,
            // les autres à 32px.
            step.id === "look" ? "pt-[44px]" : "pt-8"
          } pl-[var(--gutter)] pr-14 max-md:px-[var(--gutter-sm)] max-lg:pb-[168px]`}
        >
          <div key={step.id} className="question-enter flex max-w-brief flex-col">
            <MonoLabel tracking="18">{step.eyebrow}</MonoLabel>
            <h1 className="mt-4 text-pretty font-display text-question font-medium leading-title tracking-question text-ink max-md:text-question-sm">
              {step.question}
            </h1>
            <p className="mt-3 max-w-[560px] text-helper leading-prose text-ink-2">
              {step.helper}
            </p>

            <div className={step.id === "look" ? "mt-9" : "mt-7"}>
              <Body
                projectId={projectId}
                draft={draft}
                catalog={catalog}
                preview={preview}
                update={update}
                toneCards={toneCards}
                setToneCards={setToneCards}
              />
            </div>

            {issue ? (
              <p
                role="alert"
                className="mt-6 border-l border-accent pl-3 text-helper leading-prose text-ink"
              >
                {issue}
              </p>
            ) : null}

            <div
              className={`flex items-center gap-4 ${
                step.id === "look" ? "mt-10" : "mt-8"
              }`}
            >
              {stepNumber > 1 ? (
                <Button variant="secondary" onClick={() => void goTo(stepNumber - 1)}>
                  Back
                </Button>
              ) : null}
              <Button onClick={() => void onContinue()} disabled={leaving}>
                {stepNumber === STEP_COUNT || revisiting
                  ? "Review my brief"
                  : "Continue"}
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

        <PreviewRail model={preview} />
      </div>

      {/* Sous 1024px le rail disparaît : la maquette passe en feuille basse. */}
      <PreviewSheet model={preview} />
    </div>
  );
}
