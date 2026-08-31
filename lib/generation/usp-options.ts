import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, GENERATION_MODEL } from "@/lib/ai/client";
import { checkBannedPhrases } from "@/lib/generation/banned-phrases";
import { buildHowYouWorkContext } from "@/lib/generation/how-you-work-context";
import {
  USP_ANGLES,
  uspOptionSchema,
  type UspAngle,
  type UspOption,
} from "@/lib/generation/how-you-work-shapes";
import {
  INTRA_BATCH_SIMILARITY_THRESHOLD,
  jaccardSimilarity,
  passesSpecificity,
  specificityOverlap,
  tokenSet,
} from "@/lib/generation/usp-specificity";
import { track } from "@/lib/analytics";
import type { Catalog } from "@/lib/catalog/types";
import type { BriefBundle } from "@/lib/data/brief";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * Génération des trois options de positionnement (§2.5) : un appel modèle,
 * six candidats bruts, puis quatre portes DÉTERMINISTES — ce n'est jamais au
 * modèle de décider ce qui passe. Point d'intégration séparé de
 * `pipeline.ts`, comme `tone-cards.ts`.
 */

const MAX_MODEL_CALLS = 2;

export type UspGateName = "banned_phrases" | "specificity" | "distance" | "collision";

export type DiscardedCandidate = {
  id: string;
  angle: UspAngle;
  gate: UspGateName;
  reason: string;
};

export type UspOptionsResult = {
  options: UspOption[];
  partial: boolean;
  discarded: DiscardedCandidate[];
  modelCalls: number;
};

/* ── L'appel modèle ─────────────────────────────────────────────────────── */

type RawUspCandidate = {
  id: string;
  angle: UspAngle;
  statement: string;
  rationale: string;
  evidence: string[];
};

