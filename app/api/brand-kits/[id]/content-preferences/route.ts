import { z } from "zod";
import { authenticate, badRequest, readJson, serverError } from "@/lib/api/handler";
import { contentResponse } from "@/lib/content/respond";
import {
  CONTENT_CADENCES,
  CONTENT_REGISTERS,
  setContentPreferences,
} from "@/lib/data/content";

/*
 * Her content preferences: asked once, editable from Settings forever after.
 *
 * The entitlement check is the database's. `set_content_preferences` calls
 * `content_kit_access`, which answers `not_found` for a stranger's kit BEFORE
 * `payment_required` for an unpaid one — a 402 to a stranger would confirm the
 * kit exists. One place to get that ordering right.
 *
 * ⚠ THE VALUES ARE VALIDATED IN BOTH DIRECTIONS AND THAT IS NOT DUPLICATION.
 * Zod refuses a register this build has never heard of, so a stale client gets
 * a sentence instead of a 500; the database's trigger refuses one that is not
 * in `content_registers`, which is the authority. The two disagree only while
 * a deploy is in flight, and in that window the stricter one wins.
 */
export const runtime = "nodejs";

const bodySchema = z.object({
  cadence_per_week: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  accepted_registers: z
    .array(z.enum(CONTENT_REGISTERS))
    .min(1, "Leave at least one kind of post on, or there is nothing to write."),
  off_limits: z.string().max(500, "Keep that under 500 characters.").nullable(),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/content-preferences">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) {
    return badRequest(body.error.issues[0]?.message ?? "Those settings could not be saved.");
  }

  // Kept honest: the literal union above and the closed cadence list are the
  // same three values, and a fourth cadence sold must break here loudly.
  if (!CONTENT_CADENCES.includes(body.data.cadence_per_week)) {
    return badRequest("That posting frequency is not one we offer.");
  }

  try {
    return contentResponse(
      await setContentPreferences(auth.session.supabase, {
        brandKitId: id,
        cadencePerWeek: body.data.cadence_per_week,
        acceptedRegisters: [...body.data.accepted_registers],
        offLimits: body.data.off_limits,
      })
    );
  } catch (error) {
    return serverError("POST /api/brand-kits/[id]/content-preferences", error);
  }
}
