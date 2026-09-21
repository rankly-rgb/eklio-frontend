import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import {
  checkinAnswered,
  contentMonthKey,
  getContentCheckin,
  getContentMonth,
  getContentMonthRecord,
  getContentPreferences,
  getContentRegisters,
} from "@/lib/data/content";
import { getCreditMeter } from "@/lib/billing/credits";
import { ContentCalendar } from "@/components/content/content-calendar";
import { ContentStream, HerOwnPosts, MonthProgress } from "@/components/content/content-stream";
import { partitionMonth } from "@/lib/content/partition";
import { CheckInLine } from "@/components/content/check-in-line";
import { MonthFailed, MonthGenerating } from "@/components/content/month-generating";
import {
  MonthEmpty,
  MonthFailedToLoad,
  MonthNotDeployed,
} from "@/components/content/month-states";
import { contentGenerationArmed } from "@/lib/content/generate/armed";
import { deployEnvName, showsTechnicalDetail } from "@/lib/env/deploy";
import { monthScreen } from "@/lib/content/month-screen";
import { CreditsMeter } from "@/components/content/credits-meter";
import { PreferencesForm } from "@/components/content/preferences-form";
import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";

/*
 * /app/content — the month, as a calendar she writes in.
 *
 * LOT 6 replaces the sixteen-tile grid this page used to render. That grid
 * came from `monthly_presence_content`, one row per generated slot, which the
 * client could not write to at all. These are her own rows in `content_items`.
 *
 * The gate is the KIT's entitlement, not a Monthly Presence subscription:
 * planning her own posts is part of the brand she bought. Monthly Presence is
 * about content generated FOR her, which this lot does not build.
 */
