"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RailSection } from "@/components/site/rail-section";
import { RESET_SCOPES, type ResetScope } from "@/lib/site/types";
import type { SiteEditorState } from "@/components/site/use-site-editor";

/*
 * La remise à zéro.
 *
 * Cinq portées, et une confirmation. La confirmation n'est pas une politesse :
 * `all` réécrit la copy, les couleurs, la typographie et la structure d'un
 * coup, et l'annulation qui suivrait coûterait autant d'écritures qu'il y a de
 * clés changées.
 *
 * `site_spec_reset(…, 'copy')` REPOSE le texte semé, y compris ce que le
 * semeur avait raccourci : la note de `seed_clamped` survit donc à un reset de
 * la copy, et c'est correct.
 */

const SCOPE_LABELS: Record<ResetScope, { label: string; detail: string }> = {
  all: {
    label: "Everything",
    detail: "Colors, fonts, copy and pages, back to your chosen direction.",
  },
  colors: { label: "Colors", detail: "The six roles, back to the direction's palette." },
  typography: { label: "Typography", detail: "Back to the direction's type pairing." },
  copy: { label: "Copy", detail: "Every heading, paragraph and list, back to the seeded text." },
  structure: { label: "Pages & sections", detail: "Which pages and sections exist, and their order." },
};

export function ResetSection({ editor }: { editor: SiteEditorState }) {
  const [scope, setScope] = useState<ResetScope>("colors");
  const [confirming, setConfirming] = useState(false);

  return (
    <RailSection id="site-reset" title="Start over">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-meta font-medium text-ink">What should go back?</span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as ResetScope)}
            className="w-full rounded-card border border-line bg-bg px-3 py-2 text-ui text-ink"
          >
            {RESET_SCOPES.map((entry) => (
              <option key={entry} value={entry}>
                {SCOPE_LABELS[entry].label}
              </option>
            ))}
          </select>
        </label>

        <p className="text-meta leading-body text-ink-2">
          {SCOPE_LABELS[scope].detail}
        </p>

        <Button
          variant="secondary"
          className="self-start"
          onClick={() => setConfirming(true)}
        >
          Reset
        </Button>
      </div>

      {confirming ? (
        <ConfirmReset
          scope={scope}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false);
            await editor.reset(scope);
          }}
        />
      ) : null}
    </RailSection>
  );
}

/**
 * La modale de confirmation.
 *
 * Le focus y entre à l'ouverture et revient au bouton en sortant ; Échap
 * annule ; la tabulation ne sort pas de la boîte. Une modale qui laisse le
 * focus derrière elle est invisible au clavier et au lecteur d'écran, et c'est
 * exactement ici qu'on ne veut pas d'un « oui » accidentel.
 */
function ConfirmReset({
  scope,
  onCancel,
  onConfirm,
}: {
  scope: ResetScope;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    box.current?.querySelector<HTMLElement>("button")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !box.current) return;

      const focusable = box.current.querySelectorAll<HTMLElement>("button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,33,28,0.35)] p-6">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        className="route-enter w-full max-w-[440px] rounded-card border border-line bg-bg p-7"
      >
        <h2
          id="reset-title"
          className="font-display text-card-title font-medium leading-card tracking-card-title text-ink"
        >
          {`Reset ${SCOPE_LABELS[scope].label.toLowerCase()}?`}
        </h2>
        <p className="mt-3 text-ui leading-prose text-ink-2">
          {SCOPE_LABELS[scope].detail} Anything you wrote there is replaced.
          You can undo this.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Keep my edits
          </Button>
          <Button variant="primary" onClick={() => void onConfirm()}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
