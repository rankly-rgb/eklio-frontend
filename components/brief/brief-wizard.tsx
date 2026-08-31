"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveBrief } from "@/lib/actions/brief";
import type { BriefCatalog } from "@/lib/eklio/catalog";
import {
  BRIEF_STEPS,
  BRIEF_STEP_COUNT,
  MAX_PALETTES,
  toggleInList,
  type BriefPatch,
  type BriefPreview,
  type BriefRow,
} from "@/lib/eklio/brief";
import { PreviewPanel } from "@/components/brief/preview-panel";
import {
  Chip,
  Field,
  GhostButton,
  PrimaryButton,
  SelectCard,
  StepProgress,
  TextArea,
  TextLink,
} from "@/components/ui/controls";

type Answers = Pick<
  BriefRow,
  | "practice_name"
  | "city"
  | "state"
  | "license_type_id"
  | "specialty_ids"
  | "positioning"
  | "client_persona_ids"
  | "problem_card_ids"
  | "gain_card_ids"
  | "tone_card_id"
  | "palette_family_ids"
  | "type_pairing_id"
  | "site_goal_ids"
  | "primary_action_id"
  | "builder_target_id"
>;

const COPY: Record<
  (typeof BRIEF_STEPS)[number]["key"],
  { title: string; sub: string }
> = {
  practice: {
    title: "Let's start with your practice.",
    sub: "This is what shows above your headline. Nothing here is verified — it is yours to state.",
  },
  positioning: {
    title: "Who do you want to reach, and how?",
    sub: "One or two sentences. The first sixty characters become your subhead.",
  },
  audience: {
    title: "Who is sitting across from you?",
    sub: "Pick what is true most of the time, not everything that is possible.",
  },
  tone: {
    title: "How should it sound?",
    sub: "Each one is written the way your headline would be written.",
  },
  palette: {
    title: "Which of these feels like your practice?",
    sub: "Sage and dusty blue are the directory default. Standing apart is allowed.",
  },
  typography: {
    title: "And how should it read?",
    sub: "Three pairings, each one a different kind of quiet.",
  },
  site: {
    title: "What should the site do?",
    sub: "This decides the prompt we hand you at the end.",
  },
};

export function BriefWizard({
  projectId,
  initialAnswers,
  initialStep,
  initialPreview,
  catalog,
}: {
  projectId: string;
  initialAnswers: Answers;
  initialStep: number;
  initialPreview: BriefPreview | null;
  catalog: BriefCatalog;
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), BRIEF_STEP_COUNT));
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [preview, setPreview] = useState<BriefPreview | null>(initialPreview);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  // L'autosave part sur chaque changement, mais une frappe ne doit pas
  // produire une écriture par caractère : on regroupe sur 600 ms. Le patch
  // accumulé est gardé dans une ref pour qu'un deuxième changement pendant le
  // délai ne perde pas le premier.
  const queued = useRef<BriefPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const patch = queued.current;
    queued.current = {};
    if (Object.keys(patch).length === 0) return;

    setSaved("saving");
    void saveBrief(projectId, patch).then((result) => {
      if (!result.ok) {
        setSaved("error");
        return;
      }
      setSaved("saved");
      if (result.preview) setPreview(result.preview);
    });
  }, [projectId]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const update = useCallback(
    (patch: Partial<Answers>) => {
      setAnswers((prev) => ({ ...prev, ...patch }));
      queued.current = { ...queued.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    [flush]
  );

  const goTo = useCallback(
    (next: number) => {
      const bounded = Math.min(Math.max(next, 1), BRIEF_STEP_COUNT);
      setStep(bounded);
      // `progress_step` est l'étape à laquelle le brief REPREND — distincte de
      // `projects.current_step`, qui est le pointeur de cycle de vie du projet.
      queued.current = { ...queued.current, progress_step: bounded };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 100);
      window.scrollTo({ top: 0 });
    },
    [flush]
  );

  const finish = () => {
    if (timer.current) clearTimeout(timer.current);
    flush();
    startTransition(() => router.push("/app/directions"));
  };

  const current = BRIEF_STEPS[step - 1];

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl flex-none px-6 pt-5">
        <StepProgress current={step} total={BRIEF_STEP_COUNT} />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-10 px-6 py-11">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex max-w-[640px] flex-col">
            <div className="overline text-muted">{current.overline}</div>
            <h1 className="mt-4 font-display text-[40px] font-medium leading-[1.12] tracking-[-0.015em] text-balance">
              {COPY[current.key].title}
            </h1>
            <p className="mt-3 max-w-[520px] text-[15px] leading-[1.6] text-muted">
              {COPY[current.key].sub}
            </p>

            <div className="mt-9">
              <StepBody step={current.key} answers={answers} catalog={catalog} update={update} />
            </div>

            <div className="mt-10 flex items-center gap-4">
              <GhostButton hidden={step === 1} onClick={() => goTo(step - 1)}>
                Back
              </GhostButton>
              {step < BRIEF_STEP_COUNT ? (
                <PrimaryButton onClick={() => goTo(step + 1)}>Continue</PrimaryButton>
              ) : (
                <PrimaryButton onClick={finish} disabled={pending}>
                  {pending ? "One moment…" : "See my three directions"}
                </PrimaryButton>
              )}
              {step < BRIEF_STEP_COUNT ? (
                <TextLink onClick={() => goTo(step + 1)}>Skip for now</TextLink>
              ) : null}
            </div>
          </div>

          <div className="flex-1" />
          <div className="overline pb-5 pt-10 text-faint">
            {saved === "saving" ? "SAVING" : saved === "error" ? "NOT SAVED" : saved === "saved" ? "SAVED" : ""}
          </div>
        </div>

        <div className="hidden w-[420px] flex-none border-l border-line pl-10 lg:block">
          <PreviewPanel preview={preview} />
        </div>
      </div>
    </div>
  );
}