export default async function ContentPage({ searchParams }: PageProps<"/app/content">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/content");

  const home = await loadHome(supabase, user.id);
  const kit = home.brandKit;

  if (!kit) {
    return (
      <main className="route-enter flex-1 px-[var(--gutter)] pb-16 pt-8 max-md:px-[var(--gutter-sm)]">
        <div className="mt-8 flex max-w-[520px] flex-col gap-5 rounded-card border border-line p-8">
          <MonoLabel tracking="16">Content</MonoLabel>
          <p className="text-helper leading-prose text-ink-2">
            Content follows your brand. Finish your brief and choose a direction first.
          </p>
          <ButtonLink href="/app" variant="secondary" className="self-start">
            Back home
          </ButtonLink>
        </div>
      </main>
    );
  }

  const brandKitId = kit.row.id;
  if (!(await isBrandKitEntitled(supabase, brandKitId))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  const params = await searchParams;
  const requested = params.month;
  const raw = Array.isArray(requested) ? requested[0] : requested;
  const month = raw && /^\d{4}-\d{2}-01$/.test(raw) ? raw : contentMonthKey(new Date());

  const requestedView = Array.isArray(params.view) ? params.view[0] : params.view;
  /*
   * ⚠ LE FLUX EST LE DÉFAUT, ET IL FAUT DEMANDER LE CALENDRIER. N'importe
   * quelle autre valeur rend le flux : une URL bricolée ne doit pas produire
   * un troisième écran qui n'existe pas.
   */
  const view = requestedView === "calendar" ? "calendar" : "stream";

  /*
   * La palette de sa direction choisie. La vignette du flux l'utilise pour
   * poser la ligne d'image dans SES couleurs — ce n'est pas la carte composée
   * (le pipeline qui la produit n'est pas câblé), c'est la ligne que le
   * compositeur posera, et la vignette le dit en toutes lettres.
   */
  const palette = kit.selectedDirection?.palette ?? kit.directions?.[0]?.palette ?? null;
  const streamTokens = {
    primary: palette?.primary ?? "#6B7F6E",
    light: palette?.light ?? "#E7E2D6",
    dark: palette?.dark ?? "#2B2724",
    paper: palette?.paper ?? "#FAF7F2",
  };

  const [result, checkin, preferences, registers, credits, record] = await Promise.all([
    getContentMonth(supabase, brandKitId, month),
    getContentCheckin(supabase, brandKitId, month),
    getContentPreferences(supabase, brandKitId),
    getContentRegisters(supabase),
    /*
     * ⚠ LE COMPTEUR EST LU ICI, PAS DANS LE COMPOSANT. `credit_meter()` est
     * scopée `auth.uid()` et demande le client de session ; un composant
     * client qui l'appellerait ferait un second aller-retour pour un chiffre
     * que cette page a déjà le droit de lire.
     *
     * Et il ne décide de rien : dépenser passe par `reserve_credit`, en base,
     * qui ne lit pas ceci. Un compteur faux ne peut donc pas ouvrir une
     * dépense — au pire il affiche mal.
     */
    getCreditMeter(supabase, month),
    /*
     * L'état du mois LUI-MÊME, distinct de ses items. Un mois `generating` n'a
     * pas encore d'items, et un écran vide est indiscernable d'un mois raté :
     * c'est cette ligne qui fait la différence entre « ça arrive » et « ça
     * n'est pas venu ».
     */
    getContentMonthRecord(supabase, brandKitId, month),
  ]);

  /*
   * ⚠ AT THE TOP UNTIL ANSWERED, AND NOT ONE VISIT LONGER. `checkinAnswered`
   * treats `taking_clients` as the one answer that counts, because it is the
   * only field that changes what may be generated. Once she has answered it
   * the card comes down, even with the two optional fields blank — a card that
   * stayed up for an optional question would be asking for more than sixty
   * seconds.
   */
  /*
   * ⚠ L'ENVIRONNEMENT EST LU ICI, AU RENDU, ET UNE SEULE FOIS. La cause
   * technique ne sort jamais en production ; `lib/env/deploy.ts` ferme par
   * défaut, y compris quand rien ne dit où l'on est.
   */
  const detailVisible = showsTechnicalDetail();
  const envName = detailVisible ? deployEnvName() : null;
  /*
   * Ses propres posts — non vides. Ils s'affichent sous le flux, et aussi
   * sous l'état vide, parce qu'ils existent indépendamment de ce qu'Eklio a
   * écrit ou pas.
   */
  const ownPosts = result.ok ? partitionMonth(result.data).hers : [];

  const screen = monthScreen({
    result,
    record,
    /*
     * `contentGenerationArmed()` est lu ICI plutôt qu'au chargement du module :
     * l'écran ne promet « le 1er » que là où quelque chose écrira vraiment le
     * 1er.
     */
    automatic: contentGenerationArmed(),
    detail: detailVisible && !result.ok ? (result.detail ?? null) : null,
  });

  const monthLabel = new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-8 max-md:px-[var(--gutter-sm)]">
      {/*
       * ⚠ ONE CARD AT A TIME, AND PREFERENCES COME FIRST. They are asked once
       * and they set up everything after; the check-in is monthly and only
       * makes sense once she knows what a month is. Two cards stacked on the
       * first visit would be a form, which is the opposite of sixty seconds.
       *
       * Neither card blocks the calendar. It is underneath both, and it works.
       */}
      {preferences === null ? (
        <div className="mb-8 max-w-[720px]">
          <PreferencesForm brandKitId={brandKitId} registers={registers} initial={null} />
        </div>
      ) : (
        /*
         * ⚠ LE CHECK-IN NE DISPARAÎT PLUS, IL SE REPLIE. Il disparaissait dès
         * qu'il était répondu, et ce qu'elle avait écrit devenait invisible —
         * donc impossible à corriger sans deviner où. Une ligne garde la
         * réponse à l'écran et garde « Edit » à portée.
         */
        <div className="mb-8 max-w-[720px]">
          <CheckInLine
            brandKitId={brandKitId}
            month={month}
            monthLabel={monthLabel}
            checkin={checkin}
            answered={checkinAnswered(checkin)}
          />
        </div>
      )}

      {/*
       * ⚠ DISCRET, ET SOUS LE RESTE. Le compteur est visible et n'est jamais
       * l'élément le plus fort de l'écran : swaps illimités, régénérations et
       * visuels custom finis. Il disparaît entièrement quand il n'a rien à
       * dire — un essai sans visuel custom ne voit pas « 0 a month », qui est
       * un mur là où il n'y avait pas de porte.
       */}
      <div className="mb-6 max-w-[720px]">
        <CreditsMeter meter={credits} />
      </div>

      {/*
       * ⚠ LE CHOIX DE L'ÉCRAN EST UNE FONCTION PURE, PAS UNE CASCADE DE
       * TERNAIRES. Il l'était, et il marchait — mais on ne pouvait pas
       * l'éprouver : ce dépôt n'a pas d'infrastructure de rendu React, donc la
       * seule façon de savoir ce que la page ferait dans une configuration
       * donnée était de la déployer et de regarder. C'est exactement ainsi
       * que « Something went wrong » a atteint une preview.
       *
       * `lib/content/month-screen.ts` prend la décision, et son test la
       * parcourt dans les quatre configurations du débogage.
       */}
      {screen.kind === "not_deployed" ? (
        <MonthNotDeployed detail={screen.detail} env={envName} />
      ) : screen.kind === "failed" ? (
        <MonthFailedToLoad message={screen.message} detail={screen.detail} env={envName} />
      ) : screen.kind === "empty" ? (
        <>
          <MonthEmpty
            monthLabel={monthLabel}
            automatic={screen.automatic}
            /*
             * ⚠ LE LIEN MÈNE À L'AUTRE VUE, PAS À CELLE QU'ELLE REGARDE. Un
             * « Open the calendar » qui recharge le calendrier est un bouton
             * qui ne fait rien, et un bouton qui ne fait rien se lit comme
             * cassé.
             */
            calendarHref={
              view === "calendar"
                ? `/app/content?month=${month}`
                : `/app/content?month=${month}&view=calendar`
            }
            calendarLabel={view === "calendar" ? "Back to the cards" : "Open the calendar"}
          />
          {/*
           * ⚠ SES PROPRES POSTS SURVIVENT À UN MOIS VIDE. Le mois est vide
           * parce qu'Eklio n'a rien écrit ; ce qu'ELLE a écrit est toujours
           * là, et le faire disparaître avec l'état vide reviendrait à lui
           * cacher son propre travail au motif que le nôtre manque.
           */}
          {ownPosts.length > 0 ? <HerOwnPosts items={ownPosts} /> : null}
        </>
      ) : screen.kind === "generating" ? (
        <MonthGenerating monthLabel={monthLabel} />
      ) : screen.kind === "generation_failed" ? (
        <MonthFailed monthLabel={monthLabel} />
      ) : !result.ok ? null /* déjà traité au-dessus ; la garde satisfait le typage */
      : view === "calendar" ? (
        <ContentCalendar brandKitId={brandKitId} month={month} model={result.data} />
      ) : (
        <>
          <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
                {monthLabel}
              </h1>
              <MonthProgress model={result.data} />
            </div>
            {/*
             * ⚠ LE CALENDRIER EST UNE BASCULE SECONDAIRE, pas un onglet de
             * même poids. Il répond à « quand », qui est une vraie question
             * une fois par mois ; le flux répond à « est-ce que celui-ci me
             * ressemble », qui est la question trente fois.
             */}
            <ButtonLink
              href={`/app/content?month=${month}&view=calendar`}
              variant="secondary"
              className="text-helper"
            >
              Calendar
            </ButtonLink>
          </header>
          <ContentStream model={result.data} tokens={streamTokens} />
        </>
      )}
    </main>
  );
}
