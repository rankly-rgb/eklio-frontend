import { Skeleton } from "@/components/ui/skeleton";

/* Squelette de l'accueil : salutation, nudge, puis la grille 2fr 1fr. */
export default function AppHomeLoading() {
  return (
    <main
      aria-busy="true"
      className="flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)]"
    >
      <Skeleton className="h-9 w-[320px] max-w-full" radius="4px" />
      <Skeleton className="mt-4 h-[80px]" radius="var(--radius-card)" />
      <div className="mt-5 grid grid-cols-[2fr_1fr] gap-6 max-lg:grid-cols-1">
        <Skeleton className="h-[320px]" radius="var(--radius-card)" />
        <Skeleton className="h-[320px]" radius="var(--radius-card)" />
      </div>
    </main>
  );
}