function StepBody({
  step,
  answers,
  catalog,
  update,
}: {
  step: (typeof BRIEF_STEPS)[number]["key"];
  answers: Answers;
  catalog: BriefCatalog;
  update: (patch: Partial<Answers>) => void;
}) {
  switch (step) {
    case "practice":
      return (
        <div className="flex flex-col gap-6">
          <Field
            label="Practice name"
            value={answers.practice_name ?? ""}
            onChange={(v) => update({ practice_name: v })}
            placeholder="Elm & Ember Therapy"
          />
          <div className="grid grid-cols-[1fr_120px] gap-4">
            <Field
              label="City"
              value={answers.city ?? ""}
              onChange={(v) => update({ city: v })}
              placeholder="Portland"
            />
            <Field
              label="State"
              value={answers.state ?? ""}
              onChange={(v) => update({ state: v.toUpperCase().slice(0, 2) })}
              placeholder="OR"
              maxLength={2}
            />
          </div>

          <div className="flex flex-col gap-3">
            <span className="overline text-muted">Licence</span>
            <div className="flex flex-wrap gap-2">
              {catalog.licenseTypes.map((l) => (
                <Chip
                  key={l.id}
                  selected={answers.license_type_id === l.id}
                  onClick={() =>
                    update({ license_type_id: answers.license_type_id === l.id ? null : l.id })
                  }
                >
                  {l.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="overline text-muted">
              Specialties — the first two appear on your site
            </span>
            <div className="flex flex-wrap gap-2">
              {catalog.specialties.map((s) => (
                <Chip
                  key={s.id}
                  selected={answers.specialty_ids.includes(s.id)}
                  onClick={() => update({ specialty_ids: toggleInList(answers.specialty_ids, s.id) })}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      );

    case "positioning":
      return (
        <TextArea
          label="In your own words"
          value={answers.positioning ?? ""}
          onChange={(v) => update({ positioning: v })}
          placeholder="Therapy for high-performing adults who can't switch off."
          hint="We cut the subhead at sixty characters, on a word boundary — never mid-word."
        />
      );

    case "audience":
      return (
        <div className="flex flex-col gap-8">
          <CardGrid
            title="Who they are"
            items={catalog.personas}
            selected={answers.client_persona_ids}
            onToggle={(id) => update({ client_persona_ids: toggleInList(answers.client_persona_ids, id) })}
          />
          <CardGrid
            title="What brings them in"
            items={catalog.problems}
            selected={answers.problem_card_ids}
            onToggle={(id) => update({ problem_card_ids: toggleInList(answers.problem_card_ids, id) })}
          />
          <CardGrid
            title="What they leave with"
            items={catalog.gains}
            selected={answers.gain_card_ids}
            onToggle={(id) => update({ gain_card_ids: toggleInList(answers.gain_card_ids, id) })}
          />
        </div>
      );

    case "tone":
      return (
        <div className="grid grid-cols-2 gap-4">
          {catalog.tones.map((t) => (
            <SelectCard
              key={t.id}
              selected={answers.tone_card_id === t.id}
              onClick={() => update({ tone_card_id: answers.tone_card_id === t.id ? null : t.id })}
            >
              <span className="overline text-muted">{t.keywords.join(" · ")}</span>
              <span className="font-display text-[20px] leading-snug">{t.sample_hero}</span>
            </SelectCard>
          ))}
        </div>
      );

    case "palette":
      return (
        <div className="grid grid-cols-3 gap-6">
          {catalog.palettes.map((p) => {
            const rank = answers.palette_family_ids.indexOf(p.id);
            return (
              <SelectCard
                key={p.id}
                selected={rank >= 0}
                badge={rank === 0 ? "LEADING" : undefined}
                onClick={() =>
                  update({
                    palette_family_ids: toggleInList(answers.palette_family_ids, p.id, MAX_PALETTES),
                  })
                }
              >
                <PaletteThumb palette={p} />
                <span className="overline text-muted">{p.label}</span>
              </SelectCard>
            );
          })}
          <p className="col-span-3 text-[13px] text-muted">
            Up to three. The first one you pick leads, and it is what the preview renders.
          </p>
        </div>
      );

    case "typography":
      return (
        <div className="grid grid-cols-3 gap-4">
          {catalog.typePairings.map((tp) => (
            <SelectCard
              key={tp.id}
              selected={answers.type_pairing_id === tp.id}
              onClick={() =>
                update({ type_pairing_id: answers.type_pairing_id === tp.id ? null : tp.id })
              }
            >
              <link href={tp.google_fonts_url} rel="stylesheet" />
              <span
                className="text-[26px] leading-tight"
                style={{ fontFamily: `${tp.heading_font}, Georgia, serif` }}
              >
                Aa
              </span>
              <span
                className="text-[13px] leading-relaxed text-muted"
                style={{ fontFamily: `${tp.body_font}, system-ui, sans-serif` }}
              >
                {tp.heading_font} / {tp.body_font}
              </span>
            </SelectCard>
          ))}
        </div>
      );

    case "site":
      return (
        <div className="flex flex-col gap-8">
          <CardGrid
            title="What the site is for"
            items={catalog.siteGoals}
            selected={answers.site_goal_ids}
            onToggle={(id) => update({ site_goal_ids: toggleInList(answers.site_goal_ids, id) })}
          />

          <div className="flex flex-col gap-3">
            <span className="overline text-muted">The one thing a visitor should do</span>
            <div className="flex flex-wrap gap-2">
              {catalog.primaryActions.map((a) => (
                <Chip
                  key={a.id}
                  selected={answers.primary_action_id === a.id}
                  onClick={() =>
                    update({ primary_action_id: answers.primary_action_id === a.id ? null : a.id })
                  }
                >
                  {a.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="overline text-muted">Where you will build it</span>
            <div className="flex flex-wrap gap-2">
              {catalog.builderTargets.map((b) => (
                <Chip
                  key={b.id}
                  selected={answers.builder_target_id === b.id}
                  onClick={() =>
                    update({ builder_target_id: answers.builder_target_id === b.id ? null : b.id })
                  }
                >
                  {b.label}
                </Chip>
              ))}
            </div>
            <p className="text-[13px] text-muted">
              You can change this later — it only decides the shape of the hand-off, not the brand.
            </p>
          </div>
        </div>
      );
  }
}

function CardGrid({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: { id: string; label: string; description: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="overline text-muted">{title}</span>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <SelectCard key={item.id} selected={selected.includes(item.id)} onClick={() => onToggle(item.id)}>
            <span className="text-[15px] font-semibold">{item.label}</span>
            <span className="text-[13px] leading-snug text-muted">{item.description}</span>
          </SelectCard>
        ))}
      </div>
    </div>
  );
}

function PaletteThumb({
  palette,
}: {
  palette: { primary_hex: string; secondary_hex: string; light_hex: string; dark_hex: string; paper_hex: string };
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-[10px] border border-line" style={{ background: palette.paper_hex }}>
        <div className="h-4" style={{ background: palette.primary_hex }} />
        <div className="p-3">
          <div className="h-2 w-3/4 rounded-sm" style={{ background: palette.dark_hex }} />
          <div className="mt-2 h-1.5 w-1/2 rounded-sm opacity-40" style={{ background: palette.dark_hex }} />
          <div className="mt-3 h-3.5 w-14 rounded-full" style={{ background: palette.secondary_hex }} />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {[palette.primary_hex, palette.secondary_hex, palette.light_hex].map((hex) => (
          <span key={hex} className="size-3 rounded-full border border-line" style={{ background: hex }} />
        ))}
      </div>
    </div>
  );
}
