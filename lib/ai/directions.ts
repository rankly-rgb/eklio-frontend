import "server-only";

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { anthropic, GENERATION_MODEL } from "@/lib/ai/client";
import {
  validateDirections,
  type DirectionLimits,
  type GeneratedDirection,
} from "@/lib/ai/limits";

const HeroSchema = z.object({
  overline: z.string(),
  headline: z.string(),
  subhead: z.string(),
  cta_label: z.string(),
});

const DirectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  rationale: z.string(),
  about_excerpt: z.string(),
  type_pairing_id: z.string(),
  palette: z.object({
    primary: z.string(),
    secondary: z.string(),
    light: z.string(),
    dark: z.string(),
    paper: z.string(),
    accent: z.string(),
  }),
  hero: HeroSchema,
  tone_keywords: z.array(z.string()),
});

const GenerationSchema = z.object({
  directions: z.array(DirectionSchema),
  voice_guide: z.object({
    sounds_like: z.array(z.string()),
    never_write: z.array(z.string()),
  }),
  practitioner_line: z.string(),
});

export type Generation = z.infer<typeof GenerationSchema>;

export type BriefFacts = {
  practiceName: string | null;
  city: string | null;
  state: string | null;
  license: string | null;
  specialties: string[];
  positioning: string | null;
  personas: string[];
  problems: string[];
  gains: string[];
  toneKeywords: string[];
  toneSample: string | null;
  palettes: { label: string; swatches: string[] }[];
  siteGoals: string[];
  primaryAction: string | null;
  builderTarget: string | null;
};

export type TypePairingChoice = {
  id: string;
  heading_font: string;
  body_font: string;
};

export type EthicsRule = {
  id: string;
  short_label: string;
  description: string;
  example_forbidden: string;
};

const MAX_ATTEMPTS = 3;

function briefBlock(b: BriefFacts): string {
  const lines: string[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) lines.push(`${label}: ${value}`);
  };
  const addList = (label: string, values: string[]) => {
    if (values.length) lines.push(`${label}: ${values.join(", ")}`);
  };

  add("Practice name", b.practiceName);
  add("Location", [b.city, b.state].filter(Boolean).join(", ") || null);
  add("Licence", b.license);
  addList("Specialties", b.specialties);
  add("How she describes the work", b.positioning);
  addList("Who she sees", b.personas);
  addList("What brings them in", b.problems);
  addList("What they leave with", b.gains);
  addList("Tone she picked", b.toneKeywords);
  add("A headline in that tone", b.toneSample);
  addList(
    "Palettes she shortlisted, leading first",
    b.palettes.map((p) => `${p.label} (${p.swatches.join(" ")})`)
  );
  addList("What the site is for", b.siteGoals);
  add("The one action a visitor should take", b.primaryAction);
  add("Where she will build the site", b.builderTarget);

  return lines.length ? lines.join("\n") : "She skipped the brief entirely. Work from the defaults.";
}

function systemPrompt(
  limits: DirectionLimits,
  pairings: TypePairingChoice[],
  rules: EthicsRule[]
): string {
  return `You write brand directions for therapists in private practice in the United States.

Three directions, genuinely different from each other — not one idea in three colourways. Each is a complete, plausible way her practice could present itself.

WHAT MAKES THIS GOOD
Her competition is the therapist directory: pale sage green, dusty blue, a stock photo of a fern. Never produce those palettes. Standing apart is the entire product.
Write the way she would talk to someone sitting across from her, not the way a clinic writes. Plain words. No abstraction where a concrete noun exists.

HARD LIMITS — these are database constraints, not preferences. A direction that misses one is rejected and her generation is spent for nothing.
- name: at most ${limits.name} characters, one or two words.
- rationale: between ${limits.rationale_min} and ${limits.rationale_max} characters. Both ends are enforced. Count them.
- hero.headline: at most ${limits.hero_headline} characters.
- hero.subhead: at most ${limits.hero_subhead} characters.
- tone_keywords: exactly ${limits.tone_keywords_count} single words, no spaces inside a word. Joined with " · " they must be at most ${limits.tone_keywords_joined} characters.
- palette: hex values like #3B2C3A for primary, secondary, light, dark, paper and accent. "light" and "paper" are two different surfaces: paper is the page ground, light is a raised band on it. They must not be the same value.
- Body text must reach WCAG AA against paper, so dark must be genuinely dark.
- type_pairing_id: one of ${pairings.map((p) => `${p.id} (${p.heading_font} / ${p.body_font})`).join("; ")}. The three directions must use three different ones.
- id: a short lowercase slug, unique among the three.

ETHICS — this is a health practice. These are not style notes; copy that breaks one of them cannot ship.
${rules.map((r) => `- ${r.short_label}: ${r.description} Never: "${r.example_forbidden}"`).join("\n")}

ALSO RETURN
- voice_guide.sounds_like: exactly 3 short lines describing how her writing should sound.
- voice_guide.never_write: exactly 3 short lines naming what it should never do.
- practitioner_line: one line naming her the way it would appear under a signature.`;
}

/**
 * Génère les trois directions, valide contre les bornes de la base, et rejoue
 * en nommant les violations quand il en reste.
 *
 * Le crédit a déjà été consommé par l'appelant : une reprise ici n'en coûte
 * pas un second, parce que la violation n'est pas la faute de l'utilisatrice.
 */
export async function generateDirections({
  brief,
  limits,
  pairings,
  rules,
}: {
  brief: BriefFacts;
  limits: DirectionLimits;
  pairings: TypePairingChoice[];
  rules: EthicsRule[];
}): Promise<{ generation: Generation; attempts: number } | { error: string; attempts: number }> {
  const client = anthropic();
  const system = systemPrompt(limits, pairings, rules);
  const validIds = pairings.map((p) => p.id);

  const messages: { role: "user" | "assistant"; content: string }[] = [
    {
      role: "user",
      content: `Here is her brief.\n\n${briefBlock(brief)}\n\nWrite the three directions.`,
    },
  ];

  let lastProblems: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.messages.parse({
      model: GENERATION_MODEL,
      max_tokens: 16000,
      system,
      messages,
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(GenerationSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      lastProblems = ["The response did not parse as the requested shape."];
    } else {
      const problems = validateDirections(
        parsed.directions as GeneratedDirection[],
        limits,
        validIds
      );
      const voiceProblems = validateVoiceGuide(parsed);
      const all = [...problems, ...voiceProblems];

      if (all.length === 0) return { generation: parsed, attempts: attempt };
      lastProblems = all;
    }

    if (attempt < MAX_ATTEMPTS) {
      messages.push({ role: "assistant", content: JSON.stringify(response.parsed_output ?? {}) });
      messages.push({
        role: "user",
        content: `That was rejected. Fix exactly these and return the whole object again:\n\n${lastProblems
          .map((p) => `- ${p}`)
          .join("\n")}\n\nChange nothing else.`,
      });
    }
  }

  return { error: lastProblems.join(" "), attempts: MAX_ATTEMPTS };
}

function validateVoiceGuide(generation: Generation): string[] {
  const problems: string[] = [];
  if (generation.voice_guide.sounds_like.length !== 3) {
    problems.push("voice_guide.sounds_like must have exactly 3 entries.");
  }
  if (generation.voice_guide.never_write.length !== 3) {
    problems.push("voice_guide.never_write must have exactly 3 entries.");
  }
  return problems;
}
