"use client";

import { useState } from "react";
import { ChipGroup } from "@/components/brief/chip-group";
import { WriteForMe } from "@/components/brief/write-for-me";
import { HelpMeSayIt } from "@/components/brief/help-me-say-it";
import {
  PaletteCard,
  PersonaCard,
  ToneCard,
  TypePairingCard,
} from "@/components/preview/cards";
import { TextField, TextAreaField } from "@/components/ui/text-field";
import { MonoLabel } from "@/components/ui/mono-label";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { Catalog } from "@/lib/catalog/types";
import type { PreviewModel } from "@/lib/brand/shapes";
import type { StepDraft } from "@/lib/brief/flow";

/*
 * Le corps de chacune des sept étapes. Toutes reçoivent le même contrat :
 * le brouillon courant, le catalogue lu en base, et un `update` qui écrit
 * localement puis déclenche l'autosave.
 *
 * Aucune option n'est écrite ici : elles viennent toutes du catalogue (§6).
 * Le seul écart est signalé à l'étape 1, `PRACTICE_STAGES`.
 */

export type StepBodyProps = {
  projectId: string;
  draft: StepDraft;
  catalog: Catalog;
  preview: PreviewModel | null;
  update: (patch: Partial<StepDraft>) => void;
};

/*
 * ÉCART SIGNALÉ — le §5 demande des « stage cards » à l'étape 1, mais le
 * schéma backend ne porte AUCUNE table de catalogue pour l'étape de vie du
 * cabinet (contrairement à license_types, specialties, site_goals…). La liste
 * ci-dessous est donc codée ici, contre la règle du §6.
 *
 * DEMANDE AU DÉPÔT DE SCHÉMA — une table `practice_stages (id, label,
 * description, sort_order, active)` sur le modèle de `site_goals`, plus une
 * colonne `project_briefs.practice_stage_id`. En attendant, le choix est
 * stocké dans `project_briefs.data.stage`, qui n'est lu par personne d'autre.
 */
const PRACTICE_STAGES = [
  {
    id: "starting",
    label: "Just opening",
    description: "The practice exists on paper and needs a face.",
  },
  {
    id: "building",
    label: "A few years in",
    description: "Referrals work; the website has never caught up.",
  },
  {
    id: "established",
    label: "Established",
    description: "A full caseload, and a brand from an earlier version of it.",
  },
  {
    id: "changing",
    label: "Changing direction",
    description: "New focus, new fees, or leaving a group practice.",
  },
];

/* ── 1. Practice ────────────────────────────────────────────────────────── */

