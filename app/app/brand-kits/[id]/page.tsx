import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { isBrandKitEntitled, isCompAccessActive, purchaseWasReversed } from "@/lib/billing/entitlements";
import { BrandKitView } from "@/components/kit/brand-kit-view";
import { siteSpecGet } from "@/lib/site/rpc";
import { readSiteCatalog } from "@/lib/site/catalog";
import { builderOf } from "@/lib/site/output";
import { readCatalog } from "@/lib/catalog/read";
import { loadLaunchProgress } from "@/lib/data/checklist";
import type { PracticeDetails } from "@/lib/kit/launch-copy";

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
  const [siteSpec, siteCatalog, catalog, launchProgress, compAccess] = await Promise.all([
    siteSpecGet(supabase, id),
    readSiteCatalog(supabase).catch(() => null),
    readCatalog(supabase).catch(() => null),
    loadLaunchProgress(supabase, id),
    isCompAccessActive(supabase),
  ]);

  // Same fields `lib/kit/asset-context.ts` reads from the site spec for the
  // asset renderers — reused here rather than re-fetched, since this page
  // already loaded `siteSpec` for the "Your site" card.
  const practiceDetails: PracticeDetails | null = siteSpec.ok && siteSpec.data.spec.practice_details
    ? {
        practitionerName: siteSpec.data.spec.practice_details.practitioner_name ?? null,
        licenseLabel: siteSpec.data.spec.practice_details.license_label ?? null,
        licenseNumber: siteSpec.data.spec.practice_details.license_number ?? null,
        city: siteSpec.data.spec.practice_details.city ?? null,
        state: siteSpec.data.spec.practice_details.state ?? null,
      }
    : null;
  const bookingUrl = siteSpec.ok ? siteSpec.data.spec.hero.cta_target_url || null : null;

  const siteBuilderLabel =
    siteSpec.ok && siteCatalog
      ? builderOf(siteCatalog.builder_targets, siteSpec.data.spec.target).label
      : null;

  // The real six ethics_rules rows — the same source `lib/ethics/guard.ts`'s
  // own `rulesBlock()` reads for prompts. Passed down so the BOARD-SAFE COPY
  // badge and "Check your own words" can show her the real rule text, never
  // a second hand-written copy of it.
  const ethicsRules = (catalog?.ethicsRules ?? []).map((rule) => ({
    id: rule.id,
    label: rule.short_label,
    description: rule.description,
  }));

  /*
   * The six color roles and four derived variants (§3 of the contract), and
   * the seven real contrast pairs (§4) — exactly as the database computed
   * them, never re-derived here (the contract is explicit: a client-side
   * float implementation will disagree with the database on a boundary).
   * `null` only in the tolerated edge case where an entitled kit's site spec
   * hasn't been seeded yet; the paid-space canvases show their own "still
   * setting up" state rather than approximate her palette client-side.
   */
  const canvasTokens = siteSpec.ok ? siteSpec.data.preview.tokens : null;
  const canvasContrast = siteSpec.ok ? siteSpec.data.contrast : null;

  return (
    <BrandKitView
      brandKitId={id}
      projectId={kit.projectId}
      practiceName={kit.practiceName}
      direction={kit.selectedDirection}
      voiceGuide={kit.voiceGuide}
      ethicsCheck={kit.ethicsCheck}
      ethicsRules={ethicsRules}
      siteBuilderLabel={siteBuilderLabel}
      canvasTokens={canvasTokens}
      canvasContrast={canvasContrast}
      launchProgress={launchProgress}
      practitionerLine={kit.row.practitioner_line}
      practiceDetails={practiceDetails}
      bookingUrl={bookingUrl}
      compAccess={compAccess}
    />
  );
}
