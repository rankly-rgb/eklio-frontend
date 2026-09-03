"use client";

import { useMemo, useState } from "react";
import { TextField, TextAreaField, InlineError } from "@/components/ui/text-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ChipGroup } from "@/components/brief/chip-group";
import { Checkbox } from "@/components/ui/checkbox";
import { MonoLabel } from "@/components/ui/mono-label";
import { checkClinicianFreeText } from "@/lib/tenancy/clinician-ethics";
import type { ClinicianCatalog } from "@/lib/data/clinician-brief";
import type { ClinicianStepDraft } from "@/lib/tenancy/clinician-brief/flow";

export type StepBodyProps = {
  draft: ClinicianStepDraft;
  catalog: ClinicianCatalog;
  hasOrgDefaultSupervisor: boolean;
  practiceName: string;
  update: (patch: Partial<ClinicianStepDraft>) => void;
};

/* ── 1. identity ──────────────────────────────────────────────────────── */

export function IdentityStep({
  draft,
  hasOrgDefaultSupervisor,
  update,
}: StepBodyProps) {
  return (
    <div className="flex max-w-brief flex-col gap-6">
      <TextField
        id="clinician-full-name"
        label="Full name"
        value={draft.fullName}
        onChange={(event) => update({ fullName: event.target.value })}
      />
      <TextField
        id="clinician-credentials"
        label="Credentials"
        hint="Written exactly as you want them to read, e.g. LPC-MHSP."
        value={draft.credentials ?? ""}
        onChange={(event) => update({ credentials: event.target.value })}
      />
      <SegmentedControl
        legend="Status"
        value={draft.status}
        onChange={(next) =>
          update({ status: next as ClinicianStepDraft["status"] })
        }
        options={[
          { id: "licensed", label: "Licensed" },
          { id: "associate", label: "Associate" },
          { id: "supervised_intern", label: "Supervised intern" },
        ]}
      />
      {draft.status === "supervised_intern" ? (
        <TextField
          id="clinician-supervisor"
          label="Supervisor"
          hint={
            hasOrgDefaultSupervisor
              ? "Leave blank to use your practice's default supervisor."
              : "Your practice hasn't set a default supervisor, so this is required."
          }
          value={draft.supervisorName ?? ""}
          onChange={(event) => update({ supervisorName: event.target.value })}
        />
      ) : null}
    </div>
  );
}

/* ── 2. licensed states ──────────────────────────────────────────────── */

export function LicensedStatesStep({ draft, catalog, update }: StepBodyProps) {
  return (
    <ChipGroup
      legend="Licensed states"
      mode="multi"
      selected={draft.stateCodes}
      onChange={(next) => update({ stateCodes: next })}
      options={catalog.states.map((s) => ({ id: s.code, label: s.name }))}
    />
  );
}

/* ── 3. modalities ────────────────────────────────────────────────────── */

