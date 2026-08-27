import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import {
  getSubscription,
  isEntitledToMonthlyPresence,
} from "@/lib/billing/entitlements";
import { BrandKitView } from "@/components/kit/brand-kit-view";

/*
 * Le kit de marque — Écrans 5 et 6, une seule page qui défile.
 *
 * Sans direction retenue, il n'y a rien à rendre : on renvoie sur la
 * révélation plutôt que d'afficher un kit à moitié vide.
 */
export default async function BrandKitPage({
  params,
}: PageProps<"/app/brand-kits/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/brand-kits/${id}`);

  const kit = await loadBrandKit(supabase, id, user.id);
  if (!kit) notFound();

  if (!kit.selectedDirection) {
    redirect(`/app/brand-kits/${id}/reveal`);
  }

  const subscription = await getSubscription(supabase, user.id);

  return (
    <BrandKitView
      brandKitId={id}
      projectId={kit.projectId}
      practiceName={kit.practiceName}
      direction={kit.selectedDirection}
      socialTemplates={kit.socialTemplates}
      voiceGuide={kit.voiceGuide}
      practitionerLine={kit.row.practitioner_line}
      // Une seule règle d'accès dans toute l'application (§7).
      entitled={isEntitledToMonthlyPresence(subscription)}
      monthlyCheckoutHref={`/app/checkout?project=${kit.projectId}`}
    />
  );
}
