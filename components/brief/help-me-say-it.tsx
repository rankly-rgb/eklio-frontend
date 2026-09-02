"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/*
 * « Help me say it » (§2.1) — pas « Write it for me » (`write-for-me.tsx`).
 *
 * Trois différences qui le rendent volontairement plus étroit :
 *   - désactivé sous quarante caractères, pas seulement lent à répondre ;
 *   - réécrit CE QUI EST DÉJÀ ÉCRIT, jamais un premier jet ;
 *   - « Use my original » restaure le texte VERBATIM depuis l'état local,
 *     jamais un nouvel appel — la réécriture ne s'écrit qu'à l'usage.
 *
 * `RephrasableField` et le seuil sont redéfinis ICI plutôt qu'importés de
 * `lib/generation/rephrase.ts` (même précédent que `write-for-me.tsx`, qui ne
 * lit pas non plus `SuggestableField` depuis `pipeline.ts`) : ce composant est
 * `"use client"`, et `lib/generation/rephrase.ts` importe la chaîne du client
 * Anthropic (`lib/ai/client.ts`), strictement serveur — un import direct
 * embarquerait cette chaîne dans le bundle client.
 */
const REPHRASE_MIN_CHARS = 40;
export type RephrasableField = "referral_quote" | "not_a_fit_text";

export function HelpMeSayIt({
  projectId,
  field,
  text,
  onRewrite,
}: {
  projectId: string;
  field: RephrasableField;
  text: string;
  onRewrite: (text: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);

  const disabled = text.trim().length < REPHRASE_MIN_CHARS;

  async function run() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/briefs/${projectId}/rephrase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field, text }),
      });
      const body = (await response.json().catch(() => null)) as
        | { text?: string; error?: string }
        | null;

      if (!response.ok || !body?.text) {
        setError(body?.error ?? "We couldn't tighten that. Write it your way.");
        return;
      }

      setOriginal(text);
      onRewrite(body.text);
    } catch {
      setError("We couldn't tighten that. Write it your way.");
    } finally {
      setPending(false);
    }
  }

  function useOriginal() {
    if (original !== null) onRewrite(original);
    setOriginal(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <Button
          variant="tertiary"
          onClick={run}
          disabled={disabled || pending}
          title={
            disabled
              ? "Write a line first — we'll tighten it, not invent it."
              : undefined
          }
        >
          {pending ? "Tightening…" : "Help me say it"}
        </Button>
        {original !== null ? (
          <button
            type="button"
            onClick={useOriginal}
            className="text-ui text-ink-2 underline decoration-line underline-offset-4 hover:text-ink hover:decoration-[var(--accent)]"
          >
            Use my original
          </button>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="border-l border-accent pl-3 text-helper leading-prose text-ink"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
