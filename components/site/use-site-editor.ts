"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizePatch } from "@/lib/site/patch";
import {
  pushHistory,
  HISTORY_LIMIT,
  EMPTY_HISTORY,
  type SpecHistory,
} from "@/lib/site/history";
import type {
  ResetScope,
  SiteErrorBody,
  SiteSpec,
  SiteSpecEnvelope,
  SiteTarget,
} from "@/lib/site/types";

/*
 * L'état de l'éditeur de site — une enveloppe, une file d'écriture, un
 * historique.
 *
 * ── CE QU'IL NE FAIT PAS ─────────────────────────────────────────────────
 *
 * Il ne recalcule NI la maquette, NI les ratios de contraste, NI la sortie.
 * Les trois arrivent composés dans l'enveloppe et sont remplacés en bloc à
 * chaque réponse. Deux implémentations d'un même modèle finissent toujours par
 * diverger, et le jour où ça arrive la maquette ne montre plus ce que la
 * praticienne va coller.
 *
 * ── LA FILE ──────────────────────────────────────────────────────────────
 *
 * Une seule écriture en vol à la fois. Ce qui arrive pendant s'accumule dans
 * un patch en attente, fusionné, envoyé au retour. Sans ça, deux PATCH
 * concurrents sur le même spec reviennent dans un ordre que personne ne
 * garantit, et la dernière réponse — pas la dernière frappe — gagne.
 *
 * ── L'OPTIMISME, ET SON ANNULATION ───────────────────────────────────────
 *
 * Couleurs, polices et bascules sont appliquées AVANT la réponse : ce sont
 * elles qui doivent faire réagir la maquette sous le doigt. Les variantes
 * dérivées, elles, ne peuvent pas l'être — c'est un trigger qui les calcule.
 * L'enveloppe de retour les apporte, et la maquette se rattrape en 500 ms de
 * transition de tokens plutôt que de clignoter.
 *
 * Un refus (`too_long`, `invalid_field`…) remet le spec dans l'état d'avant :
 * le contrat garantit qu'une erreur n'a RIEN écrit.
 */

const DEBOUNCE_MS = 600;

export type SitePatch = Partial<
  Pick<
    SiteSpec,
    | "primary"
    | "secondary"
    | "accent"
    | "paper"
    | "light_neutral"
    | "dark_neutral"
    | "heading_font"
    | "body_font"
    | "type_pairing_id"
    | "google_fonts_url"
    | "hero"
    | "about_excerpt"
    | "pages"
    | "practice_details"
    | "extra_instructions"
  >
>;

export type SiteEditorState = {
  envelope: SiteSpecEnvelope;
  /** Une écriture est en vol, ou en attente de l'être. */
  saving: boolean;
  /** Le dernier refus de la base, à afficher SUR le champ fautif. */
  error: SiteErrorBody | null;
  dismissError: () => void;

  /** Édition normale : optimiste, groupée, envoyée après 600 ms de calme. */
  edit: (patch: SitePatch) => void;
  /** Édition à envoyer tout de suite — une bascule, un glisser-déposer. */
  commit: (patch: SitePatch) => void;

  setTarget: (target: SiteTarget) => Promise<void>;
  fixContrast: (pairId: string) => Promise<void>;
  reset: (scope: ResetScope) => Promise<void>;
  markCopied: () => Promise<void>;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/** Les clés de premier niveau qui diffèrent entre deux specs. */
function changedKeys(from: SiteSpec, to: SiteSpec): (keyof SiteSpec)[] {
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]) as Set<
    keyof SiteSpec
  >;
  return [...keys].filter(
    (key) => JSON.stringify(from[key]) !== JSON.stringify(to[key])
  );
}

