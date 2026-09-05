import type { ReactNode } from "react";
import { MonoLabel } from "@/components/ui/mono-label";

/** One of the kit header's four state tiles — a real, measured number, never a score. */
export function StateTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-line p-4">
      <MonoLabel tracking="10">{label}</MonoLabel>
      <div className="text-body text-ink">{children}</div>
    </div>
  );
}
