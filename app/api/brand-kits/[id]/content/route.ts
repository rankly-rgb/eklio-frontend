import { NextResponse } from "next/server";
import { z } from "zod";
import type { Session } from "@/lib/api/handler";
import { authenticate, badRequest, notFound, readJson, serverError } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { contentResponse } from "@/lib/content/respond";
import {
  CONTENT_ARCHETYPES,
  contentMonthKey,
  createContentItem,
  getContentMonth,
} from "@/lib/data/content";

/*
 * GET  /api/brand-kits/[id]/content?month=YYYY-MM-01 — the month's calendar.
 * POST /api/brand-kits/[id]/content                  — a new empty item.
 *
 * Neither generates anything. Creating an item creates a row with an
 * archetype and, optionally, a date; every word in it is typed by her
 * afterwards. Nothing on this path touches `consume_generation_credit` or the
 * image budget, and a test asserts that rather than trusting this comment.
 */
export const runtime = "nodejs";

const createSchema = z.object({
  archetype: z.enum(CONTENT_ARCHETYPES),
  scheduled_for: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Give a date as YYYY-MM-DD.")
    .nullable()
    .optional(),
});

/** The kit is hers and paid for, or this returns the response to send instead. */
async function guard(id: string, session: Session) {
  const kit = await loadBrandKit(session.supabase, id, session.userId);
  if (!kit) return { ok: false as const, response: notFound() };

  if (!(await isBrandKitEntitled(session.supabase, id))) {
    const reversed = await purchaseWasReversed(session.supabase, kit.projectId);
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: lockedMessage(reversed),
          checkoutUrl: `/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`,
        },
        { status: 402 }
      ),
    };
  }

  return { ok: true as const };
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/content">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const gate = await guard(id, auth.session);
  if (!gate.ok) return gate.response;

  const raw = new URL(request.url).searchParams.get("month");
  const month = raw ?? contentMonthKey(new Date());
  if (!/^\d{4}-\d{2}-01$/.test(month)) {
    return badRequest("Ask for a month as YYYY-MM-01.");
  }

  try {
    return contentResponse(await getContentMonth(auth.session.supabase, id, month));
  } catch (error) {
    return serverError("GET /api/brand-kits/[id]/content", error);
  }
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/content">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const gate = await guard(id, auth.session);
  if (!gate.ok) return gate.response;

  const body = createSchema.safeParse(await readJson(request));
  if (!body.success) {
    return badRequest(body.error.issues[0]?.message ?? "Say which kind of post this is.");
  }

  try {
    return contentResponse(
      await createContentItem(
        auth.session.supabase,
        id,
        body.data.archetype,
        body.data.scheduled_for ?? null
      )
    );
  } catch (error) {
    return serverError("POST /api/brand-kits/[id]/content", error);
  }
}
