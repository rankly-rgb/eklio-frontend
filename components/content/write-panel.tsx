"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import type { SuggestedTopic } from "@/lib/data/on-demand";

/*
 * ── ELLE NE FAIT JAMAIS FACE À UN CHAMP VIDE ────────────────────────────
 *
 * C'est la promesse du produit, et l'ancien écran faisait exactement
 * l'inverse : Title, Caption, Alt text, Tags, et un dégradé à la place du
 * visuel. Ce panneau prend cette place.
 *
 * Trois entrées, dans cet ordre d'évidence :
 *
 *   trois sujets suggérés  — tirés de SA banque, avec leur angle et leur
 *                            « Why this one ». Gratuits, et « show three
 *                            others » l'est aussi : proposer n'est pas tirer.
 *   sa propre idée         — une ligne. Le modèle en fait un post sous les
 *                            mêmes gardes déontologiques.
 *   « Write it myself »    — discret, pour qui le veut vraiment.
 *
 * ⚠ LE PANNEAU RESTE VISIBLE QUAND L'ÉCRITURE N'EST PAS ACTIVÉE. Il le dit,
 * et il ne s'efface pas au profit du formulaire vide : il faut qu'elle voie
 * que la fonction existe, sinon la seule chose qu'elle apprend est que ce
 * produit lui demande d'écrire elle-même.
 */

export type WriteAvailability =
  | { kind: "ready" }
  /*
   * Le drapeau est éteint, ou la clef absente — et depuis le 2026-09-21 les
   * DEUX sont réellement testés. `because` nomme lequel, et il n'est rempli
   * que là où un détail technique a le droit d'être lu (`showsTechnicalDetail`).
   */
  | { kind: "not_switched_on"; because?: string | null }
  /** Le quota du mois est épuisé. `renewsOn` est une date lisible. */
  | { kind: "quota_exhausted"; renewsOn: string };

export type WritePanelProps = {
  itemId: string;
  brandKitId: string;
  month: string | null;
  /** Les trois premiers sujets, rendus par le serveur pour éviter un aller-retour. */
  initialTopics: SuggestedTopic[];
  availability: WriteAvailability;
  /** Combien de crédits il reste, pour l'afficher AVANT le clic. */
  creditsLeft: number | null;
  /** Ce qu'elle a déjà écrit ici, s'il y a quelque chose. */
  hasHerWords: boolean;
};

type Busy = { kind: "idle" } | { kind: "suggesting" } | { kind: "writing" } | { kind: "error"; message: string };

