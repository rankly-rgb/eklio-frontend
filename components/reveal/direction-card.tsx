"use client";

import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import { BrandPreview } from "@/components/preview/brand-preview";
import { useBrandFont } from "@/components/preview/use-brand-font";
import { PALETTE_ROLES, previewModelFromDirection, type Direction } from "@/lib/brand/shapes";

/*
 * Une carte de direction (Écran 4).
 *
 * Géométrie relevée au pixel : nom à 22px, justification sur DEUX LIGNES
 * RÉSERVÉES (40px) pour que les trois cartes restent alignées quel que soit le
 * texte, maquette de 250px, bandeau de palette de 34px à ras bord, filet, la
 * paire typographique rendue DANS ELLE-MÊME, la ligne de mots-clés, puis le
 * bouton poussé en bas par `margin-top:auto`.
 *
 * La recommandée porte la bordure argile et le bouton `accent` — un seul par
 * écran (§2). Elle vient de la DONNÉE (`direction.recommended`), jamais de
 * l'index.
 */
export function DirectionCard({
  direction,
  practiceName,
  index,
  onChoose,
  pending,
}: {
  direction: Direction;
  practiceName: string | null;
  index: number;
  onChoose: () => void;
  pending: boolean;
}) {
  const ready = useBrandFont(direction.typography.google_fonts_url);
  const model = previewModelFromDirection(direction, practiceName);
  const recommended = direction.recommended === true;

  // Le bandeau montre trois rôles : primaire, secondaire, clair — les mêmes
  // que les pastilles des cartes de palette du brief.
  const strip = PALETTE_ROLES.slice(0, 3).map((role) => ({
    role,
    hex: direction.palette[role],
  }));

  return (
    <article
      style={{ "--stagger-index": index } as React.CSSProperties}
      className={`reveal-rise box-border flex flex-col rounded-card border p-6 ${
        recommended ? "border-accent" : "border-line"
      }`}
    >
      <h2 className="font-display text-card-title font-medium tracking-card-title text-ink">
        {direction.name}
      </h2>
      {/* Deux lignes réservées : les trois cartes s'alignent quoi qu'il arrive. */}
      <p className="mt-2 min-h-10 text-meta leading-[1.55] text-ink-2">
        {direction.rationale}
      </p>

      <div className="mt-5">
        <BrandPreview
          model={model}
          size="card"
          rendering={direction.rendering}
        />
      </div>

      <div className="mt-5 grid grid-cols-3">
        {strip.map(({ role, hex }) => (
          <div key={role} className="h-[34px]" style={{ background: hex }} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3">
        {strip.map(({ role, hex }) => (
          <MonoLabel key={role} tracking="hex" uppercase={false}>
            {hex.toUpperCase()}
          </MonoLabel>
        ))}
      </div>

      {/* La paire typographique, rendue dans elle-même. */}
      <div
        className="mt-[22px] border-t border-line pt-5 transition-opacity duration-[var(--dur-font)]"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <div
          style={{
            fontFamily: `"${direction.typography.heading_font}", Georgia, serif`,
            fontWeight: 600,
            fontSize: 24,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            minHeight: 30,
          }}
        >
          {practiceName ?? "Your practice"}
        </div>
        <div
          className="mt-1.5"
          style={{
            fontFamily: `"${direction.typography.body_font}", system-ui, sans-serif`,
            fontSize: 13,
            color: "var(--ink-2)",
          }}
        >
          {direction.hero.subhead}
        </div>
      </div>

      <MonoLabel tracking="10" className="mt-5 whitespace-nowrap">
        {direction.tone_keywords.join(" · ")}
      </MonoLabel>

      <div className="mt-auto pt-5">
        <Button
          variant={recommended ? "accent" : "secondary"}
          onClick={onChoose}
          disabled={pending}
          className="w-full"
        >
          {pending ? "One moment…" : "Choose this direction"}
        </Button>
      </div>
    </article>
  );
}
