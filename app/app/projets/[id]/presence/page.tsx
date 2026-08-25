import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionState } from "@/lib/billing/entitlements";
import { formatMonth, monthStart } from "@/lib/presence/month";
import { parseStoredPresence } from "@/lib/presence/content";
import { formatUsd, MONTHLY_PRESENCE } from "@/lib/billing/plans";
import { MonthlyPresenceView } from "@/components/presence/monthly-presence-view";
import { GeneratePresenceButton } from "@/components/presence/generate-presence-button";
import { EmptyState } from "@/components/ui/empty-state";

/*
 * Monthly Presence — le livrable du mois courant.
 *
 * Cette page RELIT ce qui est en base ; elle ne génère rien elle-même. Trois
 * états, aucun écran vide et aucun cul-de-sac :
 * - abonnement inactif → ce que c'est, et où le prendre ;
 * - abonné sans contenu ce mois-ci → le bouton de génération ;
 * - contenu enregistré → le mois.
 */

/*
 * Leçon n°5 du kit. Les Server Actions héritent du `maxDuration` de la PAGE
 * qui les porte (cf. la doc de `maxDuration` : « set the maxDuration at the
 * page level to change the default timeout of all Server Actions used on the
 * page »). Douze posts, quatre stories et un calendrier en une seule réponse
 * demandent une à deux minutes : le défaut de la plateforme couperait la
 * génération en plein vol, et l'échec se lirait comme une panne réseau.
 */
export const maxDuration = 300;

export const metadata = {
  title: "Monthly Presence — Eklio",
};

export default async function PresencePage({
  params,
}: PageProps<"/app/projets/[id]/presence">) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La RLS filtre par propriétaire : le projet d'un autre utilisateur est
  // simplement absent du résultat → 404.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!project || !user) {
    notFound();
  }

  const month = monthStart(new Date());
  const monthLabel = formatMonth(month);

  const subscription = await getSubscriptionState(supabase, user.id);

  const header = (
    <header className="flex items-center justify-between gap-4">
      <Link
        href={`/app/projets/${project.id}/kit`}
        className="font-mono text-sm underline hover:opacity-60"
      >
        ← Brand kit
      </Link>
      <span className="truncate font-mono text-xs text-ink-muted">
        {project.name}
      </span>
    </header>
  );

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-10 px-6 py-10">
      {header}
      {children}
    </div>
  );

  if (!subscription.isActive) {
    /*
     * L'abonnement fait autorité, et il ne vient que du webhook. Un `past_due`
     * est dit tel quel : le praticien peut le réparer, et lui afficher un
     * message d'abonnement absent l'enverrait racheter ce qu'il a déjà.
     */
    return shell(
      <EmptyState
        title={
          subscription.status === "past_due"
            ? "Your last payment didn't go through."
            : `${MONTHLY_PRESENCE.label} isn't active yet.`
        }
        text={
          subscription.status === "past_due"
            ? "Your subscription is on hold until the payment clears. Nothing is lost — this month's content unlocks again as soon as it does."
            : `${MONTHLY_PRESENCE.tagline} ${formatUsd(MONTHLY_PRESENCE.amountCents)} per month, written from this project's brand kit.`
        }
      >
        {subscription.status !== "past_due" && (
          <Link
            href={`/app/checkout?project=${project.id}`}
            className="rounded bg-ink px-5 py-2.5 font-mono text-sm text-paper transition-colors hover:bg-ink-soft"
          >
            Add {MONTHLY_PRESENCE.label}
          </Link>
        )}
      </EmptyState>
    );
  }

  /*
   * Lecture propriétaire-only par RLS : cette ligne ne peut appartenir qu'au
   * praticien connecté. L'écriture, elle, passe par la service_role (la
   * server action) — les policies d'insertion et de mise à jour la refusent
   * aux clients.
   */
  const { data: row } = await supabase
    .from("monthly_presence_content")
    .select("content, status")
    .eq("project_id", project.id)
    .eq("month", month)
    .maybeSingle();

  const content = row ? parseStoredPresence(row.content) : null;

  if (!content) {
    return shell(
      <EmptyState
        title={
          row
            ? `We couldn't read ${monthLabel}.`
            : `${monthLabel} hasn't been written yet.`
        }
        text={
          row
            ? "Something about the saved month doesn't match what we expect. Writing it again will replace it."
            : `Twelve posts, four story prompts and a dated calendar, written in this practice's own voice from its brand kit.`
        }
      >
        <GeneratePresenceButton
          projectId={project.id}
          label={row ? `Rewrite ${monthLabel}` : `Write ${monthLabel}`}
        />
      </EmptyState>
    );
  }

  return shell(
    <>
      <MonthlyPresenceView
        month={month}
        monthLabel={monthLabel}
        content={content}
      />

      <div className="flex flex-col gap-3 border-t border-rule pt-8">
        <p className="text-sm text-ink-muted">
          Want a different month? Rewriting replaces {monthLabel} — the months
          you already have stay as they are.
        </p>
        <GeneratePresenceButton
          projectId={project.id}
          label={`Rewrite ${monthLabel}`}
          variant="secondary"
        />
        {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
          <p className="font-mono text-xs text-ink-muted">
            Your subscription ends on{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "long",
              timeZone: "UTC",
            }).format(new Date(subscription.currentPeriodEnd))}
            . Everything already written stays yours.
          </p>
        )}
      </div>
    </>
  );
}
