import { Skeleton } from "@/components/ui/skeleton";

/*
 * The section column's own loading boundary — and it exists for a specific
 * reason rather than for completeness.
 *
 * Without one here, a move from Colors to Type suspends at the nearest
 * boundary ABOVE, which is `[id]/loading.tsx` — and that one replaces the
 * whole kit, band and rail included. The shell would blink away on every
 * single section switch, which is the one thing a persistent rail exists to
 * stop. With this file the boundary sits INSIDE the sections layout, so the
 * band and the rail stay put and only the column she is reading redraws.
 *
 * `[id]/loading.tsx` still covers the first load of a kit, and the siblings
 * outside this group.
 */
export default function KitSectionLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div className="flex items-center gap-6">
        <Skeleton className="h-6 w-[140px]" radius="3px" />
        <div className="h-px flex-1 bg-line" />
      </div>
      <Skeleton className="h-[420px] w-full" radius="var(--radius-card)" />
    </div>
  );
}
