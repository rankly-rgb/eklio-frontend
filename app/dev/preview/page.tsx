"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import { BrandPreview } from "@/components/preview/brand-preview";
import {
  PaletteCard,
  PersonaCard,
  ToneCard,
  TypePairingCard,
} from "@/components/preview/cards";
import {
  SAMPLE_DIRECTIONS,
  SAMPLE_PRACTICE_NAME,
  SAMPLE_PRACTITIONER_LINE,
  SAMPLE_PREVIEW,
  SAMPLE_SOCIAL_TEMPLATES,
} from "@/lib/brand/sample";
import { previewModelFromDirection } from "@/lib/brand/shapes";
import type { PaletteFamily, TonePreset, TypePairing, PersonaCardData } from "@/lib/catalog/types";

/*
 * Galerie de <BrandPreview> — toutes les tailles, toutes les variantes, et les
 * quatre cartes de marque, contre les données d'exemple.
 *
 * Le sélecteur de direction en tête sert à VOIR l'animation des tokens : les
 * couleurs doivent traverser en 500 ms, les polices se fondre en 200 ms, et
 * rien ne doit sauter. Une maquette qui clignote est une maquette qui remonte.
 *
 * Le catalogue est normalement lu en base ; les trois entrées ci-dessous sont
 * des doublures locales, réservées à cette page de développement.
 */

const SAMPLE_PALETTE_FAMILIES: PaletteFamily[] = [
  {
    id: "clay_sand",
    label: "CLAY & SAND",
    active: true,
    sort_order: 2,
    primary_hex: "#B4674A",
    primary_text_hex: "#A35D43",
    secondary_hex: "#C08A3E",
    secondary_text_hex: "#92692F",
    accent_hex: "#6E3320",
    accent_text_hex: "#6E3320",
    cta_ink_hex: "#10100F",
    light_hex: "#F4EEE3",
    dark_hex: "#2B2A27",
    paper_hex: "#FAF6EE",
    swatches: ["#B4674A", "#C08A3E", "#F4EEE3"],
    preview_tokens: {
      primary: "#B4674A",
      secondary: "#C08A3E",
      light: "#F4EEE3",
      dark: "#2B2A27",
      paper: "#FAF6EE",
    },
  },
  {
    id: "plum_bone",
    label: "PLUM & BONE",
    active: true,
    sort_order: 1,
    primary_hex: "#3B2C3A",
    primary_text_hex: "#3B2C3A",
    secondary_hex: "#4A5361",
    secondary_text_hex: "#4A5361",
    accent_hex: "#6E2F44",
    accent_text_hex: "#6E2F44",
    cta_ink_hex: "#FFFFFF",
    light_hex: "#F3EDE4",
    dark_hex: "#241B23",
    paper_hex: "#FAF7F2",
    swatches: ["#3B2C3A", "#4A5361", "#F3EDE4"],
    preview_tokens: {
      primary: "#3B2C3A",
      secondary: "#4A5361",
      light: "#F3EDE4",
      dark: "#241B23",
      paper: "#FAF7F2",
    },
  },
  {
    id: "olive_chalk",
    label: "OLIVE & CHALK",
    active: true,
    sort_order: 4,
    primary_hex: "#7A8168",
    primary_text_hex: "#6D745D",
    secondary_hex: "#3F4536",
    secondary_text_hex: "#3F4536",
    accent_hex: "#8C5624",
    accent_text_hex: "#8C5624",
    cta_ink_hex: "#12140F",
    light_hex: "#EDEAE5",
    dark_hex: "#262A20",
    paper_hex: "#F7F7F3",
    swatches: ["#7A8168", "#3F4536", "#EDEAE5"],
    preview_tokens: {
      primary: "#7A8168",
      secondary: "#3F4536",
      light: "#EDEAE5",
      dark: "#262A20",
      paper: "#F7F7F3",
    },
  },
];

const SAMPLE_TONES: TonePreset[] = [
  {
    id: "grounded",
    active: true,
    sort_order: 1,
    keywords: ["steady", "plainspoken", "warm"],
    sample_hero: "You don't need to have it figured out before you call.",
  },
  {
    id: "clear",
    active: true,
    sort_order: 2,
    keywords: ["clear", "structured", "direct"],
    sample_hero: "Therapy with a plan you can actually see.",
  },
];

const SAMPLE_PAIRINGS: TypePairing[] = SAMPLE_DIRECTIONS.map((d, index) => ({
  id: d.id,
  active: true,
  sort_order: index + 1,
  heading_font: d.typography.heading_font,
  body_font: d.typography.body_font,
  google_fonts_url: d.typography.google_fonts_url,
}));

