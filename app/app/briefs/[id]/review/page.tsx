import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrief, readPreview } from "@/lib/data/brief";
import { readCatalog } from "@/lib/catalog/read";
import { summarize, isAnswered } from "@/lib/brief/summary";
import type { StepDraft } from "@/lib/brief/flow";
import { BrandPreview } from "@/components/preview/brand-preview";
import { BuildBrandButton } from "@/components/brief/build-brand-button";
import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";

/*
 * Récapitulatif du brief (§5).
 *
 * Le brief à gauche, la maquette à 900px à droite : la dernière chose que le
 * praticien voit avant de lancer la génération est ce qu'il a déjà obtenu, pas
 * un formulaire.
 *
 * Chaque section porte son « Edit », qui rouvre le brief À SA QUESTION via
 * `?step=`. L'amorce ne s'écrit nulle part : `progress_step` reste canonique.
 */
export default async function ReviewPage({
  params,
}: PageProps<"/app/briefs/[id]/review">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/briefs/${id}/review`);

  const bundle = await loadBrief(supabase, id, user.id);
  if (!bundle) notFound();

  const [catalog, preview] = await Promise.all([
    readCatalog(supabase),
    readPreview(supabase, id),
  ]);

  const draft: StepDraft = {
    practice_name: bundle.brief.practice_name,
    license_type_id: bundle.brief.license_type_id,
    specialty_ids: bundle.brief.specialty_ids,
    city: bundle.brief.city,
    state: bundle.brief.state,
    positioning: bundle.brief.positioning,
    problem_card_ids: bundle.brief.problem_card_ids,
    gain_card_ids: bundle.brief.gain_card_ids,
    client_persona_ids: bundle.brief.client_persona_ids,
    tone_card_id: bundle.brief.tone_card_id,
    palette_family_ids: bundle.brief.palette_family_ids,
    type_pairing_id: bundle.brief.type_pairing_id,
    primary_action_id: bundle.brief.primary_action_id,
    site_goal_ids: bundle.brief.site_goal_ids,
    data: bundle.data,
  };

  const sections = summarize(draft, bundle.data, catalog);

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pt-6 pb-16 max-md:px-[var(--gutter-sm)]">
      <div className="flex items-start gap-12 max-xl:flex-col">
        <div className="flex w-[380px] flex-none flex-col gap-8 max-xl:w-full">
          <div className="flex flex-col gap-3">
            <MonoLabel tracking="18">Your brief</MonoLabel>
            <h1 className="font-display text-h1 font-medium leading-tight tracking-h1">
              Everything we&rsquo;ll work from.
            </h1>
            <p className="text-helper leading-prose text-ink-2">
              Change anything before we build. Nothing here is final — you can
              regenerate later.
            </p>
          </div>

          <dl className="flex flex-col">
            {sections.map((section) => (
              <div
                key={section.step}
                className="flex items-start gap-6 border-t border-line py-5"
              >
                <div className="min-w-0 flex-1">
                  <dt>
                    <MonoLabel tracking="16">{section.title}</MonoLabel>
                  </dt>
                  <dd className="mt-2 flex flex-col gap-1">
                    {section.lines.map((line, index) => (
                      <span
                        key={`${section.step}-${index}`}
                        className={`text-ui leading-body ${
                          isAnswered(section) ? "text-ink" : "text-ink-3"
                        }`}
                      >
                        {line}
                      </span>
                    ))}
                  </dd>
                </div>
                <Link
                  href={`/app/briefs/${id}?step=${section.stepNumber}`}
                  className="mt-0.5 flex-none text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
                >
                  Edit
                </Link>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-4 border-t border-line pt-6">
            <BuildBrandButton projectId={id} />
            <ButtonLink
              href={`/app/briefs/${id}`}
              variant="tertiary"
              className="self-start"
            >
              Back to the brief
            </ButtonLink>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {preview ? (
            <div className="w-site-mock max-w-full">
              <BrandPreview model={preview} size="full" />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
