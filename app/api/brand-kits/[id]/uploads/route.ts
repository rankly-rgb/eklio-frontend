import { surfaceRefusal } from "@/lib/api/surface-guard";
import { resolveEntitledTier } from "@/lib/billing/entitlements";
import { NextResponse } from "next/server";
import { authenticate, badRequest, notFound, serverError } from "@/lib/api/handler";
import { isBrandKitEntitled, lockedMessage, purchaseWasReversed } from "@/lib/billing/entitlements";
import { loadBrandKit } from "@/lib/data/brand-kit";
import {
  UPLOAD_KINDS,
  listUserUploads,
  recordUserUpload,
  requestUserUpload,
  type UploadKind,
  type UploadResult,
} from "@/lib/data/uploads";
import { claimedTypeFor, safeFileName, sniff } from "@/lib/uploads/sniff";
import { sanitizeSvg } from "@/lib/uploads/svg";

/*
 * GET  /api/brand-kits/[id]/uploads — her files, with short-lived read URLs.
 * POST /api/brand-kits/[id]/uploads — one file, validated by its BYTES.
 *
 * ── THE ORDER MATTERS, AND THIS IS IT ───────────────────────────────────
 *
 *   1. Read the bytes.
 *   2. SNIFF them. The extension and the declared Content-Type are claims by
 *      whoever sent the file; the signature is evidence. Nothing after this
 *      point uses the claim for anything except telling her it disagreed.
 *   3. If it is an SVG, SANITISE it, and upload the sanitised bytes. The
 *      original is never stored, not even briefly.
 *   4. Ask the database for a path and a quota decision, with the SNIFFED type
 *      and the SANITISED size.
 *   5. Upload, then record. The record call re-checks the quota, because these
 *      are two calls and the quota can move between them.
 *
 * Step 4 before step 5 is what makes the quota real: the ceiling is enforced
 * by the database on the numbers it was given, not by the browser.
 *
 * Nothing here generates anything, and nothing here fingerprints anything: her
 * files are not derived from her palette, so a colour change must never mark
 * her own portrait stale.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "user-uploads";
const READ_URL_TTL_SECONDS = 300;

function refusal<T>(result: Extract<UploadResult<T>, { ok: false }>) {
  return NextResponse.json({ error: result.message }, { status: result.status });
}

export async function GET(_request: Request, ctx: RouteContext<"/api/brand-kits/[id]/uploads">) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
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

  /*
   * Starter. Uploads are bounded by a QUOTA, not by a tier — 10 MiB a file,
   * 50 MiB and 24 files a kit, all in `app_settings` and enforced by the RPC
   * below. The consult is here so that if the quota ever becomes per-tier,
   * this route is already asking the right question of the right place.
   */
  const uploadRefusal = surfaceRefusal(
    "own_uploads",
    await resolveEntitledTier(supabase, kit.projectId),
    kit.projectId
  );
  if (uploadRefusal) return uploadRefusal;

  try {
    const listed = await listUserUploads(supabase, id);
    if (!listed.ok) return refusal(listed);

    const files = await Promise.all(
      listed.data.files.map(async (file) => {
        const signed = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(file.storage_path, READ_URL_TTL_SECONDS);
        // Short-lived and never persisted: the URL is for this render only.
        return { ...file, url: signed.data?.signedUrl ?? null };
      })
    );

    return NextResponse.json({ files, quota: listed.data.quota });
  } catch (error) {
    return serverError("GET /api/brand-kits/[id]/uploads", error);
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/brand-kits/[id]/uploads">) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
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

  /*
   * Starter. Uploads are bounded by a QUOTA, not by a tier — 10 MiB a file,
   * 50 MiB and 24 files a kit, all in `app_settings` and enforced by the RPC
   * below. The consult is here so that if the quota ever becomes per-tier,
   * this route is already asking the right question of the right place.
   */
  const uploadRefusal = surfaceRefusal(
    "own_uploads",
    await resolveEntitledTier(supabase, kit.projectId),
    kit.projectId
  );
  if (uploadRefusal) return uploadRefusal;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Send the file as form data.");
  }

  const kind = String(form.get("kind") ?? "");
  if (!(UPLOAD_KINDS as readonly string[]).includes(kind)) {
    return badRequest("Say what kind of file this is.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("Choose a file.");

  try {
    // 1 & 2 — the bytes, and what they actually are.
    let bytes = new Uint8Array(await file.arrayBuffer());
    const claimed = claimedTypeFor(file.name, file.type || null);
    const sniffed = sniff(bytes, claimed);

    if (!sniffed.ok) {
      return NextResponse.json(
        {
          error:
            sniffed.reason === "empty"
              ? "That file is empty."
              : "That kind of file cannot be uploaded here. Use a JPEG, PNG, WebP, SVG or PDF.",
        },
        { status: 415 }
      );
    }

    // 3 — an SVG is a document; strip what makes it one before it is stored.
    let removed: string[] = [];
    if (sniffed.mimeType === "image/svg+xml") {
      const sanitized = sanitizeSvg(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
      if (!sanitized.ok) {
        return NextResponse.json(
          {
            error:
              sanitized.reason === "entities"
                ? "That SVG declares XML entities, which cannot be made safe. Export it again without them."
                : "That file says it is an SVG but does not read as one.",
          },
          { status: 415 }
        );
      }
      bytes = new TextEncoder().encode(sanitized.svg);
      removed = sanitized.removed;
    }

    // 4 — the path and the quota, decided by the database on the real numbers.
    const requested = await requestUserUpload(
      supabase,
      id,
      kind as UploadKind,
      sniffed.mimeType,
      bytes.byteLength
    );
    if (!requested.ok) return refusal(requested);

    // 5 — upload, then record. The storage policy is the real boundary here:
    // it reads the kit id out of the path and asks brand_kit_entitled.
    const uploaded = await supabase.storage.from(BUCKET).upload(requested.data.path, bytes, {
      contentType: sniffed.mimeType,
      upsert: false,
    });
    if (uploaded.error) {
      return serverError("POST /api/brand-kits/[id]/uploads", uploaded.error);
    }

    const recorded = await recordUserUpload(supabase, {
      brandKitId: id,
      id: requested.data.id,
      kind: kind as UploadKind,
      storagePath: requested.data.path,
      mimeType: sniffed.mimeType,
      byteSize: bytes.byteLength,
      originalName: safeFileName(file.name),
    });

    if (!recorded.ok) {
      // The row was refused, so the object must not survive it: an orphan in
      // the bucket counts against nothing and can never be deleted from the UI.
      await supabase.storage.from(BUCKET).remove([requested.data.path]);
      return refusal(recorded);
    }

    // Replacing a portrait leaves the old object behind unless it goes here.
    if (recorded.data.replaced_path) {
      await supabase.storage.from(BUCKET).remove([recorded.data.replaced_path]);
    }

    return NextResponse.json({
      id: recorded.data.id,
      mimeType: sniffed.mimeType,
      // Both told plainly rather than silently: she should know her file was
      // not what it claimed, and what was taken out of it.
      mismatched: sniffed.mismatched,
      removed,
    });
  } catch (error) {
    return serverError("POST /api/brand-kits/[id]/uploads", error);
  }
}
