import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, GENERATION_MODEL } from "@/lib/ai/client";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { checkEthics, hasBlockingViolation } from "@/lib/ethics/rules";
import { rulesBlock } from "@/lib/ethics/guard";
import { buildHowYouWorkContext } from "@/lib/generation/how-you-work-context";
import { track } from "@/lib/analytics";
import type { Catalog } from "@/lib/catalog/types";
import type { Json } from "@/types/supabase";
import type { BriefBundle } from "@/lib/data/brief";
import {
  BODY_MAX,
  FIRST_PARAGRAPH_MAX,
  buildDirectoryProfile,
  type DirectoryProfileDraft,
  type ProseProblem,
  type StructuredInput,
} from "@/lib/directory/profile";

/*
 * ── LA PROSE DU PROFIL PSYCHOLOGY TODAY ─────────────────────────────────
 *
 * Le dernier maillon manquant : `save_directory_profile` n'avait aucun
 * appelant, donc le livrable CENTRAL de The Foundation n'était produit par
 * personne. L'écran existait et disait « pas encore écrit ».
 *
 * ⚠ MÊME CHEMIN QUE LES AUTRES LIVRABLES GÉNÉRÉS, pas un chemin à part :
 *
 *   client          `getAnthropicClient()` + `GENERATION_MODEL`, comme
 *                   `lib/generation/model.ts` et `usp-options.ts`
 *   plafond         un nombre d'APPELS, vérifié AVANT l'appel — la même forme
 *                   que `MAX_MODEL_CALLS` dans `usp-options.ts`. Un plafond en
 *                   jetons ne se connaît qu'une fois la réponse revenue : ce
 *                   n'est pas un plafond, c'est un reçu.
 *   journalisation  `track()` avec `model_calls`, comme
 *                   `usp_options_generated`
 *
 * ⚠ ET L'ETHICS GUARD EST CELUI QUI EXISTE, PAS UN SECOND. Depuis L13, un
 * TRIGGER `directory_profiles_ethics_gate` passe `first_paragraph` ET `body`
 * par `ethics_blocks` et par `usp_banned_phrases_check` (les trente clichés
 * d'annuaire, écrits pour Psychology Today). Ce module ne le réimplémente pas :
 * il pré-scanne avec le MÊME scanner que le reste de l'application
 * (`checkEthics`), pour offrir une reprise plutôt qu'une exception — et la base
 * reste l'autorité qui tranche à l'écriture.
 */

/**
 * ⚠ DEUX APPELS AU PLUS, ET LE SECOND N'EXISTE QUE POUR LA DÉONTOLOGIE.
 *
 * Même valeur et même raison que `usp-options.ts`. Le premier écrit, le second
 * réécrit ce que la garde a refusé. Un troisième serait un modèle qu'on
 * supplie, pas qu'on corrige.
 */
export const MAX_MODEL_CALLS = 2;

export class DirectoryCeilingError extends Error {
  constructor(readonly limit: number) {
    super(
      `Plafond atteint : ${limit} appels modèle déjà faits pour ce profil. ` +
        `Rien de plus n'a été appelé et rien de plus n'a été dépensé.`
    );
    this.name = "DirectoryCeilingError";
  }
}

export class DirectoryProseRefusedError extends Error {
  constructor(readonly violations: string[]) {
    super(
      `La prose produite reste bloquée par la garde déontologique : ` +
        `${violations.join(", ")}.`
    );
    this.name = "DirectoryProseRefusedError";
  }
}

export class DirectoryProseInvalidError extends Error {
  constructor(readonly problems: ProseProblem[]) {
    super(`La prose produite ne passe pas le gabarit : ${problems.join(", ")}.`);
    this.name = "DirectoryProseInvalidError";
  }
}

