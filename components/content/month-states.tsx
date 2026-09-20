import { MonoLabel } from "@/components/ui/mono-label";
import { ButtonLink } from "@/components/ui/button";

/*
 * ── TROIS SITUATIONS, TROIS ÉCRANS — ET C'ÉTAIT UN SEUL AVANT ───────────
 *
 * `/app/content` écrivait « Something went wrong. Try again. » pour tout ce
 * qui n'était pas un mois rempli. Trois choses très différentes portaient donc
 * la même phrase :
 *
 *   1. son mois est vide            — NORMAL, et c'est ce qu'elle voit entre
 *                                     l'abonnement et la première génération
 *   2. la base déployée est en retard sur le code, ou la fonctionnalité n'est
 *      pas activée ici             — un environnement, pas une panne
 *   3. quelque chose a vraiment cassé
 *
 * Le premier n'est pas une erreur du tout. Le deuxième n'est pas de son
 * ressort et un réessai n'y changera rien. Seul le troisième mérite
 * « réessayez ».
 *
 * ⚠ ET AUCUN NE MONTRE DE TRACE TECHNIQUE EN PRODUCTION. `detail` n'est rendu
 * que hors production (`lib/env/deploy.ts`), et la décision est prise par
 * l'appelant, pas ici : un composant qui lirait l'environnement lui-même
 * serait un composant qu'on ne peut pas tester dans les deux sens.
 */

/** Ce que le serveur a compris, montré seulement hors production. */
function Detail({ detail, env }: { detail: string | null; env: string | null }) {
  if (!detail) return null;
  return (
    <p className="mt-4 rounded-card border border-line bg-bg-2 px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-2">
      {env ? <span className="uppercase tracking-[0.16em]">{env}</span> : null}
      {env ? " · " : null}
      {detail}
    </p>
  );
}

/**
 * CAS 1 — le mois est vide, et c'est normal.
 *
 * ⚠ CE N'EST PAS UN ÉCRAN D'ERREUR, ET IL NE DOIT PAS EN AVOIR L'AIR. Une
 * grille vide sous un titre de mois se lit comme une panne ; une phrase qui
 * dit ce qui arrive et quand se lit comme une attente.
 *
 * `automatic` dit si la génération mensuelle est armée dans cet
 * environnement. Quand elle ne l'est pas, promettre « le 1er » serait faux —
 * l'écran propose alors ce qui marche vraiment : écrire le premier post
 * elle-même.
 */
export function MonthEmpty({
  monthLabel,
  automatic,
  calendarHref,
  calendarLabel,
}: {
  monthLabel: string;
  automatic: boolean;
  calendarHref: string;
  calendarLabel: string;
}) {
  return (
    <div className="mt-6 flex max-w-[560px] flex-col gap-4 rounded-card border border-dashed border-line p-8">
      <MonoLabel tracking="16">{monthLabel}</MonoLabel>
      <h2 className="font-display text-h2 font-medium leading-tight text-ink">
        Nothing here yet
      </h2>
      <p className="text-body leading-prose text-ink-2">
        {automatic
          ? "Your month is written on the 1st, and it lands here as a set of drafts for you " +
            "to look through. Nothing is posted for you — Eklio writes, you decide."
          : "Monthly writing is not switched on for your account yet. You can still plan and " +
            "write your own posts here in the meantime, and they will sit alongside the " +
            "written ones when it is."}
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={calendarHref} variant="secondary" className="text-helper">
          {calendarLabel}
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * CAS 2 — cet environnement est en retard sur le code.
 *
 * ⚠ PAS « RÉESSAYEZ ». Rien de ce qu'elle peut faire ne changera le résultat :
 * ce sont des migrations non appliquées, ou une fonctionnalité non activée
 * ici. Lui proposer de réessayer, c'est lui faire perdre son temps et lui
 * laisser croire que c'est peut-être de son côté.
 */
export function MonthNotDeployed({
  detail,
  env,
}: {
  detail: string | null;
  env: string | null;
}) {
  return (
    <div className="mt-6 max-w-[560px] rounded-card border border-line p-8">
      <MonoLabel tracking="16">Not switched on here</MonoLabel>
      <p className="mt-3 text-body leading-prose text-ink-2">
        This part of Eklio is not available in this environment yet. Nothing is wrong with your
        account, and there is nothing for you to do — it will appear once it is switched on.
      </p>
      <Detail detail={detail} env={env} />
    </div>
  );
}

/**
 * CAS 3 — une vraie panne.
 *
 * ⚠ `role="alert"`. C'est le seul des trois qui interrompt : les deux autres
 * décrivent un état, celui-ci annonce un échec, et une lectrice d'écran doit
 * l'apprendre sans avoir à re-parcourir la page.
 */
export function MonthFailedToLoad({
  message,
  detail,
  env,
}: {
  message: string;
  detail: string | null;
  env: string | null;
}) {
  return (
    <div role="alert" className="mt-6 max-w-[560px] rounded-card border border-line p-8">
      <MonoLabel tracking="16">This did not load</MonoLabel>
      <p className="mt-3 text-body leading-prose text-ink-2">{message}</p>
      <Detail detail={detail} env={env} />
    </div>
  );
}
