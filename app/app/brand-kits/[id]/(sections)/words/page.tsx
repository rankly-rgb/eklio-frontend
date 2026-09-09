import { requireKitPage } from "@/lib/data/kit-page";
import { surfaceAccess } from "@/lib/billing/surface-access";
import { TierGate } from "@/components/billing/tier-gate";
import { SectionHeader } from "@/components/ui/section-header";
import { WordsSection } from "@/components/kit/words-section";
import { EthicsBadge } from "@/components/kit/ethics-badge";
import { EthicsDisclaimer } from "@/components/ethics-disclaimer";

/*
 * Your words — moved whole, with the ethics disclaimer that used to sit at
 * the foot of the scrolling page. It belongs beside the copy it qualifies,
 * not below six unrelated sections: this is the only section whose content
 * a board could take issue with, and it is now the section that carries the
 * sentence saying so.
 */
export default async function KitWordsPage({
  params,
}: PageProps<"/app/brand-kits/[id]/words">) {
  const { id } = await params;
  const model = await requireKitPage(id);

  /*
   * ⚠ EVERY SURFACE CONSULTS THE GUARD, INCLUDING THE ONES THAT ALWAYS
   * PASS. This one is `starter`, so today it cannot refuse — and that is
   * exactly why the line is here. A surface that consults nothing is the
   * one nobody remembers when a row in `SURFACE_MIN_TIER` moves.
   */
  const gate = surfaceAccess("kit_words", model.entitledTier);
  if (!gate.ok) return <TierGate access={gate} projectId={model.kit.projectId} />;

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        title="Your words"
        id="kit-words-heading"
        trailing={
          <EthicsBadge
            ethicsCheck={model.kit.ethicsCheck}
            ethicsRules={model.ethicsRules}
          />
        }
      />
      <WordsSection
        voiceGuide={model.kit.voiceGuide}
        tokens={model.tokens}
        ethicsRules={model.ethicsRules}
      />

      <div className="mt-6 max-w-[720px] border-t border-line pt-6">
        <EthicsDisclaimer />
      </div>
    </section>
  );
}
