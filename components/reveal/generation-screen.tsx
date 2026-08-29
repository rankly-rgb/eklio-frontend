"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import { CheckGlyph } from "@/components/ui/glyphs";
import { GENERATION_STAGES } from "@/lib/generation/job";
import { readOffer } from "@/lib/api/offer";

/*
 * L'écran d'attente (Écran 3).
 *
 * PAS D'EN-TÊTE, PAS DE NAVIGATION — la référence est un écran plein, et la
 * coquille de `/app` en pose un. D'où le recouvrement `fixed inset-0` sur
 * `--bg` : la route reste `/app/brand-kits/[id]/reveal`, avec sa garde de
 * session, mais l'écran est celui de la référence.
 *
 * Géométrie relevée : 216px de haut avant le titre à 46px, la colonne d'étapes
 * 56px plus bas avec 28px d'écart, et le libellé mono à 72px du bas.
 *
 * DEUX RÈGLES DE TEMPS :
 *   - sondage toutes les 1,5 s ;
 *   - MINIMUM 3 s à l'écran, même si le travail est déjà fini. Une révélation
 *     qui apparaît avant qu'on ait lu le titre se lit comme un bug.
 */

const POLL_MS = 1500;
const MINIMUM_MS = 3000;

type JobStatus = {
  status: "running" | "done" | "failed";
  stageIndex: number;
};

export function GenerationScreen({
  brandKitId,
  projectId,
  initialStageIndex,
}: {
  brandKitId: string;
  projectId: string;
  initialStageIndex: number;
}) {
  const router = useRouter();
  const [job, setJob] = useState<JobStatus>({
    status: "running",
    stageIndex: initialStageIndex,
  });
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${brandKitId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as JobStatus;
        if (cancelled) return;

        setJob(body);

        if (body.status === "done") {
          const elapsed = Date.now() - startedAt;
          const wait = Math.max(0, MINIMUM_MS - elapsed);
          clearInterval(timer);
          setTimeout(() => {
            if (!cancelled) router.refresh();
          }, wait);
        }
        if (body.status === "failed") clearInterval(timer);
      } catch {
        // Une requête perdue n'est pas une panne : le tour suivant réessaie.
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [brandKitId, router]);

  async function retry() {
    setRetrying(true);
    const response = await fetch(`/api/briefs/${projectId}/generate`, {
      method: "POST",
    });

    // L'allocation gratuite est épuisée : on l'emmène au checkout plutôt que
    // de lui faire relancer une génération qui ne partira pas.
    const offer = await readOffer(response);
    if (offer) {
      router.push(offer.checkoutUrl);
      return;
    }

    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center overflow-hidden bg-bg">
      <div className="h-[216px] flex-none" />

      <div className="flex flex-col items-center">
        <h1 className="font-display text-generation font-medium leading-tight tracking-h1 text-ink max-md:text-question">
          {job.status === "failed" ? "That didn't go through." : "Building your brand."}
        </h1>

        {job.status === "failed" ? (
          <div className="mt-10 flex max-w-[440px] flex-col items-center gap-6 text-center">
            <p className="text-body leading-prose text-ink-2">
              Something didn&rsquo;t go through on our side. Your answers are
              saved.
            </p>
            <Button onClick={retry} disabled={retrying}>
              {retrying ? "Starting again…" : "Try again"}
            </Button>
          </div>
        ) : (
          <div className="mt-14 flex flex-col items-start gap-7">
            {GENERATION_STAGES.map((stage, index) => {
              const reached = index < job.stageIndex;
              const running = index === job.stageIndex;

              return (
                <div key={stage.id} className="flex h-5 items-center gap-4">
                  <span className="flex w-4 flex-none justify-center">
                    {reached ? (
                      <CheckGlyph size="lg" color="var(--accent)" />
                    ) : running ? (
                      <span className="size-1.5 rounded-pill bg-accent" />
                    ) : null}
                  </span>
                  <span
                    className={`text-stage ${reached || running ? "text-ink" : "text-ink-3"}`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1" />
      {job.status === "failed" ? null : (
        <div className="pb-[72px]">
          <MonoLabel tracking="18">This usually takes about a minute</MonoLabel>
        </div>
      )}
    </div>
  );
}
