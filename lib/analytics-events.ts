/*
 * ── LES NOMS D'ÉVÉNEMENTS, ET RIEN D'AUTRE ──────────────────────────────
 *
 * Des TYPES uniquement, donc importables des deux côtés de la frontière
 * serveur/client sans rien entraîner avec eux. Ce fichier existe parce que le
 * lot « instrumentation » a découvert que deux composants CLIENT importaient
 * `@/lib/analytics` — dont l'en-tête dit « SERVEUR UNIQUEMENT » depuis le
 * premier jour. Ça compilait tant que `track()` ne faisait qu'un
 * `console.info` ; le jour où il a ouvert un client Supabase, `next build` a
 * refusé, et c'est ce refus qui a montré que ces événements-là n'avaient
 * jamais quitté le navigateur de la praticienne.
 */

export type AnalyticsEvent =
  /* ── Les deux bouts du tunnel (lot « instrumentation ») ───────────────
   * L'inventaire du §7 d'ACQUISITION_WALK.md : trente-neuf noms
   * existaient et le premier arrivait APRÈS l'inscription. Les deux
   * questions qu'une campagne à froid pose vraiment — combien sont
   * arrivés, combien ont payé — n'avaient aucun événement. Ceux-ci les
   * ferment, et rien de plus.
   *
   * `landing_viewed` et `pricing_viewed` sont émis par `POST /api/e`,
   * seul endroit du dépôt où un événement part du navigateur : les deux
   * pages sont STATIQUES et doivent le rester (c'est la page d'atterrissage
   * d'une campagne à froid). Cf. app/api/e/route.ts.
   */
  | "landing_viewed"
  | "pricing_viewed"
  | "signup_started"
  | "account_created"
  | "checkout_opened"
  | "purchase_completed"
  | "brief_started"
  | "brief_step_completed"
  | "brief_reviewed"
  | "generation_started"
  | "generation_succeeded"
  | "generation_failed"
  | "direction_chosen"
  /* Supersédé au lot 11 par `site_output_copied`. Conservé tant que
     `lib/kit/site-prompt.ts` l'est — cf. l'en-tête de ce fichier. */
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
  /* ── Check (LOT 7) ────────────────────────────────────────────────────
   * `check_scanned` and `check_rewritten` carry RULE IDS and counts only —
   * six fixed strings out of `ethics_rules`. Never the text she pasted,
   * never an excerpt of it, not even truncated. That is the whole rule for
   * this surface and it is kept here as well as in the routes.
   */
  | "check_scanned"
  | "check_rewritten"
  | "unlock_opened"
  | "email_sent"
  | "billing_portal_opened"
  | "trial_ending_notice_sent"
  /* ── Positionnement USP (§2.5) ────────────────────────────────────────
   * `usp_gate_rejected` porte le nom de la porte et l'id du candidat —
   * jamais le texte, qui EST la donnée libre que ce fichier interdit
   * d'en-tête.
   */
  | "usp_options_generated"
  | "usp_gate_rejected"
  | "usp_selected"
  | "usp_edited"
  | "usp_collision_warned"
  | "usp_collision_kept"
  /* ── post-purchase-v2, Lot 2 (app chrome) ──────────────────────────── */
  | "search_used"
  /* ── post-purchase-v2, Lot 4 (asset library) ─────────────────────────
   * `asset_downloaded`'s `size`/`format` mean the file's byte size and its
   * catalog `kind` (png/svg/...) -- never the pixel dimensions, which
   * `asset_catalog.width`/`height` already name differently.
   */
  | "asset_library_opened"
  | "asset_filtered"
  | "asset_detail_opened"
  | "asset_downloaded"
  | "asset_zip_downloaded"
  | "asset_insitu_viewed"
  /* ── post-purchase-v2, Lot 5 (generated photography) ─────────────────
   * `brand_image_generated`'s `cost_cents` is what the PRICE TABLE says the
   * image cost, never anything derived from the model's `usage` block --
   * see lib/images/config.ts. `brand_image_refused` carries the machine
   * reason (budget_exceeded, moderated, busy, ...), never the prompt and
   * never a message written for her.
   */
  | "brand_image_generated"
  | "brand_image_refused";

/** Valeurs admises : rien qui puisse porter du texte libre d'utilisateur. */
export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null
>;
