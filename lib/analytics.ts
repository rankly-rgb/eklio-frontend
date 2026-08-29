/*
 * Le tunnel, en événements — SERVEUR UNIQUEMENT.
 *
 * PAS DE FOURNISSEUR, ET C'EST DÉLIBÉRÉ. Un SDK d'analytics côté client
 * ajouterait un script tiers, un cookie, une bannière de consentement, et une
 * dépendance — pour un produit dont les utilisateurs sont des cliniciens et
 * dont les données touchent à leur pratique. Ce qu'on veut savoir tient dans
 * une ligne de journal structurée, que Vercel draine déjà.
 *
 * AUCUNE DONNÉE PERSONNELLE. Un identifiant de projet ou de kit, jamais un
 * e-mail, jamais un nom de practice, jamais un extrait de copy. Ce qui est
 * journalisé ici part chez qui héberge les logs.
 *
 * Le jour où un vrai fournisseur arrive, c'est cette fonction qu'on remplace,
 * et elle seule.
 */

export type AnalyticsEvent =
  | "brief_started"
  | "brief_step_completed"
  | "brief_reviewed"
  | "generation_started"
  | "generation_succeeded"
  | "generation_failed"
  | "direction_chosen"
  | "site_prompt_copied"
  | "pdf_downloaded"
  /* ── L'éditeur de site ────────────────────────────────────────────────
   * Tous émis DEPUIS LE SERVEUR, comme le reste : les route handlers de
   * `/api/brand-kits/[id]/site-*` et la page de l'éditeur. Aucun d'eux ne
   * porte de texte libre — un `area`, une cible, un `kind`, jamais une
   * ligne de copy.
   */
  | "site_editor_opened"
  | "site_spec_edited"
  | "contrast_fix_applied"
  | "builder_target_changed"
  | "site_output_copied"
  | "setup_sheet_downloaded"
  | "extra_instructions_used"
  | "site_spec_reset"
  | "checklist_item_completed"
  | "unlock_opened"
  | "email_sent";

/** Valeurs admises : rien qui puisse porter du texte libre d'utilisateur. */
export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null
>;

export function track(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {}
): void {
  // Une ligne, préfixée, parsable — `[analytics] event {json}`.
  console.info(`[analytics] ${event} ${JSON.stringify(properties)}`);
}
