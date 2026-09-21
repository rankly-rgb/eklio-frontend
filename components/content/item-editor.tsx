"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/ui/mono-label";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { PhotoSlot } from "@/components/kit/photo-slot";
import type { SitePreviewTokens } from "@/lib/site/types";
import {
  ARCHETYPE_LABELS,
  CHANNEL_LABELS,
  CONTENT_ARCHETYPES,
  CONTENT_IMAGE_SLOTS,
  CONTENT_STATUSES,
  PUBLISH_CHANNELS,
  type ContentItem,
  type PublishChannel,
} from "@/lib/data/content";

/*
 * ── THE ITEM EDITOR ─────────────────────────────────────────────────────
 *
 * Autosave, and it says so honestly. The save state has four values and
 * "Saved" only ever appears after the server said it saved — never
 * optimistically, because a caption she believes is stored and is not is the
 * one failure this screen must never produce.
 *
 * The debounce is driven from the CHANGE HANDLERS and a timer ref, not from an
 * effect watching state. `react-hooks/set-state-in-effect` would flag the
 * latter, and it would also be wrong: a keystroke is an event, and an effect
 * that fires on every render is a worse description of it.
 *
 * PATCH SEMANTICS ALL THE WAY DOWN. Only the fields she touched are sent. The
 * RPC treats an absent key as "leave it alone" and a present null as "clear
 * it", so an editor that posted the whole row every time would silently
 * overwrite a field she edited in another tab.
 *
 * ⚠ NOTHING HERE GENERATES. There is no "write this for me" button in this
 * lot; every word on this screen is hers. The photograph is whatever
 * `brand_images` already has for the slot she picks — this screen never asks
 * for one to be made.
 */

const SAVE_DEBOUNCE_MS = 800;

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Patch = Record<string, unknown>;