/*
 * ⚠ DEUX CHAMPS, PAS UN TEXTE QU'ON DÉCOUPERAIT ENSUITE.
 *
 * Le gabarit du lot 1 stocke `first_paragraph` et `body` séparément, et la
 * base a un CHECK sur chacun. C'est le premier paragraphe que les résultats de
 * recherche de l'annuaire montrent, et c'est lui que The First Line réécrira :
 * le faire produire tel quel évite d'avoir à deviner plus tard où il s'arrête.
 *
 * `strict: true` : les deux champs sont garantis présents et typés. Ce qui
 * n'est PAS garanti, ce sont les longueurs et la non-répétition — `checkProse`
 * s'en charge, et refuse au lieu de tronquer.
 */
const TOOL: Anthropic.Tool = {
  name: "write_directory_profile",
  description:
    "Write the personal statement for this clinician's Psychology Today profile, from the brief provided.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      first_paragraph: {
        type: "string",
        description:
          `The opening paragraph, and the ONLY part shown in directory search results. ` +
          `It has to work alone: someone reading just this should recognise their own ` +
          `situation in it. Name the problem the way a client would say it out loud, ` +
          `not the way a clinician would code it. ${FIRST_PARAGRAPH_MAX} characters at most.`,
      },
      body: {
        type: "string",
        description:
          `The rest of the statement: what the work is actually like, who it suits, ` +
          `and what a first session involves. ⚠ Do NOT repeat the first paragraph ` +
          `here — it is shown above this text, not instead of it. ` +
          `${BODY_MAX} characters at most.`,
      },
    },
    required: ["first_paragraph", "body"],
    additionalProperties: false,
  },
};

/**
 * Le cadrage système.
 *
 * ⚠ LE SOCLE DÉONTOLOGIQUE VIENT EN PREMIER, et c'est la même composition que
 * `systemPrompt()` dans `lib/generation/model.ts` : `ETHICS_SYSTEM_RULES` puis
 * les règles lues en base. Aucune consigne de style ne doit pouvoir se lire
 * comme une permission de les assouplir — et un troisième texte déontologique
 * écrit ici serait exactement le second chemin qu'on refuse.
 */
