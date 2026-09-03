"use client";

import { useEffect, useState } from "react";
import { useBuildBrand } from "@/components/brief/build-brand-button";
import { Button } from "@/components/ui/button";
import { TextAreaField, InlineError } from "@/components/ui/text-field";
import { MonoLabel } from "@/components/ui/mono-label";
import { SelectableCard } from "@/components/ui/selectable-card";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveEvidenceLabel } from "@/lib/generation/how-you-work-shapes";
import type { UspOption, UspAngle } from "@/lib/generation/how-you-work-shapes";
import type { Catalog } from "@/lib/catalog/types";

/*
 * L'écran de positionnement (§2.4) — entre le récapitulatif et la
 * génération, PAS une huitième étape (la jauge de la page reste à 7 sur 7,
 * posée par `app/app/briefs/[id]/positioning/page.tsx`, pas ici).
 */

const ANGLE_OVERLINE: Record<UspAngle, string> = {
  population: "The people you work with",
  method: "How you work",
  lived_experience: "Where you come from",
};

const REGENERATE_LIMIT = 2;
const STATEMENT_MAX = 200;
const GENERIC_ERROR =
  "Something didn't go through on our side. Your answers are saved.";

type Alternative = { id: string; statement: string };

export function PositioningScreen({
  projectId,
  catalog,
  modalityIds,
  initialOptions,
  initialSelectedId,
  initialStatement,
  initialRegenerateCount,
}: {
  projectId: string;
  catalog: Catalog;
  modalityIds: string[];
  initialOptions: UspOption[] | null;
  initialSelectedId: string | null;
  initialStatement: string | null;
  initialRegenerateCount: number;
}) {
  const [options, setOptions] = useState<UspOption[] | null>(initialOptions);
  const [loading, setLoading] = useState(initialOptions === null);
  const [partialMessage, setPartialMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const [statement, setStatement] = useState(initialStatement ?? "");
  const [regenerateCount, setRegenerateCount] = useState(
    initialRegenerateCount,
  );
  const [regenerating, setRegenerating] = useState(false);
  const [collision, setCollision] = useState<{
    alternatives: Alternative[];
  } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [newOptionsDismissed, setNewOptionsDismissed] = useState(false);
  const {
    build,
    pending: building,
    error: buildError,
  } = useBuildBrand(projectId);

  /*
   * Un choix CONFIRMÉ (§9.2 : `usp_statement` survit à toute régénération,
   * jamais `selected_usp_id` seul) dont l'id ne se retrouve plus dans le lot
   * affiché — une régénération a eu lieu depuis qu'elle a confirmé. Le
   * rendu la montre dans son propre bloc, jamais silencieusement.
   */
  const confirmedElsewhere =
    selectedId !== null &&
    statement.trim().length > 0 &&
    options !== null &&
    !options.some((option) => option.id === selectedId);

  useEffect(() => {
    // TOUJOURS appelée, même quand `initialOptions` existe déjà (correction
    // demandée) : le serveur seul sait si l'étape 4 a changé depuis (§9.7,
    // même doctrine que `tone_cards_inputs_hash`), donc c'est lui qui décide
    // s'il y a une vraie régénération à faire. `initialOptions` évite
    // seulement le clignotement du squelette sur les visites répétées.
    let cancelled = false;

    async function run() {
      try {
        const response = await fetch(`/api/briefs/${projectId}/usp-options`, {
          method: "POST",
        });
        const body = (await response.json().catch(() => null)) as {
          ok?: boolean;
          options?: UspOption[];
          partial?: boolean;
          message?: string;
          error?: string;
        } | null;
        if (cancelled) return;
        if (response.ok && body?.options) {
          setOptions(body.options);
          setPartialMessage(body.partial ? (body.message ?? null) : null);
          // `selectedId`/`statement` NE BOUGENT PAS ici (correction demandée) :
          // régénérer le lot remplace des CANDIDATS, jamais sa décision déjà
          // confirmée. Si son id confirmé n'est plus dans le lot rafraîchi,
          // le rendu ci-dessous le montre dans son propre bloc, séparément.
        } else if (initialOptions === null) {
          /*
           * `body?.error` first, always — the server now tells the truth
           * about which of three things happened (a guardrail rejection
           * reads as `partial`/`message` above, never gets here; a missing
           * API key or a model failure both land here with their own
           * honest text from generationErrorResponse). Overriding it with
           * a fixed "these weren't truly yours" string regardless of cause
           * was the bug — a config problem read as if her answers were
           * the issue.
           */
          setPartialMessage(body?.error ?? GENERIC_ERROR);
        }
        // Sinon : ce qui était déjà affiché reste affiché — une vérification
        // de fraîcheur en arrière-plan qui échoue n'est pas une raison de
        // l'interrompre.
      } catch {
        if (!cancelled && initialOptions === null) {
          setPartialMessage(
            "We couldn't reach the server just now — check your connection and reload.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // Un seul appel au montage de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(option: UspOption) {
    setSelectedId(option.id);
    setStatement(option.statement);
    setCollision(null);
    setConfirmError(null);
  }

  async function regenerate() {
    if (regenerateCount >= REGENERATE_LIMIT || regenerating) return;
    setRegenerating(true);
    setConfirmError(null);
    try {
      const response = await fetch(`/api/briefs/${projectId}/usp-options`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        options?: UspOption[];
        partial?: boolean;
        message?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.options) {
        setConfirmError(
          body?.error ?? "We couldn't write three more just now.",
        );
        return;
      }
      setOptions(body.options);
      setPartialMessage(body.partial ? (body.message ?? null) : null);
      // Idem : « Write me three more » remplace les candidats, jamais une
      // décision déjà confirmée. Voir le bloc « currently in use » ci-dessous.
      setRegenerateCount((count) => count + 1);
    } catch {
      setConfirmError("We couldn't write three more just now.");
    } finally {
      setRegenerating(false);
    }
  }

  async function confirm(keepMine: boolean) {
    if (!selectedId || statement.trim().length === 0) {
      setConfirmError("Pick one of the options, then confirm it.");
      return;
    }
    setConfirming(true);
    setConfirmError(null);
    try {
      const response = await fetch(`/api/briefs/${projectId}/usp-confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          selected_usp_id: selectedId,
          statement: statement.trim(),
          keepMine,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        collision?: boolean;
        alternatives?: Alternative[];
        error?: string;
      } | null;

      if (!response.ok || !body?.ok) {
        setConfirmError(body?.error ?? GENERIC_ERROR);
        return;
      }
      if (body.collision) {
        setCollision({ alternatives: body.alternatives ?? [] });
        return;
      }
      setCollision(null);
      await build();
    } catch {
      setConfirmError(GENERIC_ERROR);
    } finally {
      setConfirming(false);
    }
  }

  const selectedOption =
    options?.find((entry) => entry.id === selectedId) ?? null;

  /*
   * Rien de nouveau à confirmer : elle a déjà confirmé, la régénération ne
   * l'a pas touchée, et elle a dit qu'elle la garde (ou n'a simplement pas
   * touché aux nouvelles cartes). Passer directement à la génération —
   * rappeler `usp-confirm` échouerait de toute façon : son `selected_usp_id`
   * ne référence plus le lot actuel, et le handler validerait contre CE
   * lot-là (§9.2).
   */
  async function proceed() {
    if (selectedOption) {
      await confirm(false);
    } else if (confirmedElsewhere) {
      await build();
    } else {
      setConfirmError("Pick one of the options, then confirm it.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-[132px]" />
          ))}
        </div>
      ) : (
        <>
          {confirmedElsewhere ? (
            <div className="flex flex-col gap-3 rounded-card border border-line bg-card p-5">
              <MonoLabel tracking="14" tone="ink-3">
                This is the positioning you&rsquo;re using now.
              </MonoLabel>
              <p className="text-pretty font-display text-tone font-medium leading-card text-ink">
                {statement}
              </p>
              {!newOptionsDismissed ? (
                <Button
                  variant="secondary"
                  onClick={() => setNewOptionsDismissed(true)}
                  className="self-start"
                >
                  Keep it
                </Button>
              ) : null}
            </div>
          ) : null}

          {partialMessage ? (
            <p className="border-l border-accent pl-3 text-helper leading-prose text-ink-2">
              {partialMessage}
            </p>
          ) : null}

          {confirmedElsewhere && newOptionsDismissed ? null : (
            <div className="flex flex-col gap-4">
              {(options ?? []).map((option) => (
                <SelectableCard
                  key={option.id}
                  selected={selectedId === option.id}
                  onSelect={() => select(option)}
                  discOffset="18px"
                  className="flex flex-col gap-3 bg-card"
                >
                  <MonoLabel tracking="14" tone="ink-2">
                    {ANGLE_OVERLINE[option.angle]}
                  </MonoLabel>
                  <p className="text-pretty font-display text-tone font-medium leading-card text-ink">
                    {option.statement}
                  </p>
                  <p className="text-ui leading-body text-ink-2">
                    {option.rationale}
                  </p>
                  {option.evidence.length > 0 ? (
                    <MonoLabel tracking="10" tone="ink-3">
                      {`Built from: ${option.evidence
                        .map((field) =>
                          resolveEvidenceLabel(
                            field,
                            modalityIds,
                            catalog.modalityCards,
                          ),
                        )
                        .join(" · ")}`}
                    </MonoLabel>
                  ) : null}
                </SelectableCard>
              ))}
            </div>
          )}

          <Button
            variant="tertiary"
            onClick={regenerate}
            disabled={regenerating || regenerateCount >= REGENERATE_LIMIT}
            className="self-start"
          >
            {regenerating
              ? "Writing three more…"
              : `Write me three more (${REGENERATE_LIMIT - regenerateCount} left)`}
          </Button>

          {selectedOption ? (
            <div className="flex flex-col gap-2">
              <TextAreaField
                id="usp-statement"
                label="Your positioning statement"
                rows={3}
                value={statement}
                onChange={(event) =>
                  setStatement(event.target.value.slice(0, STATEMENT_MAX))
                }
                maxLength={STATEMENT_MAX}
              />
              <span aria-live="polite" className="text-helper text-ink-3">
                {`${statement.length} / ${STATEMENT_MAX}`}
              </span>
            </div>
          ) : null}

          {collision ? (
            <div className="flex flex-col gap-3 border-l border-accent pl-3">
              <p className="text-helper leading-prose text-ink">
                That&rsquo;s close to how another practice in your state
                describes itself. You can keep it, or try one of these.
              </p>
              <div className="flex flex-wrap gap-2">
                {collision.alternatives.map((alt) => (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => {
                      const option = options?.find(
                        (entry) => entry.id === alt.id,
                      );
                      if (option) select(option);
                    }}
                    className="rounded-pill border border-line px-4 py-2 text-left text-ui text-ink-2 hover:border-accent hover:text-ink"
                  >
                    {alt.statement}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                onClick={() => void confirm(true)}
                disabled={confirming}
                className="self-start"
              >
                Keep mine
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => void proceed()}
              disabled={
                (!selectedOption && !confirmedElsewhere) ||
                confirming ||
                building
              }
              className="self-start"
            >
              {confirming || building ? "Confirming…" : "Continue"}
            </Button>
          )}

          {confirmError ? <InlineError>{confirmError}</InlineError> : null}
          {buildError ? <InlineError>{buildError}</InlineError> : null}
        </>
      )}
    </div>
  );
}
