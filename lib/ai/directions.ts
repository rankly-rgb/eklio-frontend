import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";
import { buildBriefContext } from "@/lib/ai/brief-context";
import { generateWithEthicsGuard } from "@/lib/ethics/enforce";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import type { BriefDraft } from "@/lib/brief/schemas";

/*
 * Génération des 3 directions créatives, en anglais américain — le produit
 * s'adresse à des praticiens de santé mentale licenciés en cabinet privé aux
 * États-Unis. Tout ce qui part au modèle ou finit à l'écran est en anglais ;
 * les commentaires restent en français, comme partout dans le dépôt.
 *
 * Deux gardes se cumulent, et une génération doit passer les DEUX avant d'être
 * persistée :
 * - structurelle : outil forcé + schéma strict + `directionsResultSchema`
 *   (exactement 3 directions, hex valides, champs présents) ;
 * - déontologique : `ETHICS_SYSTEM_RULES` injecté dans le prompt système
 *   (niveau 1) et `generateWithEthicsGuard` autour de l'appel (niveau 2), qui
 *   régénère avec feedback puis lève `EthicsComplianceError`.
 *
 * Sens de dépendance : lib/ai importe lib/ethics, jamais l'inverse.
 */

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color");

export const paletteSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  neutral_light: hexColor,
  neutral_dark: hexColor,
});

export const directionSchema = z.object({
  name: z.string().min(1).max(60),
  // 600 et non 400 : en anglais, « 2 à 3 phrases » chaleureuses tiennent
  // rarement sous 400 caractères, et la limite faisait échouer la validation
  // structurelle à chaque génération réelle. Le budget est aussi demandé au
  // modèle (schéma d'outil + prompt), la borne n'étant qu'un filet.
  description: z.string().min(1).max(600),
  palette: paletteSchema,
  heading_font: z.string().min(1).max(60),
  body_font: z.string().min(1).max(60),
});

export const directionsResultSchema = z.object({
  directions: z.array(directionSchema).length(3),
});

export type Palette = z.infer<typeof paletteSchema>;

/*
 * Ordre d'affichage canonique de la palette, partagé par la fiche de direction
 * et la page de kit : les deux écrans montrent les mêmes couleurs, dans le même
 * ordre, sous les mêmes libellés. Les libellés sont en minuscules — la mise en
 * capitales est une affaire de CSS (`.label-mono`), pas de données.
 */
export const PALETTE_ENTRIES: { key: keyof Palette; label: string }[] = [
  { key: "primary", label: "primary" },
  { key: "secondary", label: "secondary" },
  { key: "accent", label: "accent" },
  { key: "neutral_light", label: "light neutral" },
  { key: "neutral_dark", label: "dark neutral" },
];
export type DirectionResult = z.infer<typeof directionSchema>;
export type DirectionsResult = z.infer<typeof directionsResultSchema>;

/*
 * Palettes enregistrées avant le Lot 2, quand les clés étaient françaises.
 * Même logique que `normalizeBriefDraft()` côté brief : la lecture tolère
 * l'ancienne forme, l'écriture ne produit que la nouvelle.
 *
 * TODO(post-test-data): retirer le fallback FR une fois les données de test
 * purgées — les directions se régénèrent, aucune migration n'est nécessaire.
 */
const LEGACY_PALETTE_KEYS: Record<string, keyof Palette> = {
  primaire: "primary",
  secondaire: "secondary",
  neutre_clair: "neutral_light",
  neutre_fonce: "neutral_dark",
};

/** Relit une palette stockée en jsonb, ancienne forme comprise. */
export function paletteFromStored(stored: unknown): Partial<Palette> {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
    return {};
  }

  const palette: Partial<Palette> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (typeof value !== "string") continue;
    const target = LEGACY_PALETTE_KEYS[key] ?? (key as keyof Palette);
    if (target in paletteSchema.shape) {
      palette[target] = value;
    }
  }
  return palette;
}

