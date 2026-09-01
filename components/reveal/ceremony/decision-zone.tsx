"use client";

import { Button } from "@/components/ui/button";
import { CheckGlyph } from "@/components/ui/glyphs";
import { useSelectDirection } from "@/lib/reveal/use-select-direction";

const INCLUSIONS = ["Full brand kit", "Site editor", "Builder-ready instructions"];

/*
 * La zone de décision — le bouton appelle le VRAI chemin de sélection
 * (`useSelectDirection`, le même hook que la vue Compare utilisera à
 * l'étape 6), pas une maquette. La barrière de paiement reste en base ;
 * `paid` ne décide que ce que le bouton DIT (§2).
 */
export function DecisionZone({
  brandKitId,
  projectId,
  directionId,
  paid,
}: {
  brandKitId: string;
  projectId: string;
  directionId: string;
  paid: boolean;
}) {
  const { choose, pendingId, error } = useSelectDirection(brandKitId, projectId, paid);
  const pending = pendingId === directionId;

  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-bg/90 px-8 py-6 shadow-preview backdrop-blur-sm max-md:px-5">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <Button
          variant="accent"
          onClick={() => void choose(directionId)}
          disabled={pending}
          className="px-8"
        >
          {pending ? "One moment…" : "This one feels like me"}
        </Button>

        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {INCLUSIONS.map((label) => (
            <li key={label} className="flex items-center gap-1.5 text-meta text-ink-2">
              <span className="flex size-4 flex-none items-center justify-center rounded-pill bg-accent">
                <CheckGlyph size="sm" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <p role="alert" className="border-l border-accent pl-3 text-helper leading-prose text-ink">
          {error}
        </p>
      ) : (
        <p className="font-mono text-mono-sm uppercase tracking-mono-14 text-ink-3">
          The kind of presentation a studio bills thousands for.
        </p>
      )}
    </div>
  );
}
