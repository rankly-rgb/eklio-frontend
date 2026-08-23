"use client";

/*
 * Curseur 1 à 5 aux extrémités étiquetées en mono (ton de la marque).
 * `onCommit` est appelé au relâchement pour déclencher la sauvegarde.
 */
export function Slider({
  id,
  left,
  right,
  value,
  onChange,
  onCommit,
}: {
  id: string;
  left: string;
  right: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        {left} or {right}
      </label>
      <div className="flex items-center justify-between font-mono text-xs tracking-[0.08em] text-ink-muted uppercase">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        aria-valuetext={`${value} of 5, between ${left} and ${right}`}
        className="w-full accent-ink"
      />
    </div>
  );
}
