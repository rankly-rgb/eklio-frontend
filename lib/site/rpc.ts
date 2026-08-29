import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  SiteCatalog,
  SiteErrorBody,
  SiteErrorCode,
  SiteOutput,
  SiteSpecEnvelope,
} from "@/lib/site/types";

/*
 * La couche d'appel de l'éditeur de site (§1 du FRONTEND_CONTRACT).
 *
 * ── LE JWT DE L'UTILISATRICE, TOUJOURS ───────────────────────────────────
 *
 * `auth.uid()` est ce qui cadre ces huit fonctions. Le client passé ici est
 * TOUJOURS celui de `lib/supabase/server.ts` — clé anon + cookies de session,
 * donc jeton de l'appelante en `Authorization`. Sur une connexion
 * `service_role`, `auth.uid()` vaut NULL et TOUTE écriture répond
 * `unauthenticated` : ce n'est pas une faille, c'est une panne. D'où le type
 * ci-dessous, qui n'accepte qu'un client de session, et le test statique de
 * `lib/site/__tests__/routes.test.ts`, qui vérifie qu'aucune route de
 * l'éditeur n'importe `createAdminClient`.
 *
 * ── RENVOYER CE QUI ARRIVE ───────────────────────────────────────────────
 *
 * La fonction Postgres compose l'enveloppe entière. On la caste, on ne la
 * reparse pas : un `z.object()` retirerait toute clé ajoutée en base après ce
 * déploiement. Le SEUL contrôle à l'exécution est `isSiteError`, parce que
 * c'est la seule branche où le front doit décider quelque chose.
 */

type Client = SupabaseClient<Database>;

export type SiteRpcOk<T> = { ok: true; data: T };
export type SiteRpcFailure = { ok: false; error: SiteErrorBody; status: number };
export type SiteRpcResult<T> = SiteRpcOk<T> | SiteRpcFailure;

/**
 * Le code d'état HTTP d'un code d'erreur du contrat.
 *
 * `no_fix_needed` est un 409 et non un 400 : le contrat dit que ce n'est pas
 * une erreur que l'utilisatrice a causée — la paire passait déjà. Le client le
 * traite en NO-OP, pas en échec, et un code à part est ce qui lui permet de
 * faire la différence sans lire le message.
 */
const STATUS: Record<SiteErrorCode, number> = {
  unauthenticated: 401,
  not_found: 404,
  no_fix_needed: 409,
  too_long: 400,
  invalid_body: 400,
  invalid_field: 400,
  invalid_scope: 400,
  unknown_field: 400,
  invalid_format: 400,
  invalid_target: 400,
  no_direction: 400,
};

/** L'enveloppe d'erreur du contrat : `{"error":{"code","message","field"?}}`. */
export function isSiteError(value: unknown): value is { error: SiteErrorBody } {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

/**
 * Un appel RPC, résolu en succès typé ou en erreur du contrat.
 *
 * `error` côté PostgREST (transport, contrainte, fonction absente) et `error`
 * DANS le corps sont deux choses différentes : la seconde est un refus prévu
 * par le contrat, la première une panne. Les deux remontent ici sous la même
 * forme, mais la panne garde son 500 et est journalisée.
 */
async function call<T>(
  supabase: Client,
  fn:
    | "site_spec_get"
    | "site_spec_patch"
    | "site_spec_reset"
    | "site_spec_set_target"
    | "site_output_get"
    | "site_output_mark_copied"
    | "site_spec_fix_contrast"
    | "site_catalog",
  args: Record<string, unknown>
): Promise<SiteRpcResult<T>> {
  const { data, error } = await supabase.rpc(
    fn,
    args as never
  );

  if (error) {
    console.error(`[site] ${fn}`, error);
    return {
      ok: false,
      status: 500,
      error: {
        code: "not_found",
        message: "Something didn't go through on our side. Your spec is saved.",
      },
    };
  }

  if (isSiteError(data)) {
    return { ok: false, status: STATUS[data.error.code] ?? 400, error: data.error };
  }

  return { ok: true, data: data as T };
}

/* ── Les huit entrées ───────────────────────────────────────────────────── */

export function siteSpecGet(
  supabase: Client,
  brandKitId: string
): Promise<SiteRpcResult<SiteSpecEnvelope>> {
  return call(supabase, "site_spec_get", { p_brand_kit_id: brandKitId });
}

export function siteSpecPatch(
  supabase: Client,
  brandKitId: string,
  patch: unknown
): Promise<SiteRpcResult<SiteSpecEnvelope>> {
  return call(supabase, "site_spec_patch", {
    p_brand_kit_id: brandKitId,
    p_patch: patch,
  });
}

export function siteSpecReset(
  supabase: Client,
  brandKitId: string,
  scope: string
): Promise<SiteRpcResult<SiteSpecEnvelope>> {
  return call(supabase, "site_spec_reset", {
    p_brand_kit_id: brandKitId,
    p_scope: scope,
  });
}

export function siteSpecSetTarget(
  supabase: Client,
  brandKitId: string,
  target: string
): Promise<SiteRpcResult<SiteSpecEnvelope>> {
  return call(supabase, "site_spec_set_target", {
    p_brand_kit_id: brandKitId,
    p_target: target,
  });
}

/** La SEULE entrée qui ne renvoie pas l'enveloppe : la sortie, seule. */
export function siteOutputGet(
  supabase: Client,
  brandKitId: string,
  target: string,
  format: string
): Promise<SiteRpcResult<SiteOutput | string>> {
  return call(supabase, "site_output_get", {
    p_brand_kit_id: brandKitId,
    p_target: target,
    p_format: format,
  });
}

export function siteOutputMarkCopied(
  supabase: Client,
  brandKitId: string
): Promise<SiteRpcResult<SiteSpecEnvelope>> {
  return call(supabase, "site_output_mark_copied", {
    p_brand_kit_id: brandKitId,
  });
}

/**
 * Applique le correctif de contraste d'une paire.
 *
 * La suggestion est RECALCULÉE en base contre le spec tel qu'il est ; on ne
 * lui envoie donc jamais un hex venu du client. L'enveloppe renvoyée porte les
 * sept paires recalculées — c'est elle qu'il faut rendre, pas la paire cliquée.
 */
export function siteSpecFixContrast(
  supabase: Client,
  brandKitId: string,
  pairId: string
): Promise<SiteRpcResult<SiteSpecEnvelope>> {
  return call(supabase, "site_spec_fix_contrast", {
    p_brand_kit_id: brandKitId,
    p_pair_id: pairId,
  });
}

export function siteCatalog(
  supabase: Client
): Promise<SiteRpcResult<SiteCatalog>> {
  return call(supabase, "site_catalog", {});
}
