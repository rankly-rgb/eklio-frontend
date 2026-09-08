import { requireKitPage } from "@/lib/data/kit-page";
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
