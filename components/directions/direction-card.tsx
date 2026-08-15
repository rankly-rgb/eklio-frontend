import type { Tables } from "@/types/supabase";
import type { Palette } from "@/lib/ai/directions";

type PaletteEntry = { key: keyof Palette; label: string };

const PALETTE_ENTRIES: PaletteEntry[] = [
  { key: "primaire", label: "primaire" },
  { key: "secondaire", label: "secondaire" },
  { key: "accent", label: "accent" },
  { key: "neutre_clair", label: "neutre clair" },
  { key: "neutre_fonce", label: "neutre foncé" },
];

export function DirectionCard({
  direction,
  selected,
  children,
}: {
  direction: Tables<"directions">;
  selected: boolean;
  children?: React.ReactNode;
}) {
  const palette = direction.palette as Palette;

  return (
    <div
      className={`flex flex-col gap-5 rounded border p-5 ${
        selected ? "border-rule-strong bg-accent-tint" : "border-rule bg-paper"
      }`}
    >
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs text-ink-muted">
          Direction {direction.position}
        </span>
        <h2 className="font-display text-2xl leading-tight">
          {direction.name}
        </h2>
        <p className="text-sm text-ink-soft">{direction.description}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="label-mono text-ink-muted">Palette</span>
        <div className="flex gap-2">
          {PALETTE_ENTRIES.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center gap-1">
              <span
                className="size-9 rounded-full border border-rule"
                style={{ backgroundColor: palette[key] }}
                aria-hidden="true"
              />
              <span className="font-mono text-[10px] text-ink-muted">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 font-mono text-xs text-ink-soft">
        <span className="label-mono text-ink-muted">Typographies</span>
        <span>Titres : {direction.typographie_titre}</span>
        <span>Corps : {direction.typographie_corps}</span>
      </div>

      {children}
    </div>
  );
}