export function ItemEditor({
  item,
  tokens,
  photoUrl,
  written = false,
}: {
  item: ContentItem;
  tokens: Pick<SitePreviewTokens, "primary" | "dark_neutral">;
  /** A signed URL when this item's slot has a current photograph, else null. */
  photoUrl: string | null;
  /**
   * Eklio a écrit ce post (`lib/content/write-screen.ts`, `eklioWroteThis`).
   * Deux réglages disparaissent alors — voir plus bas.
   */
  written?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(item);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  const pending = useRef<Patch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;

    setSave({ kind: "saving" });
    try {
      const response = await fetch(`/api/content-items/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setSave({ kind: "error", message: body?.error ?? "That did not save." });
        return;
      }
      setSave({ kind: "saved" });
    } catch {
      setSave({ kind: "error", message: "That did not save. Check your connection." });
    }
  }, [item.id]);

  const queue = useCallback(
    (patch: Patch) => {
      setDraft((current) => ({ ...current, ...patch }) as ContentItem);
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  async function togglePosted(posted: boolean, channel: PublishChannel | null) {
    setBusy(true);
    try {
      const response = await fetch(`/api/content-items/${item.id}/posted`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ posted, channel }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setSave({ kind: "error", message: body?.error ?? "That could not be recorded." });
        return;
      }
      // The publication state lives in the log, so the server is the only
      // thing that knows it. Re-read rather than guess.
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/content-items/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        setSave({ kind: "error", message: "That could not be deleted." });
        return;
      }
      router.push("/app/content");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        <TextField
          id="content-title"
          label="Title"
          hint="What this post is, in a few words. It is what you will see on the calendar."
          maxLength={34}
          value={draft.title ?? ""}
          onChange={(event) => queue({ title: event.target.value || null })}
          onBlur={() => void flush()}
        />

        <TextAreaField
          id="content-caption"
          label="Caption"
          hint="Exactly what you will paste when you post it."
          rows={10}
          maxLength={2200}
          value={draft.caption ?? ""}
          onChange={(event) => queue({ caption: event.target.value || null })}
          onBlur={() => void flush()}
        />
        <p className="-mt-4 text-helper text-ink-3">
          {(draft.caption ?? "").length} of 2,200 characters
        </p>

        <TextAreaField
          id="content-alt"
          label="Alt text"
          hint="What the image shows, for anyone who cannot see it. Worth writing before you post, not after."
          rows={3}
          maxLength={420}
          value={draft.alt_text ?? ""}
          onChange={(event) => queue({ alt_text: event.target.value || null })}
          onBlur={() => void flush()}
        />

        <TextField
          id="content-tags"
          label="Tags"
          hint="Comma separated, up to eight. They are lowercased and de-duplicated when saved."
          value={(draft.tags ?? []).join(", ")}
          onChange={(event) =>
            queue({
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 8),
            })
          }
          onBlur={() => void flush()}
        />
      </div>

      <aside className="flex flex-col gap-6">
        <SaveIndicator state={save} updatedAt={item.updated_at} />

        {/*
         * ⚠ « Kind » ET « State » ÉTAIENT DES MOTS DE SYSTÈME, ET ILS ONT ÉTÉ
         * TRADUITS PLUTÔT QUE RETIRÉS.
         *
         * Les retirer aurait enlevé deux réglages qu'elle utilise vraiment :
         * changer la forme d'une carte, et dire qu'une carte est prête. Ce qui
         * était faux n'était pas leur existence, c'était leur nom. « Kind »
         * n'est pas une question qu'on se pose ; « What kind of post » en est
         * une. « State » décrit une colonne ; « Where it is » décrit sa
         * situation.
         *
         * ⚠ ET CE N'EST PAS « COMMENT ELLE EST DESSINÉE ». `archetype` est le
         * FORMAT du post — déclaration, question, notes, signature, récit,
         * fiche Google. La MISE EN PAGE de la carte est un autre vocabulaire
         * (`content_archetypes`) et elle se choisit plus haut, sur la surface
         * de relecture. Les deux colonnes portent des noms qui se ressemblent
         * et ne veulent pas dire la même chose ; un libellé « How it looks »
         * ici aurait fait croire que ce réglage change le dessin.
         *
         * Et `proposed` ne figure pas dans la liste : c'est l'état d'une carte
         * qu'EKLIO a écrite et qu'elle n'a pas encore regardée. Se l'attribuer
         * à soi-même n'a pas de sens, et le proposer comme choix le lui
         * demanderait.
         */}
        {/*
         * ── CES DEUX RÉGLAGES SONT LES SIENS, ET SEULEMENT LES SIENS ──────
         *
         * ⚠ SUR UN POST GÉNÉRÉ, ILS DÉCRIVENT UN CHOIX QU'ELLE N'A PAS FAIT.
         * « What kind of post: Question » sur une carte qu'Eklio a écrite lui
         * demande de valider une décision prise ailleurs, et « Where it is:
         * Still working on it » lui dit qu'elle a du travail en retard sur un
         * post qui est terminé. Les deux sont donc retirés de cette vue-là.
         *
         * ⚠ ET ILS RESTENT ENTIERS SUR SES POSTS À ELLE. Ce sont les seuls
         * endroits où se choisissent le format d'un post — fiche Google
         * comprise — et l'état « prêt à publier », qui alimente le compteur du
         * mois. Les supprimer partout aurait retiré deux fonctions pour
         * corriger un libellé mal placé.
         */}
        {written ? (
          /*
           * ⚠ LA FONCTION RESTE, LE MOT DE SYSTÈME PART. « Approve », sur le
           * flux du mois, est un LIEN vers cette page : retirer « Where it
           * is » sans rien mettre à la place aurait produit un bouton qui
           * mène à un écran où l'on ne peut pas faire ce qu'il annonce. Ce
           * qu'elle veut dire ici tient en une phrase et un geste, et la
           * phrase n'est pas le nom d'une colonne.
           */
          <div className="flex flex-col gap-2">
            <MonoLabel tracking="16">This one</MonoLabel>
            {draft.status === "ready" ? (
              <p className="text-helper leading-prose text-ink-2">
                Ready to post.{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-ink"
                  onClick={() => {
                    queue({ status: "draft" });
                    void flush();
                  }}
                >
                  Put it back to a draft
                </button>
              </p>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  queue({ status: "ready" });
                  void flush();
                }}
              >
                Mark it ready to post
              </Button>
            )}
          </div>
        ) : (
        <>
        <Field label="What kind of post">
          <Select
            id="content-archetype"
            value={draft.archetype}
            options={CONTENT_ARCHETYPES.map((value) => [value, ARCHETYPE_LABELS[value]])}
            onChange={(value) => {
              queue({ archetype: value });
              void flush();
            }}
          />
        </Field>

        <Field label="Where it is">
          <Select
            id="content-status"
            value={draft.status}
            options={CONTENT_STATUSES.filter((value) => value !== "proposed").map((value) => [
              value,
              value === "draft"
                ? "Still working on it"
                : value === "ready"
                  ? "Ready to post"
                  : "Put away",
            ])}
            onChange={(value) => {
              queue({ status: value });
              void flush();
            }}
          />
        </Field>
        </>
        )}

        <Field label="Date">
          <input
            id="content-date"
            type="date"
            value={draft.scheduled_for ?? ""}
            onChange={(event) => {
              queue({ scheduled_for: event.target.value || null });
              void flush();
            }}
            className="w-full rounded-card border border-line bg-bg px-4 py-3 text-body text-ink"
          />
        </Field>

        <Field label="Photograph">
          <Select
            id="content-slot"
            value={draft.image_slot ?? ""}
            options={[
              ["", "None"],
              ...CONTENT_IMAGE_SLOTS.map((slot) => [slot, slot.replace(/_/g, " ")] as const),
            ]}
            onChange={(value) => {
              queue({ image_slot: value || null });
              void flush();
            }}
          />
          {/*
           * ── LE DÉGRADÉ NE TIENT PLUS LIEU DE VISUEL ─────────────────────
           *
           * ⚠ C'ÉTAIT LA SEULE IMAGE D'UN POST VIDE, et elle n'était l'image
           * de rien. Un bloc coloré grand comme une carte, en haut d'un écran
           * où rien n'est encore écrit, se lit comme « voici ton post » — puis
           * le fichier qu'elle télécharge ne lui ressemble pas.
           *
           * Le dégradé déterministe reste ce qu'il est ailleurs (la révélation
           * du kit, la toile d'accueil) : là-bas il tient la place d'une
           * photographie qui va exister. Ici il tenait la place d'une carte
           * composée, qui n'est pas une photographie du tout.
           *
           * Donc : la photographie quand il y en a une, une phrase quand il
           * n'y en a pas, et rien du tout quand aucun emplacement n'est choisi.
           */}
          {photoUrl ? (
            <PhotoSlot
              tokens={tokens}
              src={photoUrl}
              alt={draft.alt_text ?? ""}
              className="mt-3 aspect-square w-full rounded-card"
            />
          ) : draft.image_slot ? (
            <p className="mt-3 text-helper leading-prose text-ink-2">
              No photograph for this slot yet.
            </p>
          ) : null}
        </Field>

        <PostedControl
          item={item}
          busy={busy}
          onToggle={(posted, channel) => void togglePosted(posted, channel)}
        />

        <div className="border-t border-line pt-5">
          <DeleteControl busy={busy} onConfirm={() => void remove()} />
        </div>
      </aside>
    </div>
  );
}

function SaveIndicator({ state, updatedAt }: { state: SaveState; updatedAt: string }) {
  /*
   * "Saved" is never shown optimistically: it appears only after the server
   * answered. Before she has changed anything it says when the row was last
   * written, which is a fact rather than a reassurance.
   */
  if (state.kind === "error") {
    return (
      <p role="alert" className="text-helper text-danger">
        {state.message}
      </p>
    );
  }

  return (
    <p className="text-helper text-ink-2" aria-live="polite">
      {state.kind === "saving"
        ? "Saving…"
        : state.kind === "saved"
          ? "Saved"
          : `Last saved ${new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(updatedAt))}`}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <MonoLabel tracking="16">{label}</MonoLabel>
      {children}
    </div>
  );
}

function Select({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-card border border-line bg-bg px-4 py-3 text-body text-ink"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function PostedControl({
  item,
  busy,
  onToggle,
}: {
  item: ContentItem;
  busy: boolean;
  onToggle: (posted: boolean, channel: PublishChannel | null) => void;
}) {
  const [channel, setChannel] = useState<PublishChannel>("instagram");

  if (item.posted) {
    return (
      <div className="flex flex-col gap-2 rounded-card border border-line p-4">
        <MonoLabel tracking="16">Posted</MonoLabel>
        <p className="text-helper leading-prose text-ink-2">
          {item.channel ? CHANNEL_LABELS[item.channel as PublishChannel] : "Recorded"} ·{" "}
          {item.posted_at
            ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                new Date(item.posted_at)
              )
            : ""}
        </p>
        <Button variant="secondary" disabled={busy} onClick={() => onToggle(false, null)}>
          It did not go out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line p-4">
      <MonoLabel tracking="16">When you post it</MonoLabel>
      <p className="text-helper leading-prose text-ink-2">
        Eklio does not post for you. Marking it here is how the publishing log knows.
      </p>
      <Select
        id="content-channel"
        value={channel}
        options={PUBLISH_CHANNELS.map((value) => [value, CHANNEL_LABELS[value]])}
        onChange={(value) => setChannel(value as PublishChannel)}
      />
      <Button disabled={busy} onClick={() => onToggle(true, channel)}>
        I posted this
      </Button>
    </div>
  );
}

function DeleteControl({ busy, onConfirm }: { busy: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="text-helper text-ink-2 underline hover:text-ink"
      >
        Delete this item
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-helper leading-prose text-ink-2">
        This deletes the item and its publishing history. It cannot be undone.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" disabled={busy} onClick={onConfirm}>
          Delete
        </Button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-helper text-ink-2 underline hover:text-ink"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
