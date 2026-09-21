"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/ui/mono-label";
import { Button } from "@/components/ui/button";
import type { ContentItem, ContentMonth } from "@/lib/data/content";
import { isFailedGeneration, partitionMonth } from "@/lib/content/partition";

/*
 * ── LE FLUX, ET POURQUOI CE N'EST PLUS UN CALENDRIER ────────────────────
 *
 * Un calendrier répond à « quand ». La question qu'elle se pose en ouvrant cet
 * écran est « est-ce que celui-ci me ressemble » — trente fois, une par carte.
 * Une grille de cases datées met la date au premier plan et la carte au
 * second ; un flux fait l'inverse.
 *
 * Le calendrier reste, en bascule secondaire, parce que « quand » est une
 * vraie question une fois par mois.
 *
 * ── LE POIDS DES ACTIONS EST LA DÉCISION DE PRODUIT ─────────────────────
 *
 *   Swap    dominant   — instantané, gratuit, et c'est ce qui doit être facile
 *   Edit    secondaire — elle a déjà tout, elle ajuste
 *   Approve secondaire — un accord, pas un travail
 *   Regenerate  discret, AVEC SON COÛT ÉCRIT
 *
 * ⚠ « REGENERATE » PORTE SON PRIX DANS SON LIBELLÉ. Un bouton qui dépense un
 * crédit sans le dire transforme une découverte en facture, et la découverte
 * arrive toujours trop tard.
 */

export type StreamTokens = { primary: string; light: string; dark: string; paper: string };

/*
 * ⚠ LA COUPE À DEUX LIGNES EST FAITE PAR LE NAVIGATEUR (`line-clamp-2`), pas
 * ici. Cette fonction ne borne que la QUANTITÉ envoyée au DOM : une caption de
 * 2 200 caractères posée dans un nœud tronqué en CSS reste 2 200 caractères
 * dans le document, trente fois. Quarante mots dépassent deux lignes à toutes
 * les largeurs de cette grille, donc la coupe visible reste celle du CSS.
 */
function firstLines(caption: string | null): string {
  if (!caption) return "";
  return caption.trim().split(/\s+/).slice(0, 40).join(" ");
}

