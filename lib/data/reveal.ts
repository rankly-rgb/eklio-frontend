import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { revealPayloadSchema, type RevealPayload } from "@/lib/brand/shapes";

/*
 * La charge utile de la révélation — un seul appel RPC, `brand_kit_reveal_get`
 * (eklio-backend), plutôt que le `.from("brand_kits")` + requête séparée sur
 * `project_briefs` que `loadBrandKit` fait encore pour la page de kit et
 * l'éditeur de site. Cette fonction NE remplace PAS `loadBrandKit` : elle
 * dessert uniquement la route de révélation, qui est la seule à avoir besoin
 * du résumé de contraste et de l'image d'ambiance par direction.
 *
 * Le jsonb renvoyé est RELU par `revealPayloadSchema` plutôt que casté, pour
 * la même raison que `lib/data/brand-kit.ts` : la base garantit sa forme à
 * l'écriture, pas un kit écrit avant une évolution de contrainte.
 */

type Client = SupabaseClient<Database>;

export type RevealPayloadOutcome =
  | { ok: true; payload: RevealPayload }
  | { ok: false; reason: "unauthenticated" | "not_found" | "invalid_response" };

type RpcErrorBody = { error?: { code?: string; message?: string; field?: string } };

function isErrorBody(value: unknown): value is RpcErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as RpcErrorBody).error === "object" &&
    (value as RpcErrorBody).error !== null
  );
}

export async function loadRevealPayload(
  supabase: Client,
  brandKitId: string
): Promise<RevealPayloadOutcome> {
  const { data, error } = await supabase.rpc("brand_kit_reveal_get", {
    p_brand_kit_id: brandKitId,
  });

  if (error) {
    console.error("[reveal] brand_kit_reveal_get", error);
    return { ok: false, reason: "invalid_response" };
  }

  if (isErrorBody(data)) {
    const code = data.error?.code;
    if (code === "unauthenticated" || code === "not_found") {
      return { ok: false, reason: code };
    }
    // `payment_required` cannot reach here — the RPC never returns it, the
    // reveal is free — but an unrecognised code is treated the same as a
    // shape failure rather than assumed to be one of the two known ones.
    console.error("[reveal] brand_kit_reveal_get error", data.error);
    return { ok: false, reason: "invalid_response" };
  }

  const parsed = revealPayloadSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[reveal] payload shape", parsed.error.issues);
    return { ok: false, reason: "invalid_response" };
  }

  return { ok: true, payload: parsed.data };
}
