import Link from "next/link";
import { redirect } from "next/navigation";

import { getOrCreateWorkspace } from "@/lib/eklio/project";
import { createClient } from "@/lib/supabase/server";

/**
 * L'accueil est un aiguillage : elle reprend là où elle en est.
 *
 * `projects.current_step` n'est pas lu ici — il suit le cycle de vie du projet
 * et n'est pas synchronisé avec le brief. L'état réel se lit dans ce que les
 * tables portent : un brief entamé, des directions écrites, une direction
 * choisie.
 */
export default async function AppHome() {
  const workspace = await getOrCreateWorkspace();
  if (!workspace) redirect("/login");

  const supabase = await createClient();

  const [{ data: brief }, { data: kit }] = await Promise.all([
    supabase
      .from("project_briefs")
      .select("progress_step,practice_name")
      .eq("project_id", workspace.projectId)
      .maybeSingle(),
    workspace.brandKitId
      ? supabase
          .from("brand_kits")
          .select("directions,selected_direction_id")
          .eq("id", workspace.brandKitId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (kit?.selected_direction_id) redirect("/app/kit");

  const hasDirections = Array.isArray(kit?.directions) && kit.directions.length > 0;
  if (hasDirections) redirect("/app/directions");

  const started = Boolean(brief?.practice_name) || (brief?.progress_step ?? 1) > 1;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <div className="overline text-muted">Welcome</div>
      <h1 className="mt-4 font-display text-[40px] leading-[1.12] tracking-[-0.015em] text-balance">
        {started ? "Pick up where you left off." : "Let's find out what your practice looks like."}
      </h1>
      <p className="mt-3 max-w-[480px] text-[15px] leading-[1.6] text-muted">
        Seven short questions. Then three directions, free to look at.
      </p>
      <div className="mt-8">
        <Link
          href="/app/brief"
          className="inline-flex h-10 items-center rounded-full bg-ink px-[30px] text-sm font-semibold text-paper transition hover:opacity-90"
        >
          {started ? "Continue the brief" : "Start the brief"}
        </Link>
      </div>
    </div>
  );
}