function dayLabel(date: string | null): string {
  if (!date) return "Unscheduled";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * La vignette.
 *
 * ⚠ CE N'EST PAS LA CARTE COMPOSÉE, ET L'ÉCRAN LE DIT. Le PNG 1080×1350 est
 * produit par `lib/compose/` dans le pipeline mensuel, qui n'est pas câblé :
 * tant qu'aucun asset n'existe, montrer un cadre vide ou une image d'exemple
 * serait deux façons de mentir. Ce qui est montré est la LIGNE que le
 * compositeur posera, dans sa palette — vrai, partiel, et annoncé comme tel.
 */
function Thumb({ item, tokens }: { item: ContentItem; tokens: StreamTokens }) {
  return (
    <div
      className="relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-card border border-line p-5"
      style={{ backgroundColor: tokens.paper }}
    >
      <span
        className="font-mono text-[11px] uppercase tracking-[0.16em]"
        style={{ color: tokens.dark, opacity: 0.6 }}
      >
        {item.theme ?? " "}
      </span>

      <p
        className="font-display text-[22px] font-medium leading-tight"
        style={{ color: tokens.dark }}
      >
        {item.on_image_text ?? item.title ?? "No line yet"}
      </p>

      <span
        className="font-mono text-[10px] uppercase tracking-[0.16em]"
        style={{ color: tokens.dark, opacity: 0.45 }}
      >
        Not composed yet
      </span>
    </div>
  );
}

function Card({
  item,
  tokens,
  onSwap,
  swapping,
}: {
  item: ContentItem;
  tokens: StreamTokens;
  onSwap: (id: string) => void;
  swapping: boolean;
}) {
  return (
    <article className="flex flex-col gap-3">
      <Link href={`/app/content/${item.id}`} className="block">
        <Thumb item={item} tokens={tokens} />
      </Link>

      <div className="flex items-baseline justify-between gap-3">
        <MonoLabel tracking="16">{dayLabel(item.scheduled_for)}</MonoLabel>
        {/*
         * ⚠ LE LIBELLÉ D'ANGLE VIENT DE LA BASE, ET IL EST ABSENT QUAND IL
         * DOIT L'ÊTRE. Un post qu'elle a écrit elle-même n'a pas d'angle :
         * l'écran n'écrit pas « Uncategorised », il n'écrit rien.
         */}
        {item.topic?.angle_label ? (
          <span className="text-helper text-ink-2">{item.topic.angle_label}</span>
        ) : null}
      </div>

      <p className="line-clamp-2 text-body leading-prose text-ink">
        {firstLines(item.caption) || "No caption yet."}
      </p>

      {/*
       * ⚠ « Why this one » EST DU TEXTE D'APPUI, JAMAIS UN BADGE. Un badge se
       * lit comme une étiquette de système ; une phrase se lit comme une
       * raison. C'est une raison.
       */}
      {item.rationale ? (
        <p className="text-helper leading-prose text-ink-2">Why this one: {item.rationale}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => onSwap(item.id)}
          disabled={swapping}
          className="px-4 py-1.5 text-helper"
        >
          {swapping ? "Swapping…" : "Swap"}
        </Button>
        <Link
          href={`/app/content/${item.id}`}
          className="rounded-card border border-line px-3 py-1.5 text-helper text-ink-2 hover:text-ink"
        >
          Edit
        </Link>
        {item.status !== "ready" ? (
          <Link
            href={`/app/content/${item.id}`}
            className="rounded-card border border-line px-3 py-1.5 text-helper text-ink-2 hover:text-ink"
          >
            Approve
          </Link>
        ) : (
          <span className="text-helper text-ink-2">Ready</span>
        )}
        {/*
         * ⚠ LE COÛT EST DANS LE LIBELLÉ. Un bouton qui dépense sans le dire
         * transforme une découverte en facture, et la découverte arrive
         * toujours trop tard. « Regenerate » vit sur la page de relecture,
         * pas ici : c'est une action de dernier recours et elle n'a pas à
         * être à portée de doigt trente fois.
         */}
      </div>
    </article>
  );
}

export function ContentStream({
  model,
  tokens,
}: {
  model: ContentMonth;
  tokens: StreamTokens;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /*
   * ⚠ LE FLUX NE MONTRE QUE LE MOIS ÉCRIT PAR EKLIO. Ses propres posts vont
   * dans leur section, et ses brouillons vides ne vont nulle part — ils
   * restent en base. Voir `lib/content/partition.ts`.
   */
  const { generated, hers } = partitionMonth(model);

  async function swap(id: string) {
    setSwappingId(id);
    setNotice(null);
    try {
      const response = await fetch(`/api/content-items/${id}/swap`, { method: "POST" });
      /*
       * ⚠ `code` EST À CÔTÉ DE `error`, PAS DEDANS. Cette ligne lisait
       * `body.error.code` sur un corps où `error` est une CHAÎNE : la branche
       * ci-dessous ne pouvait jamais partir, et une banque vide s'annonçait
       * « réessayez ». Voir `lib/content/respond.ts`.
       */
      const body = (await response.json().catch(() => null)) as
        | { error?: string; code?: string }
        | null;

      if (!response.ok) {
        /*
         * ⚠ LA BANQUE ÉPUISÉE SE DIT, ELLE NE SE RÉESSAIE PAS. Réessayer
         * tirerait le même rien. Et la phrase ne parle pas de « banque » :
         * ce mot est à nous, pas à elle.
         */
        setNotice(
          body?.code === "bank_exhausted"
            ? "There is nothing else for this one yet. Edit it, or come back next month."
            : "That could not be swapped. Try again."
        );
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setNotice("That could not be swapped. Try again.");
    } finally {
      setSwappingId(null);
    }
  }

  /*
   * ⚠ PLUS DE REPLI « Nothing for this month yet » ICI. Un mois sans post
   * généré n'arrive plus jusqu'à ce composant : la page rend `MonthEmpty`,
   * qui dit ce qui va se passer et quand. Deux écrans vides concurrents, dont
   * un moins bon, c'est celui qu'on finit par voir.
   */

  return (
    <div className="flex flex-col gap-6">
      {/*
       * ⚠ `role="alert"`, PAS SEULEMENT DU TEXTE. Un swap est déclenché au
       * clavier comme à la souris, et son refus arrive sans que rien bouge
       * à l'écran : sans annonce, une lectrice d'écran appuie, n'entend rien,
       * et appuie encore. Le dépôt en fait une règle avec un test derrière
       * (`mobile-and-a11y.test.ts`), et c'est ce test qui l'a rattrapé ici.
       */}
      {notice ? (
        <p role="alert" className="text-helper text-ink-2">
          {notice}
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-x-8 gap-y-10 max-lg:grid-cols-2 max-md:grid-cols-1">
        {generated.map((item) =>
          isFailedGeneration(item) ? (
            /*
             * ⚠ PAS UNE GRANDE CARTE BLANCHE. La génération a échoué : elle
             * n'a rien à y faire, et un cadre vide de la taille d'un post lui
             * dit le contraire. Swap reste dominant — le sujet vient de la
             * banque, il y en a un autre.
             */
            <FailedCard
              key={item.id}
              item={item}
              onSwap={swap}
              swapping={swappingId === item.id || pending}
            />
          ) : (
            <Card
              key={item.id}
              item={item}
              tokens={tokens}
              onSwap={swap}
              swapping={swappingId === item.id || pending}
            />
          )
        )}
      </div>

      {hers.length > 0 ? <HerOwnPosts items={hers} /> : null}
    </div>
  );
}

/**
 * Un post généré qui n'a pas abouti.
 *
 * ⚠ IL OCCUPE UNE CELLULE DE LA GRILLE, PAS UNE CARTE. Le mois garde son
 * compte — elle voit qu'il manque quelque chose à cet endroit-là — sans qu'un
 * rectangle vide de 4:5 lui suggère qu'il y a du travail dedans.
 */
function FailedCard({
  item,
  onSwap,
  swapping,
}: {
  item: ContentItem;
  onSwap: (id: string) => void;
  swapping: boolean;
}) {
  return (
    <article className="flex flex-col justify-between gap-4 rounded-card border border-dashed border-line p-5">
      <div className="flex flex-col gap-2">
        <MonoLabel tracking="16">{dayLabel(item.scheduled_for)}</MonoLabel>
        <p className="text-body leading-prose text-ink-2">
          This one didn&rsquo;t come together. Swap for another.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => onSwap(item.id)}
          disabled={swapping}
          className="px-4 py-1.5 text-helper"
        >
          {swapping ? "Swapping…" : "Swap"}
        </Button>
        <Link
          href={`/app/content/${item.id}`}
          className="rounded-card border border-line px-3 py-1.5 text-helper text-ink-2 hover:text-ink"
        >
          Edit
        </Link>
      </div>
    </article>
  );
}

/**
 * Ses propres posts, sous le mois.
 *
 * ⚠ EDIT SEULEMENT. Swap tirerait un sujet de la banque par-dessus ses mots à
 * elle ; Approve accepterait une proposition qu'Eklio n'a pas faite. Les deux
 * boutons étaient là, sur la carte vide que la preview montrait, et aucun des
 * deux n'avait de sens.
 *
 * ⚠ ET SOUS LE FLUX, PAS DEDANS. Mélangés, ses posts et ceux du mois se
 * lisent comme une seule série — alors que l'un est à relire et l'autre est
 * déjà le sien.
 */
export function HerOwnPosts({ items }: { items: ContentItem[] }) {
  return (
    <section className="mt-6 flex flex-col gap-4 border-t border-line pt-8">
      <div className="flex flex-col gap-1">
        <MonoLabel tracking="16">Your own posts</MonoLabel>
        <p className="max-w-[520px] text-helper leading-prose text-ink-2">
          Written by you, not by Eklio. They stay exactly as you left them.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-baseline justify-between gap-3 rounded-card border border-line px-4 py-3"
          >
            <span className="flex flex-wrap items-baseline gap-3">
              <MonoLabel tracking="16">{dayLabel(item.scheduled_for)}</MonoLabel>
              <span className="text-body text-ink">
                {item.title?.trim() || firstLines(item.caption) || "Untitled"}
              </span>
            </span>
            <Link
              href={`/app/content/${item.id}`}
              className="text-helper text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * « 24 of 30 ready ».
 *
 * ⚠ ET LES COMPTEURS À ZÉRO DISPARAISSENT. « 0 posted » le premier jour du
 * mois est une ligne qui ne dit rien et qui se lit comme un reproche. Un
 * compteur apparaît quand il a quelque chose à compter.
 */
export function MonthProgress({ model }: { model: ContentMonth }) {
  /*
   * ⚠ ON NE COMPTE QUE CE QU'EKLIO A ÉCRIT. Le total additionnait tous les
   * items, donc un brouillon qu'elle avait créé elle-même en janvier donnait
   * « 0 of 1 ready » sur un mois où rien n'avait été généré. Le compteur
   * répond à « où en est le mois qu'on m'a écrit », et ses propres posts n'en
   * font pas partie.
   */
  const { generated } = partitionMonth(model);
  const total = generated.length;

  // ⚠ MASQUÉ À ZÉRO, pas affiché « 0 of 0 ». Il n'y a rien à suivre.
  if (total === 0) return null;

  /*
   * ⚠ `ready` ET `posted` VIENNENT DE LA BASE, mais ils comptent TOUS les
   * items, y compris les siens. Ils sont donc bornés au total généré : dire
   * « 3 of 2 ready » serait pire que de ne rien dire.
   */
  const ready = Math.min(model.counts.ready, total);
  const posted = Math.min(model.counts.posted, total);
  const proposed = Math.min(model.counts.proposed ?? 0, total);

  const parts: string[] = [`${ready} of ${total} ready`];
  if (posted > 0) parts.push(`${posted} posted`);
  if (proposed > 0) parts.push(`${proposed} waiting on you`);

  return <p className="text-helper leading-prose text-ink-2">{parts.join(" · ")}</p>;
}
