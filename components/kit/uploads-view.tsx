"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import {
  UPLOAD_KINDS,
  UPLOAD_KIND_LABELS,
  formatBytes,
  type UploadKind,
  type UserUpload,
} from "@/lib/data/uploads";

/*
 * ── HER OWN FILES ───────────────────────────────────────────────────────
 *
 * Everything on this screen was brought by her, which is why nothing on it
 * carries a "needs rebuilding" state. Her portrait does not go stale when she
 * changes an accent colour — that machinery belongs to files Eklio DERIVES
 * from her palette, and hers are not derived from anything.
 *
 * When the server finds a file is not what it claimed, or strips something out
 * of an SVG, it says so here rather than quietly succeeding. She uploaded it;
 * she should know what happened to it.
 */

export type UploadWithUrl = UserUpload & { url: string | null };

export type UploadQuota = {
  files: number;
  max_files: number;
  bytes: number;
  max_bytes: number;
  max_file_bytes: number;
};

type Notice =
  | { kind: "none" }
  | { kind: "error"; message: string }
  | { kind: "done"; mismatched: boolean; removed: string[] };

export function UploadsView({
  brandKitId,
  files,
  quota,
}: {
  brandKitId: string;
  files: UploadWithUrl[];
  quota: UploadQuota;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>({ kind: "none" });

  async function upload(kind: UploadKind, file: File) {
    setBusy(true);
    setNotice({ kind: "none" });

    const body = new FormData();
    body.set("kind", kind);
    body.set("file", file);

    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/uploads`, {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setNotice({ kind: "error", message: payload?.error ?? "That file could not be added." });
        return;
      }

      setNotice({
        kind: "done",
        mismatched: Boolean(payload?.mismatched),
        removed: Array.isArray(payload?.removed) ? payload.removed : [],
      });
      router.refresh();
    } catch {
      setNotice({ kind: "error", message: "That file could not be added. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/uploads/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setNotice({ kind: "error", message: "That file could not be removed." });
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 flex max-w-[860px] flex-col gap-8">
      <section className="flex flex-col gap-4">
        <MonoLabel tracking="16" as="h2">
          Add a file
        </MonoLabel>
        <p className="text-helper leading-prose text-ink-2">
          JPEG, PNG, WebP, SVG or PDF, up to {formatBytes(quota.max_file_bytes)} each. Eklio checks
          what a file actually is rather than trusting its name, and strips anything executable out
          of an SVG before storing it.
        </p>

        <div className="flex flex-wrap gap-3">
          {UPLOAD_KINDS.map((kind) => (
            <label
              key={kind}
              className="cursor-pointer rounded-card border border-line px-4 py-3 text-ui text-ink hover:border-ink-3"
            >
              {UPLOAD_KIND_LABELS[kind]}
              <input
                type="file"
                className="sr-only"
                disabled={busy}
                accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  // Reset first: choosing the same file twice must fire again.
                  event.target.value = "";
                  if (chosen) void upload(kind, chosen);
                }}
              />
            </label>
          ))}
        </div>

        <p className="text-meta text-ink-3">
          {`${quota.files} of ${quota.max_files} files · ${formatBytes(quota.bytes)} of ${formatBytes(quota.max_bytes)}`}
        </p>

        {notice.kind === "error" ? (
          <p role="alert" className="border-l border-accent pl-3 text-helper leading-prose text-ink">
            {notice.message}
          </p>
        ) : null}

        {notice.kind === "done" && (notice.mismatched || notice.removed.length > 0) ? (
          <div aria-live="polite" className="flex flex-col gap-1.5 border-l border-line pl-3">
            {notice.mismatched ? (
              <p className="text-helper leading-prose text-ink-2">
                That file was not the type its name claimed. It has been stored as what it actually
                is.
              </p>
            ) : null}
            {notice.removed.length > 0 ? (
              <p className="text-helper leading-prose text-ink-2">
                {`Removed from the SVG before storing: ${notice.removed.join(", ")}.`}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <MonoLabel tracking="16" as="h2">
          Your files
        </MonoLabel>

        {files.length === 0 ? (
          <p className="text-helper leading-prose text-ink-2">
            Nothing here yet. Your portrait is the one most people add first.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-5 max-md:grid-cols-2">
            {files.map((file) => (
              <li key={file.id} className="flex flex-col gap-2">
                <div className="aspect-square overflow-hidden rounded-card border border-line bg-paper-2">
                  {file.url && file.mime_type !== "application/pdf" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed, ephemeral Storage URLs
                    <img
                      src={file.url}
                      alt={file.original_name ?? UPLOAD_KIND_LABELS[file.kind]}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <MonoLabel tracking="14" tone="ink-3">
                        {file.mime_type === "application/pdf" ? "PDF" : "No preview"}
                      </MonoLabel>
                    </div>
                  )}
                </div>

                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-helper text-ink">
                    {file.original_name ?? UPLOAD_KIND_LABELS[file.kind]}
                  </span>
                  <span className="flex-none text-meta text-ink-3">
                    {formatBytes(file.byte_size)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <MonoLabel tracking="14" tone="ink-3">
                    {UPLOAD_KIND_LABELS[file.kind]}
                  </MonoLabel>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(file.id)}
                    className="text-meta text-ink-2 underline hover:text-ink disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="max-w-[560px] text-helper leading-prose text-ink-2">
        These are yours. Changing your palette rebuilds the files Eklio makes for you; it never
        touches these.
      </p>
    </div>
  );
}
