import { z } from "zod";
import { authenticate, badRequest, json, readJson, serverError } from "@/lib/api/handler";
import { track } from "@/lib/analytics";

/*
 * POST /api/search — ⌘K's data source. One RPC (app_search,
 * eklio-backend, 20260905175503), server-side, no client-side full scan.
 * Scoped to the current page's brand kit; content_items and ethics_checks
 * don't exist yet (Lots 6/7), so their result arrays just don't appear.
 */

const bodySchema = z.object({
  brandKitId: z.string().uuid(),
  query: z.string().max(200),
});

export type SearchAssetResult = { key: string; group: string; label: string };
export type SearchLaunchStepResult = { key: string; label: string; status: string };

export async function POST(request: Request) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest("A brand kit id and query are required.");

  const { data, error } = await auth.session.supabase.rpc("app_search", {
    p_brand_kit_id: parsed.data.brandKitId,
    p_query: parsed.data.query,
  });

  if (error) return serverError("POST /api/search", error);
  if (data && typeof data === "object" && "error" in (data as object)) {
    return json({ assets: [], launch_steps: [] });
  }

  track("search_used", { scope: "brand_kit" });

  const result = data as { assets?: SearchAssetResult[]; launch_steps?: SearchLaunchStepResult[] };
  return json({ assets: result.assets ?? [], launch_steps: result.launch_steps ?? [] });
}
