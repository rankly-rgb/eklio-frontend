"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import type { DeletedBrandKit } from "@/lib/data/brand-kit";

/*
 * "Recently deleted" (Lot 9) — the 30-day window, made visible and
 * reversible. Restoring is free (not a paid action, same as deleting), and
 * this section only renders at all when there's something in it.
 */
export function RecentlyDeletedSection({ kits }: { kits: DeletedBrandKit[] }) {
  if (kits.length === 0) return null;

  return (
    <section
      aria-labelledby="recently-deleted"
      className="mt-7 flex flex-col gap-3 rounded-card border border-line p-[18px_20px]"
    >
      <MonoLabel tracking="16" as="h2" id="recently-deleted">
        Recently deleted
      </MonoLabel>
      <ul className="flex flex-col gap-3">
        {kits.map((kit) => (
          <DeletedKitRow key={kit.brandKitId} kit={kit} />
        ))}
      </ul>
    </section>
  );
}

function DeletedKitRow({ kit }: { kit: DeletedBrandKit }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/brand-kits/${kit.brandKitId}/restore`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("restore failed");
      router.refresh();
    } catch {
      setError("That didn't save. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-ui text-ink">{kit.practiceName}</p>
        <p className="text-meta text-ink-2">
          {kit.daysLeft > 0
            ? `${kit.daysLeft} day${kit.daysLeft === 1 ? "" : "s"} left to restore`
            : "Being removed"}
        </p>
        {error ? (
          <p role="alert" className="text-meta text-ink">
            {error}
          </p>
        ) : null}
      </div>
      <Button
        variant="secondary"
        className="flex-none"
        disabled={pending}
        onClick={() => void restore()}
      >
        {pending ? "Restoring…" : "Restore"}
      </Button>
    </li>
  );
}