export function directorySystemPrompt(rules: Catalog["ethicsRules"]): string {
  return [
    ETHICS_SYSTEM_RULES,
    rulesBlock(rules),
    `You are writing the personal statement for a licensed mental-health clinician's Psychology Today profile.

A directory profile is read by someone who is already looking for help and is deciding whether to call THIS person rather than the next one on the list. Most profiles on that list say the same things. Yours has to say what is true of this practice and not of the others.

Name the problem the way a client would describe it to a friend — "we keep having the same argument", "I can't switch off after work" — not the way it appears in a chart. Do not lead with modality names, and do not describe a demographic instead of a difficulty.

Write in plain American English, in the first person, short sentences, no exclamation marks. Describe the work, never its result.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Ce que le module rend : un brouillon prêt pour `save_directory_profile`. */
export type DirectoryGeneration = {
  draft: DirectoryProfileDraft;
  /**
   * Ce que le scan a trouvé, rangé tel quel dans
   * `directory_profiles.ethics_check`.
   *
   * ⚠ Typé `Json` et pas une forme à nous : c'est une colonne `jsonb`, et lui
   * donner un type applicatif ferait croire que la base en garantit la forme.
   * Elle n'en garantit aucune — c'est un journal, pas une décision.
   */
  ethicsCheck: Json;
  modelCalls: number;
};

type Parsed = { firstParagraph: string; body: string };

function parse(response: Anthropic.Message): Parsed {
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Le modèle n'a produit aucun bloc d'outil.");

  const input = toolUse.input as Record<string, unknown>;
  return {
    /*
     * ⚠ PAS DE `?? ""` ICI. Un champ manquant doit arriver jusqu'à
     * `checkProse`, qui le nommera `first_paragraph_missing` — le masquer par
     * une chaîne vide produirait « body_missing » sur le mauvais champ, ou
     * pire, un profil publié avec un paragraphe vide.
     */
    firstParagraph: typeof input.first_paragraph === "string" ? input.first_paragraph : "",
    body: typeof input.body === "string" ? input.body : "",
  };
}

/** L'appel modèle, isolé pour que les tests puissent l'injecter. */
export type DirectoryCall = (system: string, prompt: string) => Promise<Parsed>;

export const callDirectoryProfile: DirectoryCall = async (system, prompt) => {
  const response = await getAnthropicClient().messages.create({
    model: GENERATION_MODEL,
    max_tokens: 4000,
    system,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });
  return parse(response);
};

/**
 * Produit la prose, la scanne, et rend un brouillon.
 *
 * ⚠ AUCUNE COMPOSITION PAR CONCATÉNATION. Les champs structurés passent par
 * `buildDirectoryProfile`, qui n'assemble aucune chaîne et n'écrit aucun
 * libellé devant une valeur : un champ absent ne produit PAS de ligne, pas non
 * plus une ligne vide. C'est la discipline de L9, et le cas « tous les
 * optionnels vides » est un cas normal qui rend `{}`.
 */
export async function generateDirectoryProfile(
  bundle: BriefBundle,
  catalog: Catalog,
  structured: StructuredInput,
  call: DirectoryCall = callDirectoryProfile
): Promise<DirectoryGeneration> {
  const system = directorySystemPrompt(catalog.ethicsRules);
  const brief = buildHowYouWorkContext(bundle, catalog);

  let modelCalls = 0;
  let prompt = brief;
  let lastViolations: string[] = [];

  for (let attempt = 0; attempt < MAX_MODEL_CALLS; attempt += 1) {
    /*
     * ⚠ LE PLAFOND EST VÉRIFIÉ AVANT L'APPEL, jamais après. Un plafond lu
     * après coup n'est pas un plafond : l'argent est déjà dépensé, et ce
     * produit n'a aucune primitive de remboursement.
     */
    if (modelCalls >= MAX_MODEL_CALLS) throw new DirectoryCeilingError(MAX_MODEL_CALLS);

    const raw = await call(system, prompt);
    modelCalls += 1;

    const built = buildDirectoryProfile({
      platform: "psychology_today",
      firstParagraph: raw.firstParagraph,
      body: raw.body,
      structured,
    });

    if (!built.ok) {
      /*
       * Longueur ou répétition. On ne tronque pas — `checkProse` refuse, et
       * une coupure silencieuse produirait une phrase qui s'arrête au milieu,
       * sur un profil public, sans que personne l'ait décidé.
       */
      if (attempt + 1 >= MAX_MODEL_CALLS) {
        throw new DirectoryProseInvalidError(built.problems);
      }
      prompt = `${brief}\n\nYour previous attempt was rejected: ${built.problems.join(
        ", "
      )}. Write it again, respecting the limits.`;
      continue;
    }

    /*
     * ⚠ LE MÊME SCANNER QUE PARTOUT AILLEURS. `checkEthics` lit
     * `FORBIDDEN_PATTERNS`, dont `ethics_patterns` en base est le jumeau
     * recensé (test de parité, lot 2 B3). On scanne les DEUX champs
     * séparément : le trigger en base fait exactement cela, et scanner une
     * concaténation laisserait passer une violation à cheval sur la jointure.
     */
    const scans = [built.draft.prose.firstParagraph, built.draft.prose.body].map(
      (text) => checkEthics(text)
    );
    const violations = scans.flatMap((scan) => scan.violations);

    if (!hasBlockingViolation(violations)) {
      track("directory_profile_generated", {
        model_calls: modelCalls,
        warnings: violations.length,
      });
      return {
        draft: built.draft,
        ethicsCheck: { violations, scanned_at: new Date().toISOString() } as unknown as Json,
        modelCalls,
      };
    }

    lastViolations = violations
      .filter((violation) => violation.severity === "block")
      .map((violation) => `${violation.ruleId}: ${violation.reason}`);

    /*
     * Réécrire, puis re-scanner — la discipline de `lib/check/rewrite.ts` :
     * « the re-scan is not optional and not conditional ». La boucle repasse
     * par `checkEthics`, elle ne fait pas confiance à la réécriture.
     */
    prompt = `${brief}\n\nYour previous attempt broke advertising ethics rules: ${lastViolations.join(
      "; "
    )}. Write it again without those claims.`;
  }

  track("directory_profile_refused", { model_calls: modelCalls });
  throw new DirectoryProseRefusedError(lastViolations);
}
