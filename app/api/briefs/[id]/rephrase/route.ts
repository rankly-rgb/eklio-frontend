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
  ProperNounIntroducedError,
  REPHRASABLE_FIELDS,
  REPHRASE_MIN_CHARS,
  rephrase,
} from "@/lib/generation/rephrase";

/*
 * POST /api/briefs/[id]/rephrase — « Help me say it » (§2.1), pas « Write it
 * for me ». `loadBrief` scope la lecture à `userId` : un brief d'autrui répond
 * 404, comme le reste de cette surface (§7) — pas de service-role ici, cette
 * route n'appelle aucune des trois RPC verrouillées du contrat.
 */

const bodySchema = z.object({
  field: z.enum(REPHRASABLE_FIELDS),
  text: z.string().trim().min(REPHRASE_MIN_CHARS),
});

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/briefs/[id]/rephrase">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return badRequest(
      `Write a line first — we'll tighten it, not invent it.`
    );
  }

  const bundle = await loadBrief(auth.session.supabase, id, auth.session.userId);
  if (!bundle) return notFound();

  try {
    const text = await rephrase(parsed.data.field, parsed.data.text);
    return json({ text });
  } catch (error) {
    if (error instanceof ProperNounIntroducedError) {
      return json(
        {
          error:
            "That rewrite added something you didn't say. Try editing it yourself.",
        },
        { status: 422 }
      );
    }
    return serverError("POST /api/briefs/rephrase", error);
  }
}
