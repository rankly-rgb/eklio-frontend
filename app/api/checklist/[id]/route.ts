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
import { LAUNCH_STEP_KEYS, setLaunchStep } from "@/lib/data/checklist";
import { track } from "@/lib/analytics";

/*
 * PATCH /api/checklist/[id] — sets one "Your first week" step to
 * done/todo/skipped. `[id]` is the brand kit id (`set_launch_step`'s own
 * ownership check resolves it through `brand_kits -> projects`, the same
 * way every other brand-kit-scoped route does).
 */

const bodySchema = z.object({
  key: z.enum(LAUNCH_STEP_KEYS),
  status: z.enum(["todo", "done", "skipped"]),
});

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/checklist/[id]">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id: brandKitId } = await ctx.params;
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("That change couldn't be saved.");

  const outcome = await setLaunchStep(
    auth.session.supabase,
    brandKitId,
    parsed.data.key,
    parsed.data.status
  );

  if (outcome.ok) {
    if (parsed.data.status === "done") {
      track("checklist_item_completed", { key: parsed.data.key });
    }
    return json({ ok: true });
  }
  if (outcome.reason === "not-found") return notFound();
  return serverError("PATCH /api/checklist", outcome.detail);
}
