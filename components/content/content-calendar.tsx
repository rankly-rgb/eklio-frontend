"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import {
  ARCHETYPE_LABELS,
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

/*
 * Le format d'un post dont le format n'a pas encore été décidé.
 *
 * ⚠ `archetype` EST `not null` EN BASE (`content_items_archetype_check`), donc
 * créer une ligne demande une valeur : il n'y a pas d'état « pas encore
 * choisi » à écrire. `statement` est le même défaut que celui d'une idée libre
 * dans `lib/content/generate/on-demand.ts`, et pour la même raison — une idée
 * qu'on formule en une phrase EST une déclaration. Les formes qui restent
 * supposent une structure qu'elle n'a pas donnée.
 *
 * ⚠ ET IL NE SE FIGE PAS. Sur un post qu'elle écrit elle-même, « What kind of
 * post » porte les six formats et cette valeur est la première chose qu'elle
 * peut changer. Sur un post généré, la mise en page vient du sujet et ce
 * champ ne se montre plus du tout.
 */
const NEW_POST_ARCHETYPE: ContentArchetype = "statement";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * ── « NEW POST » N'OUVRE PLUS SUR UNE QUESTION DE SYSTÈME ──────────────
   *
   * Avant : une boîte de dialogue demandait « What kind of post is this? » et
   * six formats. Elle répondait, et atterrissait sur un formulaire vide.
   * Deux gestes pour arriver nulle part — et le premier lui demandait un choix
   * de vocabulaire interne avant qu'une seule idée n'existe.
   *
   * Maintenant : le post est créé et elle arrive sur le panneau d'écriture,
   * qui lui propose trois sujets. Le format se décide par ce qu'elle choisit
   * là-bas, ou reste le sien à régler dans l'éditeur si elle écrit elle-même.
   *
   * ⚠ ET RIEN N'EST PERDU. Les six formats, fiche Google comprise, restent
   * entiers dans « What kind of post » sur un post qu'elle écrit elle-même.
   * On a retiré la QUESTION, pas la réponse.
   *
   * ⚠ AUCUNE DÉPENSE ICI. Créer une ligne ne génère rien ; c'est « Write it »,
   * sur la page du post, qui coûte un crédit et qui le dit avant le clic.
   */
  async function create(date: string | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/content`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ archetype: NEW_POST_ARCHETYPE, scheduled_for: date }),
      });
      const body = (await response.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;

      if (!response.ok || !body?.id) {
        setError(body?.error ?? "That could not be created. Try again.");
        return;
      }
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
          {/*
            The way in to the review screen, shown only when there is something
            to review. A permanent link to an empty plan would teach her the
            page is usually empty, which is the opposite of what it is for.
          */}
          {model.counts.proposed ? (
            <Link
              href={`/app/content/plan?month=${month}`}
              className="text-helper text-ink underline hover:text-ink-2"
            >
              Read your month
            </Link>
          ) : null}
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

      {/*
       * Seven columns need seven columns' worth of room. Below the medium
       * breakpoint the month becomes a LIST of the days that actually carry
       * something -- the same rows, ordered the same way, without a grid squeezed
       * to 40px cells that nobody can read or tap.
       */}
      <div className="mt-8 hidden grid-cols-7 gap-px overflow-hidden rounded-card border border-line bg-line md:grid">
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
                void create(`${month.slice(0, 8)}${String(day).padStart(2, "0")}`)
              }
            />
          )
        )}
      </div>

      <ol className="mt-8 flex flex-col md:hidden">
        {model.items.length === 0 ? (
          <li className="text-helper leading-prose text-ink-2">
            Nothing scheduled this month yet.
          </li>
        ) : (
          model.items.map((item) => (
            <li key={item.id} className="border-b border-line first:border-t">
              <Link href={`/app/content/${item.id}`} className="flex items-baseline gap-4 py-3">
                <MonoLabel tracking="14" className="w-10 flex-none">
                  {String(dayOf(item) ?? 0).padStart(2, "0")}
                </MonoLabel>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={`truncate text-ui ${
                      item.status === "proposed" ? "text-ink-2" : "text-ink"
                    }`}
                  >
                    {item.title ?? "Untitled"}
                  </span>
                  <ItemMeta item={item} />
                </span>
              </Link>
            </li>
          ))
        )}
      </ol>

      <div className="mt-6 md:hidden">
        <Button variant="secondary" disabled={busy} onClick={() => void create(null)}>
          {busy ? "Opening…" : "New post"}
        </Button>
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-h2 font-medium text-ink">Not yet scheduled</h2>
          <Button variant="secondary" disabled={busy} onClick={() => void create(null)}>
            {busy ? "Opening…" : "New post"}
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

    </>
  );
}

function Counts({ counts }: { counts: ContentMonth["counts"] }) {
  /*
   * Counts the database computed over her own rows. "Posted" is derived from
   * the publishing log, not from a status column someone could have left
   * behind — which is the whole reason the log is the state.
   *
   * ⚠ THE FIRST THREE COUNT HER WORK ONLY. A proposal is something Eklio wrote
   * and she has not read yet; counting it as `Scheduled` would report twelve
   * scheduled posts to someone who has seen none of them. `get_content_month`
   * excludes proposals from all three and returns them separately, and this is
   * the surface that keeps that distinction visible.
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
      {counts.proposed ? (
        /*
         * Named for what it is, and set apart from the three above: this is
         * Eklio's work waiting on her, not hers waiting on the world.
         */
        <div className="flex items-baseline gap-1.5 border-l border-line pl-5">
          <dt>Waiting for you</dt>
          <dd className="text-ink">{counts.proposed}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/*
 * ── A PROPOSAL LOOKS LIKE A PROPOSAL ────────────────────────────────────
 *
 * Greyed, dashed, and lighter than anything she wrote. Two reasons, and the
 * second is the one that matters:
 *
 *   1. It is not hers yet. A tile that looks identical to a post she wrote
 *      invites her to treat a machine's draft as a decision she made.
 *   2. Approving the month is a real gesture with a real cost — twelve posts
 *      move from `proposed` to `draft` at once. Whatever is about to move has
 *      to be visibly distinct BEFORE she presses it, or the button is a
 *      surprise rather than a confirmation.
 */
const PROPOSED_TILE = "border-dashed border-line bg-paper-2 text-ink-2";
const WRITTEN_TILE = "border-line text-ink hover:border-ink-3";

function tileClass(item: ContentItem): string {
  return item.status === "proposed" ? PROPOSED_TILE : WRITTEN_TILE;
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
          className={`rounded border px-2 py-1 text-[12px] leading-snug ${tileClass(item)}`}
        >
          <span className="block truncate">{item.title ?? "Untitled"}</span>
          <ItemMeta item={item} />
        </Link>
      ))}
    </div>
  );
}

function ItemMeta({ item }: { item: ContentItem }) {
  /*
   * "Proposed" is said out loud rather than left to the colour. Greying is a
   * signal a colour-blind reader may not receive and a screen-reader user
   * cannot receive at all, and this is the difference between a post she wrote
   * and one she has not read.
   */
  const state = item.posted
    ? " · Posted"
    : item.status === "ready"
      ? " · Ready"
      : item.status === "proposed"
        ? " · Proposed"
        : "";

  return (
    <span className="mt-0.5 block text-[11px] uppercase tracking-[0.08em] text-ink-3">
      {ARCHETYPE_LABELS[item.archetype]}
      {state}
    </span>
  );
}
