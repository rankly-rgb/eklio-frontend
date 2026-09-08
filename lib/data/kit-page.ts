import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit, type BrandKit } from "@/lib/data/brand-kit";
import {
  isBrandKitEntitled,
  isCompAccessActive,
  purchaseWasReversed,
} from "@/lib/billing/entitlements";
import { siteSpecGet } from "@/lib/site/rpc";
import { readSiteCatalog } from "@/lib/site/catalog";
import { builderOf } from "@/lib/site/output";
import { readCatalog } from "@/lib/catalog/read";
import { loadLaunchProgress, type LaunchProgress } from "@/lib/data/checklist";
import { bookingUrlFrom, practiceDetailsFrom } from "@/lib/kit/launch-context";
import { loadAssetStats, type AssetStats } from "@/lib/data/asset-stats";
import { loadImageContext } from "@/lib/images/context";
import { computeImageFingerprint } from "@/lib/images/fingerprint";
import { getBrandImages } from "@/lib/images/rpc";
import type { PracticeDetails } from "@/lib/kit/launch-copy";
import type {
  ContrastReport,
  PracticeDetails as SitePracticeDetails,
  SitePreviewTokens,
} from "@/lib/site/types";

/*
 * THE brand kit aggregate — one read per request, shared by the sections
 * layout and whichever section is on show.
 *
 * ⚠ WHY `cache` AND WHY THE CLIENT IS NOT AN ARGUMENT. The layout renders the
 * header band and the rail; the page renders one section. Both need the kit.
 * `React.cache` memoises on the ARGUMENTS, and a fresh Supabase client is a
 * new object every call — passing one in would key every caller differently
 * and quietly double every query in here. So this function makes its own
 * client from the request's cookies, and takes nothing but the kit id.
 *
 * ⚠ THE GUARD LIVES HERE, ONCE. Seven section routes each re-deriving "is she
 * allowed to see this" is seven chances to get the ORDER wrong, and the order
 * is the whole thing: a kit that isn't hers must answer 404 BEFORE anything
 * mentions payment, or the 402 confirms the kit exists. `requireKitPage` is
 * the single definition, and `app/__tests__/brand-kit-entitlement.test.ts`
 * asserts every section route goes through it rather than around it.
 *
 * WHAT IT LOADS, AND WHY ALL OF IT. The header band needs the asset manifest
 * (total assets, categories, last updated) on EVERY section, so the manifest
 * is loaded for every section regardless. That is what settles the assets
 * route's question: it reads `assetStats.manifest` from here rather than
 * calling `loadAssetStats` a second time — folding it in costs nothing,
 * because the band already paid for it.
 */

export type KitRuleLabel = { id: string; label: string; description: string };

export type KitPage = {
  kit: BrandKit;
  brandKitId: string;
  /** The six roles + four derived variants, or null before the site spec is seeded. */
  tokens: SitePreviewTokens | null;
  /** The seven contrast pairs, or null in the same case. */
  contrast: ContrastReport | null;
  /** The human name beside each role -- an alias, never a replacement for the role. */
  colorLabels: Record<string, string> | null;
  /** The site spec's full practice_details, for the Overview's contact card. */
  sitePracticeDetails: SitePracticeDetails | null;
  /** The narrower shape the launch checklist copy reads. */
  practiceDetails: PracticeDetails | null;
  bookingUrl: string | null;
  siteBuilderLabel: string | null;
  ethicsRules: KitRuleLabel[];
  assetStats: AssetStats | null;
  launchProgress: LaunchProgress;
  compAccess: boolean;
  /** The hero photograph's signed URL, or null for <PhotoSlot>'s gradient. */
  heroImageUrl: string | null;
  /**
   * A SECOND photograph, for the rail's card — never the hero.
   *
   * The Overview shows the hero full-bleed; repeating it 200px lower in the
   * rail would read as a bug rather than as an editorial choice. Null is the
   * normal answer today and the gradient is the correct rendering of it.
   */
  railImageUrl: string | null;
};

/**
 * Everything the kit's sections render, for the signed-in owner of a paid
 * kit — or a redirect on the way to whichever screen answers what is missing.
 *
 * Never returns a partial kit: a caller that gets a value gets all of it.
 */
