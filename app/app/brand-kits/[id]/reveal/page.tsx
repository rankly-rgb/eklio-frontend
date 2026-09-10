import { notFound } from "next/navigation";
import { requireBriefAccess } from "@/lib/anon/require-brief";
import { EmailMeALink } from "@/components/brief/email-me-a-link";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { loadRevealPayload } from "@/lib/data/reveal";
import { readJob, statusOf } from "@/lib/generation/job";
import { resolveEntitledTier } from "@/lib/billing/entitlements";
import { GenerationScreen } from "@/components/reveal/generation-screen";
import { RevealCeremony } from "@/components/reveal/ceremony/reveal-ceremony";

/*
 * Génération (Écran 3) puis révélation — la même route, deux états.
 *
 * ⚠ EN CHANTIER (plan de livraison, étape 4/7). `<RevealCeremony>` gère
 * désormais les trois directions, la navigation, la zone de décision (le
 * VRAI chemin de sélection — `lib/reveal/use-select-direction.ts`) et la
 * couche de preuve. Reste hors de cette étape : l'Acte 1 (nom, transition) et
 * l'Acte 3 « Compare » — `<RevealView>`/`<DirectionCard>` ne sont toujours
 * pas supprimés, rien ne les importe encore. Voir aussi `act-two.tsx` :
 * l'arrangement de la cascade n'est PAS vérifié contre
 * `reveal-ref-1-ceremony.png`, ce fichier n'ayant pas atteint la session.
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

  const { supabase, userId, anonymous } = await requireBriefAccess(
    `/app/brand-kits/${id}/reveal`
  );

  const kit = await loadBrandKit(supabase, id, userId);
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
  const [outcome, tier] = await Promise.all([
    loadRevealPayload(supabase, id),
    resolveEntitledTier(supabase, kit.projectId),
  ]);
  if (!outcome.ok) notFound();

  return (
    <>
      <RevealCeremony
        brandKitId={id}
        projectId={kit.projectId}
        payload={outcome.payload}
        paid={tier !== null}
      />

      {/*
        ⚠ THE SECOND ASK, AND THE BETTER ONE. She is looking at three finished
        directions with her practice's name on them — the moment an email
        address is worth giving, and the moment losing this would actually
        hurt. Under the ceremony, never in front of it: the reveal is what she
        came for, and nothing may stand between her and it.

        Only for an anonymous brief; a signed-in one is already hers.
      */}
      {anonymous ? (
        <div className="mx-auto w-full max-w-[560px] px-[var(--gutter-sm)] pb-16">
          <EmailMeALink projectId={kit.projectId} where="reveal" />
        </div>
      ) : null}
    </>
  );
}
