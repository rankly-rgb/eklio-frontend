import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { ORDERED_PLANS, RECOMMENDED_TIER, formatUsd } from "@/lib/billing/plans";
import { parseKitTier } from "@/lib/kit/tiers";

/*
 * Écran de checkout — le tier choisi, l'add-on, puis Stripe.
 *
 * Sous `/app`, donc derrière la session : Stripe a besoin d'un utilisateur
 * pour rattacher le paiement, et un paiement anonyme n'aurait aucun droit à
 * accorder à personne.
 *
 * `?plan=` vient de `/pricing`, `?project=` du projet qu'on veut débloquer.
 * Les deux sont des paramètres d'URL, donc non fiables : le tier est relu par
 * `parseKitTier`, et le projet est vérifié comme appartenant à l'utilisateur
 * (la RLS le filtre) avant d'être attaché au paiement.
 */

export const metadata = {
  title: "Checkout — Eklio",
};

export default async function CheckoutPage({
  searchParams,
}: PageProps<"/app/checkout">) {
  const params = await searchParams;

  const rawPlan = Array.isArray(params.plan) ? params.plan[0] : params.plan;
  const tier = parseKitTier(rawPlan) ?? RECOMMENDED_TIER;

  const rawProject = Array.isArray(params.project)
    ? params.project[0]
    : params.project;

  /*
   * Un `?project=` inventé ne doit pas rattacher un paiement au projet d'un
   * autre : la RLS filtre par propriétaire, donc un projet absent du résultat
   * est simplement ignoré et le paiement part sans rattachement — il vaudra
   * alors pour tous les projets du praticien.
   */
  let projectId: string | null = null;
  let projectName: string | null = null;
  if (rawProject) {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", rawProject)
      .maybeSingle();
    if (project) {
      projectId = project.id;
      projectName = project.name;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-3">
        <Link
          href="/pricing"
          className="text-ui text-ink-2 underline decoration-[var(--line)] underline-offset-4 hover:text-ink hover:decoration-[var(--accent)]"
        >
          ← All plans
        </Link>
        <h1 className="font-display text-question font-medium leading-tight tracking-h1">
          Your order
        </h1>
        {projectName && (
          <p className="text-helper text-ink-2">
            Unlocking the kit for {projectName}
          </p>
        )}
      </header>

      <CheckoutForm tier={tier} projectId={projectId} />

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="font-mono text-mono uppercase tracking-mono-16 text-ink-2">Change tier</p>
        <div className="flex flex-wrap gap-3">
          {ORDERED_PLANS.filter((plan) => plan.tier !== tier).map((plan) => (
            <Link
              key={plan.tier}
              href={{
                pathname: "/app/checkout",
                query: projectId
                  ? { plan: plan.tier, project: projectId }
                  : { plan: plan.tier },
              }}
              className="inline-flex h-10 items-center rounded-pill border border-line px-[26px] text-ui text-ink transition-colors hover:bg-card"
            >
              {plan.label} · {formatUsd(plan.amountCents)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
