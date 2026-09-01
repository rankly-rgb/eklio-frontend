import { createHash } from "node:crypto";
import type { BriefBundle } from "@/lib/data/brief";

/*
 * Empreinte des réponses de l'étape 4 (§2.2, §9.7) — « editing step 4
 * invalidates it ». Ni les étapes 1-3 ni la voix choisie n'y entrent.
 *
 * UNE SEULE fonction pour les deux générateurs qui en dépendent : les cartes
 * de ton (`tone_cards_inputs_hash`, colonne dédiée) ET les options USP
 * (`data.usp_options_inputs_hash`, part libre — voir le rapport final pour
 * l'écart de schéma). Les deux invalident sur EXACTEMENT les mêmes champs,
 * donc une seule fonction de hachage, appelée deux fois avec le même brief,
 * plutôt que deux copies qui pourraient un jour diverger l'une de l'autre.
 */
export function computeHowYouWorkInputsHash(
  brief: Pick<
    BriefBundle["brief"],
    | "session_style_ids"
    | "not_a_fit_ids"
    | "not_a_fit_text"
    | "modality_ids"
    | "modality_prominence"
    | "referral_quote"
    | "prior_career"
    | "prior_career_public"
  >
): string {
  const canonical = JSON.stringify({
    session_style_ids: [...(brief.session_style_ids ?? [])].sort(),
    not_a_fit_ids: [...(brief.not_a_fit_ids ?? [])].sort(),
    not_a_fit_text: brief.not_a_fit_text ?? "",
    modality_ids: [...(brief.modality_ids ?? [])].sort(),
    modality_prominence: brief.modality_prominence ?? "",
    referral_quote: brief.referral_quote ?? "",
    prior_career: brief.prior_career ?? "",
    prior_career_public: brief.prior_career_public,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
