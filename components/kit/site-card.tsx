import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";
import { BrandPreview } from "@/components/preview/brand-preview";
import type { PreviewModel } from "@/lib/brand/shapes";

/*
 * La carte « Your site » du kit de marque.
 *
 * Elle REMPLACE la section « Site prompt », qui composait le prompt dans ce
 * dépôt et l'affichait en bloc. La base est désormais la source unique : le
 * texte à coller vit dans l'éditeur, avec la maquette qui le produit, et il n'y
 * a plus de raison d'en montrer une copie ici.
 *
 * La carte porte donc trois choses, et pas une de plus : à quoi ça ressemble,
 * pour quel constructeur, et par où entrer.
 */
export function SiteCard({
  brandKitId,
  model,
  builderLabel,
}: {
  brandKitId: string;
  model: PreviewModel;
  /** Le constructeur courant, ou `null` si le spec n'a pas encore été semé. */
  builderLabel: string | null;
}) {
  return (
    <div className="flex items-end gap-8 rounded-card border border-line p-[22px_24px] max-lg:flex-col max-lg:items-stretch max-lg:gap-5">
      <div className="w-[320px] flex-none max-lg:w-full">
        <BrandPreview model={model} variant="thumbnail" shape="site" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="max-w-[440px] text-body leading-prose text-ink">
          Edit your pages, colors and copy, and leave with instructions for your
          builder. Eklio doesn&rsquo;t build or host your site.
        </p>
        <MonoLabel tracking="16" className="mt-3 block">
          {builderLabel ? `Building with ${builderLabel}` : "No builder chosen yet"}
        </MonoLabel>
      </div>

      <div className="flex flex-none items-center gap-5">
        <ButtonLink href={`/app/brand-kits/${brandKitId}/site`} variant="primary">
          Edit your site
        </ButtonLink>
        <Link
          href={`/app/brand-kits/${brandKitId}/site`}
          className="whitespace-nowrap text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
        >
          See the instructions
        </Link>
      </div>
    </div>
  );
}
