import type { PreflightPort, MonthStatus } from "@/lib/content/month/preflight";
import type { ContentItemRow } from "@/lib/content/month/assemble";
import { serverBankGuardPort, type DrawRpcClient } from "@/lib/content/month/draw-port";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES COUTURES QUI RESTAIENT — ÉTAGE D DE F45
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le préalable, l'écriture d'un post, la ligne du mois et la libération des
 * sujets : quatre accès à la base que seul le harnais savait faire, chacun écrit
 * inline chez lui. Ce fichier les nomme une fois, comme `draw-port.ts` pour le
 * tirage et `server-port.ts` pour le crédit.
 *
 * ⚠ AUCUNE DÉCISION ICI. Pas un seuil, pas un plafond, pas un ordre. Ces
 * fonctions traduisent : elles nomment la table, passent les colonnes, rendent
 * l'erreur. Une décision posée ici serait un second arbitre, et celui des deux
 * qu'on oublie de mettre à jour est celui qui décide (F27, F41).
 */

/** Le minimum que ces coutures demandent d'un client Supabase. */
export type MonthRpcClient = DrawRpcClient & {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown
      ): {
        eq(
          column: string,
          value: unknown
        ): { maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }> };
        maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }> & {
      select(columns: string): {
        single(): Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update(patch: Record<string, unknown>): {
      eq(column: string, value: unknown): Promise<{ error: { message: string } | null }>;
      in(column: string, values: unknown[]): Promise<{ error: { message: string } | null }>;
    };
    delete(): {
      eq(
        column: string,
        value: unknown
      ): { in(column: string, values: unknown[]): Promise<{ error: { message: string } | null }> };
    };
  };
  rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Le préalable, câblé sur la base.
 *
 * ⚠ `licenceFacts` LIT L'ABRÉVIATION DANS `license_type_states`, PAS DANS LE
 * BRIEF. C'est la matrice qui dit comment un type de licence s'écrit dans un État
 * donné, vérifiée à la main État par État (F12). Un brief ne l'invente pas.
 */
export function serverPreflightPort(
  db: MonthRpcClient,
  options: { stateCode: string | null }
): PreflightPort {
  return {
    async monthStatus(brandKitId, month) {
      const { data, error } = await db
        .from("content_months")
        .select("status")
        .eq("brand_kit_id", brandKitId)
        .eq("month", month)
        .maybeSingle();
      if (error) throw new Error(`content_months: ${error.message}`);
      if (!data) return null;
      return (data as { status: MonthStatus }).status;
    },

    async licenceFacts(projectId) {
      const brief = await db
        .from("project_briefs")
        .select("license_type_id, license_number, license_state_code, state")
        .eq("project_id", projectId)
        .maybeSingle();
      if (brief.error) throw new Error(`project_briefs: ${brief.error.message}`);
      const row = (brief.data ?? {}) as {
        license_type_id?: string | null;
        license_number?: string | null;
        license_state_code?: string | null;
        state?: string | null;
      };

      /*
       * ⚠ LE MÊME REPLI QUE LE HARNAIS : `license_state_code ?? state`. Un brief
       * rempli avant que le champ dédié existe porte l'État du cabinet, et c'est
       * le seul État qu'on ait de lui.
       */
      const stateCode = (options.stateCode ?? row.license_state_code ?? row.state ?? "").toUpperCase();

      let abbreviation: string | null = null;
      if (row.license_type_id && stateCode) {
        const matrix = await db
          .from("license_type_states")
          .select("abbreviation")
          .eq("license_type_id", row.license_type_id)
          .eq("state_code", stateCode)
          .maybeSingle();
        if (matrix.error) throw new Error(`license_type_states: ${matrix.error.message}`);
        abbreviation = (matrix.data as { abbreviation?: string } | null)?.abbreviation ?? null;
      }

      return {
        licenseTypeId: row.license_type_id ?? null,
        licenseNumber: row.license_number ?? null,
        abbreviation,
      };
    },

    /*
     * ⚠ LA PORTE F46, ET ELLE EST SÉPARÉE DE L'ABRÉVIATION EXPRÈS. `licenceMention`
     * retombe sur `LICENCE_ABBREVIATION`, une table du CODE : une abréviation
     * absente n'empêche donc pas d'imprimer. L'absence d'abréviation n'est pas un
     * contrôle de vérification — celui-ci lit `verified_at`, qui est le geste
     * humain de F12.
     */
    async stateVerified(licenseTypeId, stateCode) {
      const { data, error } = await db
        .from("license_type_states")
        .select("verified_at")
        .eq("license_type_id", licenseTypeId)
        .eq("state_code", stateCode.toUpperCase())
        .maybeSingle();
      if (error) throw new Error(`license_type_states: ${error.message}`);
      return (data as { verified_at?: string | null } | null)?.verified_at != null;
    },

    async creditRemaining(userId, month) {
      const { data, error } = await db.rpc("credit_remaining", {
        p_user: userId,
        p_kind: "post_generation",
        p_month: month,
      });
      if (error) throw new Error(`credit_remaining: ${error.message}`);
      const row = (data ?? {}) as { remaining?: number | null; unlimited?: boolean };
      return { remaining: row.remaining ?? null, unlimited: row.unlimited === true };
    },

    bank: serverBankGuardPort(db),
  };
}

/**
 * L'écriture d'un post, câblée sur `content_items`.
 *
 * ⚠ ELLE REND LE MESSAGE DE LA BASE, ELLE NE LÈVE PAS. Un refus d'insert est une
 * décision de l'assemblage — il prend un remplaçant au même créneau — et lever
 * ferait tomber le mois entier sur un post que la base n'a pas voulu.
 */
export function serverInsertPort(
  db: MonthRpcClient,
  options: { brandKitId: string; monthId: string; theme?: string | null; register?: string | null }
) {
  return async (row: ContentItemRow): Promise<string | null> => {
    const { error } = await db.from("content_items").insert({
      brand_kit_id: options.brandKitId,
      month_id: options.monthId,
      topic_id: row.topicId,
      theme: options.theme ?? null,
      register: options.register ?? null,
      /* ⚠ La famille de mise en page, NOT NULL, distincte de la forme composée. */
      archetype: row.layout,
      compose_archetype: row.composeArchetype,
      payload: row.payload,
      status: "proposed",
      title: row.cardLine,
      on_image_text: row.onImageText,
      caption: row.caption,
      alt_text: row.altText,
      rationale: row.rationale,
      scheduled_for: row.scheduledFor,
    });
    return error?.message ?? null;
  };
}

/**
 * La ligne du mois : ouverte en `generating`, fermée en `proposed` ou `failed`.
 *
 * ⚠ ELLE N'ÉCRASE PAS CELLE QUI EXISTE. Le webhook Stripe pose déjà cette ligne à
 * l'achat (`lib/content/generate/queue.ts`), et une exécution tuée en laisse une
 * en `generating`. Un `upsert` effacerait ses thèmes ; la clé unique
 * `(brand_kit_id, month)` est l'arbitre, et on relit plutôt que d'insister (F54).
 */
export function serverMonthRowPort(db: MonthRpcClient) {
  return {
    async open(input: { brandKitId: string; month: string }): Promise<string> {
      const existing = await db
        .from("content_months")
        .select("id")
        .eq("brand_kit_id", input.brandKitId)
        .eq("month", input.month)
        .maybeSingle();
      if (existing.error) throw new Error(`content_months: ${existing.error.message}`);
      if (existing.data) return (existing.data as { id: string }).id;

      const created = await db
        .from("content_months")
        .insert({
          brand_kit_id: input.brandKitId,
          month: input.month,
          themes: [],
          status: "generating",
        })
        .select("id")
        .single();
      if (created.error) throw new Error(`content_months insert: ${created.error.message}`);
      return (created.data as { id: string }).id;
    },

    async close(monthId: string, status: "proposed" | "failed"): Promise<void> {
      const { error } = await db
        .from("content_months")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", monthId);
      if (error) throw new Error(`content_months update: ${error.message}`);
    },
  };
}

/**
 * Rendre des sujets à la banque.
 *
 * ⚠ UNE ASSIGNATION GARDÉE POUR RIEN BLOQUE TOUT LE SEGMENT. La fenêtre
 * anti-collision est de quatre-vingt-dix jours (F13) et le délai de grâce du balai
 * de trois heures : entre les deux, un sujet tiré et non publié est un sujet volé
 * au segment. La banque locale en portait 994 le 2026-09-26.
 */
export function serverReleaseTopics(db: MonthRpcClient, options: { brandKitId: string }) {
  return async (topicIds: string[]): Promise<void> => {
    if (topicIds.length === 0) return;
    /*
     * ⚠ ON SUPPRIME LA LIGNE, ON NE LA MARQUE PAS. `topic_assignments` ne porte
     * que `(brand_kit_id, topic_id, month, assigned_at)` : l'absence de ligne EST
     * la disponibilité. Ajouter un `released_at` créerait un second langage pour
     * dire la même chose, et `next_topic_for_kit` ne le lirait pas.
     *
     * ⚠ ET LE FILTRE PORTE AUSSI SUR LE KIT. Sans lui, rendre un sujet effacerait
     * l'assignation d'une AUTRE praticienne qui l'a légitimement pris.
     */
    const { error } = await db
      .from("topic_assignments")
      .delete()
      .eq("brand_kit_id", options.brandKitId)
      .in("topic_id", topicIds);
    if (error) throw new Error(`topic_assignments: ${error.message}`);
  };
}
