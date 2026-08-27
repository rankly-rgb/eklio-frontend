"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { SITE_PROMPT_TARGETS, type SitePromptTarget } from "@/lib/kit/site-prompt";

/*
 * La section « Site prompt » du kit : le bloc mono, le sélecteur de cible, la
 * copie, et le guide en trois étapes propre à chaque constructeur.
 *
 * Le prompt est LU À LA DEMANDE plutôt que rendu dans la page : il fait
 * plusieurs milliers de caractères, et changer de constructeur ne doit pas
 * recharger le kit entier.
 */
export function SitePromptBlock({
  brandKitId,
  target,
  onTargetChange,
}: {
  brandKitId: string;
  target: SitePromptTarget;
  onTargetChange: (next: SitePromptTarget) => void;
}) {
  /*
   * Le prompt est rangé AVEC sa cible. Poser `null` au changement de cible
   * depuis l'effet déclencherait un rendu en cascade ; en gardant la cible
   * dans l'état, « en cours de chargement » se DÉDUIT au rendu.
   */
  const [loaded, setLoaded] = useState<{
    target: SitePromptTarget;
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const prompt = loaded?.target === target ? loaded.text : null;
  const entry =
    SITE_PROMPT_TARGETS.find((candidate) => candidate.id === target) ??
    SITE_PROMPT_TARGETS[0];

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/brand-kits/${brandKitId}/site-prompt?target=${target}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { prompt?: string } | null) => {
        if (!cancelled) setLoaded({ target, text: body?.prompt ?? "" });
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded({
            target,
            text: "We couldn't load your prompt. Reload the page and try again.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [brandKitId, target]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        {SITE_PROMPT_TARGETS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={candidate.id === target}
            onClick={() => onTargetChange(candidate.id)}
            className={`flex h-[34px] items-center rounded-pill border px-4 text-ui transition-colors duration-[var(--dur-select)] ${
              candidate.id === target
                ? "border-accent bg-card text-ink"
                : "border-line text-ink-2 hover:text-ink"
            }`}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      <div className="max-h-[320px] overflow-auto rounded-card border border-line bg-card p-6">
        <pre className="whitespace-pre-wrap font-mono text-mono leading-[1.7] tracking-mono-hex text-ink-2">
          {prompt === null ? "Loading your prompt…" : prompt}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="secondary"
          disabled={!prompt}
          onClick={async () => {
            if (!prompt) return;
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : `Copy for ${entry.label}`}
        </Button>
      </div>

      <ol className="flex flex-col gap-3">
        {entry.steps.map((step, index) => (
          <li key={step} className="flex items-baseline gap-3">
            <MonoLabel tracking="14" tone="ink-3">
              {String(index + 1).padStart(2, "0")}
            </MonoLabel>
            <span className="text-ui leading-body text-ink">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
