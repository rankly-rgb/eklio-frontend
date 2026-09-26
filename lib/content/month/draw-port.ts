import type { BankGuardPort } from "@/lib/content/bank-guard";
import type { DrawnTopic, DrawPorts } from "@/lib/content/month/draw";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA COUTURE DE LA BANQUE CÔTÉ SERVEUR — ÉTAGE C3 DE F45
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ CE FICHIER EXISTE PARCE QUE LE RECENSEMENT A RAISON D'ÊTRE TATILLON.
 *
 * `lib/content/month/draw.ts` porte la décision du tirage — la ronde, les
 * plafonds, la pénurie — et il est éprouvé par des doublures. Mais il ne
 * contient AUCUN nom de RPC : il les reçoit par port. Le recensement, qui compte
 * les chaînes littérales parce qu'aucun type ne les protège, ne pouvait donc pas
 * voir `assign_topic_to_kit` ni `drawable_count_for_kit` comme portés — et il
 * avait raison. Une décision portée dont l'appel reste inline dans le harnais est
 * à moitié portée.
 *
 * C'est le symétrique exact de `lib/credits/server-port.ts` : la décision d'un
 * côté, la couture qui nomme les RPC de l'autre, et un seul endroit où la forme
 * des arguments est écrite.
 *
 * ── ⚠ ET ELLE NE DÉCIDE RIEN ────────────────────────────────────────────
 *
 * Aucun seuil, aucun plafond, aucun ordre. Ce module traduit — il nomme le RPC,
 * passe les arguments, lève sur erreur. Un seuil posé ici serait un second
 * arbitre, et celui des deux qu'on oublie de mettre à jour est celui qui décide
 * (la classe de F27, et de F41).
 */

/** Le minimum que cette couture demande d'un client Supabase. */
export type DrawRpcClient = {
  rpc(
    name: "assign_topic_to_kit" | "drawable_count_for_kit" | "release_stale_topic_assignments",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
  from(table: "content_topics"): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown
      ): { single(): Promise<{ data: unknown; error: { message: string } | null }> };
    };
  };
};

/** Les colonnes que le tirage lit d'un sujet, nommées une seule fois. */
const TOPIC_COLUMNS = "id, archetype_key, intent, title, hook";

/**
 * Les deux accès dont `drawMonth` a besoin, câblés sur la base.
 *
 * ⚠ `p_archetype` EST OMIS, PAS PASSÉ À `null`. `assign_topic_to_kit` distingue
 * « n'importe quel tirable » de « celui-là » par la PRÉSENCE de l'argument ; un
 * `null` explicite prendrait le chemin de la surcharge nommée et ne rendrait
 * jamais rien. C'est ce que fait le rattrapage, et c'est la moitié du mois.
 */
export function serverDrawPort(
  db: DrawRpcClient,
  options: { kitId: string; month: string }
): DrawPorts {
  return {
    async assign(archetype) {
      const { data, error } = await db.rpc(
        "assign_topic_to_kit",
        archetype === undefined
          ? { p_brand_kit_id: options.kitId, p_month: options.month }
          : { p_brand_kit_id: options.kitId, p_month: options.month, p_archetype: archetype }
      );
      if (error) throw new Error(`assign_topic_to_kit: ${error.message}`);
      return typeof data === "string" ? data : null;
    },

    async topic(id) {
      const { data, error } = await db
        .from("content_topics")
        .select(TOPIC_COLUMNS)
        .eq("id", id)
        .single();
      /*
       * ⚠ UNE LECTURE QUI ÉCHOUE REND `null`, ELLE NE LÈVE PAS. Le sujet est déjà
       * marqué assigné à ce point : lever ferait mourir le tirage en laissant
       * l'assignation derrière lui, et c'est ainsi qu'on fabrique les orphelines.
       * `drawMonth` passe au suivant, et le balai des trois heures rattrape.
       */
      if (error || !data) return null;
      return data as DrawnTopic;
    },
  };
}

/**
 * La garde de banque, câblée sur la base.
 *
 * ⚠ L'ORDRE EST LIBÉRER PUIS COMPTER, ET IL EST DANS `guardBank`, PAS ICI.
 * Compter d'abord verrait la banque telle que les exécutions mortes l'ont
 * laissée — 994 assignations orphelines le 2026-09-26 — et refuserait un mois
 * que la banque pouvait tenir.
 */
export function serverBankGuardPort(db: DrawRpcClient): BankGuardPort {
  return {
    async releaseStale() {
      const { data, error } = await db.rpc("release_stale_topic_assignments", {});
      if (error) throw new Error(`release_stale_topic_assignments: ${error.message}`);
      return Number(data ?? 0);
    },

    async drawableCounts(kitId) {
      const { data, error } = await db.rpc("drawable_count_for_kit", { p_brand_kit_id: kitId });
      if (error) throw new Error(`drawable_count_for_kit: ${error.message}`);
      const rows = (data ?? []) as Array<{ archetype_key: string; drawable: number }>;
      return Object.fromEntries(rows.map((r) => [r.archetype_key, Number(r.drawable)]));
    },
  };
}
