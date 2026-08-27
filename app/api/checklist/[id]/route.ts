import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  authenticate,
  badRequest,
  json,
  notFound,
  readJson,
  serverError,
} from "@/lib/api/handler";
import { toggleChecklistItem } from "@/lib/data/checklist";
import { track } from "@/lib/analytics";

/* PATCH /api/checklist/[id] — coche ou décoche un item de la checklist. */

const bodySchema = z.object({ done: z.boolean() });

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/checklist/[id]">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("That change couldn't be saved.");

  const outcome = await toggleChecklistItem(
    auth.session.supabase,
    id,
    auth.session.userId,
    parsed.data.done
  );

  if (outcome.ok) {
    if (parsed.data.done) {
      // La CLÉ de l'item, pas son libellé : le libellé est de la copy.
      track("checklist_item_completed", { key: outcome.item.key });
    }
    return json({ item: outcome.item });
  }
  if (outcome.reason === "not-found") return notFound();
  return serverError("PATCH /api/checklist", outcome.detail);
}
