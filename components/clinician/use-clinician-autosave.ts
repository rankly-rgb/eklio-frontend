"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClinicianBriefPatch } from "@/lib/data/clinician-brief";
import type { ClinicianProfileCompleteness } from "@/lib/tenancy/clinician-profile";

/*
 * The clinician brief's autosave — cloned from
 * components/brief/use-brief-autosave.ts's shape (600ms debounce, merged
 * pending patch, single round-trip that returns fresh derived state), swapped
 * to PATCH /api/clinician-profile/[projectId] and to return completeness
 * instead of a brand preview model — this flow has no visual mock to repaint,
 * so "preview" here means the completeness score updating live instead of
 * requiring a second request. Not a generic, parameterized reuse of the
 * brief's hook: a separate hook following the same three properties.
 */

export type SaveState = "idle" | "saving" | "saved" | "error";

export type ClinicianAutosave = {
  save: (patch: ClinicianBriefPatch) => void;
  completeness: ClinicianProfileCompleteness | null;
  state: SaveState;
  error: string | null;
  flush: () => Promise<void>;
};

const DEBOUNCE_MS = 600;
const SAVED_VISIBLE_MS = 2000;

function mergePatch(
  current: ClinicianBriefPatch,
  patch: ClinicianBriefPatch
): ClinicianBriefPatch {
  return {
    profile: { ...current.profile, ...patch.profile },
    stateCodes: patch.stateCodes ?? current.stateCodes,
    modalities: patch.modalities ?? current.modalities,
    populationIds: patch.populationIds ?? current.populationIds,
  };
}

export function useClinicianAutosave(
  projectId: string,
  initialCompleteness: ClinicianProfileCompleteness | null
): ClinicianAutosave {
  const [completeness, setCompleteness] = useState(initialCompleteness);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const pending = useRef<ClinicianBriefPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const send = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;

    setState("saving");
    setError(null);

    const request = (async () => {
      try {
        const response = await fetch(`/api/clinician-profile/${projectId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          setState("error");
          setError(
            body?.error ?? "That didn't save. Check your connection and try again."
          );
          return;
        }

        const body = (await response.json()) as {
          completeness: ClinicianProfileCompleteness;
        };
        setCompleteness(body.completeness);
        setState("saved");
      } catch {
        setState("error");
        setError("That didn't save. Check your connection and try again.");
      }
    })();

    inFlight.current = request;
    await request;
    inFlight.current = null;
  }, [projectId]);

  const save = useCallback(
    (patch: ClinicianBriefPatch) => {
      pending.current = mergePatch(pending.current, patch);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void send();
      }, DEBOUNCE_MS);
    },
    [send]
  );

  const flush = useCallback(async () => {
    await send();
    if (inFlight.current) await inFlight.current;
  }, [send]);

  useEffect(() => {
    if (state !== "saved") return;
    const timeout = setTimeout(() => setState("idle"), SAVED_VISIBLE_MS);
    return () => clearTimeout(timeout);
  }, [state]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { save, completeness, state, error, flush };
}
