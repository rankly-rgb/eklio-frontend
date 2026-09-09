import { surfaceAccess } from "@/lib/billing/surface-access";
import { TierGate } from "@/components/billing/tier-gate";
import { resolveEntitledTier } from "@/lib/billing/entitlements";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadAssetStats } from "@/lib/data/asset-stats";
import { readCatalog } from "@/lib/catalog/read";
import { siteSpecGet } from "@/lib/site/rpc";
import { bookingUrlFrom } from "@/lib/kit/launch-context";
import { handoffBrief } from "@/lib/kit/handoff";
import { HandoffView } from "@/components/kit/handoff-view";
import { Breadcrumb } from "@/components/app/breadcrumb";

/*
 * /app/brand-kits/[id]/handoff — LOT 10.
 *
 * Everything a designer, a VA or a group practice's web person needs to carry
 * this brand somewhere else, in the two forms that actually travel: a plain
 * text brief she pastes into an email, and the files she already owns.
 *
 * ⚠ NO SHARE URL, deliberately and permanently. Eklio never hosts, publishes
 * or shares; a handoff is something she forwards herself. That is why the
 * recipient needs no account and why nothing about this practice ends up on a
 * guessable address.
 *
 * Nothing on this page renders or generates. It reads the manifest to say how
 * many files are current — a measured number, not an estimate — and stops
 * there; the downloads themselves go through the routes that already exist.
 */
export default async function HandoffPage({ params }: PageProps<"/app/brand-kits/[id]/handoff">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/brand-kits/${id}/handoff`);

  const kit = await loadBrandKit(supabase, id, user.id);
  if (!kit) notFound();

  if (!(await isBrandKitEntitled(supabase, id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  /*
   * ⚠ SIGNATURE. The handoff sheet is the one page she gives to whoever
   * touches her brand next — a designer, a developer, an agency — and that is
   * the moment the top tier is for. The refusal is a card naming it, in place
   * of the sheet.
   */
  const gate = surfaceAccess(
    "designer_handoff",
    await resolveEntitledTier(supabase, kit.projectId)
  );
  if (!gate.ok) return <TierGate access={gate} projectId={kit.projectId} />;

  const [assetStats, catalog, siteSpec] = await Promise.all([
    loadAssetStats(supabase, kit),
    readCatalog(supabase).catch(() => null),
    siteSpecGet(supabase, id).catch(() => null),
  ]);

  const brief = handoffBrief(
    {
      practiceName: kit.practiceName ?? "This practice",
      practitionerLine: kit.row.practitioner_line,
      direction: kit.selectedDirection ?? kit.directions?.[0] ?? null,
      voice: kit.voiceGuide,
      // The real six rows, the same source the ethics guard reads for prompts.
      // A paraphrase here would be a second copy of a rule with a licensing
      // board behind it.
      rules: (catalog?.ethicsRules ?? []).map((rule) => ({
        label: rule.short_label,
        description: rule.description,
      })),
      assets: {
        currentCount: assetStats?.currentCount ?? 0,
        lastUpdated: assetStats?.lastUpdated ?? null,
        staleKeys: assetStats?.staleKeys ?? [],
      },
      bookingUrl: bookingUrlFrom(siteSpec && siteSpec.ok ? siteSpec.data.spec : null),
    },
    new Date()
  );

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <Breadcrumb
        items={[
          { label: kit.practiceName ?? "Your brand", href: `/app/brand-kits/${id}` },
          { label: "Hand off" },
        ]}
      />

      <h1 className="mt-4 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
        Hand this to whoever builds it
      </h1>
      <p className="mt-3 max-w-[620px] text-body leading-prose text-ink-2">
        A web designer, a virtual assistant, the person at your group practice who runs the site.
        Everything below is what they need, and none of it needs an Eklio account.
      </p>

      <HandoffView
        brief={brief}
        zipHref={`/api/brand-kits/${id}/assets/zip`}
        pdfHref={`/api/brand-kits/${id}/pdf`}
        assetsHref={`/app/brand-kits/${id}/assets`}
      />
    </main>
  );
}
