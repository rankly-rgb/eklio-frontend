"use client";

export type Direction = {
  id: string;
  name: string;
  rationale: string;
  about_excerpt: string;
  palette: Record<string, string>;
  typography: { heading_font: string; body_font: string; google_fonts_url: string };
  hero: { overline: string; headline: string; subhead: string; cta_label: string };
  tone_keywords: string[];
};

/**
 * La carte de reveal. Sa géométrie est ce que les CHECK de la base protègent :
 * le titre tient sur une ligne sous le padding, la rationale sur deux, et la
 * maquette de héros fait 250px. Rien ici ne tronque — si un texte débordait,
 * il n'aurait pas passé l'écriture.
 */
export function DirectionCard({
  direction,
  selected,
  onChoose,
  busy,
}: {
  direction: Direction;
  selected: boolean;
  onChoose: () => void;
  busy: boolean;
}) {
  const t = direction.typography;
  const p = direction.palette;

  return (
    <div
      className={`flex flex-col gap-4 rounded-[14px] border p-4 transition ${
        selected ? "border-accent" : "border-line"
      }`}
    >
      <link href={t.google_fonts_url} rel="stylesheet" />

      <div
        className="h-[250px] overflow-hidden rounded-[10px] border border-line"
        style={{ background: p.paper, fontFamily: `${t.body_font}, system-ui, sans-serif` }}
      >
        <div className="flex h-5 items-center gap-1.5 px-2" style={{ background: p.primary }}>
          <span className="h-1 w-5 rounded-full opacity-90" style={{ background: p.paper }} />
        </div>
        <div className="p-3.5">
          <div
            className="font-mono text-[9px] uppercase tracking-[0.16em]"
            style={{ color: p.secondary }}
          >
            {direction.hero.overline}
          </div>
          <div
            className="mt-1.5 text-[19px] leading-[1.15]"
            style={{ color: p.dark, fontFamily: `${t.heading_font}, Georgia, serif` }}
          >
            {direction.hero.headline}
          </div>
          <div className="mt-2 text-[11px] leading-[1.5]" style={{ color: p.dark, opacity: 0.7 }}>
            {direction.hero.subhead}
          </div>
          <div
            className="mt-3 inline-flex h-6 items-center rounded-full px-3 text-[10px] font-semibold"
            style={{ background: p.primary, color: p.paper }}
          >
            {direction.hero.cta_label}
          </div>
          <div className="mt-3 rounded-md p-2 text-[10px] leading-[1.5]" style={{ background: p.light, color: p.dark }}>
            {direction.about_excerpt.slice(0, 110)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {["primary", "secondary", "light", "dark", "paper"].map((role) => (
          <span
            key={role}
            title={`${role} ${p[role]}`}
            className="size-3 rounded-full border border-line"
            style={{ background: p[role] }}
          />
        ))}
      </div>

      <div>
        <h3 className="font-display text-[22px] leading-tight">{direction.name}</h3>
        <p className="mt-1.5 text-[13px] leading-[1.5] text-muted">{direction.rationale}</p>
      </div>

      <div className="overline whitespace-nowrap text-muted">
        {direction.tone_keywords.join(" · ")}
      </div>

      <button
        type="button"
        onClick={onChoose}
        disabled={busy}
        className={`mt-auto flex h-10 items-center justify-center rounded-full px-6 text-sm font-semibold transition disabled:opacity-50 ${
          selected
            ? "border border-accent text-accent"
            : "bg-ink text-paper hover:opacity-90"
        }`}
      >
        {selected ? "Your direction" : busy ? "One moment…" : "Choose this one"}
      </button>
    </div>
  );
}
