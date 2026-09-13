"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonVariant } from "@/components/ui/button";
import type { LaunchStepKey, LaunchStepStatus } from "@/lib/data/checklist";

/*
 * Mark done / skip, for ONE step, on its own screen.
 *
 * The accordion's version of these buttons is optimistic because it sits in a
 * list where the click has to answer instantly. Here it is not: this screen
 * shows one step, its state is the whole point of the screen, and a router
 * refresh re-reads the truth from the same RPC the rest of the product reads.
 * An optimistic tick that quietly disagreed with the server would be worse
 * here than a half-second wait.
 */
export function LaunchStepActions({
  brandKitId,
  stepKey,
  status,
  variant = "primary",
  onSet,
  doneLabel = "Mark done",
}: {
  brandKitId: string;
  stepKey: LaunchStepKey;
  status: LaunchStepStatus;
  /**
   * The affirmative button's fill. `primary` (ink) everywhere by default, so
   * `/app/launch` is untouched; the home card passes `accent` because the
   * mockup draws it in clay and the home screen spends its one clay CTA here
   * (`components/ui/button.tsx`: at most one primary or accent per screen).
   */
  variant?: ButtonVariant;
  /**
   * Where the write goes. Omitted — `/app/launch` and `/app/launch/[stepKey]` —
   * it writes here and refreshes. The home screen passes its shared state's
   * writer instead, because the rail and the ring beside this card describe the
   * same seven rows and must move on the same update. Same route, same RPC;
   * only the owner of the optimistic copy differs.
   */
  onSet?: (status: LaunchStepStatus) => void | Promise<void>;
  /**
   * What the affirmative button says. Defaults to `Mark done`.
   *
   * The five steps that finish on someone else's website pass `Mark as done`:
   * Eklio cannot see her Psychology Today profile or her Google listing, so
   * she is DECLARING that she did it, not confirming something the product
   * observed. The wording is the only place that distinction can live.
   */
  doneLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: LaunchStepStatus) {
    if (onSet) {
      await onSet(next);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/checklist/${brandKitId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: stepKey, status: next }),
      });
      if (!response.ok) {
        setError("That did not save. Check your connection and try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("That did not save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        {status === "done" ? (
          <Button variant="secondary" disabled={busy} onClick={() => void set("todo")}>
            Mark not done
          </Button>
        ) : (
          <Button variant={variant} disabled={busy} onClick={() => void set("done")}>
            {doneLabel}
          </Button>
        )}

        {status === "skipped" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void set("todo")}
            className="text-meta text-ink-2 hover:text-ink disabled:opacity-40"
          >
            Undo skip
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void set("skipped")}
            className="text-meta text-ink-3 hover:text-ink-2 disabled:opacity-40"
          >
            Skip for now
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="border-l border-accent pl-3 text-helper leading-prose text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
