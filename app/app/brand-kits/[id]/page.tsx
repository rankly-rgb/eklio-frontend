import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import {
  getSubscription,
  isBrandKitEntitled,
  isEntitledToMonthlyPresence,
  purchaseWasReversed,
} from "@/lib/billing/entitlements";
import { BrandKitView } from "@/components/kit/brand-kit-view";
import { siteSpecGet } from "@/lib/site/rpc";
import { readSiteCatalog } from "@/lib/site/catalog";
import { builderOf } from "@/lib/site/output";

/*
 * Le kit de marque — Écrans 5 et 6, une seule page qui défile.
 *
 * Sans direction retenue, il n'y a rien à rendre : on renvoie sur la
 * révélation plutôt que d'afficher un kit à moitié vide.
 *
 * ⚠ LE DROIT SE DEMANDE À LA BASE, pas à la colonne d'à côté. Cette page était
 * gardée par `selected_direction_id`, ce qui n'est pas une garde mais un effet
 * de bord : une praticienne non payante ne pouvait plus écrire cette colonne,
 * donc elle n'arrivait pas jusqu'ici. Ça tombe dès qu'une ligne existe déjà.
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

  // La révélation reste gratuite et entière : c'est là qu'on vend, et c'est là
  // qu'on la renvoie si le kit n'est pas déverrouillé.
  if (!(await isBrandKitEntitled(supabase, id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(
      `/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`
    );
  }

  /*
   * Le constructeur retenu, pour la carte « Your site ».
   *
   * Les deux lectures sont TOLÉRANTES : un kit dont le spec n'a pas encore été
   * semé rend la carte sans nom de constructeur, ce qui est vrai. Faire échouer
   * le kit entier pour un libellé serait disproportionné.
   */
  const [subscription, siteSpec, siteCatalog] = await Promise.all([
    getSubscription(supabase, user.id),
    siteSpecGet(supabase, id),
    readSiteCatalog(supabase).catch(() => null),
  ]);

  const siteBuilderLabel =
    siteSpec.ok && siteCatalog
      ? builderOf(siteCatalog.builder_targets, siteSpec.data.spec.target).label
      : null;

  return (
    <BrandKitView
      brandKitId={id}
      projectId={kit.projectId}
      practiceName={kit.practiceName}
      direction={kit.selectedDirection}
      socialTemplates={kit.socialTemplates}
      voiceGuide={kit.voiceGuide}
      practitionerLine={kit.row.practitioner_line}
      siteBuilderLabel={siteBuilderLabel}
      // Une seule règle d'accès dans toute l'application (§7).
      entitled={isEntitledToMonthlyPresence(subscription)}
      monthlyCheckoutHref={`/app/checkout?project=${kit.projectId}`}
    />
  );
}
