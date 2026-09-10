"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { Progress7, StepCounter } from "@/components/ui/progress7";
import { STEPS, type StepDraft } from "@/lib/brief/flow";
import { FIXTURE_CATALOG, FIXTURE_DRAFT, FIXTURE_LABEL } from "@/lib/brief/fixtures/catalog";
import { SAMPLE_PREVIEW } from "@/lib/brand/sample";
import {
  PracticeStep,
  PositioningStep,
  ClientStep,
  HowYouWorkStep,
  VoiceStep,
  LookStep,
  WebsiteStep,
  type StepBodyProps,
} from "@/components/brief/step-bodies";

/*
 * ── THE SEVEN BRIEF SCREENS, AT PHONE WIDTH, WITHOUT A SESSION ──────────
 *
 * The acquisition walk could not reach these: everything behind `/app` needs
 * a session, and Supabase was unreachable from that environment. So the phone
 * rendering of the thing a cold prospect actually fills in went unexamined,
 * which is the one unknown that decides whether the rest of the chantier
 * matters.
 *
 * This renders all seven bodies at once, in the real shell (eyebrow, question,
 * helper, gauge), from a fixture catalogue built to the live catalogue's
 * measured counts and longest labels. It reads no database and calls nothing.
 *
 * ⚠ EVERY WORD ON THIS PAGE IS A FIXTURE, and it says so at the top and above
 * every screen. It is linked from nowhere.
 *
 * ── WHY THE BODIES AND NOT `BriefFlow` ──────────────────────────────────
 *
 * `BriefFlow` owns autosave, and autosave is a PATCH against a real brief. On
 * a session-less page every keystroke would fire a request that 401s. The
 * bodies are where the layout lives; `update` here is local state, which is
 * also what makes every screen interactive enough to measure a filled-in one.
 */

const BODIES: Record<string, (props: StepBodyProps) => React.ReactNode> = {
  practice: PracticeStep,
  positioning: PositioningStep,
  client: ClientStep,
  how_you_work: HowYouWorkStep,
  voice: VoiceStep,
  look: LookStep,
  website: WebsiteStep,
};

export default function BriefPhonePage() {
  const [draft, setDraft] = useState<StepDraft>(FIXTURE_DRAFT);

  function update(patch: Partial<StepDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <main className="route-enter flex flex-col gap-12 pb-24">
      <header className="flex flex-col gap-3 border-b border-line px-[var(--gutter-sm)] pt-8 pb-6">
        <span className="self-start rounded-pill border border-danger px-2.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-danger">
          Fixtures — nothing here is real
        </span>
        <h1 className="font-display text-h2 font-medium text-ink">
          The seven brief screens, at this width
        </h1>
        <p className="text-helper leading-prose text-ink-2">
          Catalogue counts and longest labels are taken from the live tables;
          the words are invented. Linked from nowhere, reads nothing, saves
          nothing. Label: <code>{FIXTURE_LABEL}</code>
        </p>
      </header>

      {STEPS.map((step) => {
        const Body = BODIES[step.id];
        return (
          <section
            key={step.id}
            data-brief-step={step.id}
            className="flex flex-col border-b border-line pb-12"
          >
            {/* The real shell, so the measurement is of the real screen. */}
            <div className="flex-none p-[20px_var(--gutter)_0] max-md:p-[40px_var(--gutter-sm)_0]">
              <div className="mb-2.5 flex justify-end max-md:hidden">
                <StepCounter step={step.number} />
              </div>
              <Progress7 step={step.number} className="max-md:hidden" />
              <Progress7 step={step.number} dense className="md:hidden" />
              <div className="mt-6 md:hidden">
                <StepCounter step={step.number} />
              </div>
            </div>

            <div
              className={`flex min-w-0 flex-1 flex-col ${
                step.id === "look" ? "pt-[44px]" : "pt-8"
              } pl-[var(--gutter)] pr-14 max-md:px-[var(--gutter-sm)]`}
            >
              <div className="flex max-w-brief flex-col">
                <MonoLabel tracking="18">{step.eyebrow}</MonoLabel>
                <h1 className="mt-4 text-pretty font-display text-question font-medium leading-title tracking-question text-ink max-md:text-question-sm">
                  {step.question}
                </h1>
                <p className="mt-3 max-w-[560px] text-helper leading-prose text-ink-2">
                  {step.helper}
                </p>

                <div className={step.id === "look" ? "mt-9" : "mt-7"}>
                  <Body
                    projectId="00000000-0000-4000-8000-fixture000001"
                    draft={draft}
                    catalog={FIXTURE_CATALOG}
                    /*
                     * ⚠ NOT `null`, AND THAT IS A FINDING, NOT A FIXTURE
                     *   CHOICE. `StepBodyProps.preview` is typed
                     *   `PreviewModel | null`, and the `look` step's palette
                     *   cards dereference `model.tokens` with no guard —
                     *   `components/preview/cards.tsx:41`. A null preview
                     *   crashes step 6 outright. In production `brief_preview()`
                     *   has always returned something, so nothing has ever hit
                     *   it; the type says it can, and the code says it cannot.
                     *   Recorded in the report rather than patched here, since
                     *   this session is not the one that touches it.
                     */
                    preview={SAMPLE_PREVIEW}
                    update={update}
                    toneCards={null}
                    setToneCards={() => {}}
                  />
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
