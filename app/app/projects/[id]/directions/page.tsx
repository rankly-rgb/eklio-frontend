import Link from "next/link";
import { redirect } from "next/navigation";

import { DirectionCard } from "@/components/directions/direction-card";
import { GenerateDirectionsForm } from "@/components/directions/generate-directions-form";
import {
  generateProjectDirections,
  selectDirection,
} from "@/lib/actions/directions";
import { createClient } from "@/lib/supabase/server";

export default async function DirectionsPage(
  props: PageProps<"/app/projects/[id]/directions">
) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, user_id")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id) redirect("/app");

  const { data: directions } = await supabase
    .from("directions")
    .select("id, position, name, description, palette, typography, is_selected")
    .eq("project_id", id)
    .order("position");

  const hasDirections = (directions ?? []).length > 0;
  const selected = (directions ?? []).find((d) => d.is_selected);

  const generateAction = generateProjectDirections.bind(null, id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/app"
          className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce hover:opacity-60"
        >
          {project.name}
        </Link>
        <h1 className="font-display text-3xl leading-tight md:text-4xl">
          {hasDirections
            ? "Three directions for your practice."
            : "Ready when you are."}
        </h1>
        <p className="max-w-xl text-gris-fonce">
          {hasDirections
            ? "Read each one as a stranger would. Choose the one that sounds like you on your steadiest day — you can regenerate if none of them land."
            : "We will propose three distinct personalities based on your brief. Nothing is saved unless all three clear the advertising-ethics rules for your license."}
        </p>
      </header>

      {!hasDirections && (
        <GenerateDirectionsForm
          action={generateAction}
          label="Generate three directions"
          pendingLabel="Generating…"
        />
      )}

      {hasDirections && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {(directions ?? []).map((direction) => {
              const choose = selectDirection.bind(null, id, direction.id);
              return (
                <DirectionCard
                  key={direction.id}
                  name={direction.name}
                  description={direction.description}
                  palette={direction.palette}
                  typography={direction.typography}
                  isSelected={direction.is_selected}
                  action={
                    direction.is_selected ? undefined : (
                      <form action={choose}>
                        <button
                          type="submit"
                          className="rounded-full border border-noir px-5 py-2 font-mono text-sm transition-colors hover:bg-noir hover:text-cream-light"
                        >
                          Choose this direction
                        </button>
                      </form>
                    )
                  }
                />
              );
            })}
          </div>

          <div className="flex flex-col gap-6 border-t border-noir/10 pt-6">
            {selected ? (
              <div className="flex flex-col gap-3">
                <p className="text-gris-fonce">
                  You chose <strong>{selected.name}</strong>. Next, we build the
                  full brand kit: positioning, voice guide, website copy for
                  every page you asked for, and a prompt you can paste into your
                  site builder.
                </p>
                <Link
                  href={`/app/projects/${id}/kit`}
                  className="self-start rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light transition-colors hover:bg-gris-fonce"
                >
                  Build my brand kit
                </Link>
              </div>
            ) : (
              <p className="text-gris-fonce">
                Choose a direction to continue to your brand kit.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
                None of these land?
              </p>
              <GenerateDirectionsForm
                action={generateAction}
                label="Generate three new directions"
                pendingLabel="Generating…"
              />
              <p className="font-mono text-xs text-gris-fonce">
                Regenerating replaces all three. Your choice is cleared.
              </p>
            </div>
          </div>
        </>
      )}

      <Link href="/app" className="font-mono text-sm underline hover:opacity-60">
        Back to your practices
      </Link>
    </div>
  );
}
