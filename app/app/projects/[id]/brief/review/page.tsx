import Link from "next/link";

import { BrandSheetPreview } from "@/components/brief/brand-sheet-preview";
import { completeBrief, loadBriefAnswers } from "@/lib/actions/brief";
import {
  BRIEF_STEPS,
  isStepComplete,
  isBriefComplete,
} from "@/lib/brief/steps";

export default async function BriefReviewPage(
  props: PageProps<"/app/projects/[id]/brief/review">
) {
  const { id } = await props.params;
  const answers = await loadBriefAnswers(id);
  const complete = isBriefComplete(answers);

  const completeBriefForProject = completeBrief.bind(null, id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
          Review
        </p>
        <h1 className="font-display text-3xl leading-tight md:text-4xl">
          Here is what you told us.
        </h1>
        <p className="max-w-xl text-gris-fonce">
          Read it the way a prospective client would. Anything you change here
          changes what we generate next.
        </p>
      </header>

      <BrandSheetPreview answers={answers} />

      <section className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
          Steps
        </p>
        <ul className="flex flex-col gap-2">
          {BRIEF_STEPS.map((step) => {
            const done = isStepComplete(step, answers[step.id] ?? {});
            return (
              <li
                key={step.id}
                className="flex items-center justify-between gap-4 border-b border-noir/10 pb-2"
              >
                <span className="text-sm">{step.title}</span>
                <span className="flex items-center gap-4">
                  <span
                    className={`font-mono text-xs ${
                      done ? "text-gris-fonce" : "text-red-700"
                    }`}
                  >
                    {done ? "Complete" : "Needs an answer"}
                  </span>
                  <Link
                    href={`/app/projects/${id}/brief/${step.id}`}
                    className="font-mono text-sm underline hover:opacity-60"
                  >
                    Edit
                  </Link>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-col gap-4 border-t border-noir/10 pt-6">
        {!complete && (
          <p className="font-mono text-sm text-red-700">
            A few required answers are still missing. Fill them in and come back.
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <Link href="/app" className="font-mono text-sm underline hover:opacity-60">
            Save and exit
          </Link>

          {complete ? (
            <form action={completeBriefForProject}>
              <button
                type="submit"
                className="rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light transition-colors hover:bg-gris-fonce"
              >
                Generate three directions
              </button>
            </form>
          ) : (
            <span
              aria-disabled="true"
              className="cursor-not-allowed rounded-full bg-noir/30 px-6 py-3 font-mono text-sm text-cream-light"
            >
              Generate three directions
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