const SAMPLE_PERSONAS: PersonaCardData[] = [
  {
    id: "high_functioning",
    active: true,
    sort_order: 3,
    label: "Professionals who look fine from outside",
    description:
      "They hit every deadline and cannot remember the last time they felt rested.",
  },
  {
    id: "first_time_therapy",
    active: true,
    sort_order: 7,
    label: "First-timers who almost did not call",
    description:
      "They have talked themselves out of this appointment at least three times.",
  },
];

export default function DevPreviewPage() {
  const [directionIndex, setDirectionIndex] = useState(1);
  const [paletteId, setPaletteId] = useState("clay_sand");
  const [toneId, setToneId] = useState("grounded");
  const [pairingId, setPairingId] = useState(SAMPLE_PAIRINGS[1].id);
  const [personaId, setPersonaId] = useState("high_functioning");

  const direction = SAMPLE_DIRECTIONS[directionIndex];
  const model = previewModelFromDirection(direction, SAMPLE_PRACTICE_NAME);
  const railModel = { ...model, specialties: SAMPLE_PREVIEW.specialties };

  return (
    <main className="route-enter mx-auto flex max-w-[1240px] flex-col gap-14 px-[var(--gutter)] py-[var(--gutter)]">
      <header className="flex flex-col gap-3">
        <MonoLabel tracking="18">Development</MonoLabel>
        <h1 className="font-display text-h1 font-medium leading-tight tracking-h1">
          Brand preview
        </h1>
        <p className="max-w-[620px] text-helper leading-prose text-ink-2">
          Switch direction and watch the tokens travel. Colors cross in 500ms,
          fonts fade in 200ms, and nothing reflows — if the mockup blinks, it is
          remounting instead of animating.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {SAMPLE_DIRECTIONS.map((entry, index) => (
            <Button
              key={entry.id}
              variant={index === directionIndex ? "primary" : "secondary"}
              onClick={() => setDirectionIndex(index)}
            >
              {entry.name}
            </Button>
          ))}
        </div>
      </header>

      <section className="flex flex-col gap-6">
        <SectionHeader title="Site" mono="panel · card · full" monoTracking="14" />
        <div className="flex flex-wrap items-start gap-12">
          <div className="w-[332px]">
            <BrandPreview model={railModel} size="panel" />
          </div>
          <div className="w-[400px]">
            <BrandPreview
              model={model}
              size="card"
              rendering={direction.rendering}
            />
          </div>
        </div>
        <div className="w-site-mock max-w-full">
          <BrandPreview model={model} size="full" />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeader title="Social" mono="four templates" monoTracking="14" />
        <div className="flex flex-wrap items-start gap-4">
          {SAMPLE_SOCIAL_TEMPLATES.map((template) => (
            <BrandPreview
              key={template.id}
              model={model}
              variant="social"
              template={template}
              practitionerLine={SAMPLE_PRACTITIONER_LINE}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeader title="Thumbnail" mono="palette · site" monoTracking="14" />
        <div className="flex flex-wrap items-start gap-12">
          <div className="w-[220px] overflow-hidden rounded-card border border-line">
            <BrandPreview model={model} variant="thumbnail" shape="palette" />
          </div>
          <div className="w-[520px] max-w-full">
            <BrandPreview model={model} variant="thumbnail" shape="site" />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeader title="Palette cards" />
        <div className="grid grid-cols-3 gap-6">
          {SAMPLE_PALETTE_FAMILIES.map((family) => (
            <PaletteCard
              key={family.id}
              family={family}
              model={model}
              selected={paletteId === family.id}
              leading={paletteId === family.id}
              onSelect={() => setPaletteId(family.id)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeader title="Type pairing cards" />
        <div className="grid grid-cols-3 gap-6">
          {SAMPLE_PAIRINGS.map((pairing) => (
            <TypePairingCard
              key={pairing.id}
              pairing={pairing}
              practiceName="Elm & Ember"
              sentence="Therapy for high-performing adults who can't switch off."
              selected={pairingId === pairing.id}
              onSelect={() => setPairingId(pairing.id)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeader title="Tone cards" />
        <div className="grid grid-cols-2 gap-4">
          {SAMPLE_TONES.map((tone) => (
            <ToneCard
              key={tone.id}
              tone={tone}
              selected={toneId === tone.id}
              onSelect={() => setToneId(tone.id)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeader title="Persona cards" />
        <div className="grid grid-cols-2 gap-4">
          {SAMPLE_PERSONAS.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              selected={personaId === persona.id}
              onSelect={() => setPersonaId(persona.id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
