import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { isBrandKitEntitled, purchaseWasReversed } from "@/lib/billing/entitlements";
import { listUserUploads } from "@/lib/data/uploads";
import { UploadsView, type UploadWithUrl } from "@/components/kit/uploads-view";
import { Breadcrumb } from "@/components/app/breadcrumb";

/*
 * /app/brand-kits/[id]/uploads — LOT 9, the portrait path.
 *
 * Her own files: a portrait, a logo she already had, a photograph, a document.
 * Nothing here is derived from her palette, so nothing here goes stale when it
 * changes — which is the one rule this whole lot exists to keep, and it is
 * enforced by the absence of a fingerprint column rather than by care.
 */
export const runtime = "nodejs";

const READ_URL_TTL_SECONDS = 300;

export default async function UploadsPage({
  params,
}: PageProps<"/app/brand-kits/[id]/uploads">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/app/brand-kits/${id}/uploads`);

  const kit = await loadBrandKit(supabase, id, user.id);
  if (!kit) notFound();

  if (!(await isBrandKitEntitled(supabase, id))) {
    const reversed = await purchaseWasReversed(supabase, kit.projectId);
    redirect(`/app/checkout?project=${kit.projectId}${reversed ? "&reversed=1" : ""}`);
  }

  const listed = await listUserUploads(supabase, id);
  const quota = listed.ok
    ? listed.data.quota
    : { files: 0, max_files: 24, bytes: 0, max_bytes: 52428800, max_file_bytes: 10485760 };

  const files: UploadWithUrl[] = listed.ok
    ? await Promise.all(
        listed.data.files.map(async (file) => {
          // Signed and short-lived, generated for this render and never stored.
          const signed = await supabase.storage
            .from("user-uploads")
            .createSignedUrl(file.storage_path, READ_URL_TTL_SECONDS);
          return { ...file, url: signed.data?.signedUrl ?? null };
        })
      )
    : [];

  return (
    <main className="route-enter flex-1 px-[var(--gutter)] pb-20 pt-6 max-md:px-[var(--gutter-sm)]">
      <Breadcrumb
        items={[
          { label: kit.practiceName ?? "Your brand", href: `/app/brand-kits/${id}` },
          { label: "Your files" },
        ]}
      />

      <h1 className="mt-4 font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
        Your files
      </h1>
      <p className="mt-3 max-w-[620px] text-body leading-prose text-ink-2">
        Your portrait, a logo you already had, anything else you want to keep with this brand.
      </p>

      <UploadsView brandKitId={id} files={files} quota={quota} />
    </main>
  );
}
