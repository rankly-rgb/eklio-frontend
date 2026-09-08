import { Skeleton } from "@/components/ui/skeleton";

/*
 * The section column's loading boundary — and it lives INSIDE the group on
 * purpose, which is the whole of what this file is.
 *
 * There used to be a kit-shaped skeleton one level up, at `[id]/loading.tsx`.
 * That segment holds five screens that are not the kit — the reveal, the
 * delivery ceremony, the handoff sheet, her own uploads and the site editor —
 * and all five flashed a header band, a rail and a 520px mockup block on the
 * way in. The shell this lot built made that heavier and more obviously
 * wrong, so the skeleton moved down here, where the only thing below it IS a
 * section.
 *
 * Two consequences, both wanted. Those five screens now fall back to
 * `app/app/loading.tsx`, the generic app skeleton, which is the honest
 * default for a screen nobody wrote one for. And a move between sections —
 * Colors to Type — suspends HERE rather than above the sections layout, so
 * the band and the rail stay put and only the column she is reading redraws.
 * A persistent rail that blinks away on every navigation is not one.
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
