import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { siteSpecGet } from "@/lib/site/rpc";
import { readSiteCatalog } from "@/lib/site/catalog";
import { SiteEditor } from "@/components/site/site-editor";
import { track } from "@/lib/analytics";

/*
 * L'éditeur de site.
 *
 * La praticienne a retenu une direction ; elle édite ici la SPÉCIFICATION de
 * son site, voit une maquette réagir, et repart avec des instructions prêtes à
 * coller dans son constructeur. Eklio ne construit pas et n'héberge pas —
 * l'écran le dit, parce que ça gouverne ce qu'elle attend de la suite.
 *
 * Tout est lu ICI, côté serveur, avec le jeton de la session : l'enveloppe
 * complète et le catalogue. Le client reçoit donc un premier rendu complet, et
 * n'a rien à aller chercher au montage.
 *
 * Il n'y a AUCUNE route publique dans cette fonctionnalité, et il ne doit pas y
 * en avoir : la maquette est une référence de design, à l'intérieur de
 * l'application authentifiée.
 */
export default async function SiteEditorPage({
  params,
}: PageProps<"/app/brand-kits/[id]/site">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/brand-kits/${id}/site`);

  const kit = await loadBrandKit(supabase, id, user.id);
  if (!kit) notFound();

  // Sans direction retenue, il n'y a pas de spec à semer : on renvoie là où
  // le choix se fait, plutôt que d'afficher un éditeur vide.
  if (!kit.selectedDirection) redirect(`/app/brand-kits/${id}/reveal`);

  const [envelope, catalog] = await Promise.all([
    siteSpecGet(supabase, id),
    readSiteCatalog(supabase),
  ]);

  if (!envelope.ok) {
    if (envelope.error.code === "not_found") redirect(`/app/brand-kits/${id}/reveal`);
    throw new Error(`[site-editor] ${envelope.error.code}: ${envelope.error.message}`);
  }

  track("site_editor_opened", { brandKitId: id, target: envelope.data.spec.target });

  return (
    <SiteEditor
      brandKitId={id}
      initial={envelope.data}
      catalog={catalog}
      direction={kit.selectedDirection}
    />
  );
}