export function useSiteEditor(
  brandKitId: string,
  initial: SiteSpecEnvelope
): SiteEditorState {
  const [envelope, setEnvelope] = useState(initial);
  const [inFlight, setInFlight] = useState(0);
  const [error, setError] = useState<SiteErrorBody | null>(null);
  const [history, setHistory] = useState<SpecHistory>(() => ({
    ...EMPTY_HISTORY,
    past: [],
    present: initial.spec,
  }));

  /*
   * Ces trois-là vivent en ref, pas en state : ils sont lus par des callbacks
   * qui ne doivent pas se recréer à chaque frappe, et un rendu de plus par
   * caractère saisi ferait perdre le curseur des champs en place.
   */
  const pending = useRef<SitePatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  /** Le spec d'avant l'optimisme, pour revenir en arrière sur un refus. */
  const confirmed = useRef<SiteSpec>(initial.spec);
  /*
   * L'écriture en cours EST une annulation. Sans ce drapeau, la réponse d'un
   * Cmd+Z réempilerait l'état annulé dans `past`, et le Cmd+Z suivant
   * reviendrait dessus : l'historique tournerait en rond entre deux états.
   */
  const travelling = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  /** Remplace TOUTE l'enveloppe. Jamais une de ses parties. */
  const adopt = useCallback((next: SiteSpecEnvelope) => {
    confirmed.current = next.spec;
    setEnvelope(next);
    setError(null);
  }, []);

  /*
   * `flush` se rappelle lui-même quand une écriture est arrivée pendant
   * l'envoi précédent. Il passe par cette ref plutôt que par son propre nom :
   * une `useCallback` qui se référence forme un cycle que le compilateur React
   * ne peut pas mémoriser, et la ref le casse sans changer le comportement.
   */
  const flushRef = useRef<() => void>(() => {});

  const flush = useCallback(async () => {
    if (busy.current) return;
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;

    pending.current = {};
    busy.current = true;
    setInFlight((count) => count + 1);
    const rollbackTo = confirmed.current;

    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/site-spec`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sanitizePatch(patch)),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        // Le contrat le garantit : une erreur n'a rien écrit. On revient donc
        // à l'état confirmé, et on abandonne ce qui attendait — le réenvoyer
        // rejouerait la même erreur en boucle.
        pending.current = {};
        setEnvelope((current) => ({ ...current, spec: rollbackTo }));
        setError(
          (body as { error?: SiteErrorBody } | null)?.error ?? {
            code: "invalid_body",
            message: "That didn't save. Try again in a moment.",
          }
        );
        return;
      }

      adopt(body as SiteSpecEnvelope);
      if (travelling.current) {
        travelling.current = false;
      } else {
        setHistory((current) => pushHistory(current, (body as SiteSpecEnvelope).spec));
      }
    } catch {
      pending.current = {};
      setEnvelope((current) => ({ ...current, spec: rollbackTo }));
      setError({
        code: "invalid_body",
        message: "That didn't save. Check your connection and try again.",
      });
    } finally {
      busy.current = false;
      setInFlight((count) => count - 1);
      // Ce qui est arrivé pendant l'envoi part maintenant, en un seul patch.
      if (Object.keys(pending.current).length > 0) flushRef.current();
    }
  }, [brandKitId, adopt]);

  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  const queue = useCallback(
    (patch: SitePatch, immediate: boolean) => {
      pending.current = { ...pending.current, ...patch };
      // L'optimisme : la maquette bouge maintenant, la base confirmera.
      setEnvelope((current) => ({ ...current, spec: { ...current.spec, ...patch } }));
      setError(null);

      if (timer.current) clearTimeout(timer.current);
      if (immediate) {
        void flush();
      } else {
        timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
      }
    },
    [flush]
  );

  const edit = useCallback((patch: SitePatch) => queue(patch, false), [queue]);
  const commit = useCallback((patch: SitePatch) => queue(patch, true), [queue]);

  /**
   * Un appel qui renvoie l'enveloppe entière — cible, correctif, reset,
   * mark-copied. Aucun d'eux n'est optimiste : ils changent tous plus que ce
   * qu'on leur a demandé (un correctif déplace un jeton et bouge toutes les
   * paires qui le partagent), et deviner ce plus serait le recalculer.
   */
  const post = useCallback(
    async (path: string, body: unknown, options?: { history?: boolean }) => {
      setInFlight((count) => count + 1);
      try {
        const response = await fetch(`/api/brand-kits/${brandKitId}/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const payload = await response.json().catch(() => null);

        if (response.status === 409) {
          // `no_fix_needed` : la paire passait déjà. Pas une erreur de
          // l'utilisatrice, donc pas un message — un no-op.
          return;
        }
        if (!response.ok) {
          setError(
            (payload as { error?: SiteErrorBody } | null)?.error ?? {
              code: "invalid_body",
              message: "That didn't go through. Try again in a moment.",
            }
          );
          return;
        }

        adopt(payload as SiteSpecEnvelope);
        if (options?.history !== false) {
          setHistory((current) =>
            pushHistory(current, (payload as SiteSpecEnvelope).spec)
          );
        }
      } finally {
        setInFlight((count) => count - 1);
      }
    },
    [brandKitId, adopt]
  );

  const setTarget = useCallback(
    async (target: SiteTarget) => {
      await post("site-spec/target", { target });
    },
    [post]
  );

  const fixContrast = useCallback(
    async (pairId: string) => {
      await post("site-spec/fix-contrast", { pair_id: pairId });
    },
    [post]
  );

  const reset = useCallback(
    async (scope: ResetScope) => {
      await post("site-spec/reset", { scope });
    },
    [post]
  );

  const markCopied = useCallback(async () => {
    // Une copie ne change pas le spec : elle avance seulement le compteur de
    // version copiée. Elle n'a donc rien à faire dans l'historique — un Cmd+Z
    // après une copie doit défaire la dernière ÉDITION.
    await post("site-output/mark-copied", {}, { history: false });
  }, [post]);

  /**
   * Restaure un instantané en n'envoyant que les clés qui diffèrent.
   *
   * Pas de `PUT` : il n'y en a pas. `site_spec_patch` fusionne les clés de
   * premier niveau, donc renvoyer les clés changées de l'instantané SUFFIT à
   * l'y ramener — et n'écrase rien de ce qu'on n'a pas touché.
   */
  const travel = useCallback(
    (to: SiteSpec) => {
      const patch: Record<string, unknown> = {};
      for (const key of changedKeys(envelope.spec, to)) {
        patch[key] = to[key];
      }
      const usable = sanitizePatch(patch);
      if (Object.keys(usable).length === 0) return;
      travelling.current = true;
      commit(usable as SitePatch);
    },
    [envelope.spec, commit]
  );

  /*
   * Les deux callbacks lisent `history` et posent le suivant : ils ne
   * calculent RIEN dans l'updater de `setHistory`. Un updater doit être pur,
   * et React le rappelle en StrictMode — un `travel()` dedans partirait deux
   * fois.
   */
  const undo = useCallback(() => {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    setHistory({
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
    });
    travel(previous);
  }, [history, travel]);

  const redo = useCallback(() => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    setHistory({
      past: [...history.past, history.present].slice(-HISTORY_LIMIT),
      present: next,
      future: history.future.slice(1),
    });
    travel(next);
  }, [history, travel]);

  return useMemo(
    () => ({
      envelope,
      saving: inFlight > 0,
      error,
      dismissError: () => setError(null),
      edit,
      commit,
      setTarget,
      fixContrast,
      reset,
      markCopied,
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }),
    [
      envelope,
      inFlight,
      error,
      edit,
      commit,
      setTarget,
      fixContrast,
      reset,
      markCopied,
      undo,
      redo,
      history.past.length,
      history.future.length,
    ]
  );
}
