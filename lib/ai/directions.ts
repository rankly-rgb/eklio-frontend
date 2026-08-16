import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";
import type { BriefDraft } from "@/lib/brief/schemas";
import {
  EMOTION_OPTIONS,
  FAMILLE_CHROMATIQUE_OPTIONS,
  METIER_OPTIONS,
  OBJECTIF_SITE_OPTIONS,
  STYLE_TYPOGRAPHIQUE_OPTIONS,
  TONE_SLIDERS,
  optionLabel,
} from "@/lib/brief/steps";

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hexadécimale invalide");

export const paletteSchema = z.object({
  primaire: hexColor,
  secondaire: hexColor,
  accent: hexColor,
  neutre_clair: hexColor,
  neutre_fonce: hexColor,
});

export const directionSchema = z.object({
  nom: z.string().min(1).max(60),
  description: z.string().min(1).max(400),
  palette: paletteSchema,
  typographie_titre: z.string().min(1).max(60),
  typographie_corps: z.string().min(1).max(60),
});

export const directionsResultSchema = z.object({
  directions: z.array(directionSchema).length(3),
});

export type Palette = z.infer<typeof paletteSchema>;
export type DirectionResult = z.infer<typeof directionSchema>;
export type DirectionsResult = z.infer<typeof directionsResultSchema>;

const DIRECTIONS_TOOL: Anthropic.Tool = {
  name: "proposer_directions",
  description:
    "Propose exactement 3 directions créatives distinctes pour l'identité de marque, à partir du brief fourni.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      directions: {
        type: "array",
        // L'API Anthropic n'autorise pas minItems/maxItems au-delà de 0 ou 1
        // en mode strict : le "exactement 3" est demandé dans la
        // description et vérifié après coup par directionsResultSchema.
        description: "Exactement 3 directions, ni plus ni moins.",
        items: {
          type: "object",
          properties: {
            nom: {
              type: "string",
              description: "Nom évocateur de la direction (2 à 4 mots).",
            },
            description: {
              type: "string",
              description:
                "2 à 3 phrases décrivant la personnalité de marque et pourquoi elle correspond au brief.",
            },
            palette: {
              type: "object",
              properties: {
                primaire: { type: "string", description: "Couleur hex #RRGGBB" },
                secondaire: { type: "string", description: "Couleur hex #RRGGBB" },
                accent: { type: "string", description: "Couleur hex #RRGGBB" },
                neutre_clair: { type: "string", description: "Couleur hex #RRGGBB, claire" },
                neutre_fonce: { type: "string", description: "Couleur hex #RRGGBB, foncée" },
              },
              required: [
                "primaire",
                "secondaire",
                "accent",
                "neutre_clair",
                "neutre_fonce",
              ],
              additionalProperties: false,
            },
            typographie_titre: {
              type: "string",
              description:
                "Nom d'une police réelle et disponible (Google Fonts de préférence) pour les titres, ex. Fraunces.",
            },
            typographie_corps: {
              type: "string",
              description:
                "Nom d'une police réelle et disponible pour le corps de texte, ex. Inter.",
            },
          },
          required: [
            "nom",
            "description",
            "palette",
            "typographie_titre",
            "typographie_corps",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["directions"],
    additionalProperties: false,
  },
};

function labelsFor(
  options: { value: string; label: string }[],
  values: string[] | undefined
): string {
  if (!values || values.length === 0) return "non précisé";
  return values.map((v) => optionLabel(options, v) ?? v).join(", ");
}

function toneSummary(draft: BriefDraft): string {
  return TONE_SLIDERS.map(({ name, left, right }) => {
    const value = draft[name];
    const v = typeof value === "number" ? value : 3;
    if (v === 3) return `${left}/${right} : équilibré`;
    return v < 3 ? `plutôt ${left} (${v}/5)` : `plutôt ${right} (${v}/5)`;
  }).join(" · ");
}

function buildPrompt(projectName: string, draft: BriefDraft): string {
  const metier =
    draft.metier === "autre"
      ? (draft.metier_autre ?? "non précisé")
      : (optionLabel(METIER_OPTIONS, draft.metier) ?? "non précisé");

  return `Vous êtes directeur·rice artistique senior pour Eklio, un service qui crée des identités de marque pour des solopreneurs français (coachs, thérapeutes, consultants, formateurs, freelances, artisans).

Voici le brief de marque rempli par le client pour le projet « ${projectName} » :

- Métier : ${metier}
- Offre principale : ${draft.offre_principale ?? "non précisé"}
- Problème résolu : ${draft.probleme_resolu ?? "non précisé"}
- Résultat pour le client : ${draft.resultat_client ?? "non précisé"}
- Différenciation : ${draft.differenciation ?? "non précisé"}
- Cible : ${draft.cible_description ?? "non précisé"}
- Ton souhaité : ${toneSummary(draft)}
- Émotions à transmettre : ${labelsFor(EMOTION_OPTIONS, draft.emotions)}
- À éviter dans le ton : ${draft.a_eviter_ton ?? "aucune contrainte précisée"}
- Familles de couleurs souhaitées : ${labelsFor(FAMILLE_CHROMATIQUE_OPTIONS, draft.familles_chromatiques)}
- Niveau de contraste souhaité : ${draft.niveau_contraste ?? "non précisé"}
- Couleurs à éviter : ${draft.couleurs_a_eviter ?? "aucune"}
- Univers admirés : ${draft.univers_admires ?? "non précisé"}
- Style typographique souhaité : ${optionLabel(STYLE_TYPOGRAPHIQUE_OPTIONS, draft.style_typographique) ?? "non précisé"}
- Niveau de caractère souhaité : ${draft.niveau_caractere ?? "non précisé"}
- Objectif du site : ${optionLabel(OBJECTIF_SITE_OPTIONS, draft.objectif_site) ?? "non précisé"}

Proposez exactement 3 directions créatives distinctes et cohérentes avec ce brief, en français. Chaque direction doit avoir une personnalité clairement différenciée des deux autres (par exemple : une plus sobre, une plus audacieuse, une plus chaleureuse — adaptez selon le brief, ne vous limitez pas à cet exemple). Pour chaque direction, choisissez des polices réelles et disponibles qui correspondent au style souhaité, et une palette de 5 couleurs cohérente avec les familles chromatiques demandées.`;
}

/*
 * Appelle Claude avec un unique outil forcé (tool_choice) pour obtenir une
 * réponse strictement structurée — pas de parsing de texte libre. La
 * validation zod repasse sur la réponse avant qu'elle n'entre en base.
 */
export async function generateDirectionsFromBrief(
  projectName: string,
  draft: BriefDraft
): Promise<DirectionsResult> {
  const prompt = buildPrompt(projectName, draft);

  const response = await getAnthropicClient().messages.create({
    model: "claude-opus-5",
    max_tokens: 8000,
    output_config: { effort: "medium" },
    tools: [DIRECTIONS_TOOL],
    tool_choice: { type: "tool", name: "proposer_directions" },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("La génération a été refusée par le modèle.");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Aucune direction n'a été générée.");
  }

  return directionsResultSchema.parse(toolUse.input);
}
