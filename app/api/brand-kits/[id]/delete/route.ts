import { authenticate, json, notFound, serverError } from "@/lib/api/handler";
import { deleteBrandKit } from "@/lib/data/brand-kit";

/*
 * POST /api/brand-kits/[id]/delete — soft-deletes the caller's own kit
 * (Lot 9). Free, not paid: an unpaid or reversed kit must still be
 * deletable, so this never checks `isBrandKitEntitled` (see
 * `app/__tests__/brand-kit-entitlement.test.ts`'s `FREE` allowlist).
 *
 * The typed-name confirmation ("type the practice name to confirm") is a
 * client-side safety net against a wrong click, not an authorization
 * check — `delete_brand_kit`'s own ownership check is the real boundary,
 * same split every destructive-action confirmation in this app already
 * uses (`components/site/reset-section.tsx`'s `ConfirmReset`).
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/delete">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const outcome = await deleteBrandKit(auth.session.supabase, id);

  if (outcome.ok) return json({ ok: true });
  if (outcome.reason === "not-found") return notFound();
  return serverError("POST /api/brand-kits/[id]/delete", null);
}
