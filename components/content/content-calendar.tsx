"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import {
  ARCHETYPE_LABELS,
  CONTENT_ARCHETYPES,
  contentMonthLabel,
  daysInMonth,
  firstWeekday,
  type ContentArchetype,
  type ContentItem,
  type ContentMonth,
} from "@/lib/data/content";

/*
 * The month, as a calendar rather than a grid of sixteen tiles.
 *
 * The older content grid rendered a fixed sixteen slots because the month was
 * generated for her on a schedule. These are HER items: there may be three or
 * thirty, they may sit on any day, and some may not be dated at all. A shape
 * that always shows sixteen would be lying about all three.
 *
 * Every number on this screen is counted by the database over her own rows.
 * Nothing here is an estimate, and nothing here is blurred.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `2026-09-01` shifted by whole months, without touching a local time zone. */
function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function dayOf(item: ContentItem): number | null {
  return item.scheduled_for ? Number(item.scheduled_for.slice(8, 10)) : null;
}

export function ContentCalendar({
  brandKitId,
  month,
  model,
}: {
  brandKitId: string;
  month: string;
  model: ContentMonth;
}) {
  const router = useRouter();
  const [picker, setPicker] = useState<{ date: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(archetype: ContentArchetype, date: string | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/content`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archetype, scheduled_for: date }),
      });
      const body = (await response.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;

      if (!response.ok || !body?.id) {
        setError(body?.error ?? "That could not be created. Try again.");
        return;
      }
      setPicker(null);
      router.push(`/app/content/${body.id}`);
    } catch {
      setError("That could not be created. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const total = daysInMonth(month);
  const offset = firstWeekday(month);
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, index) => index + 1),
  ];

  return (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
            {contentMonthLabel(month)}
          </h1>
          <nav className="flex items-center gap-2">
            <Link
              href={`/app/content?month=${shiftMonth(month, -1)}`}
              className="rounded-card border border-line px-3 py-1 text-helper text-ink-2 hover:text-ink"
            >
              Previous
            </Link>
            <Link
              href={`/app/content?month=${shiftMonth(month, 1)}`}
              className="rounded-card border border-line px-3 py-1 text-helper text-ink-2 hover:text-ink"
            >
              Next
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-5">
          <Counts counts={model.counts} />
          <Link href="/app/content/log" className="text-helper text-ink-2 underline hover:text-ink">
            Publishing log
          </Link>
        </div>
      </header>

      {error ? (
        <p role="alert" className="mt-4 text-helper text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-7 gap-px overflow-hidden rounded-card border border-line bg-line">
        {WEEKDAYS.map((day) => (
          <div key={day} className="bg-paper px-3 py-2">
            <MonoLabel tracking="16">{day}</MonoLabel>
          </div>
        ))}

        {cells.map((day, index) =>
          day === null ? (
            <div key={`pad-${index}`} className="min-h-[104px] bg-paper-2" />
          ) : (
            <DayCell
              key={day}
              month={month}
              day={day}
              items={model.items.filter((item) => dayOf(item) === day)}
              onAdd={() =>
                setPicker({ date: `${month.slice(0, 8)}${String(day).padStart(2, "0")}` })
              }
            />
          )
        )}
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-h2 font-medium text-ink">Not yet scheduled</h2>
          <Button variant="secondary" onClick={() => setPicker({ date: null })}>
            New item
          </Button>
        </div>

        {model.unscheduled.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {model.unscheduled.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/app/content/${item.id}`}
                  className="flex items-baseline justify-between gap-4 rounded-card border border-line px-4 py-3 hover:border-ink-3"
                >
                  <span className="text-body text-ink">{item.title ?? "Untitled"}</span>
                  <ItemMeta item={item} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-helper leading-prose text-ink-2">
            Everything you have written has a date on it.
          </p>
        )}
      </section>

      {picker ? (
        <ArchetypePicker
          busy={busy}
          date={picker.date}
          onCancel={() => setPicker(null)}
          onChoose={(archetype) => void create(archetype, picker.date)}
        />
      ) : null}
    </>
  );
}

function Counts({ counts }: { counts: ContentMonth["counts"] }) {
  /*
   * Three counts the database computed over her own rows. "Posted" is derived
   * from the publishing log, not from a status column someone could have left
   * behind — which is the whole reason the log is the state.
   */
  return (
    <dl className="flex items-baseline gap-5 text-helper text-ink-2">
      <div className="flex items-baseline gap-1.5">
        <dt>Scheduled</dt>
        <dd className="text-ink">{counts.scheduled}</dd>
      </div>
      <div className="flex items-baseline gap-1.5">
        <dt>Ready</dt>
        <dd className="text-ink">{counts.ready}</dd>
      </div>
      <div className="flex items-baseline gap-1.5">
        <dt>Posted</dt>
        <dd className="text-ink">{counts.posted}</dd>
      </div>
    </dl>
  );
}

function DayCell({
  month,
  day,
  items,
  onAdd,
}: {
  month: string;
  day: number;
  items: ContentItem[];
  onAdd: () => void;
}) {
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month.slice(0, 8)}${String(day).padStart(2, "0")}T12:00:00Z`));

  return (
    <div className="flex min-h-[104px] flex-col gap-1.5 bg-paper p-2">
      <div className="flex items-center justify-between">
        <span className="text-helper text-ink-3">{day}</span>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add an item on ${label}`}
          className="rounded-full px-1.5 text-helper text-ink-3 hover:bg-paper-2 hover:text-ink"
        >
          +
        </button>
      </div>

      {items.map((item) => (
        <Link
          key={item.id}
          href={`/app/content/${item.id}`}
          className="rounded border border-line px-2 py-1 text-[12px] leading-snug text-ink hover:border-ink-3"
        >
          <span className="block truncate">{item.title ?? "Untitled"}</span>
          <ItemMeta item={item} />
        </Link>
      ))}
    </div>
  );
}

function ItemMeta({ item }: { item: ContentItem }) {
  return (
    <span className="mt-0.5 block text-[11px] uppercase tracking-[0.08em] text-ink-3">
      {ARCHETYPE_LABELS[item.archetype]}
      {item.posted ? " · Posted" : item.status === "ready" ? " · Ready" : ""}
    </span>
  );
}

function ArchetypePicker({
  busy,
  date,
  onCancel,
  onChoose,
}: {
  busy: boolean;
  date: string | null;
  onCancel: () => void;
  onChoose: (archetype: ContentArchetype) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a kind of post"
        className="w-full max-w-[420px] rounded-card border border-line bg-paper p-6"
      >
        <MonoLabel tracking="16">
          {date ? `New item, ${date}` : "New item, no date yet"}
        </MonoLabel>
        <h2 className="mt-3 font-display text-h2 font-medium text-ink">
          What kind of post is this?
        </h2>
        <p className="mt-2 text-helper leading-prose text-ink-2">
          The kind decides which template it is laid out in. You can change it later.
        </p>

        <ul className="mt-5 flex flex-col gap-2">
          {CONTENT_ARCHETYPES.map((archetype) => (
            <li key={archetype}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onChoose(archetype)}
                className="w-full rounded-card border border-line px-4 py-3 text-left text-body text-ink hover:border-ink-3 disabled:opacity-50"
              >
                {ARCHETYPE_LABELS[archetype]}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
