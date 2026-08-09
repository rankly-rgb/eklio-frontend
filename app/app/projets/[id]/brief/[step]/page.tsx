import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadProjectWithBrief } from "@/lib/brief/load";
import { getStep } from "@/lib/brief/steps";
import { StepForm } from "@/components/brief/step-form";
import { StepRail } from "@/components/ui/step-rail";
import { ProgressBar } from "@/components/ui/progress-bar";

export default async function BriefStepPage({
  params,
}: PageProps<"/app/projets/[id]/brief/[step]">) {
  const { id, step: stepParam } = await params;

  const stepNumber = Number(stepParam);
  const stepDef = getStep(stepNumber);
  if (!stepDef) {
    notFound();
  }

  const { project, brief, draft } = await loadProjectWithBrief(id);

  // Garde d'accès : impossible de sauter au-delà de l'étape suivante.
  if (stepNumber > project.current_step + 1) {
    redirect(`/app/projets/${project.id}/brief/${project.current_step}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/app"
          className="font-mono text-sm underline hover:opacity-60"
        >
          ← Vos projets
        </Link>
        <span className="truncate font-mono text-xs text-ink-muted">
          {project.name}
        </span>
      </header>

      {/* <1024px : le rail se réduit à une barre de progression horizontale. */}
      <div className="lg:hidden">
        <ProgressBar step={stepDef.step} total={7} />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-10 lg:grid-cols-[240px_minmax(0,640px)] lg:justify-center xl:grid-cols-[240px_minmax(0,640px)_320px]">
        <div className="hidden self-start lg:sticky lg:top-10 lg:block">
          <StepRail
            projectId={project.id}
            activeStep={stepDef.step}
            maxStep={project.current_step}
            completedSteps={brief.completed_steps}
          />
        </div>

        <StepForm
          key={stepDef.step}
          projectId={project.id}
          projectName={project.name}
          stepDef={stepDef}
          initialDraft={draft}
        />
      </div>
    </div>
  );
}
