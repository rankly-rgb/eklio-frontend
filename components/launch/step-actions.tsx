"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
}: {
  brandKitId: string;
  stepKey: LaunchStepKey;
  status: LaunchStepStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: LaunchStepStatus) {
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
          <Button disabled={busy} onClick={() => void set("done")}>
            Mark done
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
