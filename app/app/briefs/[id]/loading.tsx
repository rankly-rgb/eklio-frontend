import { Skeleton } from "@/components/ui/skeleton";

/*
 * Le squelette du brief. Il épouse le gabarit qu'il remplace — jauge, question,
 * grille, rail — plutôt que d'afficher une roue au milieu de l'écran (§2).
 */
export default function BriefLoading() {
  return (
    <main className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <div className="flex-none p-[20px_var(--gutter)_0] max-md:p-[40px_var(--gutter-sm)_0]">
        <div className="mb-2.5 flex justify-end">
          <Skeleton className="h-3 w-[88px]" radius="2px" />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-[3px]" radius="999px" />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-4 pl-[var(--gutter)] pr-14 pt-8 max-md:px-[var(--gutter-sm)]">
          <Skeleton className="h-3 w-[92px]" radius="2px" />
          <Skeleton className="h-11 w-[520px] max-w-full" radius="4px" />
          <Skeleton className="h-4 w-[420px] max-w-full" radius="2px" />
          <div className="mt-6 grid max-w-brief grid-cols-3 gap-6">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-[190px]" radius="var(--radius-card)" />
            ))}
          </div>
        </div>

        <aside className="w-rail flex-none border-l border-line p-[44px_48px_0_40px] max-lg:hidden">
          <Skeleton className="h-[420px] w-full" radius="var(--radius-card)" />
        </aside>
      </div>
    </main>
  );
}
