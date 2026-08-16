import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandKitView } from "@/components/kit/brand-kit-view";
import { GenerationForm } from "@/components/generation-form";
import { generateProjectKit } from "@/lib/actions/kit";
import { getEntitlement } from "@/lib/billing/entitlements";
import { createClient } from "@/lib/supabase/server";
import type { KitContent } from "@/lib/ai/kit";

export default async function KitPage(
  props: PageProps<"/app/projects/[id]/kit">
) {
  const { id } = await props.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, user_id")
    .eq("id", id)
    .single();

  if (!project || project.user_id !== user.id) redirect("/app");

  const { data: kit } = await supabase
    .from("brand_kits")
    .select("palette, typography, content, export_prompt, direction_snapshot")
    .eq("project_id", id)
    .maybeSingle();

  const { data: direction } = await supabase
    .from("directions")
    .select("id, name")
    .eq("project_id", id)
    .eq("is_selected", true)
    .maybeSingle();

  const { tier, hasMonthlyPresence } = await getEntitlement(id);
  const buildAction = generateProjectKit.bind(null, id);

  if (!kit) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-2">
          <Link
            href="/app"
            className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce hover:opacity-60"
          >
            {project.name}
          </Link>
          <h1 className="font-display text-3xl leading-tight md:text-4xl">
            Build your brand kit.
          </h1>
        </header>

        {!direction ? (
          <>
            <p className="max-w-xl text-gris-fonce">
              Choose one of your three directions first — the kit is built from
              it.
            </p>
            <Link
              href={`/app/projects/${id}/directions`}
              className="self-start rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light transition-colors hover:bg-gris-fonce"
            >
              Back to your directions
            </Link>
          </>
        ) : !tier ? (
          <>
            <p className="max-w-xl text-gris-fonce">
              Working from <strong>{direction.name}</strong>. Choose a plan and
              we will write the kit: positioning and brand story, a voice guide,
              website copy, and a prompt you can paste into your site builder.
            </p>
            <Link
              href={`/app/projects/${id}/checkout`}
              className="self-start rounded-full bg-noir px-6 py-3 font-mono text-sm text-cream-light transition-colors hover:bg-gris-fonce"
            >
              Choose your plan
            </Link>
          </>
        ) : (
          <>
            <p className="max-w-xl text-gris-fonce">
              Working from <strong>{direction.name}</strong> on the{" "}
              <strong>{tier.name}</strong> plan. Every line is checked against
              the advertising-ethics rules before it reaches you.
            </p>
            <GenerationForm
              action={buildAction}
              label="Build my brand kit"
              pendingLabel="Building…"
            />
          </>
        )}
      </div>
    );
  }

  const snapshot = kit.direction_snapshot as { name?: string };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      <Link
        href="/app"
        className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce hover:opacity-60"
      >
        Back to your practices
      </Link>

      <BrandKitView
        practiceName={project.name}
        directionName={snapshot.name ?? direction?.name ?? "Your direction"}
        palette={kit.palette}
        typography={kit.typography}
        content={kit.content as unknown as KitContent}
        exportPrompt={kit.export_prompt ?? ""}
      />

      <div className="flex flex-col gap-2 border-t border-noir/10 pt-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
          Not quite right?
        </p>
        <GenerationForm
          action={buildAction}
          label="Rebuild my brand kit"
          pendingLabel="Rebuilding…"
        />
        <p className="font-mono text-xs text-gris-fonce">
          Rebuilding replaces this kit. Your chosen direction stays as it is.
        </p>
      </div>

      {hasMonthlyPresence && (
        <Link
          href={`/app/projects/${id}/presence`}
          className="font-mono text-sm underline hover:opacity-60"
        >
          Go to Monthly Presence
        </Link>
      )}
    </div>
  );
}
