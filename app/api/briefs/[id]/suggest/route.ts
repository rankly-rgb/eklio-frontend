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
import { loadBrief } from "@/lib/data/brief";
import {
  GenerationNotImplementedError,
  suggestFieldText,
} from "@/lib/generation/pipeline";

/*
 * POST /api/briefs/[id]/suggest — « Write it for me ».
 *
 * Le champ demandé est validé contre une liste fermée : cette route appelle un
 * modèle, et un nom de champ libre en ferait un point d'injection de prompt.
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
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("We can't draft that field.");

  const bundle = await loadBrief(auth.session.supabase, id, auth.session.userId);
  if (!bundle) return notFound();

  try {
    const text = await suggestFieldText({
      supabase: auth.session.supabase,
      projectId: id,
      userId: auth.session.userId,
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
