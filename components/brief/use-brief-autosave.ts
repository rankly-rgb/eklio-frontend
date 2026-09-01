"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BriefPatch } from "@/lib/data/brief";
import type { PreviewModel } from "@/lib/brand/shapes";

/*
 * L'autosave du brief (§5).
 *
 * TROIS PROPRIÉTÉS, et chacune se voit à l'écran :
 *
 * 1. DÉBOUNCE DE 600 ms. Une frappe ne déclenche pas une requête ; une pause
 *    en déclenche une.
 * 2. UN SEUL ALLER-RETOUR. Le PATCH renvoie le brief ET sa prévisualisation :
 *    le rail n'a rien à redemander, donc jamais de fenêtre où il montre l'état
 *    d'avant.
 * 3. PRÉVISUALISATION OPTIMISTE. Palette, typographie, ton et action
 *    principale repeignent le rail IMMÉDIATEMENT, avant même l'enregistrement.
 *    La réponse du serveur remplace ensuite le modèle — mais l'utilisateur a
 *    déjà vu sa couleur arriver.
 *
 * Les correctifs en attente sont FUSIONNÉS : deux changements à 200 ms
 * d'intervalle partent en une requête, pas deux qui se doublent.
 */

export type SaveState = "idle" | "saving" | "saved" | "error";

export type Autosave = {
  save: (patch: BriefPatch) => void;
  /** Repeint le rail sans rien enregistrer — utilisé par le survol/choix. */
  previewOptimistically: (next: PreviewModel) => void;
  preview: PreviewModel | null;
  state: SaveState;
  error: string | null;
  /** Vide en attente : le bouton « Continue » attend, il ne perd pas de saisie. */
  flush: () => Promise<void>;
};

const DEBOUNCE_MS = 600;
const SAVED_VISIBLE_MS = 2000;

export function useBriefAutosave(
  projectId: string,
  initialPreview: PreviewModel | null
): Autosave {
  const [preview, setPreview] = useState<PreviewModel | null>(initialPreview);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const pending = useRef<BriefPatch>({});
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
        const response = await fetch(`/api/briefs/${projectId}`, {
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
            body?.error ??
              "That didn't save. Check your connection and try again."
          );
          return;
        }

        const body = (await response.json()) as { preview: PreviewModel | null };
        if (body.preview) setPreview(body.preview);
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
    (patch: BriefPatch) => {
      pending.current = { ...pending.current, ...patch };
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

  // Le libellé SAVED s'efface après deux secondes (§5).
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

  return {
    save,
    previewOptimistically: setPreview,
    preview,
    state,
    error,
    flush,
  };
}
