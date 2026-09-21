import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { contentStatusForCode, type ContentResult } from "@/lib/data/content";

/*
 * ── LA COUCHE DE DONNÉES DE « WRITE IT » ────────────────────────────────
 *
 * Quatre RPC, et chacune est une frontière de transaction :
 *
 *   suggest_topics_for_kit   — GRATUIT, ne consomme rien, n'assigne rien
 *   begin_on_demand_write    — réserve UN crédit, idempotent sur une clef
 *   apply_on_demand_write    — écrit le post et règle le crédit
 *   release_on_demand_write  — relâche quand rien n'a été produit
 *
 * ⚠ LE PLAFOND N'EST NULLE PART ICI. Il est dans `reserve_credit`, en SQL, et
 * ce fichier n'a aucun moyen de le contourner : il ne sait pas ce qu'est un
 * quota, seulement qu'on lui a répondu non.
 */

type Client = SupabaseClient<Database>;

export const suggestedTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  hook: z.string(),
  angle: z.string(),
  /** Vient de `content_intents`, jamais d'une table TypeScript. */
  angle_label: z.string().nullable(),
  archetype_key: z.string(),
  timely: z.boolean(),
  /** La ligne « Why this one », déjà rendue pour ELLE. */
  rationale: z.string().nullable(),
});
export type SuggestedTopic = z.infer<typeof suggestedTopicSchema>;

/** Trois sujets, ou autant qu'il en reste. Gratuit et illimité. */
export async function suggestTopics(
  supabase: Client,
  brandKitId: string,
  options: { month?: string | null; limit?: number; exclude?: string[] } = {}
): Promise<ContentResult<SuggestedTopic[]>> {
  const { data, error } = await supabase.rpc("suggest_topics_for_kit", {
    p_brand_kit_id: brandKitId,
    p_month: options.month ?? undefined,
    p_limit: options.limit ?? 3,
    p_exclude: options.exclude ?? [],
  });

  if (error) {
    console.error("[content] suggest_topics_for_kit", {
      code: error.code ?? null,
      message: error.message,
    });
    /*
     * ⚠ UNE BANQUE ABSENTE N'EST PAS UNE PANNE. Sur un déploiement sans les
     * migrations du chantier, `content_topics` n'existe pas : le panneau doit
     * s'afficher sans suggestions plutôt que de disparaître. C'est l'écran qui
     * décide quoi dire, pas cette fonction — elle rend le refus tel quel.
     */
    return {
      ok: false,
      code: "not_deployed",
      message: "Suggestions are not available in this environment yet.",
      status: contentStatusForCode("not_deployed"),
      detail: `suggest_topics_for_kit: ${error.code ?? "?"} ${error.message}`,
    };
  }

  /*
   * ⚠ LA RPC PEUT RENDRE UN REFUS PLUTÔT QU'UNE LISTE. Elle vérifie le droit
   * d'accès au kit — gratuites ne veut pas dire publiques — et un kit impayé
   * reçoit `{error:{code,message}}`, pas un tableau vide.
   */
  const refusal = z.object({ error: z.object({ code: z.string(), message: z.string() }) })
    .safeParse(data);
  if (refusal.success) {
    const code = refusal.data.error.code;
    return {
      ok: false,
      code,
      message: refusal.data.error.message,
      status: contentStatusForCode(code),
    };
  }

  const parsed = z.array(suggestedTopicSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("[content] suggest_topics_for_kit: shape", parsed.error.issues.slice(0, 4));
    return {
      ok: false,
      code: "schema_mismatch",
      message: "Suggestions came back in a shape Eklio does not recognise.",
      status: contentStatusForCode("schema_mismatch"),
      detail: parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    };
  }
  return { ok: true, data: parsed.data };
}

const beginSchema = z.object({
  ok: z.literal(true),
  reason: z.enum(["reserved", "already_started"]),
  write_id: z.string(),
  reservation_id: z.string(),
  state: z.enum(["reserved", "written", "released"]),
});
export type WriteHandle = z.infer<typeof beginSchema>;

/**
 * Réserve le crédit de « Write it ».
 *
 * ⚠ `idempotencyKey` EST CE QUI REND LE DOUBLE CLIC GRATUIT. Deux appels avec
 * la même clef rendent la même ligne et ne réservent qu'une fois — y compris
 * depuis deux onglets, ce qu'un bouton désactivé ne couvre pas.
 */
