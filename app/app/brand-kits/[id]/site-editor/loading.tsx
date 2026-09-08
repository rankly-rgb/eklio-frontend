import { Skeleton } from "@/components/ui/skeleton";

/*
 * Squelette de l'éditeur : rail de 360px, maquette, panneau de sortie.
 *
 * Jamais un spinner (§2 du système), et jamais une maquette nue : la forme
 * annoncée ici est celle qui arrive, pour que l'écran ne se réorganise pas
 * sous les yeux au moment où les données tombent.
 */
export default function SiteEditorLoading() {
  return (
    <main
      aria-busy="true"
      className="flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-[320px] max-w-full" radius="4px" />
        <Skeleton className="h-3 w-[420px] max-w-full" radius="2px" />
      </div>

      <div className="mt-8 flex gap-8 max-[1100px]:flex-col">
        <Skeleton
          className="h-[560px] w-[360px] flex-none max-[1100px]:w-full"
          radius="var(--radius-card)"
        />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-[560px] w-full" radius="var(--radius-card)" />
        </div>
      </div>

      <Skeleton className="mt-10 h-[280px] w-full" radius="var(--radius-card)" />
    </main>
  );
}
