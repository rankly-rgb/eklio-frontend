import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { loadRevealPayload } from "@/lib/data/reveal";
import { readJob, statusOf } from "@/lib/generation/job";
import { GenerationScreen } from "@/components/reveal/generation-screen";
import { ActTwoStatic } from "@/components/reveal/ceremony/act-two";

/*
 * Génération (Écran 3) puis révélation — la même route, deux états.
 *
 * ⚠ EN CHANTIER (plan de livraison, étape 3/7). Cette route rendait jusqu'ici
 * `<RevealView>` — l'écran à trois colonnes (Écran 4). Elle rend désormais
 * `<ActTwoStatic>`, la coquille de la cérémonie plein écran, mais seulement sa
 * scène statique pour une direction : ni cascade, ni couche de preuve, ni
 * zone de décision, ni navigation entre les trois directions — voir le
 * commentaire de tête d'`act-two.tsx`. Conséquence directe : **le choix d'une
 * direction est temporairement inatteignable depuis cette route** tant que
 * l'étape 4 n'a pas posé la zone de décision. `<RevealView>` et
 * `<DirectionCard>` ne sont pas supprimés — ils redeviendront la vue
 * « Compare » (§ Acte 3, étape 6) — mais rien ne les importe plus d'ici.
 *
 * `maxDuration` : cette page n'appelle pas le modèle (la génération vit dans
 * `POST /api/briefs/[id]/generate`, qui porte son propre plafond), mais elle
 * est l'écran où le praticien attend. Le plafond ci-dessous couvre le rendu et
 * les lectures, pas la génération.
 */
export const maxDuration = 300;

export default async function RevealPage({
  params,
}: PageProps<"/app/brand-kits/[id]/reveal">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/brand-kits/${id}/reveal`);

  const kit = await loadBrandKit(supabase, id, user.id);
  if (!kit) notFound();

  const status = statusOf(readJob(kit.row.content), kit.directions !== null);

  if (!kit.directions) {
    return (
      <GenerationScreen
        brandKitId={id}
        projectId={kit.projectId}
        initialStageIndex={status?.stageIndex ?? 0}
      />
    );
  }

  /*
   * `loadRevealPayload` appelle `brand_kit_reveal_get` (eklio-backend) plutôt
   * que de relire `kit.directions` : c'est la seule source du résumé de
   * contraste réel et de `ambiance_url` par direction. L'appartenance a déjà
   * été confirmée par `loadBrandKit` ci-dessus ; un échec ici serait donc une
   * incohérence entre les deux lectures, pas un cas d'usage normal — d'où le
   * 404 plutôt qu'un état d'erreur dédié.
   */
  const outcome = await loadRevealPayload(supabase, id);
  if (!outcome.ok) notFound();

  const shown = outcome.payload.directions[0];

  return (
    <ActTwoStatic
      direction={shown}
      practiceName={outcome.payload.practice.name}
      specialties={outcome.payload.practice.specialties}
      index={0}
      total={outcome.payload.directions.length}
    />
  );
}
