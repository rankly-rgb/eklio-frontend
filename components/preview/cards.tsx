"use client";

import { SelectableCard } from "@/components/ui/selectable-card";
import { MonoLabel } from "@/components/ui/mono-label";
import { SAMPLE_PREVIEW } from "@/lib/brand/sample";
import { BrandPreview } from "@/components/preview/brand-preview";
import { useBrandFont } from "@/components/preview/use-brand-font";
import type { PreviewModel } from "@/lib/brand/shapes";
import type {
  PaletteFamily,
  TonePreset,
  TypePairing,
  PersonaCardData,
} from "@/lib/catalog/types";

/*
 * Les quatre cartes du brief, toutes bâties sur les MÊMES tokens de marque que
 * <BrandPreview> : une carte de palette n'est jamais trois ronds nus, une carte
 * de typographie se rend dans sa propre typographie, une carte de ton EST le
 * titre qu'elle décrit. La donnée se montre, elle ne se décrit pas.
 */

/* ── Palette (Écran 1) ──────────────────────────────────────────────────── */

export function PaletteCard({
  family,
  model,
  selected,
  leading,
  onSelect,
}: {
  family: PaletteFamily;
  /**
   * Modèle courant, repeint aux couleurs de CETTE famille pour la vignette.
   *
   * ⚠ NULLABLE, comme `StepBodyProps.preview` l'a toujours été. Le type le dit
   * maintenant au lieu de le laisser au hasard de l'appelant.
   */
  model: PreviewModel | null;
  selected: boolean;
  /** Première famille choisie : elle pilote la prévisualisation. */
  leading: boolean;
  onSelect: () => void;
}) {
  /*
   * ⚠ `model` IS NULLABLE AT THE CALL SITE, AND THIS DEREFERENCED IT.
   *
   * `StepBodyProps.preview` is typed `PreviewModel | null`, and this line read
   * `model.tokens` with no guard: a null preview threw
   * `Cannot read properties of null (reading 'tokens')` and step 6 — the last
   * screen before the reveal — rendered nothing at all.
   *
   * It has never been hit, because `brief_preview()` has always returned a
   * model and almost nobody has walked this path. The anonymous brief is about
   * to multiply the sessions reaching step 6 from devices and states nobody has
   * exercised, and a latent crash on the screen before the reveal is not
   * something to leave armed while traffic arrives.
   *
   * The fallback is the sample model the empty home already renders: the
   * swatches are the point of this card, they come from `family`, and they are
   * correct whatever the preview says.
   */
  const base = model ?? SAMPLE_PREVIEW;
  const tinted: PreviewModel = {
    ...base,
    tokens: { ...base.tokens, ...family.preview_tokens },
  };

  return (
    <div className="flex flex-col gap-3">
      <SelectableCard
        selected={selected}
        onSelect={onSelect}
        padded={false}
        label={family.label}
      >
        <BrandPreview model={tinted} variant="thumbnail" shape="palette" />
      </SelectableCard>

      <div aria-hidden="true" className="flex items-center gap-[5px]">
        {family.swatches.map((swatch, index) => (
          <span
            key={`${swatch}-${index}`}
            className="size-3 rounded-pill"
            style={{
              background: swatch,
              // Le troisième pastille est le clair de la famille : sans filet,
              // il disparaît sur le fond de page.
              border: index === 2 ? "1px solid var(--line)" : undefined,
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {/*
          ⚠ NOT `MonoLabel`, WHICH IS 11px. This is the label carrying the
          decision on the screen where she picks between six colour families BY
          NAME, and 11px uppercase mono is a size for a state badge, not for the
          thing being chosen. The tracking and the caps are kept — it still
          reads as part of the system — and only the size changes.
        */}
        <span
          className={`font-mono text-ui uppercase tracking-mono-14 ${
            selected ? "text-ink" : "text-ink-2"
          }`}
        >
          {family.label}
        </span>
        {leading ? (
          <MonoLabel tracking="14" tone="accent">
            Leading
          </MonoLabel>
        ) : null}
      </div>
    </div>
  );
}

/* ── Typographie ────────────────────────────────────────────────────────── */

export function TypePairingCard({
  pairing,
  practiceName,
  sentence,
  selected,
  onSelect,
}: {
  pairing: TypePairing;
  practiceName: string;
  /** Une phrase de corps, rendue dans la police de corps de la paire. */
  sentence: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const ready = useBrandFont(pairing.google_fonts_url);

  return (
    <SelectableCard
      selected={selected}
      onSelect={onSelect}
      discOffset="12px"
      label={`${pairing.heading_font} and ${pairing.body_font}`}
      className="flex min-h-[124px] flex-col bg-card"
    >
      <div
        className="flex flex-1 flex-col transition-opacity duration-[var(--dur-font)]"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <span
          className="text-pretty"
          style={{
            fontFamily: `"${pairing.heading_font}", Georgia, serif`,
            fontWeight: 600,
            fontSize: 24,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            // Hauteur réservée : l'échange de police ne décale pas la grille.
            minHeight: 30,
          }}
        >
          {practiceName}
        </span>
        <span
          className="mt-1.5"
          style={{
            fontFamily: `"${pairing.body_font}", system-ui, sans-serif`,
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--ink-2)",
          }}
        >
          {sentence}
        </span>
      </div>

      <MonoLabel tracking="10" className="mt-4 whitespace-nowrap">
        {`${pairing.heading_font} · ${pairing.body_font}`}
      </MonoLabel>
    </SelectableCard>
  );
}

/* ── Ton (Écran 2) ──────────────────────────────────────────────────────── */

/*
 * `tone` accepte soit une carte du catalogue statique (`TonePreset`), soit
 * une carte GÉNÉRÉE (`ToneCard`, `lib/generation/how-you-work-shapes.ts`,
 * §2.2) : les deux portent `id`/`sample_hero`/`keywords`, seuls champs rendus
 * ici. Une seule carte, jamais deux composants pour la même chose.
 */
export function ToneCard({
  tone,
  selected,
  onSelect,
}: {
  tone: Pick<TonePreset, "id" | "sample_hero" | "keywords">;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <SelectableCard
      selected={selected}
      onSelect={onSelect}
      discOffset="12px"
      className="flex min-h-[124px] flex-col bg-card"
    >
      {/* La carte EST le titre : ce que le praticien choisit, c'est la voix. */}
      <span className="text-pretty pr-3 font-display text-tone font-medium leading-card tracking-question text-ink">
        {tone.sample_hero}
      </span>
      <span className="flex-1" />
      <MonoLabel tracking="10" className="mt-4 whitespace-nowrap">
        {tone.keywords.join(" · ")}
      </MonoLabel>
    </SelectableCard>
  );
}

/* ── Client idéal ───────────────────────────────────────────────────────── */

export function PersonaCard({
  persona,
  selected,
  onSelect,
}: {
  persona: PersonaCardData;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <SelectableCard
      selected={selected}
      onSelect={onSelect}
      discOffset="12px"
      className="flex min-h-[124px] flex-col bg-card"
    >
      <span className="text-pretty pr-4 font-display text-subsection font-medium leading-card tracking-card-title text-ink">
        {persona.label}
      </span>
      <span className="mt-2.5 text-ui leading-body text-ink-2">
        {persona.description}
      </span>
    </SelectableCard>
  );
}
