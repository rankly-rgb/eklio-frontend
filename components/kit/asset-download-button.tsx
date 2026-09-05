"use client";

import { useState } from "react";

/*
 * One catalogue key, one download. POSTs to
 * `/api/brand-kits/[id]/assets/[key]` (renders-if-needed, signs, returns a
 * URL), then opens it — the browser's own download/viewer behavior takes it
 * from there, same as the existing "Download PDF" link elsewhere on this
 * page, just POST-driven instead of a plain `<a href>` since this route has
 * to decide whether to render first.
 *
 * A same-origin `fetch` already carries the session cookie the route's
 * `authenticate()` reads (`lib/supabase/server.ts`'s cookie-based client,
 * same as every other route in this app) — no token to attach by hand.
 */
export function AssetDownloadButton({
  brandKitId,
  assetKey,
  children,
  className = "",
}: {
  brandKitId: string;
  assetKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function handleClick() {
    setState("working");
    try {
      const res = await fetch(`/api/brand-kits/${brandKitId}/assets/${assetKey}?intent=download`, {
        method: "POST",
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setState("error");
        return;
      }
      window.open(body.url, "_blank", "noopener,noreferrer");
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
      className={`disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {state === "working" ? "Preparing…" : state === "error" ? "Couldn't get that file — try again" : children}
    </button>
  );
}
