import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { createProject, loadBriefAnswers } from "@/lib/actions/brief";
import { firstIncompleteStep } from "@/lib/brief/steps";
import {
  PROJECT_STATUS_HINT,
  PROJECT_STATUS_LABEL,
  resumeHref,
} from "@/lib/projects/status";

// The proxy already guarantees an authenticated user reaches this page; we
// re-read the session to show their details (defense in depth).
export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, updated_at")
    .order("updated_at", { ascending: false });

  // Resume on a draft should land on the first unanswered step, not step one.
  const resumeTargets = await Promise.all(
    (projects ?? []).map(async (project) => {
      if (project.status !== "brief") return null;
      const answers = await loadBriefAnswers(project.id);
      return firstIncompleteStep(answers);
    })
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Your practices</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="font-mono text-sm underline hover:opacity-60"
          >
            Sign out
          </button>
        </form>
      </div>

      <p className="font-mono text-sm text-gris-fonce">
        Signed in as {user?.email}.
      </p>

      {(projects ?? []).length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-noir/30 bg-cream-light p-8">
          <p className="max-w-md text-gris-fonce">
            Nothing here yet. The brief takes about seven minutes, and every
            answer saves as you go — you can stop and come back.
          </p>
          <form action={createProject}>
            <button
              type="submit"
              className="rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light transition-colors hover:bg-gris-fonce"
            >
              Start your brief
            </button>
          </form>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {(projects ?? []).map((project, index) => (
              <li
                key={project.id}
                className="flex flex-col gap-3 rounded-lg border border-noir/15 bg-cream-light p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-lg">{project.name}</span>
                  <span className="font-mono text-xs text-gris-fonce">
                    {PROJECT_STATUS_HINT[project.status]}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="rounded-full border border-noir/25 px-3 py-1 font-mono text-xs">
                    {PROJECT_STATUS_LABEL[project.status]}
                  </span>
                  <Link
                    href={resumeHref(
                      project.id,
                      project.status,
                      resumeTargets[index]
                    )}
                    className="font-mono text-sm underline hover:opacity-60"
                  >
                    Resume
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <form action={createProject}>
            <button
              type="submit"
              className="rounded-full border border-noir px-6 py-3 font-mono text-sm transition-colors hover:bg-noir hover:text-cream-light"
            >
              Start another brief
            </button>
          </form>
        </>
      )}
    </div>
  );
}
