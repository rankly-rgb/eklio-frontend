import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseMonthlyPresence } from "@/lib/billing/entitlements";
import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";
import { KIND_LABEL } from "@/lib/seo/kinds";
import { readMonthPieces, readPieceMonths } from "@/lib/seo/read";
import { STATUS_CTA, STATUS_TEXT, monthLabel, pagesScreen, parseMonthParam, searchLine, stateUnavailableText } from "@/lib/seo/screen";
import { latestKitFor, licenceEligibility } from "@/lib/seo/context";
import { seoDb } from "@/lib/seo/db";
import { seoGenerationArmed } from "@/lib/seo/armed";

/*
 * /app/pages — « Website pages ». Chaque mois, une page locale et deux articles
 * à coller sur SON site. Eklio ne publie rien : elle relit, copie, publie, et
 * nous dit où.
 *
 * L'accès à la liste suit Monthly Presence (`monthly_presence_entitled`, le
 * chokepoint SQL) ; l'HISTORIQUE, lui, reste lisible après résiliation — la RLS
 * de `seo_pieces` ne demande que la propriété pour lire.
 */
export default async function WebsitePagesPage({ searchParams }: PageProps<"/app/pages">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/pages");

  const now = new Date();
  const params = await searchParams;
  const month = parseMonthParam(params.month, now);

  const [entitled, months, pieces] = await Promise.all([
    canUseMonthlyPresence(supabase),
    readPieceMonths(supabase),
    readMonthPieces(supabase, month),
  ]);
  /*
   * ⚠ LA MÊME RÉPONSE QUE LE PIPELINE (session 3) : `licenceEligibility`, lue avec SA
   * session. Une praticienne d'un État non vérifié ne lit ni date ni promesse.
   */
  const kit = await latestKitFor(seoDb(supabase), user.id);
  const eligibility = kit ? await licenceEligibility(seoDb(supabase), kit.projectId) : ({ ok: true } as const);
  const screen = pagesScreen({
    entitled,
    hasHistory: months.length > 0,
    monthHasPieces: pieces.length > 0,
    eligibility,
    armed: seoGenerationArmed(),
    month,
    now,
  });

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-8 max-md:px-[var(--gutter-sm)]">
      <MonoLabel tracking="16">Website pages</MonoLabel>
      <h1 className="mt-3 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">{monthLabel(month)}</h1>
      <p className="mt-3 max-w-[600px] text-helper leading-prose text-ink-2">
        Each month, a page about your work in your city and two articles that answer what people ask
        before they reach out. You read them, copy them to your own site, and tell us where they went.
      </p>

      {months.length > 0 ? (
        <nav aria-label="Months" className="mt-6 flex flex-wrap gap-2">
          {months.map((m) => (
            <Link
              key={m}
              href={`/app/pages?month=${m}`}
              aria-current={m === month ? "page" : undefined}
              className={`rounded-pill border px-3 py-1 text-meta ${m === month ? "border-ink text-ink" : "border-line text-ink-2 hover:bg-card"}`}
            >
              {monthLabel(m)}
            </Link>
          ))}
        </nav>
      ) : null}

      {screen.kind === "no_subscription" ? (
        <div className="mt-8 flex max-w-[560px] flex-col gap-4 rounded-card border border-line p-8">
          <MonoLabel tracking="16">Part of Monthly Presence</MonoLabel>
          <p className="text-body leading-prose text-ink">
            Website pages come with Monthly Presence: every month, three pages written for your site, under
            your name, for the people who look for what you do.
          </p>
          <p className="text-helper leading-prose text-ink-2">
            Eklio does not host your site. You get the text ready to paste, with the steps for your site builder.
          </p>
          <ButtonLink href="/pricing" className="self-start">
            See Monthly Presence
          </ButtonLink>
        </div>
      ) : null}

      {screen.kind === "not_yet" ? (
        <div className="mt-8 flex max-w-[560px] flex-col gap-3 rounded-card border border-line p-8">
          <MonoLabel tracking="16">Coming</MonoLabel>
          <p className="text-body leading-prose text-ink">Your first pages arrive on {screen.arrives}.</p>
          <p className="text-helper leading-prose text-ink-2">
            They are written from your brief: your approaches, the people you work with, and your city. You will
            read each one before anything can be copied.
          </p>
        </div>
      ) : null}

      {screen.kind === "state_unavailable" ? (
        <div className="mt-8 flex max-w-[560px] flex-col gap-3 rounded-card border border-line p-8">
          <MonoLabel tracking="16">Not available in your state yet</MonoLabel>
          <p className="text-body leading-prose text-ink">{stateUnavailableText(screen.state)}</p>
        </div>
      ) : null}

      {screen.kind === "empty_month" ? (
        <p className="mt-8 max-w-[520px] text-helper leading-prose text-ink-2">No pages were written for this month.</p>
      ) : null}

      {screen.kind === "list" ? (
        <>
          {screen.readOnly ? (
            <p className="mt-6 max-w-[600px] text-helper leading-prose text-ink-2">
              Your Monthly Presence has ended. Your pages stay here for you to read and copy; nothing new will be written.
            </p>
          ) : null}
          <ol className="mt-8 flex max-w-[760px] flex-col">
            {pieces.map((p) => {
              const status = p.status as keyof typeof STATUS_TEXT;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-5">
                  <div className="flex min-w-0 flex-col gap-1">
                    <MonoLabel tracking="12">{KIND_LABEL[p.kind]}</MonoLabel>
                    <Link href={`/app/pages/${p.id}`} className="text-body font-medium text-ink hover:underline">
                      {p.title}
                    </Link>
                    <span className="text-helper text-ink-2">{searchLine(p.primaryQuery)}</span>
                    <span className="text-meta text-ink-3">{STATUS_TEXT[status]}</span>
                  </div>
                  <ButtonLink href={`/app/pages/${p.id}`} variant={status === "needs_review" ? "primary" : "secondary"}>
                    {STATUS_CTA[status]}
                  </ButtonLink>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </main>
  );
}
