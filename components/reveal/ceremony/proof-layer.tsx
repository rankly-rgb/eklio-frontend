import { MonoLabel } from "@/components/ui/mono-label";
import { BoardSafeBadge } from "@/components/reveal/ceremony/board-safe-badge";
import type { RevealPayloadDirection, VoiceGuide } from "@/lib/brand/shapes";

/*
 * La couche de preuve — tout vient de la charge utile, RIEN n'est en dur : le
 * nom des polices, le VRAI pire ratio de contraste (couleur danger en dessous
 * d'AA, jamais caché), les mots-clés de ton, et le tampon Board-safe copy
 * relié au VRAI contenu de `voice_guide.never_write`.
 */
export function ProofLayer({
  direction,
  voiceGuide,
}: {
  direction: RevealPayloadDirection;
  voiceGuide: VoiceGuide | null;
}) {
  const { contrast } = direction;
  const worst =
    contrast.pairs.find((pair) => pair.ratio === contrast.worst_ratio) ??
    contrast.pairs[0];
  const levelWord = worst?.level === "AA_large" ? "AA large" : worst?.level;

  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-line pt-5">
      <MonoLabel tracking="14" tone="ink-3">
        {direction.typography.heading_font} — display
      </MonoLabel>
      <MonoLabel tracking="14" tone="ink-3">
        {direction.typography.body_font} — text
      </MonoLabel>

      {worst ? (
        <MonoLabel
          tracking="14"
          tone="ink-3"
          className={contrast.passes_aa ? "" : "text-[var(--danger)]"}
        >
          {worst.ratio.toFixed(2)}:1 · {levelWord}
        </MonoLabel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {direction.tone_keywords.map((word) => (
          <span
            key={word}
            className="rounded-pill border border-line px-2.5 py-1 font-mono text-mono-sm uppercase tracking-mono-10 text-ink-2"
          >
            {word}
          </span>
        ))}
      </div>

      {voiceGuide ? (
        <BoardSafeBadge neverWrite={voiceGuide.never_write} />
      ) : null}
    </div>
  );
}
