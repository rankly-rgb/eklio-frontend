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
  ProperNounIntroducedError,
  REPHRASABLE_FIELDS,
  REPHRASE_MIN_CHARS,
  rephrase,
} from "@/lib/generation/rephrase";
import { resolveBriefCaller } from "@/lib/anon/session";
import { consumeAnonSpend, noBriefResponse } from "@/lib/anon/spend";

/*
 * POST /api/briefs/[id]/rephrase — « Help me say it » (§2.1), pas « Write it
 * for me ». `loadBrief` scope la lecture à l'appelante : un brief d'autrui
 * répond 404, comme le reste de cette surface (§7) — pas de service-role ici,
 * cette route n'appelle aucune des trois RPC verrouillées du contrat.
 *
 * ⚠ ANONYME, ET COMPTÉE. Un appel modèle de plus sur le chemin gratuit : il
 * passe par le plafond `assist`, comme `suggest`, `tone-cards` et
 * `usp-options`.
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
  const caller = await resolveBriefCaller();
  if (caller.kind === "none") return noBriefResponse();

  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return badRequest(
      `Write a line first — we'll tighten it, not invent it.`
    );
  }

  const bundle = await loadBrief(caller.supabase, id, caller.userId);
  if (!bundle) return notFound();

  // Le plafond après le 404 : refuser un brief qui n'est pas le sien ne doit
  // pas coûter un compte à quelqu'un d'autre.
  if (caller.kind === "anon") {
    const refusal = await consumeAnonSpend("assist", request);
    if (refusal) return refusal;
  }

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
