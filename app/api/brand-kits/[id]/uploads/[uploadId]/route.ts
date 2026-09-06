import { NextResponse } from "next/server";
import { authenticate, notFound, serverError } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { deleteUserUpload } from "@/lib/data/uploads";

/*
 * DELETE /api/brand-kits/[id]/uploads/[uploadId] — remove one of her files.
 *
 * The row goes first and returns its storage path, so the object goes with it.
 * A row without its object is a broken thumbnail; an object without its row is
 * bytes she is billed for and cannot see, which is worse.
 */
export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/brand-kits/[id]/uploads/[uploadId]">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id, uploadId } = await ctx.params;
  const { supabase, userId } = auth.session;

  const kit = await loadBrandKit(supabase, id, userId);
  if (!kit) return notFound();

  if (!(await isBrandKitEntitled(supabase, id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    return NextResponse.json(
      {
        error: lockedMessage(reversed),
        checkoutUrl: `/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`,
      },
      { status: 402 }
    );
  }

  try {
    const removed = await deleteUserUpload(supabase, uploadId);
    if (!removed.ok) {
      return NextResponse.json({ error: removed.message }, { status: removed.status });
    }

    const { error } = await supabase.storage.from("user-uploads").remove([removed.data.path]);
    if (error) console.error("[uploads] object remove", error);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return serverError("DELETE /api/brand-kits/[id]/uploads/[uploadId]", error);
  }
}
