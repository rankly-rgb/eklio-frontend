import Link from "next/link";
import { STEPS } from "@/lib/brief/steps";

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
    <nav aria-label="Étapes du brief" className="flex flex-col gap-1">
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
                    {isDone ? " (étape terminée)" : ""}
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
      {maxStep >= 8 && (
        <Link
          href={`/app/projets/${projectId}/brief/recapitulatif`}
          className="mt-3 px-3 font-mono text-sm underline hover:opacity-60"
        >
          Récapitulatif
        </Link>
      )}
    </nav>
  );
}
