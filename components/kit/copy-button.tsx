"use client";

import { useEffect, useState } from "react";

/**
 * Copy-to-clipboard for hex values and the export prompt.
 *
 * The Clipboard API needs a secure context and can be denied, so the failure
 * path is explicit rather than a button that silently does nothing.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`font-mono text-xs underline hover:opacity-60 ${className}`}
    >
      {state === "copied"
        ? copiedLabel
        : state === "failed"
          ? "Copy failed — select and copy manually"
          : label}
    </button>
  );
}