const TOOL: Anthropic.Tool = {
  name: "write_usp_options",
  description:
    "Write six positioning-statement candidates, two for each of three angles, for a therapist's private-practice brief.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        description:
          "Exactly 6 candidates: 2 with angle 'population', 2 with angle 'method', 2 with angle 'lived_experience'.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "A short lowercase-hyphen slug." },
            angle: {
              type: "string",
              enum: [...USP_ANGLES],
              description:
                "population = who this is for, in lived terms. method = how the work is done. lived_experience = her own trajectory and stance.",
            },
            statement: {
              type: "string",
              description:
                "One or two sentences, 200 characters at most. Must reuse at least one concrete element she actually supplied -- generic directory language is a failure.",
            },
            rationale: {
              type: "string",
              description: "One sentence, 240 characters at most, on why this statement fits.",
            },
            evidence: {
              type: "array",
              description:
                "Which brief fields this statement drew from, e.g. ['referral_quote', 'modality_ids'].",
              items: { type: "string" },
            },
          },
          required: ["id", "angle", "statement", "rationale", "evidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["candidates"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are a senior brand director at Eklio, which builds brand identities for licensed mental-health clinicians in private practice in the United States.

Write six positioning-statement candidates from the brief below. American English. One or two sentences, 200 characters at most. No outcome promises, no clinical claims, no testimonial language -- board-safe under ACA and APA advertising standards.

Every candidate must reuse at least one concrete element she actually supplied in the brief. A statement that could have been written without reading her brief is a failure, not a safe default.`;

async function callUspOptionsModel(
  prompt: string,
  avoid: { statement: string; reason: string }[]
): Promise<RawUspCandidate[]> {
  const instruction =
    avoid.length > 0
      ? `${prompt}\n\nAVOID THESE FORMULATIONS -- each was discarded from a previous attempt, with why:\n${avoid
          .map((entry) => `- "${entry.statement}" (${entry.reason})`)
          .join("\n")}`
      : prompt;

  const response = await getAnthropicClient().messages.create({
    model: GENERATION_MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: instruction }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Le modèle n'a produit aucun candidat USP.");

  return (toolUse.input as { candidates: RawUspCandidate[] }).candidates;
}

/* ── Le contexte de spécificité (gate 2) ───────────────────────────────── */

function buildContentTokens(bundle: BriefBundle, catalog: Catalog): Set<string> {
  const { brief, data } = bundle;
  const labels = (ids: string[], source: { id: string; label: string }[]) =>
    ids
      .map((id) => source.find((entry) => entry.id === id)?.label)
      .filter((label): label is string => Boolean(label));

  /*
   * ÉCART SIGNALÉ : §2.5 demande de tokeniser « the persona free text », mais
   * l'étape 3 (« ideal client ») ne porte AUCUN champ libre dans ce schéma —
   * seulement `client_persona_ids` (chips). On tokenise les LIBELLÉS résolus
   * à la place ; voir le rapport final.
   */
  const text = [
    brief.referral_quote,
    brief.not_a_fit_text,
    ...labels(brief.client_persona_ids, catalog.personaCards),
    ...labels(brief.modality_ids ?? [], catalog.modalityCards),
    ...labels(brief.session_style_ids ?? [], catalog.sessionStyleCards),
    data.problem_text,
    data.gain_text,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return tokenSet(text);
}

/* ── Les quatre portes ──────────────────────────────────────────────────── */

type GateInput = {
  candidates: RawUspCandidate[];
  contentTokens: Set<string>;
  admin: SupabaseClient<Database>;
  scopeKey: string;
  excludeBriefId: string;
  bannedPhrasesCheck: (text: string) => Promise<string[]>;
};

async function runGates(
  input: GateInput
): Promise<{ survivors: (UspOption & { bestSimilarity: number })[]; discarded: DiscardedCandidate[] }> {
  const { candidates, contentTokens, admin, scopeKey, excludeBriefId, bannedPhrasesCheck } =
    input;
  const discarded: DiscardedCandidate[] = [];

  // Gate 1 — banned phrases.
  const afterBanned: RawUspCandidate[] = [];
  for (const candidate of candidates) {
    const parsed = uspOptionSchema.safeParse(candidate);
    if (!parsed.success) {
      discarded.push({
        id: candidate.id,
        angle: candidate.angle,
        gate: "banned_phrases",
        reason: "shape rejected before any gate ran",
      });
      continue;
    }
    const hits = await bannedPhrasesCheck(candidate.statement);
    if (hits.length > 0) {
      discarded.push({ id: candidate.id, angle: candidate.angle, gate: "banned_phrases", reason: hits.join(", ") });
      continue;
    }
    afterBanned.push(candidate);
  }

  // Gate 2 — specificity: must share a content token with what she wrote.
  const afterSpecificity: RawUspCandidate[] = [];
  for (const candidate of afterBanned) {
    if (passesSpecificity(candidate.statement, contentTokens)) {
      afterSpecificity.push(candidate);
    } else {
      discarded.push({
        id: candidate.id,
        angle: candidate.angle,
        gate: "specificity",
        reason: "shares no content token with the brief",
      });
    }
  }

  // Gate 3 — inter-candidate distance: at most one survivor per angle,
  // preferring the highest specificity overlap; then drop any remaining
  // pair that is too similar to another survivor.
  const byAngle = new Map<UspAngle, RawUspCandidate[]>();
  for (const candidate of afterSpecificity) {
    byAngle.set(candidate.angle, [...(byAngle.get(candidate.angle) ?? []), candidate]);
  }

  let perAngle: RawUspCandidate[] = [];
  for (const [angle, group] of byAngle) {
    const ranked = [...group].sort(
      (a, b) =>
        specificityOverlap(b.statement, contentTokens) -
        specificityOverlap(a.statement, contentTokens)
    );
    const [winner, ...losers] = ranked;
    perAngle.push(winner);
    for (const loser of losers) {
      discarded.push({
        id: loser.id,
        angle,
        gate: "distance",
        reason: "another candidate for the same angle scored higher on specificity",
      });
    }
  }

  perAngle = perAngle.sort(
    (a, b) =>
      specificityOverlap(b.statement, contentTokens) - specificityOverlap(a.statement, contentTokens)
  );
  const afterDistance: RawUspCandidate[] = [];
  for (const candidate of perAngle) {
    const tooSimilar = afterDistance.some(
      (kept) =>
        jaccardSimilarity(tokenSet(candidate.statement), tokenSet(kept.statement)) >=
        INTRA_BATCH_SIMILARITY_THRESHOLD
    );
    if (tooSimilar) {
      discarded.push({
        id: candidate.id,
        angle: candidate.angle,
        gate: "distance",
        reason: "within the similarity threshold of another survivor",
      });
    } else {
      afterDistance.push(candidate);
    }
  }

  // Gate 4 — cross-user collision, the only gate that leaves this process.
  const survivors: (UspOption & { bestSimilarity: number })[] = [];
  for (const candidate of afterDistance) {
    const { data, error } = await admin.rpc("usp_check_distinct", {
      p_scope_key: scopeKey,
      p_statement: candidate.statement,
      p_exclude_brief: excludeBriefId,
    });
    if (error) {
      discarded.push({ id: candidate.id, angle: candidate.angle, gate: "collision", reason: "usp_check_distinct errored" });
      continue;
    }
    const verdict = data as { distinct: boolean; best_similarity: number };
    if (!verdict.distinct) {
      // Ne JAMAIS journaliser ni renvoyer `conflicting_statement` (§9.10) :
      // le texte d'une autre practice ne quitte jamais ce module.
      discarded.push({ id: candidate.id, angle: candidate.angle, gate: "collision", reason: "collides with another practice" });
      continue;
    }
    survivors.push({
      id: candidate.id,
      angle: candidate.angle,
      statement: candidate.statement,
      rationale: candidate.rationale,
      evidence: candidate.evidence,
      bestSimilarity: verdict.best_similarity,
    });
  }

  return { survivors, discarded };
}

/* ── Orchestration ──────────────────────────────────────────────────────── */

export async function generateUspOptions(
  bundle: BriefBundle,
  catalog: Catalog,
  admin: SupabaseClient<Database>,
  scopeKey: string,
  modelCall: (
    prompt: string,
    avoid: { statement: string; reason: string }[]
  ) => Promise<RawUspCandidate[]> = callUspOptionsModel,
  bannedPhrasesCheck: (text: string) => Promise<string[]> = checkBannedPhrases
): Promise<UspOptionsResult> {
  const prompt = buildHowYouWorkContext(bundle, catalog);
  const contentTokens = buildContentTokens(bundle, catalog);

  const byAngle = new Map<UspAngle, UspOption & { bestSimilarity: number }>();
  const allDiscarded: DiscardedCandidate[] = [];
  let avoid: { statement: string; reason: string }[] = [];
  let modelCalls = 0;

  while (byAngle.size < 3 && modelCalls < MAX_MODEL_CALLS) {
    modelCalls += 1;
    const raw = await modelCall(prompt, avoid);
    const { survivors, discarded } = await runGates({
      candidates: raw,
      contentTokens,
      admin,
      scopeKey,
      excludeBriefId: bundle.project.id,
      bannedPhrasesCheck,
    });

    for (const survivor of survivors) {
      if (!byAngle.has(survivor.angle)) byAngle.set(survivor.angle, survivor);
    }
    allDiscarded.push(...discarded);
    // Chaque `discarded` de cette itération vient forcément de `raw`, cette
    // même itération : la reprise ne repasse que les refus les plus récents.
    avoid = discarded.map((entry) => ({
      statement: raw.find((candidate) => candidate.id === entry.id)!.statement,
      reason: `${entry.gate}: ${entry.reason}`,
    }));

    for (const entry of discarded) {
      track("usp_gate_rejected", { gate: entry.gate, candidate_id: entry.id, angle: entry.angle });
    }
  }

  const options: UspOption[] = [...byAngle.values()].map((entry) => ({
    id: entry.id,
    angle: entry.angle,
    statement: entry.statement,
    rationale: entry.rationale,
    evidence: entry.evidence,
  }));
  const partial = options.length < 3;

  track("usp_options_generated", {
    count: options.length,
    partial,
    model_calls: modelCalls,
    best_similarity: options.length > 0 ? Math.max(...[...byAngle.values()].map((o) => o.bestSimilarity)) : null,
  });

  return { options, partial, discarded: allDiscarded, modelCalls };
}
