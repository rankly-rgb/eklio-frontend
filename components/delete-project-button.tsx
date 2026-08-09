"use client";

import { useActionState, useState } from "react";
import { deleteProject, type DeleteProjectState } from "@/app/app/actions";

/*
 * Suppression en deux temps, sans alert() : un premier clic ouvre une
 * confirmation inline, le second déclenche la server action.
 */
export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState<
    DeleteProjectState,
    FormData
  >(deleteProject, null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded border border-rule px-4 py-2 font-mono text-sm text-danger transition-colors hover:bg-paper-raised"
      >
        Supprimer
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <span className="font-mono text-xs text-ink-soft">
        Supprimer « {projectName} » ?
      </span>
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-ink px-3 py-1.5 font-mono text-xs text-paper transition-colors hover:bg-ink-soft disabled:opacity-50"
      >
        {isPending ? "Suppression…" : "Oui, supprimer"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirming(false)}
        className="rounded border border-rule px-3 py-1.5 font-mono text-xs transition-colors hover:bg-paper-raised disabled:opacity-50"
      >
        Annuler
      </button>
      {state?.error && (
        <span role="alert" className="font-mono text-xs text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
