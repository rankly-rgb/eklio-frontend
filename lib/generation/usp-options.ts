import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, GENERATION_MODEL } from "@/lib/ai/client";
import { checkBannedPhrases } from "@/lib/generation/banned-phrases";
import { buildHowYouWorkContext } from "@/lib/generation/how-you-work-context";
import {
  USP_ANGLES,
  generatedUspOptionSchema,
  type GeneratedUspOption,
  type UspAngle,
  type UspOption,
} from "@/lib/generation/how-you-work-shapes";
import {
  jaccardSimilarity,
  passesSpecificity,
  specificityOverlap,
  tokenSet,
} from "@/lib/generation/usp-specificity";
import { fetchUspGuardrails, type UspGuardrails } from "@/lib/generation/usp-guardrails";
import {
  checkRegister,
  registerReason,
  type RegisterVocabulary,
} from "@/lib/generation/usp-register";
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

/*
 * ⚠ `register` EST LA CINQUIÈME, AJOUTÉE LE 14 SEPTEMBRE. L'offre demande la
 * niche « dans les mots de ses patients, pas en modalités ni en démographie ».
 * Le prompt le dit ; la gate le mesure. Un modèle à qui on interdit « EMDR »
 * écrit « une approche fondée sur le retraitement des souvenirs » — c'est la
 * même leçon que `lib/check/rewrite.ts` a apprise sur les garanties.
 */
