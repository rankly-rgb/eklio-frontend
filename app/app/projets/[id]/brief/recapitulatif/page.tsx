import Link from "next/link";
import { loadProjectWithBrief } from "@/lib/brief/load";
import { STEPS, optionLabel, type FieldDef } from "@/lib/brief/steps";
import { STEP_NUMBERS, type BriefDraft } from "@/lib/brief/schemas";
import { BrandSheet } from "@/components/ui/brand-sheet";
import { GenerateDirectionsButton } from "@/components/brief/generate-directions-button";

function sliderText(value: number, left: string, right: string): string {
  if (value === 3) return "balanced (3/5)";
  return value < 3
    ? `leaning ${left} (${value}/5)`
    : `leaning ${right} (${value}/5)`;
}

function fieldValue(field: FieldDef, draft: BriefDraft): string | null {
  switch (field.kind) {
    case "text":
    case "textarea": {
      const value = draft[field.name];
      return typeof value === "string" && value.trim() !== "" ? value : null;
    }
    case "choice": {
      const value = draft[field.name];
      return typeof value === "string"
        ? (optionLabel(field.options, value) ?? null)
        : null;
    }
    case "multi": {
      const value = draft[field.name];
      if (!Array.isArray(value) || value.length === 0) return null;
      const found = value
        .map((v) => optionLabel(field.options, v))
        .filter((v): v is string => v !== undefined);
      return found.length > 0 ? found.join(" · ") : null;
    }
    case "sliders": {
      const parts = field.sliders.map((slider) => {
        const value = draft[slider.name];
        return sliderText(
          typeof value === "number" ? value : 3,
          slider.left,
          slider.right
        );
      });
      return parts.join(" · ");
    }
  }
}

export default async function RecapPage({
  params,
}: PageProps<"/app/projets/[id]/brief/recapitulatif">) {
  const { id } = await params;
  const { project, brief, draft } = await loadProjectWithBrief(id);

  return (
    <div className="mx-auto flex w-full max-w-[1024px] flex-1 flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <Link
          href="/app"
          className="font-mono text-sm underline hover:opacity-60"
        >
          ← Your projects
        </Link>
        <span className="truncate font-mono text-xs text-ink-muted">
          {project.name}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,640px)_320px] lg:justify-center">
        <div className="flex min-w-0 flex-col gap-10">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-xs tracking-[0.08em] text-ink-muted">
              Review
            </p>
            <h1 className="font-display text-[40px] leading-tight">
              Your brief, at a glance.
            </h1>
            <p className="text-sm text-ink-muted">
              Read back through your answers, change anything that needs it,
              then move on.
            </p>
          </div>

          <div className="flex flex-col">
            {STEPS.map((stepDef) => {
              const isDone = brief.completed_steps.includes(stepDef.step);
              return (
                <section
                  key={stepDef.step}
                  aria-labelledby={`recap-step-${stepDef.step}`}
                  className="border-t border-rule py-6 last:border-b"
                >
                  <div className="mb-4 flex items-baseline justify-between gap-4">
                    <h2
                      id={`recap-step-${stepDef.step}`}
                      className="flex items-baseline gap-3"
                    >
                      <span className="font-mono text-xs text-ink-muted">
                        {String(stepDef.step).padStart(2, "0")}
                      </span>
                      <span className="text-xl font-medium">
                        {stepDef.title}
                      </span>
                      {!isDone && (
                        <span className="label-mono rounded bg-accent-surface px-2 py-0.5 text-ink-soft">
                          to complete
                        </span>
                      )}
                    </h2>
                    <Link
                      href={`/app/projets/${project.id}/brief/${stepDef.step}`}
                      className="font-mono text-sm underline hover:opacity-60"
                    >
                      Edit
                      <span className="sr-only"> {stepDef.title}</span>
                    </Link>
                  </div>
                  <dl className="flex flex-col gap-3">
                    {stepDef.fields.map((field) => {
                      if (
                        field.kind === "text" &&
                        field.visibleIf &&
                        !field.visibleIf(draft)
                      ) {
                        return null;
                      }
                      const value = fieldValue(field, draft);
                      return (
                        <div key={field.name} className="flex flex-col gap-0.5">
                          <dt className="label-mono text-ink-muted">
                            {field.label}
                          </dt>
                          {value !== null ? (
                            <dd className="whitespace-pre-wrap text-base text-ink-soft">
                              {value}
                            </dd>
                          ) : (
                            <dd className="text-sm text-ink-muted italic">
                              not filled in
                            </dd>
                          )}
                        </div>
                      );
                    })}
                  </dl>
                </section>
              );
            })}
          </div>

          {STEP_NUMBERS.every((s) => brief.completed_steps.includes(s)) ? (
            <GenerateDirectionsButton
              projectId={project.id}
              label={
                project.status === "brief_complete"
                  ? "Generate my 3 directions"
                  : "Regenerate my 3 directions"
              }
            />
          ) : (
            <div className="flex flex-col items-start gap-2 pb-6">
              <button
                type="button"
                disabled
                aria-describedby="generation-incomplete"
                className="cursor-not-allowed rounded bg-ink px-6 py-3 font-mono text-sm text-paper opacity-40"
              >
                Generate my 3 directions
              </button>
              <p
                id="generation-incomplete"
                className="font-mono text-xs text-ink-muted"
              >
                Complete all 7 steps to continue.
              </p>
            </div>
          )}
        </div>

        <aside className="self-start lg:sticky lg:top-10">
          <BrandSheet projectName={project.name} draft={draft} />
        </aside>
      </div>
    </div>
  );
}
