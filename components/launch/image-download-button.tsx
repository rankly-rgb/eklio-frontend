"use client";

import { useState } from "react";

/*
 * ── ONE PHOTOGRAPH, ONE DOWNLOAD ─────────────────────────────────────────
 *
 * A generated photograph is NOT a catalogue asset. It lives in `brand_images`
 * with a storage path, not in the asset manifest, so `AssetDownloadButton`'s
 * route cannot serve it and there is no key to hand that route.
 * `GET /api/brand-kits/[id]/images` already returns every slot with a signed
 * URL for the ones that are ready and current — this asks for that list at the
 * moment of the click and opens the one slot it was asked for.
 *
 * ⚠ SIGNED AT CLICK TIME, NOT AT RENDER TIME. Those URLs live five minutes. A
 * step screen left open in a tab while she signs up for a builder would hand
 * her a dead link; fetching on click means the signature is always fresh.
 *
 * ⚠ AND IT NEVER GENERATES. This is the GET sibling of the POST route that
 * costs money — a slot with no photograph comes back with a null URL and this
 * says so, rather than quietly commissioning one.
 */
export function ImageDownloadButton({
  brandKitId,
  slot,
  label,
  className = "",
}: {
  brandKitId: string;
  slot: string;
  /** Named in the accessible label, so a screen reader gets more than "Download". */
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function handleClick() {
    setState("working");
    try {
      const res = await fetch(`/api/brand-kits/${brandKitId}/images`);
      const body = (await res.json()) as { images?: { slot: string; url: string | null }[] };
      const url = body.images?.find((image) => image.slot === slot)?.url;
      if (!res.ok || !url) {
        setState("error");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      disabled={state === "working"}
      onClick={() => void handleClick()}
      aria-label={`Download ${label}`}
      className={`disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {/*
        ⚠ THE FAILURE IS ANNOUNCED, NOT ONLY DRAWN. `role="alert"` on the text
        that replaces the label, so a screen reader hears the button change
        rather than a sighted-only state.
      */}
      {state === "error" ? (
        <span role="alert">Couldn&rsquo;t get that file — try again</span>
      ) : state === "working" ? (
        "Preparing…"
      ) : (
        "Download"
      )}
    </button>
  );
}
