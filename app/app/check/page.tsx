import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import { readCatalog } from "@/lib/catalog/read";
import { CheckView } from "@/components/check/check-view";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * /app/check — LOT 7.
 *
 * She pastes something she wrote and Eklio says which of the six advertising
 * rules it trips, and where. No score, no percentage, no "compliant": those
 * would each be a claim Eklio cannot support, and the third is a legal one.
 *
 * The six rules are shown in full underneath, from `ethics_rules` — the same
 * rows the scanner attaches its findings to and the same rows the generation
 * pipeline is held to. She should be able to read the rule she tripped, not
 * just be told she tripped it.
 */
export default async function CheckPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/check");

  const home = await loadHome(supabase, user.id);
  const kit = home.brandKit;
  if (!kit) redirect("/app");

  if (!(await isBrandKitEntitled(supabase, kit.row.id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  const catalog = await readCatalog(supabase).catch(() => null);
  const rules = catalog?.ethicsRules ?? [];

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-8 max-md:px-[var(--gutter-sm)]">
      <div className="max-w-[760px]">
        <MonoLabel tracking="16">Check</MonoLabel>
        <h1 className="mt-3 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
          Before you post it
        </h1>
        <p className="mt-4 text-body leading-prose text-ink-2">
          Paste anything you wrote — a directory profile, a post, an email. Eklio reads it for the
          six advertising rules that apply to licensed therapists in the United States and tells you
          which ones it trips, and where.
        </p>
      </div>

      <CheckView brandKitId={kit.row.id} />

      {rules.length > 0 ? (
        <section className="mt-14 max-w-[760px]">
          <MonoLabel tracking="16" as="h2">
            The six rules
          </MonoLabel>
          <dl className="mt-5 flex flex-col gap-5">
            {rules.map((rule) => (
              <div key={rule.id} className="flex flex-col gap-1.5">
                <dt className="text-ui font-medium text-ink">{rule.short_label}</dt>
                <dd className="text-helper leading-prose text-ink-2">
                  {rule.description}
                  {rule.example_forbidden ? (
                    <>
                      {" "}
                      Never: <span className="font-mono text-mono">{rule.example_forbidden}</span>
                    </>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