/** Une clef d'intention, stable pour ce montage du panneau. */
function newIdempotencyKey(): string {
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function WritePanel({
  itemId,
  brandKitId,
  month,
  initialTopics,
  availability,
  creditsLeft,
  hasHerWords,
}: WritePanelProps) {
  const router = useRouter();
  const [topics, setTopics] = useState(initialTopics);
  const [seen, setSeen] = useState<string[]>(initialTopics.map((t) => t.id));
  const [chosen, setChosen] = useState<string | null>(initialTopics[0]?.id ?? null);
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<"single" | "carousel">("single");
  const [busy, setBusy] = useState<Busy>({ kind: "idle" });
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const armed = availability.kind === "ready";

  const showOthers = useCallback(async () => {
    setBusy({ kind: "suggesting" });
    try {
      const response = await fetch(`/api/brand-kits/${brandKitId}/suggest-topics`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month, limit: 3, exclude: seen }),
      });
      const body = (await response.json().catch(() => null)) as
        | { topics?: SuggestedTopic[]; error?: string }
        | null;

      if (!response.ok || !body?.topics) {
        setBusy({ kind: "error", message: body?.error ?? "Those could not be loaded." });
        return;
      }
      if (body.topics.length === 0) {
        /*
         * ⚠ LA BANQUE EST ÉPUISÉE POUR ELLE, ET ON LE DIT SANS LE MOT
         * « banque » : ce mot est à nous. Ce qui lui reste est son idée à
         * elle, qui marche toujours.
         */
        setBusy({
          kind: "error",
          message: "There is nothing else to suggest right now. Your own idea still works.",
        });
        return;
      }
      setTopics(body.topics);
      setSeen((previous) => [...previous, ...body.topics!.map((t) => t.id)]);
      setChosen(body.topics[0]?.id ?? null);
      setBusy({ kind: "idle" });
    } catch {
      setBusy({ kind: "error", message: "Those could not be loaded. Check your connection." });
    }
  }, [brandKitId, month, seen]);

  async function writeIt() {
    if (!armed) return;
    if (hasHerWords && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }

    setBusy({ kind: "writing" });
    const topic = topics.find((t) => t.id === chosen) ?? null;

    try {
      const response = await fetch(`/api/content-items/${itemId}/write`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          /*
           * ⚠ UNE CLEF PAR INTENTION, GÉNÉRÉE AU MOMENT DU CLIC. Deux clics
           * sur le même bouton portent la même parce que la requête est déjà
           * partie ; la base, elle, refuse la seconde réservation sur cette
           * clef. Le bouton désactivé n'est que la première des trois
           * protections.
           */
          idempotencyKey: newIdempotencyKey(),
          format,
          topic: idea.trim() ? null : topic,
          idea: idea.trim() || null,
          overwrite: confirmOverwrite,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string; code?: string }
        | null;

      if (!response.ok) {
        setBusy({ kind: "error", message: body?.error ?? "That did not come together. Try again." });
        return;
      }
      setBusy({ kind: "idle" });
      router.refresh();
    } catch {
      setBusy({ kind: "error", message: "That did not come together. Check your connection." });
    }
  }

  return (
    <section className="flex flex-col gap-6 rounded-card border border-line p-8">
      <div className="flex flex-col gap-2">
        <MonoLabel tracking="16">Write this one</MonoLabel>
        <p className="max-w-[560px] text-body leading-prose text-ink-2">
          Pick something to say, or tell Eklio your own idea. It writes the caption, the line on
          the card, and the card itself — then you read it over.
        </p>
      </div>

            {availability.kind === "not_switched_on" ? (
        <div className="flex max-w-[560px] flex-col gap-2 rounded-card border border-dashed border-line px-4 py-3">
          {/*
            * ⚠ PLUS « FOR YOUR ACCOUNT ». Ce n'était pas une propriété du
            * compte : aucun plan, aucun achat et aucun `comp_grant` n'ouvrent
            * cette porte. La phrase envoyait chercher du côté de la
            * facturation, où il n'y a rien à trouver.
            */}
          <p className="text-helper leading-prose text-ink-2">
            Writing isn&rsquo;t switched on here yet. You can still write this one yourself
            below, and everything here will work once it is.
          </p>
          {availability.because ? (
            <p className="font-mono text-[11px] leading-prose text-ink-2">
              {availability.because}
            </p>
          ) : null}
        </div>
      ) : null}

      {availability.kind === "quota_exhausted" ? (
        <p className="max-w-[560px] rounded-card border border-dashed border-line px-4 py-3 text-helper leading-prose text-ink-2">
          You have used this month&rsquo;s writing. It comes back on {availability.renewsOn}. You
          can still write this one yourself below.
        </p>
      ) : null}

      {/* ── Trois sujets ──────────────────────────────────────────────── */}
      {topics.length > 0 ? (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {topics.map((topic) => (
              <li key={topic.id}>
                <button
                  type="button"
                  onClick={() => {
                    setChosen(topic.id);
                    setIdea("");
                  }}
                  aria-pressed={chosen === topic.id && !idea.trim()}
                  className={`flex w-full flex-col gap-1 rounded-card border p-4 text-left ${
                    chosen === topic.id && !idea.trim() ? "border-ink" : "border-line"
                  }`}
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="text-body text-ink">{topic.title}</span>
                    {topic.angle_label ? (
                      <span className="text-helper text-ink-2">{topic.angle_label}</span>
                    ) : null}
                  </span>
                  {topic.rationale ? (
                    <span className="text-helper leading-prose text-ink-2">
                      Why this one: {topic.rationale}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void showOthers()}
            disabled={busy.kind === "suggesting"}
            className="self-start text-helper text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            {busy.kind === "suggesting" ? "Finding three others…" : "Show three others"}
          </button>
        </div>
      ) : null}

      {/* ── Son idée ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label htmlFor="write-idea" className="text-helper text-ink-2">
          My own idea
        </label>
        <input
          id="write-idea"
          type="text"
          value={idea}
          maxLength={280}
          placeholder="why rest feels hard after going back to work"
          onChange={(event) => setIdea(event.target.value)}
          className="w-full rounded-card border border-line bg-bg px-4 py-3 text-body text-ink"
        />
      </div>

      {/* ── Le format ─────────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-helper text-ink-2">Format</legend>
        <div className="flex flex-wrap gap-2">
          {(["single", "carousel"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormat(value)}
              aria-pressed={format === value}
              className={`rounded-card border px-4 py-2 text-helper ${
                format === value ? "border-ink text-ink" : "border-line text-ink-2"
              }`}
            >
              {value === "single" ? "Single card" : "Carousel"}
            </button>
          ))}
        </div>
      </fieldset>

      {busy.kind === "error" ? (
        <p role="alert" className="text-helper text-danger">
          {busy.message}
        </p>
      ) : null}

      {confirmOverwrite ? (
        <p role="alert" className="max-w-[560px] text-helper leading-prose text-ink">
          You have already written something here. Writing this one will replace your words. Click
          again to go ahead.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={() => void writeIt()} disabled={!armed || busy.kind === "writing"}>
          {busy.kind === "writing" ? "Writing…" : confirmOverwrite ? "Yes, replace it" : "Write it"}
        </Button>

        {/*
         * ⚠ LE COÛT EST ÉCRIT AVANT LE CLIC, ET EN CRÉDITS. Jamais en
         * dollars : elle n'a pas acheté des dollars, elle a un forfait. Un
         * bouton qui dépense sans le dire transforme une découverte en
         * facture, et la découverte arrive toujours trop tard.
         */}
        {armed && creditsLeft !== null ? (
          <span className="text-helper text-ink-2">
            Uses 1 of your {creditsLeft} left this month
          </span>
        ) : null}

        <a
          href={`/app/content/${itemId}?write=manual`}
          className="text-helper text-ink-2 underline underline-offset-2 hover:text-ink"
        >
          Write it myself
        </a>
      </div>
    </section>
  );
}