const DIRECTIONS_TOOL: Anthropic.Tool = {
  name: "propose_directions",
  description:
    "Propose exactly 3 distinct creative directions for the practice's brand identity, based on the brief provided.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      directions: {
        type: "array",
        // L'API Anthropic n'autorise pas minItems/maxItems au-delà de 0 ou 1
        // en mode strict : le "exactement 3" est demandé dans la description
        // et vérifié après coup par directionsResultSchema.
        description: "Exactly 3 directions, no more, no fewer.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Evocative name for the direction (2 to 4 words).",
            },
            description: {
              type: "string",
              description:
                "2 to 3 sentences describing the brand personality and why it fits this practice. Keep it under 500 characters.",
            },
            palette: {
              type: "object",
              properties: {
                primary: { type: "string", description: "Hex color #RRGGBB" },
                secondary: { type: "string", description: "Hex color #RRGGBB" },
                accent: { type: "string", description: "Hex color #RRGGBB" },
                neutral_light: {
                  type: "string",
                  description: "Hex color #RRGGBB, light",
                },
                neutral_dark: {
                  type: "string",
                  description: "Hex color #RRGGBB, dark",
                },
              },
              required: [
                "primary",
                "secondary",
                "accent",
                "neutral_light",
                "neutral_dark",
              ],
              additionalProperties: false,
            },
            heading_font: {
              type: "string",
              description:
                "Name of a real, available typeface (Google Fonts preferred) for headings, e.g. Fraunces.",
            },
            body_font: {
              type: "string",
              description:
                "Name of a real, available typeface for body copy, e.g. Inter.",
            },
          },
          required: [
            "name",
            "description",
            "palette",
            "heading_font",
            "body_font",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["directions"],
    additionalProperties: false,
  },
};

/*
 * Le mapping brief → prompt vit dans `lib/ai/brief-context.ts` depuis le
 * Lot 3 : le kit part du même brief, et deux copies auraient dérivé.
 */
function buildPrompt(projectName: string, draft: BriefDraft): string {
  return `You are a senior art director for Eklio, which builds brand identities for licensed mental-health clinicians in private practice in the United States — therapists, counselors, psychologists, clinical social workers.

${buildBriefContext(projectName, draft)}

Propose exactly 3 creative directions, each coherent with this brief and each clearly contrasted with the other two — for instance one more composed, one warmer, one more contemporary. Adapt that spread to this particular practice rather than applying it as a formula.

For each direction:
- Give it a name of 2 to 4 words a clinician would be comfortable saying out loud.
- Describe it in 2 to 3 sentences — under 500 characters — covering the personality it carries and why it fits this practice.
- Choose a palette of 5 colors consistent with the color families and the contrast level asked for.
- Choose two real, available typefaces matching the type style asked for — one for headings, one for body copy.

Write in warm, grounded, plain American English. No hype, no startup vocabulary, no sales pressure: this is a clinician speaking to someone who is deciding whether to reach out.`;
}

/*
 * Garde-fou de niveau 1 : le socle déontologique pilote le modèle dès la
 * première tentative, plutôt que d'attendre le rattrapage de niveau 2. Le
 * cadrage produit vient après les règles — aucune consigne de style ne peut se
 * lire comme une permission de les assouplir.
 */
export const DIRECTIONS_SYSTEM_PROMPT = `${ETHICS_SYSTEM_RULES}

You are a senior art director for Eklio, which builds brand identities for licensed mental-health clinicians in private practice in the United States. A direction's description is copy this clinician may publish: it has to read as psychoeducation — what the practice is like, who it serves, how the work feels — never as a claim about what the work will produce.`;

/** Nombre de reprises accordées au modèle après une violation bloquante. */
const ETHICS_MAX_RETRIES = 2;

/**
 * Appel modèle, isolé pour que la garde déontologique et les tests puissent
 * l'envelopper. `feedback` est nul à la première tentative, puis porte
 * l'instruction corrective construite à partir des violations trouvées.
 */
/*
 * Budget de sortie des directions : trois directions courtes, aucune copy
 * longue. Bien plus modeste que le kit (32 000) ou le mois (24 000), et
 * confortablement SOUS le seuil au-delà duquel le SDK refuse un appel non
 * streamé (~21 333, cf. `NON_STREAMING_MAX_TOKENS` dans `lib/ai/kit.ts`) —
 * c'est pourquoi cet appel-ci peut rester en `messages.create()`.
 */
export const DIRECTIONS_MAX_TOKENS = 8000;

