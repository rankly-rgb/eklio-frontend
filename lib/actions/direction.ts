"use server";

import { revalidatePath } from "next/cache";

import { selectDirection } from "@/lib/eklio/rpc";
import type { EklioErrorCode } from "@/lib/eklio/errors";

/**
 * Choisir une direction est le premier geste payant.
 *
 * On ne pré-vérifie pas l'entitlement ici : la RPC gardée a déjà décidé, et
 * une seconde copie de la règle dans une route est une copie qui dérive. On
 * lit son code de retour pour savoir quoi RENDRE — un checkout, ou des excuses.
 */
export async function chooseDirection(
  brandKitId: string,
  directionId: string
): Promise<{ ok: true } | { ok: false; code: EklioErrorCode; message: string }> {
  const result = await selectDirection(brandKitId, directionId);

  if (!result.ok) {
    return { ok: false, code: result.error.code, message: result.error.message };
  }

  revalidatePath("/app");
  revalidatePath("/app/kit");
  return { ok: true };
}
