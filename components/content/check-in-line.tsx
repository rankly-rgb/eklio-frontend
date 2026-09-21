"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { CheckInCard } from "@/components/content/check-in-card";
import type { ContentCheckin } from "@/lib/data/content";

/*
 * ── LE CHECK-IN, UNE FOIS RÉPONDU, DEVIENT UNE LIGNE ────────────────────
 *
 * Les trois questions sont inchangées sur le fond — elles sont dans
 * `CheckInCard`, et ce fichier ne les réécrit pas. Ce qu'il change est ce qui
 * arrive APRÈS la réponse : la carte se replie en
 *
 *   « This month: burnout, taking new clients, closed the week of the 20th · Edit »
 *
 * Une carte qui reste dépliée après avoir été remplie est une carte qui
 * redemande. Une ligne dit la même chose et rend l'écran au contenu.
 *
 * ⚠ LA RÉASSURANCE RESTE VISIBLE DANS LA CARTE DÉPLIÉE. Elle n'est pas dans la
 * ligne repliée parce qu'il n'y a plus rien à écrire à ce moment-là, et
 * qu'elle réapparaît dès qu'elle rouvre pour écrire.
 */

const TAKING: Record<string, string> = {
  yes: "taking new clients",
  waitlist: "waitlist only",
  no: "not taking new clients",
};

/*
 * ── NETTOYER SANS RÉÉCRIRE ──────────────────────────────────────────────
 *
 * La ligne collait ses réponses bout à bout telles quelles, ce qui donnait
 *
 *   « This month: Burnout, mostly., taking new clients · Edit »
 *
 * — un point au milieu d'une énumération, une majuscule au milieu d'une
 * phrase, et une virgule qui suit un point.
 *
 * ⚠ CE SONT SES MOTS ET ILS LE RESTENT. Aucun modèle n'intervient, rien n'est
 * reformulé : on retire une ponctuation finale, on replie les espaces, on met
 * la première lettre en bas de casse quand le mot n'est pas un nom propre, et
 * on coupe proprement si c'est long. Tout est déterministe et réversible de
 * tête ; si le résultat surprend, la règle est lisible.
 */

/** Une réponse longue est coupée ici, sur un mot, jamais au milieu. */
const MAX_ANSWER = 48;

/*
 * ⚠ LA CASSE N'EST PAS TOUCHÉE, ET C'EST UNE DÉCISION.
 *
 * Le brief montre « This month: burnout, taking new clients », en bas de
 * casse. J'ai d'abord écrit une règle qui abaissait la première lettre quand
 * le mot semblait ordinaire — et le test l'a cassée sur « Portland clients »,
 * qui devenait « portland clients ».
 *
 * Il n'existe pas de règle déterministe qui distingue « Burnout » (un début de
 * phrase) de « Portland » (un nom de ville) : les deux sont un mot capitalisé
 * suivi de minuscules. Un dictionnaire serait faux à la première ville
 * inconnue, et un modèle est explicitement exclu ici.
 *
 * Donc on ne touche pas. Si elle écrit « Burnout, mostly. », la ligne dit
 * « This month: Burnout, mostly ». La majuscule est la sienne ; la corriger
 * serait réécrire son texte, ce qui est précisément ce que cette ligne ne doit
 * pas faire. Le bas de casse du brief vient de ce que la praticienne de
 * l'exemple avait tapé en bas de casse.
 */

/** Une réponse d'elle, prête à entrer dans une énumération. */
export function tidyAnswer(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Espaces repliés, y compris les retours à la ligne d'un champ multiligne.
  let text = raw.replace(/\s+/g, " ").trim();
  if (text === "") return null;

  // ⚠ LA PONCTUATION FINALE PART, et seulement elle. Un point d'interrogation
  // au milieu de sa phrase reste : c'est le sien.
  text = text.replace(/[.,;:!?\s]+$/u, "");
  if (text === "") return null;

  if (text.length > MAX_ANSWER) {
    const cut = text.slice(0, MAX_ANSWER);
    const lastSpace = cut.lastIndexOf(" ");
    // ⚠ SUR UN MOT. Couper « burnout at the retu… » se lit comme un bug.
    text = (lastSpace > MAX_ANSWER / 2 ? cut.slice(0, lastSpace) : cut).replace(
      /[.,;:!?\s]+$/u,
      ""
    );
    text += "…";
  }

  return text;
}

/**
 * Ce que la ligne dit, dans l'ordre où elle l'a écrit. Les vides sautent.
 *
 * Format du brief : « This month: burnout, taking new clients · Edit ».
 */
export function checkInSummary(checkin: ContentCheckin | null): string | null {
  if (!checkin) return null;
  const parts = [
    tidyAnswer(checkin.sessions_theme),
    checkin.taking_clients ? TAKING[checkin.taking_clients] : null,
    tidyAnswer(checkin.happening),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

export function CheckInLine({
  brandKitId,
  month,
  monthLabel,
  checkin,
  answered,
}: {
  brandKitId: string;
  month: string;
  monthLabel: string;
  checkin: ContentCheckin | null;
  answered: boolean;
}) {
  const [open, setOpen] = useState(!answered);

  if (open) {
    return (
      <div className="max-w-[720px]">
        <CheckInCard
          brandKitId={brandKitId}
          month={month}
          monthLabel={monthLabel}
          initial={checkin}
        />
        {answered ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-helper text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            Done
          </button>
        ) : null}
      </div>
    );
  }

  const summary = checkInSummary(checkin);

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <MonoLabel tracking="16">This month</MonoLabel>
      <p className="text-helper leading-prose text-ink-2">
        {summary ?? "nothing noted"}
        {" · "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="underline underline-offset-2 hover:text-ink"
        >
          Edit
        </button>
      </p>
    </div>
  );
}