/**
 * Levée quand le modèle a été coupé par `max_tokens` avant d'avoir fini.
 *
 * Alignement sur `KitTruncatedError` et `PresenceTruncatedError`. Le risque est
 * ici plus faible qu'ailleurs — 8 000 jetons pour trois directions courtes —
 * mais « improbable » n'est pas « impossible », et sans ce contrôle une
 * troncature ne se présente PAS comme un problème de longueur : le bloc d'outil
 * est incomplet, son JSON ne valide pas, et l'échec remonte en erreur zod
 * opaque. Le praticien lit « Something went wrong » pour un problème qui a un
 * nom et une réponse.
 */
export class DirectionsTruncatedError extends Error {
  constructor() {
    super("Le modèle a été coupé par max_tokens avant la fin des directions.");
    this.name = "DirectionsTruncatedError";
  }
}

/**
 * Transforme une réponse du modèle en directions validées, ou lève en nommant
 * la raison.
 *
 * Extraite de l'appel réseau pour être testable sans API — même découpage que
 * `parseKitResponse` et `parsePresenceResponse`. C'est ici que se décide la
 * différence entre un échec DIAGNOSTIQUÉ et un « Something went wrong » opaque.
 */
export function parseDirectionsResponse(
  response: Anthropic.Message
): DirectionsResult {
  if (response.stop_reason === "refusal") {
    throw new Error("The model refused to generate directions.");
  }

  /*
   * Coupure par longueur : on le dit ICI, tant qu'on connaît la vraie raison.
   * Plus bas, elle se présenterait comme une banale erreur de structure.
   */
  if (response.stop_reason === "max_tokens") {
    throw new DirectionsTruncatedError();
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("No direction was generated.");
  }

  return directionsResultSchema.parse(toolUse.input);
}

export type DirectionsModelCall = (
  prompt: string,
  feedback: string | null
) => Promise<DirectionsResult>;

/*
 * Appelle Claude avec un unique outil forcé (tool_choice) pour obtenir une
 * réponse strictement structurée — pas de parsing de texte libre. La
 * validation zod repasse sur la réponse avant qu'elle ne remonte : une réponse
 * structurellement invalide lève ici, avant même la vérification déontologique.
 */
const callAnthropic: DirectionsModelCall = async (prompt, feedback) => {
  const response = await getAnthropicClient().messages.create({
    model: "claude-opus-5",
    max_tokens: DIRECTIONS_MAX_TOKENS,
    output_config: { effort: "medium" },
    system: DIRECTIONS_SYSTEM_PROMPT,
    tools: [DIRECTIONS_TOOL],
    tool_choice: { type: "tool", name: DIRECTIONS_TOOL.name },
    messages: [
      {
        role: "user",
        content: feedback ? `${prompt}\n\n${feedback}` : prompt,
      },
    ],
  });

  return parseDirectionsResponse(response);
};

/*
 * Chaînes que le praticien pourrait publier telles quelles, et qui doivent donc
 * passer la vérification déontologique : la description (2-3 phrases de copy)
 * et le nom de la direction, qui est du texte libre affiché. Les hex et les
 * noms de police n'en sont pas — les vérifier n'apporterait que du bruit.
 */
function publishableText(result: DirectionsResult): string[] {
  return result.directions.flatMap((direction) => [
    direction.name,
    direction.description,
  ]);
}

/**
 * Génération gardée, avec l'appel modèle injecté — le point d'entrée des tests.
 *
 * Ne renvoie jamais un résultat non conforme : soit les trois directions
 * passent la validation structurelle ET la validation déontologique, soit
 * l'appel lève (`EthicsComplianceError` après épuisement des reprises, ou
 * l'erreur structurelle) et rien n'est persisté.
 */
export function generateDirectionsWithModel(
  projectName: string,
  draft: BriefDraft,
  callModel: DirectionsModelCall
): Promise<DirectionsResult> {
  const prompt = buildPrompt(projectName, draft);

  return generateWithEthicsGuard(
    (feedback) => callModel(prompt, feedback),
    {
      publishableText,
      label: "directions",
      maxRetries: ETHICS_MAX_RETRIES,
    }
  );
}

export function generateDirectionsFromBrief(
  projectName: string,
  draft: BriefDraft
): Promise<DirectionsResult> {
  return generateDirectionsWithModel(projectName, draft, callAnthropic);
}
