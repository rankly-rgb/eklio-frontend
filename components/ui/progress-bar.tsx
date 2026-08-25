/*
 * Barre de progression horizontale du flow (<1024px) — remplace le rail.
 */
export function ProgressBar({ step, total }: { step: number; total: number }) {
  const percent = Math.round((step / total) * 100);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs tracking-[0.08em] text-ink-muted uppercase">
        Step {String(step).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>
      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${step} of ${total}`}
        className="h-0.5 w-full bg-rule"
      >
        <div className="h-0.5 bg-ink" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
