"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/*
 * « Write it for me » — le lien tertiaire posé sous chaque champ libre (§5).
 *
 * Ce que la suggestion rend est ÉDITABLE : elle remplit le champ, elle ne le
 * verrouille pas, et « Try another » reste offert. C'est ce qui fait la
 * différence entre un assistant et un générateur.
 *
 * Le rappel n'est montré QU'UNE FOIS, à la première utilisation, et
 * l'application s'en souvient dans `project_briefs.data`.
 */

export const SUGGESTION_NOTICE =
  "We draft in plain, board-safe language. Edit anything.";

export type SuggestableField =
  | "positioning"
  | "problem_text"
  | "gain_text"
  | "practitioner_line";

export function WriteForMe({
  projectId,
  field,
  onSuggestion,
  noticeSeen,
  onNoticeShown,
}: {
  projectId: string;
  field: SuggestableField;
  onSuggestion: (text: string) => void;
  noticeSeen: boolean;
  onNoticeShown: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [used, setUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotice, setShowNotice] = useState(false);

  async function draft() {
    setPending(true);
    setError(null);

    if (!noticeSeen) {
      setShowNotice(true);
      onNoticeShown();
    }

    try {
      const response = await fetch(`/api/briefs/${projectId}/suggest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const body = (await response.json().catch(() => null)) as
        | { text?: string; error?: string }
        | null;

      if (!response.ok || !body?.text) {
        setError(body?.error ?? "We couldn't draft that. Write it your way.");
        return;
      }

      onSuggestion(body.text);
      setUsed(true);
    } catch {
      setError("We couldn't draft that. Write it your way.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <Button variant="tertiary" onClick={draft} disabled={pending}>
          {pending ? "Drafting…" : used ? "Try another" : "Write it for me"}
        </Button>
      </div>
      {showNotice && !error ? (
        <p className="text-helper leading-prose text-ink-2">
          {SUGGESTION_NOTICE}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="border-l border-accent pl-3 text-helper leading-prose text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
