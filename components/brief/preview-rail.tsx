"use client";

import { BrandPreview } from "@/components/preview/brand-preview";
import { Skeleton } from "@/components/ui/skeleton";
import type { PreviewModel } from "@/lib/brand/shapes";

/*
 * Le rail de prévisualisation du brief (Écrans 1 et 2).
 *
 * 420px fixes, filet à gauche, `padding: 44px 48px 0 40px` — relevé au pixel.
 * Il porte l'UNIQUE ombre de l'application, et c'est la seule chose saturée de
 * l'écran.
 *
 * Le squelette épouse la maquette qu'il remplace : jamais de roue qui tourne.
 */
export function PreviewRail({ model }: { model: PreviewModel | null }) {
  return (
    <aside
      aria-label="Live preview of your site"
      className="w-rail flex-none border-l border-line p-[44px_48px_0_40px] max-lg:hidden"
    >
      {model ? (
        <BrandPreview model={model} size="panel" />
      ) : (
        <>
          <Skeleton className="h-[420px] w-full" radius="var(--radius-card)" />
          <p className="mt-[18px] font-display text-[14px] text-ink-2">
            Your site, taking shape.
          </p>
        </>
      )}
    </aside>
  );
}