export function PracticeStep({ draft, catalog, update }: StepBodyProps) {
  const stage = draft.data.stage ?? null;

  return (
    <div className="flex flex-col gap-8">
      <TextField
        id="practice-name"
        label="Practice name"
        hint="Your own name is a perfectly good practice name."
        value={draft.practice_name ?? ""}
        onChange={(event) => update({ practice_name: event.target.value })}
        placeholder="Elm & Ember Counseling"
        maxLength={120}
        autoFocus
      />

      {/*
        Le nom de la praticienne, à part du nom du cabinet.
        Facultatif — c'est un brief, pas un formulaire d'ordre — mais posé ICI
        plutôt que découvert plus tard : un site qui annonce une pratique sous
        licence sans nommer la licenciée se répare mal après coup, et le
        demander à l'écran 1 coûte une ligne quand le demander dans l'éditeur
        de site arrive après sept écrans.

        Il ne remplace pas `practitioner_line`, qui est une chaîne COMPOSÉE
        (« Nora Whitfield, LCSW ») pour la story `signature`. Le semeur du spec
        de site a besoin du nom NU.
      */}
      <TextField
        id="practitioner-name"
        label="Your name, as it should appear on your site"
        hint="Optional. Leave it out and your site will name the practice only."
        value={draft.data.practitioner_name ?? ""}
        onChange={(event) =>
          update({
            data: {
              ...draft.data,
              practitioner_name: event.target.value || undefined,
            },
          })
        }
        placeholder="Nora Whitfield"
        maxLength={80}
      />

      <div className="flex flex-col gap-3">
        <span className="text-ui font-medium text-ink">License type</span>
        <ChipGroup
          legend="License type"
          mode="single"
          options={catalog.licenseTypes.map((entry) => ({
            id: entry.id,
            label: entry.label,
          }))}
          selected={draft.license_type_id ? [draft.license_type_id] : []}
          onChange={(next) => update({ license_type_id: next[0] ?? null })}
        />
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-ui font-medium text-ink">Specialties</span>
        <p className="text-helper leading-prose text-ink-2">
          The first two appear on your site. Pick the ones you want more of.
        </p>
        <ChipGroup
          legend="Specialties"
          options={catalog.specialties.map((entry) => ({
            id: entry.id,
            label: entry.label,
          }))}
          selected={draft.specialty_ids}
          onChange={(next) => update({ specialty_ids: next })}
        />
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-4">
        <TextField
          id="practice-city"
          label="City"
          value={draft.city ?? ""}
          onChange={(event) => update({ city: event.target.value })}
          placeholder="Portland"
          maxLength={80}
        />
        <TextField
          id="practice-state"
          label="State"
          value={draft.state ?? ""}
          onChange={(event) =>
            update({ state: event.target.value.toUpperCase().slice(0, 2) })
          }
          placeholder="OR"
          maxLength={2}
        />
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-ui font-medium text-ink">Where the practice is</span>
        <ChipGroup
          legend="Practice stage"
          mode="single"
          columns={2}
          options={PRACTICE_STAGES}
          selected={stage ? [stage] : []}
          onChange={(next) =>
            update({ data: { ...draft.data, stage: next[0] ?? undefined } })
          }
        />
      </div>
    </div>
  );
}

/* ── 2. Positioning ─────────────────────────────────────────────────────── */

export function PositioningStep({
  projectId,
  draft,
  catalog,
  update,
}: StepBodyProps) {
  const noticeSeen = draft.data.suggestion_notice_seen === true;
  const markNoticeSeen = () =>
    update({ data: { ...draft.data, suggestion_notice_seen: true } });

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h3 className="font-display text-subsection font-medium text-ink">
          What brings them in
        </h3>
        <ChipGroup
          legend="What brings them in"
          columns={2}
          options={catalog.problemCards.map((entry) => ({
            id: entry.id,
            label: entry.label,
            description: entry.description,
          }))}
          selected={draft.problem_card_ids}
          onChange={(next) => update({ problem_card_ids: next })}
        />
        <TextAreaField
          id="problem-text"
          label="Or say it your way"
          rows={3}
          value={draft.data.problem_text ?? ""}
          onChange={(event) =>
            update({ data: { ...draft.data, problem_text: event.target.value } })
          }
          placeholder="They can list everything that's going well and still can't sleep."
        />
        <WriteForMe
          projectId={projectId}
          field="problem_text"
          noticeSeen={noticeSeen}
          onNoticeShown={markNoticeSeen}
          onSuggestion={(text) =>
            update({ data: { ...draft.data, problem_text: text } })
          }
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-subsection font-medium text-ink">
          What changes for them
        </h3>
        <ChipGroup
          legend="What changes for them"
          columns={2}
          options={catalog.gainCards.map((entry) => ({
            id: entry.id,
            label: entry.label,
            description: entry.description,
          }))}
          selected={draft.gain_card_ids}
          onChange={(next) => update({ gain_card_ids: next })}
        />
        <TextAreaField
          id="gain-text"
          label="Or say it your way"
          rows={3}
          value={draft.data.gain_text ?? ""}
          onChange={(event) =>
            update({
              data: { ...draft.data, gain_text: event.target.value },
              // `positioning` alimente le sous-titre de la maquette : c'est
              // cette phrase-là que `brief_preview()` tronque à 60 caractères.
              positioning: event.target.value || null,
            })
          }
          placeholder="Therapy for high-performing adults who can't switch off."
        />
        <WriteForMe
          projectId={projectId}
          field="gain_text"
          noticeSeen={noticeSeen}
          onNoticeShown={markNoticeSeen}
          onSuggestion={(text) =>
            update({
              data: { ...draft.data, gain_text: text },
              positioning: text,
            })
          }
        />
      </section>
    </div>
  );
}