export const requireKitPage = cache(async function requireKitPage(
  brandKitId: string
): Promise<KitPage> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/brand-kits/${brandKitId}`);

  /*
   * 404 FIRST, and it is not politeness. `loadBrandKit` returns null both for
   * a kit that does not exist and for one that is someone else's -- the two
   * are indistinguishable from here on purpose. Answering 402 to a stranger
   * would confirm the kit exists and that its owner has not paid.
   */
  const kit = await loadBrandKit(supabase, brandKitId, user.id);
  if (!kit) notFound();

  // Without a chosen direction there is no kit to render: send her to the
  // reveal, where the choice is made, rather than to a half-empty workspace.
  if (!kit.selectedDirection) redirect(`/app/brand-kits/${brandKitId}/reveal`);

  // The reveal stays free and whole -- it is where the sale happens, and it
  // is where an unpaid kit goes back to.
  if (!(await isBrandKitEntitled(supabase, brandKitId))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  const [siteSpec, siteCatalog, catalog, launchProgress, compAccess, assetStats] =
    await Promise.all([
      siteSpecGet(supabase, brandKitId),
      // Tolerant on purpose: a kit whose spec has not been seeded still
      // renders, without a builder label. Failing the whole workspace for a
      // caption would be disproportionate.
      readSiteCatalog(supabase).catch(() => null),
      readCatalog(supabase).catch(() => null),
      loadLaunchProgress(supabase, brandKitId),
      isCompAccessActive(supabase),
      loadAssetStats(supabase, kit),
    ]);

  const spec = siteSpec.ok ? siteSpec.data.spec : null;

  return {
    kit,
    brandKitId,
    tokens: siteSpec.ok ? siteSpec.data.preview.tokens : null,
    contrast: siteSpec.ok ? siteSpec.data.contrast : null,
    colorLabels: spec?.color_labels ?? null,
    sitePracticeDetails: spec?.practice_details ?? null,
    practiceDetails: practiceDetailsFrom(spec),
    bookingUrl: bookingUrlFrom(spec),
    siteBuilderLabel:
      spec && siteCatalog ? builderOf(siteCatalog.builder_targets, spec.target).label : null,
    // The real `ethics_rules` rows -- the same source `lib/ethics/guard.ts`
    // reads for prompts, never a second hand-written copy of the rule text.
    ethicsRules: (catalog?.ethicsRules ?? []).map((rule) => ({
      id: rule.id,
      label: rule.short_label,
      description: rule.description,
    })),
    assetStats,
    launchProgress,
    compAccess,
    ...(await loadKitImages(supabase, kit)),
  };
});

/**
 * The two photographs the kit's shell can show, each or both null.
 *
 * Null is the normal answer, not an error: a kit renders the gradient until
 * something has been generated for its CURRENT fingerprint, and a kit whose
 * brand has since moved renders the gradient again rather than a photograph
 * of colours she no longer uses. `get_brand_images` decides that -- `current`
 * is `ready` AND at this fingerprint, never one or the other.
 *
 * One RPC for both: the rows come back together, so picking a second slot
 * costs one extra signed URL and no extra query.
 */
async function loadKitImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kit: BrandKit
): Promise<{ heroImageUrl: string | null; railImageUrl: string | null }> {
  const none = { heroImageUrl: null, railImageUrl: null };

  const context = await loadImageContext(supabase, kit);
  if (!context.ok) return none;

  const rows = await getBrandImages(supabase, kit.row.id, computeImageFingerprint(context.input));
  const usable = rows.filter((row) => row.current && row.storage_path);

  const hero = usable.find((row) => row.slot === "hero");
  // Prefer the calmer of the two ambients, then anything that isn't the hero.
  const rail =
    usable.find((row) => row.slot === "ambient_a") ??
    usable.find((row) => row.slot !== "hero");

  const sign = async (path: string | null | undefined): Promise<string | null> => {
    if (!path) return null;
    const signed = await supabase.storage.from("brand-assets").createSignedUrl(path, 300);
    return signed.data?.signedUrl ?? null;
  };

  return {
    heroImageUrl: await sign(hero?.storage_path),
    railImageUrl: await sign(rail?.storage_path),
  };
}