export type UspGateName =
  | "banned_phrases"
  | "register"
  | "specificity"
  | "distance"
  | "collision";

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
                "presenting_problem = what the person is carrying, in the words she would use herself. the_moment = the point at which someone decides to look for help. what_keeps_returning = what she has already tried, and what keeps coming back.",
            },
            statement: {
              type: "string",
              description:
                "One or two sentences, 200 characters at most, in the words a PATIENT would use. Must reuse at least one concrete element she actually supplied. Naming a modality or a demographic bracket is a failure, and so is generic directory language.",
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

/*
 * ⚠ RECADRÉ LE 14 SEPTEMBRE. L'ancien prompt demandait une phrase de marque, et
 * deux de ses trois angles étaient la démographie et la modalité — c'est-à-dire
 * exactement les deux choses que l'offre interdit. Le modèle faisait ce qu'on
 * lui demandait ; c'est la demande qui était devenue fausse.
 *
 * La cible est la NICHE, dite comme la patiente la dirait. Le test de lecture
 * est écrit dans le prompt lui-même, parce qu'il est vérifiable : est-ce que
 * quelqu'un qui vit ça se reconnaîtrait dans cette phrase, ou est-ce qu'il
 * faudrait lui expliquer un mot d'abord ?
 */
const SYSTEM_PROMPT = `You write the positioning line for a licensed mental-health clinician in private practice in the United States.

WHAT A POSITIONING LINE IS HERE. It names the niche IN THE WORDS OF THE PEOPLE WHO COME. Not the modality, not the demographic bracket, not the credential. Someone living the thing should read the line and recognise herself in it without having to be taught a word first.

Write six candidates from the brief below. American English. One or two sentences, 200 characters at most.

NEVER:
- a modality, a method name, an acronym or a school of therapy (CBT, EMDR, IFS, psychodynamic, somatic...). She may practise it; it is not what the person searching is looking for.
- a demographic bracket as the subject ("women 25-40", "high-achieving professionals", "new moms"). Naming a life SITUATION is allowed; naming a market segment is not.
- outcome promises, clinical claims, testimonial language. Board-safe under ACA and APA advertising standards.
- directory filler that could sit on any profile in the state.

ALWAYS:
- reuse at least one concrete element she actually supplied. A line that could have been written without reading her brief is a failure, not a safe default.
- plain words. If a sentence needs a clinical vocabulary to be understood, rewrite it until it does not.`;

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

/**
 * Le vocabulaire de la gate de registre : ce qu'ELLE a coché.
 *
 * ⚠ AUCUNE LISTE UNIVERSELLE DE MODALITÉS. Elle serait incomplète le jour de
 * son écriture et fausse un mois plus tard. Le catalogue porte `full_name` ET
 * `label` pour les modalités — « Eye movement desensitization and
 * reprocessing » et « EMDR » — et les deux sont donnés à la gate, qui en dérive
 * aussi l'acronyme du libellé long.
 */
function buildRegisterVocabulary(
  bundle: BriefBundle,
  catalog: Catalog
): RegisterVocabulary {
  const { brief } = bundle;

  const modalityLabels = (brief.modality_ids ?? []).flatMap((id) => {
    const card = catalog.modalityCards.find((entry) => entry.id === id);
    if (!card) return [];
    // `full_name` n'existe pas sur toutes les cartes ; `label` si.
    const full = (card as { full_name?: string }).full_name;
    return full && full !== card.label ? [card.label, full] : [card.label];
  });

  const personaLabels = brief.client_persona_ids.flatMap((id) => {
    const card = catalog.personaCards.find((entry) => entry.id === id);
    return card ? [card.label] : [];
  });

  return { modalityLabels, personaLabels };
}

function buildContentTokens(
  bundle: BriefBundle,
  catalog: Catalog,
  stopwords: Set<string>
): Set<string> {
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

  return tokenSet(text, stopwords);
}

/* ── Les quatre portes ──────────────────────────────────────────────────── */

type GateInput = {
  candidates: RawUspCandidate[];
  contentTokens: Set<string>;
  /** Ce qu'ELLE a coché : la gate de registre ne connaît aucune autre liste. */
  vocabulary: RegisterVocabulary;
  guardrails: UspGuardrails;
  admin: SupabaseClient<Database>;
  scopeKey: string;
  excludeBriefId: string;
  bannedPhrasesCheck: (text: string) => Promise<string[]>;
};

async function runGates(
  input: GateInput
): Promise<{ survivors: (GeneratedUspOption & { bestSimilarity: number })[]; discarded: DiscardedCandidate[] }> {
  const {
    candidates,
    contentTokens,
    vocabulary,
    guardrails,
    admin,
    scopeKey,
    excludeBriefId,
    bannedPhrasesCheck,
  } = input;
  const { stopwords, similarityThreshold } = guardrails;
  const discarded: DiscardedCandidate[] = [];

  // Gate 1 — banned phrases.
  const afterBanned: RawUspCandidate[] = [];
  for (const candidate of candidates) {
    const parsed = generatedUspOptionSchema.safeParse(candidate);
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

  /*
   * Gate 2 — le REGISTRE. Ni modalité, ni segment de marché.
   *
   * ⚠ AVANT LA SPÉCIFICITÉ, ET L'ORDRE COMPTE. La gate de spécificité exige
   * qu'un candidat reprenne un élément du brief — et le moyen le plus facile
   * d'y arriver est de citer une modalité qu'elle a cochée. Passer le registre
   * en second ferait survivre, puis éliminer, exactement les candidats que la
   * gate précédente aurait récompensés : deux mesures qui se contredisent.
   * Ici, ce qui survit à la spécificité y est arrivé autrement.
   */
  const afterRegister: RawUspCandidate[] = [];
  for (const candidate of afterBanned) {
    const verdict = checkRegister(candidate.statement, vocabulary);
    if (verdict.ok) {
      afterRegister.push(candidate);
    } else {
      discarded.push({
        id: candidate.id,
        angle: candidate.angle,
        gate: "register",
        reason: registerReason(verdict),
      });
    }
  }

  // Gate 3 — specificity: must share a content token with what she wrote.
  const afterSpecificity: RawUspCandidate[] = [];
  for (const candidate of afterRegister) {
    if (passesSpecificity(candidate.statement, contentTokens, stopwords)) {
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
        specificityOverlap(b.statement, contentTokens, stopwords) -
        specificityOverlap(a.statement, contentTokens, stopwords)
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
      specificityOverlap(b.statement, contentTokens, stopwords) -
      specificityOverlap(a.statement, contentTokens, stopwords)
  );
  const afterDistance: RawUspCandidate[] = [];
  for (const candidate of perAngle) {
    const tooSimilar = afterDistance.some(
      (kept) =>
        jaccardSimilarity(
          tokenSet(candidate.statement, stopwords),
          tokenSet(kept.statement, stopwords)
        ) >= similarityThreshold
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
  const survivors: (GeneratedUspOption & { bestSimilarity: number })[] = [];
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
  bannedPhrasesCheck: (text: string) => Promise<string[]> = checkBannedPhrases,
  fetchGuardrails: (admin: SupabaseClient<Database>) => Promise<UspGuardrails> = fetchUspGuardrails
): Promise<UspOptionsResult> {
  const prompt = buildHowYouWorkContext(bundle, catalog);
  // Une fois PAR REQUÊTE, jamais mis en cache entre requêtes (correction
  // demandée) : les deux appels de la reprise réutilisent la même valeur,
  // fixée au début de CETTE génération.
  const guardrails = await fetchGuardrails(admin);
  const contentTokens = buildContentTokens(bundle, catalog, guardrails.stopwords);
  const vocabulary = buildRegisterVocabulary(bundle, catalog);

  const byAngle = new Map<UspAngle, GeneratedUspOption & { bestSimilarity: number }>();
  const allDiscarded: DiscardedCandidate[] = [];
  let avoid: { statement: string; reason: string }[] = [];
  let modelCalls = 0;

  while (byAngle.size < 3 && modelCalls < MAX_MODEL_CALLS) {
    modelCalls += 1;
    const raw = await modelCall(prompt, avoid);
    const { survivors, discarded } = await runGates({
      candidates: raw,
      contentTokens,
      vocabulary,
      guardrails,
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

/**
 * La phrase qui accompagne un lot incomplet (§2.5 : « the screen shows two
 * options with the line … »). Deux survivants ont leur propre phrase, exacte
 * au mot près ; en dessous, une phrase générique — le cas que le spec ne
 * nomme pas mais que le CHECK de la base (exactement 3 ou aucun) rend
 * possible dès que la reprise, elle aussi, échoue à en garder deux.
 */
export function partialMessageFor(count: number): string {
  if (count === 2) {
    return 'We only found two that were truly yours. Try adding a line to "How you work" for a third.';
  }
  return "We couldn't find positioning options that were truly yours yet.";
}
