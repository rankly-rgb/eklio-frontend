import { Skeleton } from "@/components/ui/skeleton";

/* Squelette du kit : en-tête, maquette de 900px, bandeau de palette. */
export default function BrandKitLoading() {
  return (
    <main
      aria-busy="true"
      className="flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]"
    >
      <div className="flex items-end gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Skeleton className="h-9 w-[360px] max-w-full" radius="4px" />
          <Skeleton className="h-3 w-[220px]" radius="2px" />
        </div>
        <Skeleton className="h-10 w-[180px]" radius="999px" />
      </div>

      <Skeleton className="mt-8 h-3 w-[120px]" radius="2px" />
      <Skeleton
        className="mt-6 h-[520px] w-site-mock max-w-full"
        radius="var(--radius-card)"
      />

      <div className="mt-8 grid w-site-mock max-w-full grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-24" radius="0" />
        ))}
      </div>
    </main>
  );
}
