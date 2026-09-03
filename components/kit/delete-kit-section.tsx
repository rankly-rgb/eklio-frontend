"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";

/*
 * Housekeeping — deleting a brand kit (Lot 9).
 *
 * Soft delete: `delete_brand_kit` sets `deleted_at`, nothing is purged here.
 * The typed practice-name match is a client-side safety net against a wrong
 * click, not an authorization check — the RPC's own ownership check is the
 * real boundary (same split `ConfirmReset`, `components/site/reset-
 * section.tsx`, already uses for its own destructive confirmation, whose
 * focus-trap/ARIA/Escape pattern this copies).
 */
export function DeleteKitSection({
  brandKitId,
  practiceName,
}: {
  brandKitId: string;
  practiceName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Housekeeping" />
      <p className="max-w-[560px] text-helper leading-prose text-ink-2">
        Deleting a brand kit doesn&rsquo;t refund your purchase. It moves to
        Recently deleted for 30 days, then it and its files are removed for
        good.
      </p>
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => setConfirming(true)}
      >
        Delete this brand kit
      </Button>

      {confirming ? (
        <ConfirmDelete
          brandKitId={brandKitId}
          practiceName={practiceName}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </section>
  );
}

function ConfirmDelete({
  brandKitId,
  practiceName,
  onCancel,
}: {
  brandKitId: string;
  practiceName: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === practiceName.trim();

  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    box.current?.querySelector<HTMLElement>("input")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !box.current) return;

      const focusable = box.current.querySelectorAll<HTMLElement>("input, button:not(:disabled)");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onCancel]);

  async function confirmDelete() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/delete`, { method: "POST" });
      if (!response.ok) throw new Error("delete failed");
      router.push("/app");
    } catch {
      setError("That didn't save. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(38,33,28,0.35)] p-6">
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-kit-title"
        className="route-enter w-full max-w-[440px] rounded-card border border-line bg-bg p-7"
      >
        <h2
          id="delete-kit-title"
          className="font-display text-card-title font-medium leading-card tracking-card-title text-ink"
        >
          Delete this brand kit?
        </h2>
        <p className="mt-3 text-ui leading-prose text-ink-2">
          This doesn&rsquo;t refund your purchase. You have 30 days to
          restore it from Recently deleted before it and its files are
          removed for good.
        </p>
        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-meta font-medium text-ink">
            {`Type "${practiceName}" to confirm`}
          </span>
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="w-full rounded-card border border-line bg-bg px-3 py-2 text-ui text-ink"
            autoComplete="off"
          />
        </label>

        {error ? (
          <p role="alert" className="mt-3 border-l border-accent pl-3 text-helper leading-prose text-ink">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Keep this kit
          </Button>
          <Button
            variant="primary"
            disabled={!matches || pending}
            onClick={() => void confirmDelete()}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
