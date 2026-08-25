import Link from "next/link";
import { STEPS } from "@/lib/brief/steps";
import { ReviewBriefLink } from "@/components/brief/review-brief-link";

/*
 * Rail d'étapes du guided flow (≥1024px). Les étapes accessibles sont des
 * liens ; les étapes verrouillées restent du texte grisé.
 */
export function StepRail({
  projectId,
  activeStep,
  maxStep,
  completedSteps,
}: {
  projectId: string;
  activeStep: number;
  maxStep: number;
  completedSteps: number[];
}) {
  return (
    <nav aria-label="Brief steps" className="flex flex-col gap-1">
      <ol className="flex flex-col">
        {STEPS.map(({ step, title }) => {
          const isActive = step === activeStep;
          const isDone = completedSteps.includes(step);
          const isReachable = step <= Math.min(maxStep, 7);
          const number = String(step).padStart(2, "0");

          const inner = (
            <span className="flex items-baseline gap-3 py-2.5">
              <span className="font-mono text-xs">{number}</span>
              <span className="text-sm">{title}</span>
              {isDone && (
                <span className="ml-auto font-mono text-xs" aria-hidden="true">
                  ✓
                </span>
              )}
            </span>
          );

          return (
            <li key={step} className="border-b border-rule last:border-b-0">
              {isReachable ? (
                <Link
                  href={`/app/projets/${projectId}/brief/${step}`}
                  aria-current={isActive ? "step" : undefined}
                  className={`block px-3 transition-colors hover:bg-paper-raised ${
                    isActive ? "bg-accent-tint font-medium" : ""
                  }`}
                >
                  {inner}
                  <span className="sr-only">
                    {isDone ? " (step complete)" : ""}
                  </span>
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="block px-3 text-ink-muted"
                >
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {/*
        Toujours accessible. Ce lien n'apparaissait qu'à `maxStep >= 8`,
        c'est-à-dire seulement APRÈS une étape 7 validée — la même condition
        que celle qui débloquait la génération. Le récapitulatif était donc
        scellé derrière l'événement qu'il sert justement à débloquer. La page
        se lit très bien incomplète : elle marque les étapes à finir et y
        renvoie. Le rail étant masqué sous 1024px, la page d'étape rend le
        même lien de son côté pour les écrans étroits.
      */}
      <ReviewBriefLink projectId={projectId} className="mt-3 px-3" />
    </nav>
  );
}
