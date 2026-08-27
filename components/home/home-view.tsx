import Link from "next/link";
import { MonoLabel } from "@/components/ui/mono-label";
import { SectionHeader } from "@/components/ui/section-header";
import { ButtonLink } from "@/components/ui/button";
import { BrandPreview } from "@/components/preview/brand-preview";
import { ChecklistCard } from "@/components/home/checklist-card";
import { ContentGrid } from "@/components/home/content-grid";
import { StartBriefButton } from "@/components/brief/start-brief-button";
import { previewModelFromDirection } from "@/lib/brand/shapes";
import { SAMPLE_PREVIEW } from "@/lib/brand/sample";
import { greeting, type HomeModel } from "@/lib/data/home";

/*
 * L'accueil de rétention (Écran 7).
 *
 * AU PLUS UN NUDGE. La priorité vit dans `lib/data/home.ts` : ce qui gagne
 * s'affiche, et rien d'autre. Trois cartes qui réclament l'attention en même
 * temps, c'est un tableau de bord — exactement ce que ce produit n'est pas.
 */
export function HomeView({ home }: { home: HomeModel }) {
  const kit = home.brandKit;
  const direction = kit?.selectedDirection ?? kit?.directions?.[0] ?? null;

  if (!home.projectId) return <EmptyHome />;

  const model = direction
    ? previewModelFromDirection(direction, kit?.practiceName ?? null)
    : null;

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)]">
      <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
        {greeting(home.firstName)}
      </h1>

      {home.nudge ? (
        <div className="mt-4 flex items-center gap-8 rounded-card border border-line bg-card p-[20px_24px] max-md:flex-col max-md:items-stretch max-md:gap-4">
          <p className="min-w-0 flex-1 text-body text-ink">
            {home.nudge.message}
          </p>
          <ButtonLink
            href={home.nudge.href}
            variant="primary"
            className="flex-none max-md:h-11 max-md:w-full"
          >
            {home.nudge.cta}
          </ButtonLink>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-[2fr_1fr] gap-6 max-lg:grid-cols-1">
        {model && kit ? (
          <section
            aria-labelledby="your-brand"
            className="box-border flex flex-col rounded-card border border-line p-[22px_24px]"
          >
            <MonoLabel tracking="16" as="h2" id="your-brand">
              Your brand
            </MonoLabel>

            <div className="mt-4">
              <BrandPreview model={model} variant="thumbnail" shape="site" />
            </div>

            <div className="mt-5 flex items-end gap-6 max-md:flex-col max-md:items-start max-md:gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-section font-medium tracking-card-title text-ink">
                  {kit.practiceName ?? "Your practice"}
                </p>
                <MonoLabel tracking="16" className="mt-2 block">
                  {direction?.name ?? "Not chosen yet"}
                </MonoLabel>
              </div>
              <ButtonLink
                href={`/app/brand-kits/${kit.row.id}`}
                variant="secondary"
                className="flex-none"
              >
                Open brand kit
              </ButtonLink>
            </div>
          </section>
        ) : (
          <section className="box-border flex flex-col justify-between gap-6 rounded-card border border-line p-[22px_24px]">
            <MonoLabel tracking="16" as="h2">
              Your brand
            </MonoLabel>
            <p className="max-w-[420px] text-helper leading-prose text-ink-2">
              Your brief is where it starts. About seven minutes, and you can
              stop and come back at any step.
            </p>
            <ButtonLink
              href={`/app/briefs/${home.projectId}`}
              variant="secondary"
              className="self-start"
            >
              Open my brief
            </ButtonLink>
          </section>
        )}

        {home.checklist.items.length > 0 ? (
          <ChecklistCard items={home.checklist.items} />
        ) : null}
      </div>

      {kit && direction && home.calendar.items.length > 0 ? (
        <section className="mt-7 flex flex-col gap-5">
          <SectionHeader title="This month's content" mono={home.monthLabel} />
          <ContentGrid
            items={home.calendar.items.slice(0, 5)}
            palette={direction.palette}
            typography={direction.typography}
            lockedCount={home.calendar.locked_count}
            monthLabel={home.monthLabel}
          />
          <Link
            href="/app/content"
            className="self-start text-ui text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
          >
            See the whole month
          </Link>
        </section>
      ) : null}
    </main>
  );
}

/*
 * L'état vide : une seule carte large, la maquette d'exemple, et le point
 * d'entrée. Elle MONTRE ce qu'on obtient plutôt que de le décrire — c'est le
 * même argument que le rail du brief, appliqué avant qu'il n'existe.
 */
function EmptyHome() {
  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)]">
      <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink max-md:text-question-sm">
        {greeting(null)}
      </h1>

      <div className="mt-6 flex items-start gap-12 rounded-card border border-line p-8 max-lg:flex-col">
        <div className="flex max-w-[420px] flex-col gap-5">
          <MonoLabel tracking="16">Your first brand</MonoLabel>
          <p className="text-pretty font-display text-card-title font-medium leading-card tracking-question text-ink">
            Your first brand takes about 7 minutes. Here&rsquo;s what
            you&rsquo;ll get.
          </p>
          <p className="text-helper leading-prose text-ink-2">
            A palette, a typeface pairing, a voice guide and the copy for four
            pages — plus a prompt you paste into your website builder.
          </p>
          <StartBriefButton />
        </div>

        <div className="min-w-0 flex-1">
          {/* Maquette d'exemple, figée : c'est une illustration, pas la marque
              de quelqu'un. Ses couleurs sont les seules données de marque en
              dur de l'application (`lib/brand/sample.ts`). */}
          <BrandPreview model={SAMPLE_PREVIEW} variant="thumbnail" shape="site" />
        </div>
      </div>
    </main>
  );
}
