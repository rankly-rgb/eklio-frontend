"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveBriefStep,
  type SaveBriefStepResult,
} from "@/app/app/projets/[id]/brief/actions";
import {
  isStepNumber,
  stepSchemas,
  type BriefDraft,
} from "@/lib/brief/schemas";
import { getStep, type FieldDef, type StepDef } from "@/lib/brief/steps";
import {
  firstInvalidField,
  missingAnswersMessage,
} from "@/lib/brief/step-errors";
import { Button } from "@/components/ui/button";
import { BrandSheet } from "@/components/ui/brand-sheet";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { ErrorNotice } from "@/components/ui/error-notice";
import { MultiChoice } from "@/components/ui/multi-choice";
import { Slider } from "@/components/ui/slider";
import { TextInput } from "@/components/ui/text-input";
import { Textarea } from "@/components/ui/textarea";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error" };

function asString(value: BriefDraft[keyof BriefDraft]): string {
  return typeof value === "string" ? value : "";
}

function asArray(value: BriefDraft[keyof BriefDraft]): string[] {
  return Array.isArray(value) ? value : [];
}

function asSliderValue(value: BriefDraft[keyof BriefDraft]): number {
  return typeof value === "number" ? value : 3;
}

export function StepForm({
  projectId,
  projectName,
  step,
  initialDraft,
}: {
  projectId: string;
  projectName: string;
  /* Le numéro d'étape seulement : la configuration (qui contient des
     fonctions) est relue ici, côté client, et ne franchit jamais la
     frontière Server → Client. */
  step: number;
  initialDraft: BriefDraft;
}) {
  const router = useRouter();
  const [values, setValues] = useState<BriefDraft>(initialDraft);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const stepDef = isStepNumber(step) ? getStep(step) : undefined;
  // La page serveur ne rend ce composant qu'avec une étape valide.
  if (!isStepNumber(step) || !stepDef) {
    return null;
  }
  const stepSchema = stepSchemas[step];
  // Copie déjà rétrécie : le narrowing du garde ci-dessus ne traverse pas les
  // fonctions déclarées plus bas.
  const def: StepDef = stepDef;

  function setValue(name: string, value: string | string[] | number) {
    const next = { ...values, [name]: value } as BriefDraft;
    setValues(next);
    setFieldErrors((prev) => {
      if (!(name in prev)) return prev;
      const rest = { ...prev };
      delete rest[name];
      return rest;
    });
    return next;
  }

  /* Sauvegarde silencieuse (blur d'un champ, choix cliqué, sortie d'étape). */
  function autosave(draft?: BriefDraft) {
    const payload = draft ?? values;
    setSaveState({ kind: "saving" });
    saveBriefStep(projectId, step, payload, "draft")
      .then((result: SaveBriefStepResult) => {
        setSaveState(
          result.ok
            ? { kind: "saved", at: new Date(result.savedAt) }
            : { kind: "error" }
        );
      })
      .catch(() => setSaveState({ kind: "error" }));
  }

  /*
   * Ramène le praticien sur le premier champ fautif.
   *
   * Sans cela, un champ requis situé en haut de l'étape signale son erreur
   * hors de l'écran pendant que le clic a lieu tout en bas : le bouton paraît
   * inerte. Les groupes de choix n'ont pas d'`id` sur leurs entrées — on
   * retombe sur l'attribut `name`, qui les porte toutes.
   */
  function focusField(name: string) {
    if (typeof document === "undefined") return;
    // Après la peinture : le champ n'est marqué en erreur qu'au rendu suivant.
    requestAnimationFrame(() => {
      const target =
        document.getElementById(name) ??
        document.querySelector<HTMLElement>(`[name="${name}"]`);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        block: "center",
        // Même réserve que le reste du design system sur le mouvement.
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }

  function reportInvalidStep(errors: Record<string, string>, def: StepDef) {
    setFieldErrors(errors);
    // Le message vit à côté du bouton, là où le praticien vient de cliquer.
    setGlobalError(missingAnswersMessage(errors, def));
    const first = firstInvalidField(errors, def);
    if (first) focusField(first);
  }

  function handleContinue() {
    setGlobalError(null);
    // Validation client immédiate, avec les mêmes schémas que le serveur.
    const parsed = stepSchema.safeParse(values);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key !== "" && !(key in errors)) {
          errors[key] = issue.message;
        }
      }
      reportInvalidStep(errors, def);
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveBriefStep(
          projectId,
          step,
          values,
          "complete"
        );
        if (!result.ok) {
          if (result.fieldErrors) {
            reportInvalidStep(result.fieldErrors, def);
          }
          if (result.error) setGlobalError(result.error);
          return;
        }
        router.push(
          step < 7
            ? `/app/projets/${projectId}/brief/${step + 1}`
            : `/app/projets/${projectId}/brief/recapitulatif`
        );
      } catch {
        setGlobalError(
          "Saving failed. Check your connection, then try again."
        );
      }
    });
  }

  function handleBack() {
    autosave();
    router.push(`/app/projets/${projectId}/brief/${step - 1}`);
  }

  function renderField(field: FieldDef) {
    switch (field.kind) {
      case "text":
        if (field.visibleIf && !field.visibleIf(values)) return null;
        return (
          <TextInput
            key={field.name}
            id={field.name}
            label={field.label}
            help={field.help}
            required={field.required}
            value={asString(values[field.name])}
            onChange={(v) => setValue(field.name, v)}
            onBlur={() => autosave()}
            error={fieldErrors[field.name]}
          />
        );
      case "textarea":
        return (
          <Textarea
            key={field.name}
            id={field.name}
            label={field.label}
            help={field.help}
            required={field.required}
            rows={field.rows ?? 4}
            value={asString(values[field.name])}
            onChange={(v) => setValue(field.name, v)}
            onBlur={() => autosave()}
            error={fieldErrors[field.name]}
          />
        );
      case "choice":
        return (
          <ChoiceGroup
            key={field.name}
            name={field.name}
            legend={field.label}
            help={field.help}
            required={field.required}
            options={field.options}
            value={asString(values[field.name])}
            onChange={(v) => autosave(setValue(field.name, v))}
            error={fieldErrors[field.name]}
          />
        );
      case "multi":
        return (
          <MultiChoice
            key={field.name}
            name={field.name}
            legend={field.label}
            help={field.help}
            required={field.required}
            options={field.options}
            max={field.max}
            values={asArray(values[field.name])}
            onChange={(v) => autosave(setValue(field.name, v))}
            error={fieldErrors[field.name]}
          />
        );
      case "sliders":
        return (
          <fieldset key={field.name} className="flex flex-col gap-6">
            <legend className="label-mono mb-2 text-ink-muted">
              {field.label}
            </legend>
            {field.sliders.map((slider) => (
              <Slider
                key={slider.name}
                id={slider.name}
                left={slider.left}
                right={slider.right}
                value={asSliderValue(values[slider.name])}
                onChange={(v) => setValue(slider.name, v)}
                onCommit={() => autosave()}
              />
            ))}
          </fieldset>
        );
    }
  }

  const saveIndicator =
    saveState.kind === "saving"
      ? "Saving…"
      : saveState.kind === "saved"
        ? `Saved · ${new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }).format(saveState.at)}`
        : saveState.kind === "error"
          ? "Could not save"
          : null;

  return (
    <>
      <div className="step-enter flex min-w-0 flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.08em] text-ink-muted">
            {String(step).padStart(2, "0")} / 07
          </p>
          {/* Le route announcer intégré de Next annonce ce h1 à chaque changement d'étape. */}
          <h1 className="font-display text-3xl leading-tight">
            {stepDef.question}
          </h1>
          <p className="text-sm text-ink-muted">{stepDef.help}</p>
        </header>

        <div className="flex flex-col gap-8">
          {stepDef.fields.map((field) => renderField(field))}
        </div>

        {globalError && <ErrorNotice message={globalError} />}

        <div className="flex items-center justify-between gap-4 border-t border-rule pt-6">
          {step > 1 ? (
            <Button variant="secondary" onClick={handleBack} disabled={isPending}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-4">
            {saveIndicator && (
              <span
                aria-live="polite"
                className={`font-mono text-xs ${
                  saveState.kind === "error" ? "text-danger" : "text-ink-muted"
                }`}
              >
                {saveIndicator}
              </span>
            )}
            <Button variant="primary" onClick={handleContinue} disabled={isPending}>
              {isPending
                ? "Saving…"
                : step < 7
                  ? "Continue"
                  : "Review your brief"}
            </Button>
          </div>
        </div>

        {/* <1280px : la fiche de marque devient un panneau dépliable sous la colonne. */}
        <details className="rounded border border-rule xl:hidden">
          <summary className="label-mono cursor-pointer px-4 py-3 text-ink-soft">
            Brand sheet
          </summary>
          <div className="p-2">
            <BrandSheet projectName={projectName} draft={values} />
          </div>
        </details>
      </div>

      {/* ≥1280px : panneau collant à droite. */}
      <aside className="hidden self-start xl:sticky xl:top-10 xl:block">
        <BrandSheet projectName={projectName} draft={values} />
      </aside>
    </>
  );
}
