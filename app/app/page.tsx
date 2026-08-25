import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorNotice } from "@/components/ui/error-notice";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { projectStatusLabel } from "@/lib/projects/status";
import type { Tables } from "@/types/supabase";

/*
 * Reprise par statut : « Reprendre » ramène là où le projet en est réellement.
 * Une fois le kit généré (Lot 3), c'est le livrable qui est le point de
 * reprise — plus les directions, qui sont désormais derrière soi.
 */
function resumeHref(project: Tables<"projects">): string {
  if (project.status === "brief") {
    return `/app/projets/${project.id}/brief/${project.current_step}`;
  }
  if (project.status === "kit") {
    return `/app/projets/${project.id}/kit`;
  }
  if (project.status === "directions") {
    return `/app/projets/${project.id}/directions`;
  }
  return `/app/projets/${project.id}/brief/recapitulatif`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[40px] leading-tight">
            Espace Eklio
          </h1>
          <p className="font-mono text-sm text-ink-muted">{user?.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="font-mono text-sm underline hover:opacity-60"
          >
            Se déconnecter
          </button>
        </form>
      </header>

      {error ? (
        <ErrorNotice message="Vos projets n'ont pas pu être chargés. Rechargez la page ; si le problème persiste, reconnectez-vous." />
      ) : projects === null || projects.length === 0 ? (
        <EmptyState
          title="Aucun projet pour l'instant."
          text="Commencez par décrire votre activité, comptez 10 minutes."
        >
          <Link
            href="/app/projets/nouveau"
            className="rounded bg-ink px-5 py-2.5 font-mono text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            Nouveau projet
          </Link>
        </EmptyState>
      ) : (
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="label-mono text-ink-muted">Vos projets</h2>
            <Link
              href="/app/projets/nouveau"
              className="rounded bg-ink px-5 py-2.5 font-mono text-sm text-paper transition-colors hover:bg-ink-soft"
            >
              Nouveau projet
            </Link>
          </div>
          <ul className="border-t border-rule">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-rule py-4"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-base font-medium">
                    {project.name}
                  </span>
                  <span className="font-mono text-xs text-ink-muted">
                    {project.metier ? `${project.metier} · ` : ""}
                    mis à jour le {formatDate(project.updated_at)}
                  </span>
                </div>
                <span className="label-mono rounded bg-accent-surface px-2 py-1 text-ink-soft">
                  {/* Libellé d'affichage seulement : la valeur stockée reste
                      celle du CHECK en base (cf. lib/projects/status.ts). */}
                  {projectStatusLabel(project.status)}
                </span>
                <div className="flex items-center gap-3">
                  <Link
                    href={resumeHref(project)}
                    className="rounded border border-rule px-4 py-2 font-mono text-sm transition-colors hover:bg-paper-raised"
                  >
                    Reprendre
                  </Link>
                  <DeleteProjectButton
                    projectId={project.id}
                    projectName={project.name}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
