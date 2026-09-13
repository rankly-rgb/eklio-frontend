"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  applyStatus,
  currentKey,
  resolvedCount,
  signature,
} from "@/lib/launch/state";
import type { LaunchProgress, LaunchStep, LaunchStepKey } from "@/lib/data/checklist";

/*
 * ── ONE OWNER FOR THE HOME SCREEN'S CHECKLIST STATE ──────────────────────
 *
 * The rail's rows, the ring above them and the NEXT STEP card beside them all
 * describe the same seven rows. Before this they read three different copies:
 * the rows and the ring came from the server render, the card's actions wrote
 * and called `router.refresh()`, and nothing on the client recomputed anything.
 * An optimistic toggle in the rail would therefore have left the rows ahead of
 * their own ring and ahead of the card until the refresh landed — three things
 * on one screen disagreeing about one fact, briefly, every time she ticked a box.
 *
 * So there is one owner. Everything that renders this state reads it from here,
 * and one optimistic update moves all of it together.
 *
 * ⚠ THIS IS NOT A SECOND SOURCE OF TRUTH. The server is. This holds one
 * in-flight optimistic copy of what the server already returned, writes through
 * the SAME `PATCH /api/checklist/[id]` → `set_launch_step` every other caller
 * uses, and adopts the server's answer again the moment a refresh lands. On a
 * rejected write it puts the row back where it was and says so — a row is never
 * left claiming a state the server refused.
 */

type LaunchState = {
  items: LaunchStep[];
  /** Resolved = done OR skipped, the same rule `get_launch_progress` applies. */
  resolved: number;
  total: number;
  /** The first `todo` — the emphasised row, and the step the card is showing. */
  currentKey: LaunchStepKey | null;
  /** The key being written right now, if any. */
  pending: LaunchStepKey | null;
  error: string | null;
  setStatus: (key: LaunchStepKey, status: LaunchStep["status"]) => Promise<void>;
};

const Ctx = createContext<LaunchState | null>(null);

export function useLaunchState(): LaunchState {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error("useLaunchState must be used inside <LaunchStateProvider>");
  }
  return value;
}

export function LaunchStateProvider({
  brandKitId,
  initial,
  children,
}: {
  brandKitId: string;
  initial: LaunchProgress;
  children: ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [pending, setPending] = useState<LaunchStepKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * Adopt the server's answer whenever it actually changes. `router.refresh()`
   * re-renders the server component and hands down new props, but React keeps
   * this component's state across that — so without this the optimistic copy
   * would outlive the truth it was standing in for. Comparing the SIGNATURE
   * rather than the array identity means an unrelated re-render does not
   * clobber a toggle that is still in flight.
   */
  const serverSig = signature(initial.items);
  const adopted = useRef(serverSig);
  useEffect(() => {
    if (adopted.current === serverSig) return;
    adopted.current = serverSig;
    setItems(initial.items);
  }, [serverSig, initial.items]);

  async function setStatus(key: LaunchStepKey, status: LaunchStep["status"]) {
    const previous = items.find((item) => item.key === key)?.status ?? "todo";
    if (previous === status) return;

    setError(null);
    setPending(key);
    setItems((current) => applyStatus(current, key, status));

    try {
      const response = await fetch(`/api/checklist/${brandKitId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, status }),
      });
      if (!response.ok) throw new Error("write refused");
      // The server re-picks the next action and recounts; the signature check
      // above adopts whatever it says.
      router.refresh();
    } catch {
      setItems((current) => applyStatus(current, key, previous));
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  const value: LaunchState = {
    items,
    resolved: resolvedCount(items),
    total: items.length,
    currentKey: currentKey(items),
    pending,
    error,
    setStatus,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
