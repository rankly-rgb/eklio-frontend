import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { SectionHeader } from "@/components/ui/section-header";
import { ContentGrid } from "@/components/home/content-grid";
import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";

/*
 * Le mois entier (lien « Content » de l'en-tête).
 *
 * Il n'a pas de référence dédiée : il reprend la grille de l'Écran 7, à seize
 * tuiles au lieu de cinq. Pas de nouveau motif inventé pour l'occasion.
 */
export default async function ContentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/content");

  const home = await loadHome(supabase, user.id);
  const direction =
    home.brandKit?.selectedDirection ?? home.brandKit?.directions?.[0] ?? null;

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)]">
      <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
        This month, in your brand
      </h1>

      {direction && home.calendar.items.length > 0 ? (
        <section className="mt-8 flex flex-col gap-5">
          <SectionHeader title="Posts and stories" mono={home.monthLabel} />
          <ContentGrid
            items={home.calendar.items}
            palette={direction.palette}
            typography={direction.typography}
            lockedCount={home.calendar.locked_count}
            monthLabel={home.monthLabel}
            columns={4}
          />
        </section>
      ) : (
        <div className="mt-8 flex max-w-[520px] flex-col gap-5 rounded-card border border-line p-8">
          <MonoLabel tracking="16">Nothing yet</MonoLabel>
          <p className="text-helper leading-prose text-ink-2">
            {home.brandKit
              ? "Your first month arrives on the first. One post is ready straight away, and the rest of the month is there when you want it."
              : "Content follows your brand. Finish your brief and choose a direction first."}
          </p>
          <ButtonLink
            href={home.brandKit ? `/app/brand-kits/${home.brandKit.row.id}` : "/app"}
            variant="secondary"
            className="self-start"
          >
            {home.brandKit ? "Open brand kit" : "Back home"}
          </ButtonLink>
        </div>
      )}
    </main>
  );
}
