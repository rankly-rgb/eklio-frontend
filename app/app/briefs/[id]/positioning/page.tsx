import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrief } from "@/lib/data/brief";
import { readCatalog } from "@/lib/catalog/read";
import { uspOptionsSchema } from "@/lib/generation/how-you-work-shapes";
import { PositioningScreen } from "@/components/brief/positioning-screen";
import { MonoLabel } from "@/components/ui/mono-label";
import { AfterTheBrief } from "@/components/brief/after-the-brief";

/*
 * L'écran de positionnement (§2.4). Route À PART, entre le récapitulatif et
 * la génération — pas une huitième étape du brief.
 *
 * ⚠ LA JAUGE À « 7 DE 7 » A ÉTÉ RETIRÉE D'ICI. Elle disait vrai sur le brief
 * et faux sur ce qui restait : une barre pleine, sur un écran qui n'est pas le
 * dernier. La marche d'acquisition l'a relevé — la prospect finit une jauge,
 * puis découvre deux écrans dont rien n'annonçait l'existence, sur un chemin
 * vendu comme « sept étapes ».
 *
 * `AfterTheBrief` la remplace : trois repères NOMMÉS, jamais numérotés, donc
 * impossibles à confondre avec des étapes de brief — et le nombre d'écrans
 * restants dit en toutes lettres.
 */
export default async function PositioningPage({
  params,
}: PageProps<"/app/briefs/[id]/positioning">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/briefs/${id}/positioning`);

  const bundle = await loadBrief(supabase, id, user.id);
  if (!bundle) notFound();

  const catalog = await readCatalog(supabase);
  const parsedOptions = uspOptionsSchema.safeParse(bundle.brief.usp_options);

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pt-6 pb-16 max-md:px-[var(--gutter-sm)]">
      <div className="mx-auto flex max-w-brief flex-col">
        <AfterTheBrief current="positioning" />

        <div className="mt-8 flex flex-col gap-3">
          <MonoLabel tracking="18">Positioning</MonoLabel>
          <h1 className="text-pretty font-display text-question font-medium leading-title tracking-question text-ink max-md:text-question-sm">
            Three ways to say what you do.
          </h1>
          <p className="max-w-[560px] text-helper leading-prose text-ink-2">
            Pick the one that sounds like your practice. Edit it as much as you
            want.
          </p>
        </div>

        <div className="mt-9">
          <PositioningScreen
            projectId={id}
            catalog={catalog}
            modalityIds={bundle.brief.modality_ids ?? []}
            initialOptions={parsedOptions.success ? parsedOptions.data : null}
            initialSelectedId={bundle.brief.selected_usp_id}
            initialStatement={bundle.brief.usp_statement}
            initialRegenerateCount={bundle.data.usp_regenerate_count ?? 0}
          />
        </div>
      </div>
    </main>
  );
}
