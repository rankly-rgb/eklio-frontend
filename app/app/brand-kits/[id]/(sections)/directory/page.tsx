import { requireKitPage } from "@/lib/data/kit-page";
import { surfaceAccess } from "@/lib/billing/surface-access";
import { TierGate } from "@/components/billing/tier-gate";
import { SectionHeader } from "@/components/ui/section-header";
import { DirectoryProfile } from "@/components/kit/directory-profile";
import { loadDirectoryProfile } from "@/lib/data/directory";
import { createClient } from "@/lib/supabase/server";

/*
 * Le profil d'annuaire — le livrable central de The Foundation, et le dernier
 * des quatre à recevoir un écran.
 *
 * ⚠ CETTE PAGE EXISTE PARCE QUE `lib/directory/profile.ts` N'ÉTAIT IMPORTÉ
 * QUE PAR SON PROPRE TEST. Troisième occurrence du même défaut dans ce dépôt,
 * après `lib/brief/platform.ts` et la question de plateforme de l'étape 1.
 * Le module était juste ; il ne menait nulle part.
 */
export default async function KitDirectoryPage({
  params,
}: PageProps<"/app/brand-kits/[id]/directory">) {
  const { id } = await params;
  const model = await requireKitPage(id);

  /*
   * ⚠ LA GARDE D'ABORD, LA LECTURE ENSUITE. `kit_directory` est la première
   * surface à exiger `foundation` : les trois paliers précédents n'ont jamais
   * acheté ce livrable, et lire son contenu avant de savoir si elle peut le
   * voir serait une lecture faite pour rien — et un jour, montrée par erreur.
   */
  const gate = surfaceAccess("kit_directory", model.entitledTier);
  if (!gate.ok) return <TierGate access={gate} projectId={model.kit.projectId} />;

  const supabase = await createClient();
  const view = await loadDirectoryProfile(supabase, model.brandKitId, model.kit.projectId);

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title="Your directory profile" id="kit-directory-heading" />
      <DirectoryProfile view={view} />
    </section>
  );
}
