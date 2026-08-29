import type { NextRequest } from "next/server";
import { z } from "zod";
import { NextResponse } from "next/server";
import {
  authenticate,
  badRequest,
  json,
  notFound,
  readJson,
  serverError,
} from "@/lib/api/handler";
import { loadBrandKit, selectDirection } from "@/lib/data/brand-kit";
import { track } from "@/lib/analytics";

/*
 * POST /api/brand-kits/[id]/direction — retient une des trois directions.
 *
 * L'id est vérifié contre les directions du kit avant l'écriture : la base le
 * refuserait (`brand_kit_selection_valid`), mais un CHECK rejeté remonterait
 * en 500 sur l'écran où le praticien vient de choisir.
 *
 * ⚠ CE N'EST PLUS CETTE ROUTE QUI LAISSE ENTRER. La barrière de paiement est
 * en base : elle refuse l'écriture, et la route ne fait que SURFACER ce refus
 * en 402 avec l'adresse du checkout. Avant, `paid` était un `if` dans un
 * composant client au-dessus d'une route ouverte — un seul `fetch` passait à
 * côté, et le kit, le PDF et l'éditeur de site s'ouvraient derrière.
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
    track("direction_chosen", { brandKitId: id });
    return json({
      selectedDirectionId: outcome.kit.row.selected_direction_id,
    });
  }
  if (outcome.reason === "payment-required") {
    /*
     * 402, avec l'adresse du checkout dans le corps : le client n'a pas à
     * savoir composer l'URL, et la réponse dit comment continuer plutôt que ce
     * qui a échoué.
     */
    const kit = await loadBrandKit(auth.session.supabase, id, auth.session.userId);
    return NextResponse.json(
      {
        error: "This one's ready when you are.",
        checkoutUrl: kit ? `/app/checkout?project=${kit.projectId}` : "/pricing",
      },
      { status: 402 }
    );
  }
  if (outcome.reason === "not-found") return notFound();
  if (outcome.reason === "unknown-direction") {
    return badRequest("That direction is no longer on this kit. Reload the page.");
  }
  return serverError("POST /api/brand-kits/direction", outcome.detail);
}
