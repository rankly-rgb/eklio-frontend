"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  selectDirection,
  generateDirections,
} from "@/app/app/projets/[id]/directions/actions";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
import { DirectionCard } from "@/components/directions/direction-card";
import { GenerateKitButton } from "@/components/kit/generate-kit-button";
import type { Tables } from "@/types/supabase";

export function DirectionsSelector({
  projectId,
  directions,
  hasKit,
}: {
  projectId: string;
  directions: Tables<"directions">[];
  hasKit: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSelecting, startSelectTransition] = useTransition();
  const [isRegenerating, startRegenerateTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleSelect(directionId: string) {
    setError(null);
    setPendingId(directionId);
    startSelectTransition(async () => {
      const result = await selectDirection(projectId, directionId);
      if (!result.ok) setError(result.error);
      setPendingId(null);
    });
  }

  function handleRegenerate() {
    setError(null);
    startRegenerateTransition(async () => {
      const result = await generateDirections(projectId);
      if (!result.ok) setError(result.error);
    });
  }

  const busy = isSelecting || isRegenerating;
  const selectedId =
    directions.find((direction) => direction.is_selected)?.id ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {directions.map((direction) => (
          <DirectionCard
            key={direction.id}
            direction={direction}
            selected={direction.is_selected}
          >
            <Button
              variant={direction.is_selected ? "secondary" : "primary"}
              onClick={() => handleSelect(direction.id)}
              disabled={busy}
            >
              {direction.is_selected
                ? "Direction selected"
                : pendingId === direction.id
                  ? "Selecting…"
                  : "Choose this direction"}
            </Button>
          </DirectionCard>
        ))}
      </div>

      {error && <ErrorNotice message={error} />}

      {/*
        Le pas suivant du parcours : direction choisie → kit de marque. Tant
        qu'aucune direction n'est sélectionnée, le bouton reste désactivé et
        dit pourquoi, plutôt que d'échouer une fois cliqué.
      */}
      <div className="flex flex-col items-start gap-3 border-t border-rule pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl leading-tight">
            {hasKit ? "Your brand kit is ready." : "Next: your brand kit."}
          </h2>
          <p className="max-w-[55ch] text-sm text-ink-muted">
            {hasKit
              ? "Rebuilding replaces the kit you already have. Your directions stay as they are."
              : "Positioning, brand story, voice guide, website copy for the pages you asked for, a prompt for your site builder, and social templates."}
          </p>
        </div>

        {selectedId === null ? (
          <>
            <Button variant="primary" disabled aria-describedby="kit-needs-direction">
              Build my brand kit
            </Button>
            <p
              id="kit-needs-direction"
              className="font-mono text-xs text-ink-muted"
            >
              Choose one of the three directions above to continue.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <GenerateKitButton
              projectId={projectId}
              label={hasKit ? "Rebuild my brand kit" : "Build my brand kit"}
              variant={hasKit ? "secondary" : "primary"}
              disabled={busy}
            />
            {hasKit && (
              <Link
                href={`/app/projets/${projectId}/kit`}
                className="font-mono text-sm underline hover:opacity-60"
              >
                View my brand kit
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col items-start gap-2 border-t border-rule pt-6">
        <Button variant="secondary" onClick={handleRegenerate} disabled={busy}>
          {isRegenerating ? "Generating…" : "Regenerate my 3 directions"}
        </Button>
        {isRegenerating && (
          <p className="font-mono text-xs text-ink-muted">
            This can take up to a minute.
          </p>
        )}
      </div>
    </div>
  );
}
