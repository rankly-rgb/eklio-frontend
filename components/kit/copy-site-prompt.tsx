"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronGlyph } from "@/components/ui/glyphs";
import { SITE_PROMPT_TARGETS, type SitePromptTarget } from "@/lib/kit/site-prompt";

/*
 * « Copy site prompt » — le bouton primaire du kit (Écran 5), avec son
 * chevron et son menu par constructeur.
 *
 * Copier D'ABORD, ouvrir le menu ensuite : le clic principal fait la chose
 * évidente avec la cible courante, et le chevron sert à en changer. Un menu
 * qui s'ouvre au clic principal ferait payer un aller-retour à la seule action
 * que ce bouton existe pour rendre immédiate.
 */
export function CopySitePrompt({
  brandKitId,
  target,
  onTargetChange,
  disabled,
}: {
  brandKitId: string;
  target: SitePromptTarget;
  onTargetChange: (next: SitePromptTarget) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "copying" | "copied" | "error">(
    "idle"
  );
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (state !== "copied") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy(forTarget: SitePromptTarget) {
    setOpen(false);
    setState("copying");
    try {
      const response = await fetch(
        `/api/brand-kits/${brandKitId}/site-prompt?target=${forTarget}`
      );
      const body = (await response.json().catch(() => null)) as
        | { prompt?: string }
        | null;

      if (!response.ok || !body?.prompt) {
        setState("error");
        return;
      }
      await navigator.clipboard.writeText(body.prompt);
      setState("copied");
    } catch {
      setState("error");
    }
  }

  return (
    <div ref={container} className="relative flex items-center">
      <Button
        variant="primary"
        disabled={disabled || state === "copying"}
        onClick={() => void copy(target)}
        className="pr-4"
      >
        {state === "copied"
          ? "Copied"
          : state === "error"
            ? "Copy failed"
            : "Copy site prompt"}
      </Button>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose a website builder"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="-ml-9 flex h-10 w-9 items-center justify-center rounded-r-pill"
      >
        <ChevronGlyph />
      </button>

      {open ? (
        <div
          role="menu"
          className="route-enter absolute right-0 top-12 z-40 min-w-[200px] rounded-card border border-line bg-bg p-2"
        >
          {SITE_PROMPT_TARGETS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="menuitemradio"
              aria-checked={entry.id === target}
              onClick={() => {
                onTargetChange(entry.id);
                void copy(entry.id);
              }}
              className={`block w-full rounded-check px-3 py-2 text-left text-ui hover:bg-card ${
                entry.id === target ? "text-ink" : "text-ink-2"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