/* ── 3. Ideal client ────────────────────────────────────────────────────── */

export function ClientStep({ draft, catalog, update }: StepBodyProps) {
  function toggle(id: string) {
    const selected = draft.client_persona_ids;
    if (selected.includes(id)) {
      update({ client_persona_ids: selected.filter((entry) => entry !== id) });
      return;
    }
    const next = [...selected, id];
    update({
      client_persona_ids: next.length > 3 ? next.slice(next.length - 3) : next,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {catalog.personaCards.map((persona) => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            selected={draft.client_persona_ids.includes(persona.id)}
            onSelect={() => toggle(persona.id)}
          />
        ))}
      </div>
      <MonoLabel tracking="14" tone="ink-3">
        {`${draft.client_persona_ids.length} of 3`}
      </MonoLabel>
    </div>
  );
}

/* ── 4. How you work (§2.1) ─────────────────────────────────────────────── */
/*
 * Quatre questions sur un seul écran défilant, autosauvegardées comme les
 * autres. « Help me say it » (sur les deux zones de texte b. et d.) arrive au
 * commit suivant, avec le handler `/api/briefs/:id/rephrase` qu'il appelle —
 * le bouton n'a pas de sens sans lui.
 */

export function HowYouWorkStep({
  projectId,
  draft,
  catalog,
  update,
}: StepBodyProps) {
  const [priorCareerOpen, setPriorCareerOpen] = useState(
    Boolean(draft.prior_career?.trim())
  );

  const hints = draft.session_style_ids
    .flatMap(
      (id) =>
        catalog.sessionStyleCards.find((entry) => entry.id === id)?.voice_hints ?? []
    )
    .filter((hint, index, all) => all.indexOf(hint) === index);

  function toggleNotAFit(id: string) {
    const selected = draft.not_a_fit_ids;
    const next = selected.includes(id)
      ? selected.filter((entry) => entry !== id)
      : [...selected, id];
    update({ not_a_fit_ids: next.length > 3 ? next.slice(next.length - 3) : next });
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h3 className="font-display text-subsection font-medium text-ink">
          In session, what does the work usually look like?
        </h3>
        <ChipGroup
          legend="Session style"
          columns={2}
          max={4}
          options={catalog.sessionStyleCards.map((entry) => ({
            id: entry.id,
            label: entry.label,
            description: entry.description,
          }))}
          selected={draft.session_style_ids}
          onChange={(next) => update({ session_style_ids: next })}
        />
        {hints.length > 0 ? (
          <MonoLabel tracking="14" tone="ink-3">
            {`We're hearing: ${hints.join(" · ")}`}
          </MonoLabel>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-subsection font-medium text-ink">
          Who are you not the right therapist for?
        </h3>
        <p className="text-helper leading-prose text-ink-2">
          Naming who this isn&rsquo;t for is how the right people recognize
          themselves.
        </p>
        <div className="flex flex-col gap-3">
          {catalog.notAFitCards.map((card) => {
            const selected = draft.not_a_fit_ids.includes(card.id);
            return (
              <div key={card.id} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleNotAFit(card.id)}
                  className={`box-border flex h-[34px] w-fit items-center rounded-pill border px-4 text-left transition-colors duration-[var(--dur-select)] ${
                    selected
                      ? "border-accent bg-card text-ink"
                      : "border-line text-ink-2 hover:text-ink"
                  }`}
                >
                  <span className="text-ui">{card.label}</span>
                </button>
                {selected ? (
                  <p className="pl-1 text-ui leading-body text-ink-2">
                    {card.referral_note}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <MonoLabel tracking="14" tone="ink-3">
          {`${draft.not_a_fit_ids.length} of 3`}
        </MonoLabel>
        <TextAreaField
          id="not-a-fit-text"
          label="Or say it your way"
          rows={2}
          value={draft.not_a_fit_text ?? ""}
          onChange={(event) => update({ not_a_fit_text: event.target.value })}
          maxLength={400}
        />
        <HelpMeSayIt
          projectId={projectId}
          field="not_a_fit_text"
          text={draft.not_a_fit_text ?? ""}
          onRewrite={(text) => update({ not_a_fit_text: text })}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-subsection font-medium text-ink">
          How you were trained, and how much you lead with it.
        </h3>
        <ChipGroup
          legend="Modalities"
          columns={2}
          max={5}
          options={catalog.modalityCards.map((entry) => ({
            id: entry.id,
            label: entry.label,
            description: entry.full_name,
          }))}
          selected={draft.modality_ids}
          onChange={(next) =>
            // `ChipGroup` a déjà plafonné `next` à 5 (prop `max`) : pas besoin
            // de le refaire ici.
            update({
              modality_ids: next,
              modality_prominence: next.length > 0 ? draft.modality_prominence : null,
            })
          }
        />
        {draft.modality_ids.length > 0 ? (
          <SegmentedControl
            legend="How much you lead with your training"
            options={catalog.modalityProminenceOptions.map((entry) => ({
              id: entry.id,
              label: entry.label,
            }))}
            value={draft.modality_prominence}
            onChange={(next) => update({ modality_prominence: next })}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="font-display text-subsection font-medium text-ink">
          If a colleague referred someone to you, what would they say about you?
        </h3>
        <p className="text-helper leading-prose text-ink-2">
          Third person on purpose — it&rsquo;s easier than describing yourself.
        </p>
        <TextAreaField
          id="referral-quote"
          label="What a colleague would say"
          rows={3}
          value={draft.referral_quote ?? ""}
          onChange={(event) => update({ referral_quote: event.target.value })}
          placeholder="e.g. She's direct, but you never feel judged."
          maxLength={400}
        />
        <HelpMeSayIt
          projectId={projectId}
          field="referral_quote"
          text={draft.referral_quote ?? ""}
          onRewrite={(text) => update({ referral_quote: text })}
        />
      </section>

      <section className="flex flex-col gap-3">
        {priorCareerOpen ? (
          <>
            <TextField
              id="prior-career"
              label="What did you do before this work?"
              value={draft.prior_career ?? ""}
              onChange={(event) => update({ prior_career: event.target.value })}
              maxLength={200}
            />
            <Checkbox
              label="You can use this on my site"
              checked={draft.prior_career_public}
              onChange={(next) => update({ prior_career_public: next })}
            />
            {draft.prior_career?.trim() && !draft.prior_career_public ? (
              <p className="text-ui leading-body text-ink-2">
                We&rsquo;ll keep this to ourselves — it just helps us understand
                your practice.
              </p>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPriorCareerOpen(true)}
            className="w-fit text-ui text-ink-2 underline decoration-line underline-offset-4 hover:text-ink hover:decoration-[var(--accent)]"
          >
            What did you do before this work?
          </button>
        )}
      </section>
    </div>
  );
}

/* ── 5. Voice & tone ────────────────────────────────────────────────────── */

export function VoiceStep({ draft, catalog, update }: StepBodyProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {catalog.toneCards.map((tone) => (
        <ToneCard
          key={tone.id}
          tone={tone}
          selected={draft.tone_card_id === tone.id}
          onSelect={() =>
            update({ tone_card_id: draft.tone_card_id === tone.id ? null : tone.id })
          }
        />
      ))}
    </div>
  );
}

/* ── 6. Look (palette fusionnée à la typographie, §9.7/§2.3) ──────────────── */

export function LookStep({ draft, catalog, preview, update }: StepBodyProps) {
  const practiceName =
    draft.practice_name?.trim() || preview?.practice_name || "Your practice";
  const sentence =
    preview?.hero.subhead ??
    "Therapy for high-performing adults who can't switch off.";

  function togglePalette(id: string) {
    const selected = draft.palette_family_ids;
    if (selected.includes(id)) {
      update({ palette_family_ids: selected.filter((entry) => entry !== id) });
      return;
    }
    // L'ORDRE COMPTE : le premier choix reste en tête et pilote le rail. Un
    // quatrième choix pousse le plus ancien dehors — la base plafonne à trois.
    const next = [...selected, id];
    update({
      palette_family_ids: next.length > 3 ? next.slice(next.length - 3) : next,
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-3 gap-6">
        {catalog.paletteFamilies.map((family) => (
          <PaletteCard
            key={family.id}
            family={family}
            model={preview!}
            selected={draft.palette_family_ids.includes(family.id)}
            leading={draft.palette_family_ids[0] === family.id}
            onSelect={() => togglePalette(family.id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {catalog.typePairings.map((pairing) => (
          <TypePairingCard
            key={pairing.id}
            pairing={pairing}
            practiceName={practiceName}
            sentence={sentence}
            selected={draft.type_pairing_id === pairing.id}
            onSelect={() =>
              update({
                type_pairing_id:
                  draft.type_pairing_id === pairing.id ? null : pairing.id,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

/* ── 7. Website ─────────────────────────────────────────────────────────── */

const BUILDER_TARGETS = [
  { id: "squarespace", label: "Squarespace" },
  { id: "lovable", label: "Lovable" },
  { id: "framer", label: "Framer" },
  { id: "webflow", label: "Webflow" },
] as const;

export function WebsiteStep({ draft, catalog, update }: StepBodyProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <span className="text-ui font-medium text-ink">
          What the site is for
        </span>
        <ChipGroup
          legend="Site goal"
          columns={2}
          options={catalog.siteGoals.map((entry) => ({
            id: entry.id,
            label: entry.label,
            description: entry.description,
          }))}
          selected={draft.site_goal_ids}
          onChange={(next) => update({ site_goal_ids: next })}
        />
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-ui font-medium text-ink">Primary action</span>
        <p className="text-helper leading-prose text-ink-2">
          The button in your header, and under your headline. It changes in the
          preview as you pick.
        </p>
        <ChipGroup
          legend="Primary action"
          mode="single"
          options={catalog.primaryActions.map((entry) => ({
            id: entry.id,
            label: entry.label,
          }))}
          selected={draft.primary_action_id ? [draft.primary_action_id] : []}
          onChange={(next) => update({ primary_action_id: next[0] ?? null })}
        />
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-ui font-medium text-ink">
          Where you&rsquo;ll build it
        </span>
        <ChipGroup
          legend="Website builder"
          mode="single"
          options={BUILDER_TARGETS.map((entry) => ({ ...entry }))}
          selected={draft.data.builder_target ? [draft.data.builder_target] : []}
          onChange={(next) =>
            update({
              data: {
                ...draft.data,
                builder_target:
                  (next[0] as (typeof BUILDER_TARGETS)[number]["id"]) ?? undefined,
              },
            })
          }
        />
      </div>

      <TextField
        id="existing-url"
        label="Existing website"
        hint="Optional. If you have one, we'll keep the same domain in the prompt."
        value={draft.data.existing_url ?? ""}
        onChange={(event) =>
          update({ data: { ...draft.data, existing_url: event.target.value } })
        }
        placeholder="elmandember.com"
        maxLength={200}
      />
    </div>
  );
}
