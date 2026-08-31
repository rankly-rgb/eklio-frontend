import "server-only";

import { createClient } from "@/lib/supabase/server";
import { envelopeError, type EklioError } from "@/lib/eklio/errors";
import type { Json } from "@/types/supabase";

/**
 * Le seul chemin d'appel des RPC Eklio.
 *
 * ⚠ Toujours avec le JWT de l'utilisatrice, jamais avec service_role :
 * `auth.uid()` vaut NULL sur une connexion service_role, et TOUTES ces
 * fonctions sont cadrées dessus. Un appel service_role ne reçoit pas les
 * données de quelqu'un d'autre — il ne marche simplement pas
 * (`unauthenticated`). Le client admin est réservé au webhook Stripe, qui
 * appelle `grant_plan_allowance` et rien d'autre.
 *
 * ⚠ Ne jamais écrire une signature à la main. Tout passe par `Database`,
 * généré depuis la base : un type écrit à la main et un test écrit depuis ce
 * même type sont d'accord entre eux et faux tous les deux.
 */

export type RpcResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: EklioError };

function transportError(message: string): EklioError {
  // PostgREST a refusé avant même d'atteindre la fonction (réseau, JWT
  // expiré, fonction absente). Pas une erreur métier, mais elle doit
  // remonter dans la même forme pour n'avoir qu'un seul chemin d'affichage.
  return { code: "not_found", message };
}

async function call<T>(
  fn: Parameters<Awaited<ReturnType<typeof createClient>>["rpc"]>[0],
  args?: Record<string, unknown>
): Promise<RpcResult<T>> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args);

  if (error) return { ok: false, data: null, error: transportError(error.message) };

  const enveloped = envelopeError(data);
  if (enveloped) return { ok: false, data: null, error: enveloped };

  return { ok: true, data: data as T, error: null };
}

/** L'unique définition de « elle a payé pour ce kit ». Ne pas la recopier. */
export async function brandKitEntitled(brandKitId: string): Promise<boolean> {
  const result = await call<boolean>("brand_kit_entitled", {
    p_brand_kit_id: brandKitId,
  });
  return result.ok && result.data === true;
}

/**
 * À appeler IMMÉDIATEMENT avant l'appel au modèle, et ne pas faire l'appel
 * quand elle rend false.
 *
 * ⚠ Lire `generation_credits` et décider depuis les nombres est une course :
 * deux POST concurrents lisent le même compte et passent tous les deux. Cette
 * fonction prend le verrou de ligne et décide dans un seul statement. Les
 * compteurs sont lisibles pour AFFICHER ce qui reste, pas pour décider.
 */
export async function consumeGenerationCredit(brandKitId: string): Promise<boolean> {
  const result = await call<boolean>("consume_generation_credit", {
    p_brand_kit_id: brandKitId,
  });
  return result.ok && result.data === true;
}

/** Payant. Rend `payment_required` tant que le kit n'est pas acheté. */
export async function selectDirection(brandKitId: string, directionId: string) {
  return call<Record<string, Json>>("brand_kit_select_direction", {
    p_brand_kit_id: brandKitId,
    p_direction_id: directionId,
  });
}

/** Payant — la sortie EST le livrable, donc même la lecture refuse. */
export async function siteOutputGet(
  brandKitId: string,
  target: string,
  format: "json" | "md" | "txt" = "md"
) {
  return call<Json>("site_output_get", {
    p_brand_kit_id: brandKitId,
    p_target: target,
    p_format: format,
  });
}

/** Payant. C'est ce qui éteint la bannière « votre copie est périmée ». */
export async function siteOutputMarkCopied(brandKitId: string) {
  return call<Record<string, Json>>("site_output_mark_copied", {
    p_brand_kit_id: brandKitId,
  });
}

/** Gratuit — il décrit le produit qu'on lui demande d'acheter. */
export async function siteCatalog() {
  return call<Json>("site_catalog");
}

/**
 * Toute la preview du brief en un aller-retour. SECURITY INVOKER : le brief
 * d'une autre rend NULL, jamais une preview qui n'est pas la sienne.
 */
export async function briefPreview(projectId: string) {
  return call<Json>("brief_preview", { p_brief_id: projectId });
}

/** Les bornes de longueur des directions, publiées par la base. */
export async function directionLimits() {
  return call<Json>("direction_limits");
}
