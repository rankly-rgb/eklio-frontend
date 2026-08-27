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
import { selectDirection } from "@/lib/data/brand-kit";

/*
 * POST /api/brand-kits/[id]/direction — retient une des trois directions.
 *
 * L'id est vérifié contre les directions du kit avant l'écriture : la base le
 * refuserait (`brand_kit_selection_valid`), mais un CHECK rejeté remonterait
 * en 500 sur l'écran où le praticien vient de choisir.
 */

const bodySchema = z.object({ directionId: z.string().min(1) });

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/brand-kits/[id]/direction">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("Pick one of the three directions.");

  const outcome = await selectDirection(
    auth.session.supabase,
    id,
    auth.session.userId,
    parsed.data.directionId
  );

  if (outcome.ok) {
    return json({
      selectedDirectionId: outcome.kit.row.selected_direction_id,
    });
  }
  if (outcome.reason === "not-found") return notFound();
  if (outcome.reason === "unknown-direction") {
    return badRequest("That direction is no longer on this kit. Reload the page.");
  }
  return serverError("POST /api/brand-kits/direction", outcome.detail);
}
