"use server";

import { revalidatePath } from "next/cache";

import { siteOutputGet, siteOutputMarkCopied } from "@/lib/eklio/rpc";
import type { EklioErrorCode } from "@/lib/eklio/errors";

export type OutputResult =
  | { ok: true; target: string; text: string }
  | { ok: false; code: EklioErrorCode; message: string };

/** Le livrable, dans la cible demandée. Payant : la sortie EST le produit. */
export async function loadOutput(brandKitId: string, target: string): Promise<OutputResult> {
  const result = await siteOutputGet(brandKitId, target, "md");
  if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message };

  const payload = result.data as { target?: string; text?: string } | null;
  if (!payload?.text) {
    return { ok: false, code: "not_found", message: "There is no output for this kit yet." };
  }
  return { ok: true, target: payload.target ?? target, text: payload.text };
}

/**
 * Marque la copie. C'est la seule action qui bouge `last_copied_spec_version`,
 * et donc la seule qui éteint la bannière « votre copie est périmée ».
 */
export async function markCopied(brandKitId: string): Promise<boolean> {
  const result = await siteOutputMarkCopied(brandKitId);
  if (result.ok) revalidatePath("/app/kit");
  return result.ok;
}
