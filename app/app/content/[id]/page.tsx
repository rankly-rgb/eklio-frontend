import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { getContentItem } from "@/lib/data/content";
import { loadImageContext } from "@/lib/images/context";
import { computeImageFingerprint } from "@/lib/images/fingerprint";
import { getBrandImages } from "@/lib/images/rpc";
import { ItemEditor } from "@/components/content/item-editor";
import { Breadcrumb } from "@/components/app/breadcrumb";

/*
 * /app/content/[id] — one item, edited in place.
 *
 * The refusal codes come from the database, in the order it decides them: an
 * item that is not hers is a 404 here, exactly as it is over HTTP, and an
 * unpaid kit is a trip to checkout rather than an empty screen.
 *
 * The photograph is READ, never requested. If `brand_images` already holds a
 * current, ready row for the slot this item names, its signed URL is handed to
 * `<PhotoSlot>`; otherwise the same component renders its gradient. Nothing on
 * this page can cause an image to be generated.
 */
export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 300;

export default async function ContentItemPage({ params }: PageProps<"/app/content/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/content/${id}`);

  const result = await getContentItem(supabase, id);
  if (!result.ok) {
    if (result.code === "payment_required") redirect("/app/checkout");
    notFound();
  }

  const item = result.data;
  const kit = await loadBrandKit(supabase, item.brand_kit_id, user.id);
  if (!kit) notFound();

  const palette = kit.selectedDirection?.palette ?? kit.directions?.[0]?.palette ?? null;
  const tokens = {
    primary: palette?.primary ?? "#2B2724",
    dark_neutral: palette?.dark ?? "#2B2724",
  };

  const photoUrl = await currentPhotoUrl(supabase, kit, item.image_slot);

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <Breadcrumb
        items={[
          { label: "Content", href: "/app/content" },
          { label: item.title ?? "Untitled" },
        ]}
      />

      <h1 className="mt-4 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
        {item.title ?? "Untitled"}
      </h1>

      <ItemEditor item={item} tokens={tokens} photoUrl={photoUrl} />
    </main>
  );
}

/**
 * The signed URL for this item's slot, or `null`.
 *
 * `null` covers every honest case at once: no slot chosen, no photograph
 * generated, a photograph that is stale against the kit's current fingerprint,
 * or one that failed. `<PhotoSlot>` renders the same gradient for all of them,
 * which is what it is for.
 */
async function currentPhotoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kit: NonNullable<Awaited<ReturnType<typeof loadBrandKit>>>,
  slot: string | null
): Promise<string | null> {
  if (!slot) return null;

  const context = await loadImageContext(supabase, kit);
  if (!context.ok) return null;

  const rows = await getBrandImages(supabase, kit.row.id, computeImageFingerprint(context.input));
  const row = rows.find((entry) => entry.slot === slot);
  if (!row?.current || !row.storage_path) return null;

  const signed = await supabase.storage
    .from("brand-assets")
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  return signed.data?.signedUrl ?? null;
}