export async function beginWrite(
  supabase: Client,
  itemId: string,
  idempotencyKey: string
): Promise<ContentResult<WriteHandle>> {
  const { data, error } = await supabase.rpc("begin_on_demand_write", {
    p_item_id: itemId,
    p_idempotency_key: idempotencyKey,
  });
  return decodeRpc("begin_on_demand_write", beginSchema, data, error);
}

const appliedSchema = z.object({
  ok: z.literal(true),
  reason: z.enum(["written", "already_written"]),
  id: z.string(),
});

export type ApplyWriteInput = {
  writeId: string;
  title: string | null;
  caption: string | null;
  onImageText: string | null;
  altText: string | null;
  composeArchetype: string | null;
  payload: unknown;
  rationale: string | null;
  topicId: string | null;
  costUsd: number | null;
};

export async function applyWrite(
  supabase: Client,
  input: ApplyWriteInput
): Promise<ContentResult<z.infer<typeof appliedSchema>>> {
  const { data, error } = await supabase.rpc("apply_on_demand_write", {
    p_write_id: input.writeId,
    p_title: input.title ?? undefined,
    p_caption: input.caption ?? undefined,
    p_on_image_text: input.onImageText ?? undefined,
    p_alt_text: input.altText ?? undefined,
    p_compose_archetype: input.composeArchetype ?? undefined,
    p_payload: (input.payload ?? undefined) as never,
    p_rationale: input.rationale ?? undefined,
    p_topic_id: input.topicId ?? undefined,
    p_cost_usd: input.costUsd ?? undefined,
  });
  return decodeRpc("apply_on_demand_write", appliedSchema, data, error);
}

/**
 * Rend le crédit, et ENREGISTRE CE QUE LA TENTATIVE A COÛTÉ.
 *
 * ⚠ LES DEUX MOITIÉS SONT SÉPARÉES EN BASE, ET ELLES DOIVENT L'ÊTRE. Une
 * sortie refusée a consommé des jetons chez le fournisseur ; elle ne doit
 * rien à la praticienne. `settle_credit(…, succeeded => false)` écrit une
 * ligne `release` qui rend le crédit ET porte `actual_cost_usd` — la
 * plomberie existait, et `release_on_demand_write` y passait `null`.
 *
 * Mesuré : sur onze appels de « Write it », huit ont été refusés. Le livre
 * portait le coût des trois qui ont abouti.
 */
export async function releaseWrite(
  supabase: Client,
  writeId: string,
  costUsd: number | null = null
): Promise<ContentResult<{ ok: true; reason: string }>> {
  const { data, error } = await supabase.rpc("release_on_demand_write", {
    p_write_id: writeId,
    p_cost_usd: costUsd ?? undefined,
  } as never);
  return decodeRpc(
    "release_on_demand_write",
    z.object({ ok: z.literal(true), reason: z.string() }),
    data,
    error
  );
}

/*
 * ⚠ UN DÉCODEUR LOCAL, ET NON CELUI DE `content.ts`. Le sien n'est pas
 * exporté, et l'exporter pour ce fichier voudrait dire l'élargir pour un
 * usage qui n'est pas le sien. Celui-ci fait la même chose sur le même
 * contrat d'enveloppe : `{error:{code,message}}` ou la forme attendue.
 */
const rpcErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

function decodeRpc<T>(
  context: string,
  schema: z.ZodType<T>,
  data: unknown,
  error: { message: string; code?: string | null } | null
): ContentResult<T> {
  if (error) {
    console.error(`[content] ${context}: rpc failed`, {
      code: error.code ?? null,
      message: error.message,
    });
    return {
      ok: false,
      code: "server_error",
      message: "Something went wrong. Try again.",
      status: 500,
      detail: `${context}: ${error.code ?? "?"} ${error.message}`,
    };
  }

  const refusal = rpcErrorSchema.safeParse(data);
  if (refusal.success) {
    const code = refusal.data.error.code;
    return {
      ok: false,
      code,
      message: refusal.data.error.message,
      status: contentStatusForCode(code),
    };
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`[content] ${context}: shape`, parsed.error.issues.slice(0, 4));
    return {
      ok: false,
      code: "schema_mismatch",
      message: "Eklio is reading this with a newer plan than the database has.",
      status: contentStatusForCode("schema_mismatch"),
      detail: `${context} — ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    };
  }
  return { ok: true, data: parsed.data };
}
