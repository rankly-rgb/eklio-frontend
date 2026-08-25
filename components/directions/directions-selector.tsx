"use client";

import { useState, useTransition } from "react";
import {
  selectDirection,
  generateDirections,
} from "@/app/app/projets/[id]/directions/actions";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
import { DirectionCard } from "@/components/directions/direction-card";
import type { Tables } from "@/types/supabase";

export function DirectionsSelector({
  projectId,
  directions,
}: {
  projectId: string;
  directions: Tables<"directions">[];
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
