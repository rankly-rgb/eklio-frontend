import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DirectionsSelector } from "@/components/directions/directions-selector";

export default async function DirectionsPage({
  params,
}: PageProps<"/app/projets/[id]/directions">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: directions } = await supabase
    .from("directions")
    .select("*")
    .eq("project_id", id)
    .order("position", { ascending: true });

  if (!directions || directions.length === 0) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <Link
          href={`/app/projets/${project.id}/brief/recapitulatif`}
          className="font-mono text-sm underline hover:opacity-60"
        >
          ← Review
        </Link>
        <span className="truncate font-mono text-xs text-ink-muted">
          {project.name}
        </span>
      </header>

      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.08em] text-ink-muted">
          Creative directions
        </p>
        <h1 className="font-display text-[40px] leading-tight">
          Three directions for your brand.
        </h1>
        <p className="text-sm text-ink-muted">
          Pick the one that sounds most like you. You can regenerate at any
          time.
        </p>
      </div>

      <DirectionsSelector projectId={project.id} directions={directions} />
    </div>
  );
}
