import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  badRequest,
  json,
  notFound,
  readJson,
  serverError,
} from "@/lib/api/handler";
import { loadBrief } from "@/lib/data/brief";
import {
  GenerationNotImplementedError,
  suggestFieldText,
} from "@/lib/generation/pipeline";
import { resolveBriefCaller } from "@/lib/anon/session";
import { consumeAnonSpend, noBriefResponse } from "@/lib/anon/spend";

/*
 * POST /api/briefs/[id]/suggest — « Write it for me ».
 *
 * Le champ demandé est validé contre une liste fermée : cette route appelle un
 * modèle, et un nom de champ libre en ferait un point d'injection de prompt.
 *
 * ⚠ ANONYME, ET COMPTÉE. C'est le bouton que le lot mobile vient de rendre
 * tapable — donc celui qu'une visiteuse va presser, et un appel modèle par
 * pression. Il passe par le plafond `assist`.
 */

const SUGGESTABLE_FIELDS = [
  "positioning",
  "problem_text",
  "gain_text",
  "practitioner_line",
] as const;

const bodySchema = z.object({
  field: z.enum(SUGGESTABLE_FIELDS),
});

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/briefs/[id]/suggest">
) {
  const caller = await resolveBriefCaller();
  if (caller.kind === "none") return noBriefResponse();

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("We can't draft that field.");

  const bundle = await loadBrief(caller.supabase, id, caller.userId);
  if (!bundle) return notFound();

  // Le plafond après le 404, pour la même raison que dans `rephrase`.
  if (caller.kind === "anon") {
    const refusal = await consumeAnonSpend("assist", request);
    if (refusal) return refusal;
  }

  try {
    const text = await suggestFieldText({
      supabase: caller.supabase,
      projectId: id,
      userId: caller.userId,
      field: parsed.data.field,
    });
    return json({ text });
  } catch (error) {
    if (error instanceof GenerationNotImplementedError) {
      return json(
        { error: "Drafting isn't available yet. Write it in your own words." },
        { status: 503 }
      );
    }
    return serverError("POST /api/briefs/suggest", error);
  }
}
