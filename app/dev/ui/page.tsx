"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { SectionHeader } from "@/components/ui/section-header";
import { SelectableCard } from "@/components/ui/selectable-card";
import { Progress7, StepCounter } from "@/components/ui/progress7";
import { PlaceholderLines } from "@/components/ui/placeholder-lines";
import { BrowserFrame } from "@/components/ui/browser-frame";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Toast } from "@/components/ui/toast";
import { CheckGlyph, ChevronGlyph, PadlockGlyph } from "@/components/ui/glyphs";

/*
 * Galerie des primitives — chaque composant, dans chacun de ses états.
 * Page de développement : elle n'est liée depuis nulle part et ne lit aucune
 * donnée. Elle sert de contrôle visuel contre `design/reference/`.
 */

export default function DevUiPage() {
  const [selected, setSelected] = useState<string | null>("clay");
  const [checked, setChecked] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <main className="route-enter mx-auto flex max-w-[1100px] flex-col gap-14 px-[var(--gutter)] py-[var(--gutter)]">
      <header className="flex flex-col gap-3">
        <MonoLabel tracking="18">Development</MonoLabel>
        <h1 className="font-display text-h1 font-medium leading-tight tracking-h1">
          Primitives
        </h1>
        <p className="max-w-[560px] text-helper leading-prose text-ink-2">
          Every primitive in every state, on the app surface. Compare against
          the eight files in design/reference before changing anything here.
        </p>
      </header>

      <Gallery title="Button">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary">Continue</Button>
          <Button variant="secondary">Back</Button>
          <Button variant="accent">Add Monthly Presence</Button>
          <Button variant="tertiary">Skip for now</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" disabled>
            Continue
          </Button>
          <Button variant="secondary" disabled>
            Back
          </Button>
          <Button variant="primary">
            Copy site prompt
            <ChevronGlyph />
          </Button>
          <ButtonLink variant="secondary" href="/dev/ui">
            Open brand kit
          </ButtonLink>
        </div>
      </Gallery>

      <Gallery title="MonoLabel">
        <div className="flex flex-col gap-3">
          <MonoLabel tracking="18">Palette</MonoLabel>
          <MonoLabel tracking="16">Step 5 of 7</MonoLabel>
          <MonoLabel tracking="14" tone="accent">
            Leading
          </MonoLabel>
          <MonoLabel tracking="10">Steady · Plainspoken · Warm</MonoLabel>
          <MonoLabel tracking="hex" uppercase={false}>
            #B4674A
          </MonoLabel>
          <MonoLabel tracking="url" tone="ink-3" size="10" uppercase={false}>
            elmandember.com
          </MonoLabel>
          <MonoLabel tracking="16" tone="ink-3">
            11 more locked
          </MonoLabel>
        </div>
      </Gallery>

      <Gallery title="SectionHeader">
        <SectionHeader title="Your site" />
        <SectionHeader title="This month's content" mono="September" />
      </Gallery>

      <Gallery title="Progress7">
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <StepCounter step={5} />
          </div>
          <Progress7 step={5} />
        </div>
        <Progress7 step={1} fraction={0} />
        <Progress7 step={7} fraction={1} />
        <Progress7 step={4} dense />
      </Gallery>

      <Gallery title="SelectableCard">
        <div className="grid grid-cols-2 gap-4">
          {[
            { id: "clay", headline: "You don't need to have it figured out before you call." },
            { id: "clear", headline: "Therapy with a plan you can actually see." },
          ].map((card) => (
            <SelectableCard
              key={card.id}
              selected={selected === card.id}
              onSelect={() => setSelected(card.id)}
              discOffset="12px"
              className="flex min-h-[124px] flex-col bg-card"
            >
              <span className="pr-3 font-display text-tone font-medium leading-card tracking-question text-ink text-pretty">
                {card.headline}
              </span>
              <span className="flex-1" />
              <MonoLabel tracking="10" className="mt-4 whitespace-nowrap">
                Steady · Plainspoken · Warm
              </MonoLabel>
            </SelectableCard>
          ))}
        </div>
      </Gallery>

      <Gallery title="PlaceholderLines">
        <div className="flex items-start gap-12">
          <PlaceholderLines className="w-[220px]" />
          <PlaceholderLines className="w-[220px]" height={5} gap={7} />
          <PlaceholderLines className="w-[220px]" height={6} gap={9} count={2} />
        </div>
      </Gallery>

      <Gallery title="BrowserFrame">
        <div className="flex flex-wrap items-start gap-8">
          <BrowserFrame size="thumbnail" className="w-[280px]">
            <div className="h-[90px] bg-card" />
          </BrowserFrame>
          <BrowserFrame size="panel" domain="elmandember.com" shadow className="w-[324px]">
            <div className="h-[120px] bg-card" />
          </BrowserFrame>
          <BrowserFrame size="full" domain="elmandember.com" className="w-[380px]">
            <div className="h-[140px] bg-card" />
          </BrowserFrame>
        </div>
      </Gallery>

      <Gallery title="Checkbox">
        <div className="flex flex-col gap-3.5">
          <Checkbox
            checked={checked}
            onChange={setChecked}
            label="Choose your creative direction"
          />
          <Checkbox
            checked={false}
            onChange={() => {}}
            label="Post your introduction on Instagram"
          />
          <Checkbox
            checked
            onChange={() => {}}
            size={16}
            label="Update your email signature"
          />
        </div>
      </Gallery>

      <Gallery title="Glyphs">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <span className="flex size-[18px] items-center justify-center rounded-pill bg-accent">
              <CheckGlyph size="md" />
            </span>
            <CheckGlyph size="lg" color="var(--accent)" />
            <ChevronGlyph color="var(--ink)" />
            <PadlockGlyph />
            <PadlockGlyph size="md" />
          </div>
        </div>
      </Gallery>

      <Gallery title="Skeleton">
        <div className="flex items-start gap-6">
          <Skeleton className="h-[138px] w-[180px]" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-[220px]" radius="2px" />
            <Skeleton className="h-3 w-[160px]" radius="2px" />
          </div>
        </div>
      </Gallery>

      <Gallery title="Toast">
        <Button variant="secondary" onClick={() => setToast("Site prompt copied.")}>
          Show toast
        </Button>
        <Toast message={toast} onDismiss={() => setToast(null)} />
      </Gallery>
    </main>
  );
}

function Gallery({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      <SectionHeader title={title} />
      {children}
    </section>
  );
}