export function ModalitiesStep({ draft, catalog, update }: StepBodyProps) {
  const selectedIds = draft.modalities.map((m) => m.modalityId);

  function onChangeSelection(next: string[]) {
    update({
      modalities: next.map((modalityId) => {
        const existing = draft.modalities.find((m) => m.modalityId === modalityId);
        return { modalityId, prominence: existing?.prominence ?? null };
      }),
    });
  }

  function onChangeProminence(modalityId: string, prominence: string) {
    update({
      modalities: draft.modalities.map((m) =>
        m.modalityId === modalityId ? { ...m, prominence } : m
      ),
    });
  }

  return (
    <div className="flex max-w-brief flex-col gap-6">
      <ChipGroup
        legend="Modalities"
        mode="multi"
        selected={selectedIds}
        onChange={onChangeSelection}
        options={catalog.modalities.map((m) => ({ id: m.id, label: m.label }))}
      />
      {draft.modalities.length > 0 ? (
        <div className="flex flex-col gap-4">
          <MonoLabel tracking="14" tone="ink-3">
            How much to lead with each
          </MonoLabel>
          {draft.modalities.map((m) => {
            const card = catalog.modalities.find((c) => c.id === m.modalityId);
            return (
              <div key={m.modalityId} className="flex flex-col gap-2">
                <span className="text-ui text-ink">{card?.label ?? m.modalityId}</span>
                <SegmentedControl
                  legend={`How much to lead with ${card?.label ?? m.modalityId}`}
                  value={m.prominence}
                  onChange={(next) => onChangeProminence(m.modalityId, next)}
                  options={catalog.prominenceOptions.map((p) => ({
                    id: p.id,
                    label: p.label,
                  }))}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ── 4. populations ───────────────────────────────────────────────────── */

export function PopulationsStep({ draft, catalog, update }: StepBodyProps) {
  return (
    <ChipGroup
      legend="Who you work with"
      mode="multi"
      selected={draft.populationIds}
      onChange={(next) => update({ populationIds: next })}
      options={catalog.populations.map((p) => ({ id: p.id, label: p.label }))}
    />
  );
}

/* ── 5. philosophy ────────────────────────────────────────────────────── */

export function PhilosophyStep({ draft, update }: StepBodyProps) {
  const text = draft.philosophyQuote ?? "";
  const flag = useMemo(() => checkClinicianFreeText("philosophy_quote", text), [text]);

  return (
    <div className="flex max-w-brief flex-col gap-3">
      <TextAreaField
        id="clinician-philosophy"
        label="Your philosophy"
        rows={4}
        value={text}
        onChange={(event) => update({ philosophyQuote: event.target.value })}
      />
      {flag.check.violations.length > 0 ? (
        <InlineError>
          {flag.check.violations[0].reason} — worth rewriting before this goes on your bio:
          {` "${flag.check.violations[0].excerpt}"`}
        </InlineError>
      ) : null}
    </div>
  );
}

/* ── 6. practicalities ────────────────────────────────────────────────── */

export function PracticalitiesStep({ draft, update }: StepBodyProps) {
  const outsideText = draft.outsideTheRoom ?? "";
  const outsideFlag = useMemo(
    () => checkClinicianFreeText("outside_the_room", outsideText),
    [outsideText]
  );
  const [rateInput, setRateInput] = useState(
    draft.sessionRateCents != null ? String(draft.sessionRateCents / 100) : ""
  );

  return (
    <div className="flex max-w-brief flex-col gap-6">
      <TextAreaField
        id="clinician-outside-room"
        label="Outside the room"
        hint="What you do when you're not seeing clients — optional."
        rows={3}
        value={outsideText}
        onChange={(event) => update({ outsideTheRoom: event.target.value })}
      />
      {outsideFlag.check.violations.length > 0 ? (
        <InlineError>
          {outsideFlag.check.violations[0].reason}
          {` "${outsideFlag.check.violations[0].excerpt}"`}
        </InlineError>
      ) : null}

      <TextAreaField
        id="clinician-personality"
        label="A personal note"
        hint="One or two lines that sound like you — optional."
        rows={2}
        value={draft.personalityNote ?? ""}
        onChange={(event) => update({ personalityNote: event.target.value })}
      />

      <div className="flex flex-col gap-2">
        <TextField
          id="clinician-rate"
          label="Session rate"
          hint="In dollars, e.g. 150 — optional."
          inputMode="decimal"
          value={rateInput}
          onChange={(event) => {
            const raw = event.target.value;
            setRateInput(raw);
            const dollars = Number(raw);
            update({
              sessionRateCents:
                raw.trim() === "" || !Number.isFinite(dollars) || dollars <= 0
                  ? null
                  : Math.round(dollars * 100),
            });
          }}
        />
        <Checkbox
          checked={draft.rateIsPublic}
          onChange={(next) => update({ rateIsPublic: next })}
          label="Show my rate on my bio"
        />
      </div>

      <TextField
        id="clinician-booking-url"
        label="Booking link"
        hint="Optional."
        type="url"
        value={draft.bookingUrl ?? ""}
        onChange={(event) => update({ bookingUrl: event.target.value })}
      />

      <Checkbox
        checked={draft.photoProvided}
        onChange={(next) => update({ photoProvided: next })}
        label="I have a photo on file with my practice"
      />
      <Checkbox
        checked={draft.acceptingClients}
        onChange={(next) => update({ acceptingClients: next })}
        label="I'm currently accepting new clients"
      />
    </div>
  );
}

/* ── 7. review ────────────────────────────────────────────────────────── */

export function ReviewStep({ draft, catalog, practiceName }: StepBodyProps) {
  const stateNames = draft.stateCodes
    .map((code) => catalog.states.find((s) => s.code === code)?.name ?? code)
    .join(", ");
  const modalityLabels = draft.modalities
    .map((m) => catalog.modalities.find((c) => c.id === m.modalityId)?.label ?? m.modalityId)
    .join(", ");
  const populationLabels = draft.populationIds
    .map((id) => catalog.populations.find((p) => p.id === id)?.label ?? id)
    .join(", ");

  return (
    <div className="flex max-w-brief flex-col gap-4 text-ui text-ink-2">
      <p>
        <span className="text-ink">{draft.fullName || "—"}</span>
        {draft.credentials ? `, ${draft.credentials}` : ""}
      </p>
      <p>Licensed in: {stateNames || "—"}</p>
      <p>Modalities: {modalityLabels || "—"}</p>
      <p>Works with: {populationLabels || "—"}</p>
      <p className="italic">{draft.philosophyQuote || "—"}</p>
      <p className="border-l border-line pl-3 text-helper leading-prose">
        Your brand — colors, logo, typography — is set by {practiceName} and
        shown on your bio automatically. It isn't asked here.
      </p>
    </div>
  );
}
