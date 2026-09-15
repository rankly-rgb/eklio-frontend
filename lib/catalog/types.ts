import type { Tables } from "@/types/supabase";

/*
 * Le catalogue — ton, palettes, paires typographiques, cartes de persona, de
 * problème et de gain, types de licence, spécialités, actions et objectifs de
 * site, règles déontologiques.
 *
 * Il est LU EN BASE, jamais codé ici (§6) : la copy doit pouvoir changer sans
 * déploiement. Ce fichier ne porte donc que des TYPES, dérivés des types
 * générés — de cette façon un renommage de colonne casse la compilation au
 * lieu de casser un écran.
 */

export type LicenseType = Tables<"license_types">;
/*
 * Quelle juridiction délivre quel titre. L'annexe de `license_types`, et la
 * réponse au défaut du 15 septembre : un LMHC annoncé en Oregon, où le titre
 * est LPC. La règle qui la lit est `lib/brief/license-state.ts` ; l'autorité
 * qui REFUSE est `project_briefs_license_state_gate`, en base.
 */
export type LicenseTypeState = Tables<"license_type_states">;
/*
 * Un DIPLÔME, et il n'est pas une licence. Une université le délivre, aucun
 * board ne l'accorde ni ne le retire, et il n'autorise à exercer nulle part.
 * C'est cette séparation qui permet à `checkUnbackedClaims` d'accepter
 * « PsyD » tout en refusant « psychologist » sur le même brief.
 */
export type Degree = Tables<"degrees">;
export type Specialty = Tables<"specialties">;
export type PrimaryAction = Tables<"primary_actions">;
export type SiteGoal = Tables<"site_goals">;
export type ProblemCard = Tables<"problem_cards">;
export type GainCard = Tables<"gain_cards">;
export type PersonaCardData = Tables<"client_persona_cards">;
export type TypePairing = Tables<"type_pairings">;
export type EthicsRule = Tables<"ethics_rules">;
export type SessionStyleCard = Tables<"session_style_cards">;
export type NotAFitCard = Tables<"not_a_fit_cards">;
export type ModalityCard = Tables<"modality_cards">;
export type ModalityProminenceOption = Tables<"modality_prominence_options">;

/**
 * Une famille chromatique. `preview_tokens` est un `Json` côté généré ; la
 * base garantit par CHECK qu'il porte exactement les cinq rôles, égaux aux
 * colonnes `*_hex`. On resserre donc le type ici plutôt que de le vérifier à
 * chaque rendu.
 */
export type PaletteFamily = Omit<Tables<"palette_families">, "preview_tokens"> & {
  preview_tokens: {
    primary: string;
    secondary: string;
    light: string;
    dark: string;
    paper: string;
  };
};

/** Une carte de ton. `sample_hero` EST le titre rendu par la carte. */
export type TonePreset = Tables<"tone_cards">;

export type Catalog = {
  licenseTypes: LicenseType[];
  licenseTypeStates: LicenseTypeState[];
  degrees: Degree[];
  specialties: Specialty[];
  problemCards: ProblemCard[];
  gainCards: GainCard[];
  personaCards: PersonaCardData[];
  toneCards: TonePreset[];
  paletteFamilies: PaletteFamily[];
  typePairings: TypePairing[];
  primaryActions: PrimaryAction[];
  siteGoals: SiteGoal[];
  ethicsRules: EthicsRule[];
  /*
   * "How you work" catalogs — same plain-table pattern as the eleven above
   * (FRONTEND_CONTRACT.md §9.8). `banned_phrases` is NOT here and never will
   * be: it is service-role only, reached exclusively through
   * `usp_banned_phrases_check` (§9.11) — see `lib/generation/banned-phrases.ts`.
   */
  sessionStyleCards: SessionStyleCard[];
  notAFitCards: NotAFitCard[];
  modalityCards: ModalityCard[];
  modalityProminenceOptions: ModalityProminenceOption[];
};
