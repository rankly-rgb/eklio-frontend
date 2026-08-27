"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { Checkbox } from "@/components/ui/checkbox";
import type { ChecklistItem } from "@/lib/data/checklist";

/*
 * La checklist de lancement (Écran 7) — filet de 2px, compteur mono à côté,
 * six lignes à 14px avec des cases de 14px.
 *
 * La bascule est OPTIMISTE : cocher une case doit répondre au clic, pas au
 * réseau. Un échec la remet dans son état d'avant et le dit — jamais un
 * silence qui laisserait croire que c'est enregistré.
 */
export function ChecklistCard({ items: initial }: { items: ChecklistItem[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const done = items.filter((item) => item.done).length;
  const total = items.length;

  async function toggle(item: ChecklistItem, next: boolean) {
    setError(null);
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, done: next } : entry
      )
    );

    try {
      const response = await fetch(`/api/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ done: next }),
      });
      if (!response.ok) throw new Error("write failed");
    } catch {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, done: item.done } : entry
        )
      );
      setError("That didn't save. Check your connection and try again.");
    }
  }

  return (
    <section
      aria-labelledby="launch-checklist"
      className="box-border flex flex-col rounded-card border border-line p-[22px_24px]"
    >
      <MonoLabel tracking="16" as="h2" id="launch-checklist">
        Launch checklist
      </MonoLabel>

      <div className="mt-4 flex items-center gap-3.5">
        <div className="h-0.5 flex-1 overflow-hidden rounded-pill bg-line">
          <div
            className="h-0.5 bg-accent transition-[width] duration-[var(--dur-select)]"
            style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>
        <MonoLabel tracking="14" className="flex-none">
          {`${done} of ${total}`}
        </MonoLabel>
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        {items.map((item) => (
          <Checkbox
            key={item.id}
            checked={item.done}
            onChange={(next) => void toggle(item, next)}
            label={item.label}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-helper leading-prose text-accent">
          {error}
        </p>
      ) : null}
    </section>
  );
}
