import { BrandCanvas } from "@/components/kit/brand-canvas";
import type { VoiceGuide } from "@/lib/brand/shapes";
import type { SitePreviewTokens } from "@/lib/site/types";

/**
 * Your words (Lot 3) — the voice guide, now inside a `<BrandCanvas>`: her
 * fonts and colors carry the two columns, where this section used to be
 * plain app styling regardless of her palette (the gap Lot 1 left, per the
 * brief).
 */
export function WordsSection({
  voiceGuide,
  tokens,
}: {
  voiceGuide: VoiceGuide | null;
  tokens: SitePreviewTokens | null;
}) {
  if (!voiceGuide || !tokens) {
    return (
      <p className="text-body text-ink-2">
        Your voice guide fills in here once your kit is ready.
      </p>
    );
  }

  return (
    <BrandCanvas tokens={tokens} className="p-8">
      <div className="flex max-w-voice max-md:flex-col max-md:gap-8">
        <div className="box-border flex-1 pr-14 max-md:pr-0">
          <h3 style={{ fontFamily: "var(--brand-heading)", fontWeight: 500, fontSize: 20, color: "var(--brand-dark)" }}>
            Sounds like you
          </h3>
          <div className="mt-6 flex flex-col gap-5">
            {voiceGuide.sounds_like.map((line) => (
              <p key={line} style={{ fontFamily: "var(--brand-body)", fontSize: 16, lineHeight: 1.6, color: "var(--brand-dark)" }}>
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="w-px flex-none max-md:h-px max-md:w-full" style={{ background: "var(--brand-light)" }} />
        <div className="box-border flex-1 pl-14 max-md:pl-0">
          <h3 style={{ fontFamily: "var(--brand-heading)", fontWeight: 500, fontSize: 20, color: "var(--brand-dark)" }}>
            Never write this
          </h3>
          <div className="mt-6 flex flex-col items-start gap-5">
            {voiceGuide.never_write.map((line) => (
              <span key={line} className="relative inline-block">
                <span style={{ fontFamily: "var(--brand-body)", fontSize: 16, color: "var(--brand-dark)", opacity: 0.6 }}>
                  {line}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-1/2 h-px"
                  style={{ background: "var(--brand-dark)", opacity: 0.35 }}
                />
              </span>
            ))}
          </div>
        </div>
      </div>
    </BrandCanvas>
  );
}
