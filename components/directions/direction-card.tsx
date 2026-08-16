import type { DirectionPalette, DirectionTypography } from "@/types/database";

const PALETTE_ORDER: { key: keyof DirectionPalette; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "light_neutral", label: "Light neutral" },
  { key: "dark_neutral", label: "Dark neutral" },
];

export function DirectionCard({
  name,
  description,
  palette,
  typography,
  isSelected,
  action,
}: {
  name: string;
  description: string;
  palette: DirectionPalette;
  typography: DirectionTypography;
  isSelected: boolean;
  action?: React.ReactNode;
}) {
  return (
    <article
      className={`flex flex-col gap-5 rounded-lg border bg-cream-light p-6 ${
        isSelected ? "border-noir" : "border-noir/15"
      }`}
    >
      <header className="flex items-start justify-between gap-4">
        <h3 className="font-display text-2xl leading-tight">{name}</h3>
        {isSelected && (
          <span className="shrink-0 rounded-full border border-noir px-3 py-1 font-mono text-xs">
            Chosen
          </span>
        )}
      </header>

      <p className="text-sm leading-relaxed text-gris-fonce">{description}</p>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
          Palette
        </span>
        <div className="flex gap-2">
          {PALETTE_ORDER.map(({ key, label }) => (
            <span key={key} className="flex flex-1 flex-col gap-1">
              <span
                aria-hidden="true"
                className="block h-12 w-full rounded border border-noir/10"
                style={{ backgroundColor: palette[key] }}
              />
              <span className="font-mono text-[0.6rem] uppercase text-gris-fonce">
                {label}
              </span>
              <span className="font-mono text-[0.6rem] text-gris-fonce">
                {palette[key]}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-gris-fonce">
          Typography
        </span>
        {/* Font names are shown as text. Next.js needs typefaces known at build
            time, so we never load a generated font at runtime. */}
        <span className="text-sm">
          {typography.headings} <span className="text-gris-fonce">for headings</span>
        </span>
        <span className="text-sm">
          {typography.body} <span className="text-gris-fonce">for body</span>
        </span>
      </div>

      {action}
    </article>
  );
}
