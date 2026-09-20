import { MonoLabel } from "@/components/ui/mono-label";

/*
 * ── LA PREMIÈRE OUVERTURE : LE MOIS SE CONSTRUIT ────────────────────────
 *
 * ⚠ PAS DE POURCENTAGE, ET PAS DE SPINNER NU.
 *
 * Un pourcentage suppose qu'on sait combien il reste, ce qui est faux : la
 * rédaction part en Batch et revient quand elle revient. Un chiffre inventé
 * qui avance tout seul est un mensonge que l'écran répète chaque seconde.
 *
 * Un spinner nu dit « attendez » sans dire de quoi. Ce qui rassure n'est pas
 * le mouvement, c'est de savoir ce qui se passe — donc la liste de ce qui est
 * en train d'être fait, dans l'ordre où ça se fait.
 *
 * Les quatre étapes sont celles du pipeline réel, dans son ordre réel :
 * tirage dans la banque, rédaction, relecture déontologique, composition.
 */

const STEPS = [
  "Choosing this month's subjects",
  "Writing the captions",
  "Checking every line against the ACA and APA guidance",
  "Composing the cards",
] as const;

export function MonthGenerating({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="mt-8 flex max-w-[560px] flex-col gap-5 rounded-card border border-line p-8">
      <MonoLabel tracking="16">{monthLabel}</MonoLabel>
      <h2 className="font-display text-h2 font-medium leading-tight text-ink">
        Your month is being put together.
      </h2>
      <p className="text-body leading-prose text-ink-2">
        Nothing is needed from you. It will be here when you come back, and you will be able
        to change any of it.
      </p>
      <ul className="flex flex-col gap-2">
        {STEPS.map((step) => (
          <li key={step} className="text-helper leading-prose text-ink-2">
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Un mois qui a échoué. Il le dit, et il dit ce qui n'a PAS été dépensé.
 *
 * ⚠ « Nothing was charged » EST LA PHRASE QUI COMPTE ICI. Un mois raté sur un
 * produit à crédits laisse immédiatement la question « est-ce que ça m'a coûté
 * quelque chose », et une page qui ne répond pas fabrique un ticket de
 * support. Le ledger libère toute réservation non réglée (quinze minutes), et
 * c'est vrai indépendamment de ce que cet écran dit — l'écran ne fait que le
 * rapporter.
 */
export function MonthFailed({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="mt-8 flex max-w-[560px] flex-col gap-4 rounded-card border border-line p-8">
      <MonoLabel tracking="16">{monthLabel}</MonoLabel>
      <h2 className="font-display text-h2 font-medium leading-tight text-ink">
        This month did not come together.
      </h2>
      <p className="text-body leading-prose text-ink-2">
        We are looking at it. Nothing was charged, and last month is still where you left it.
      </p>
    </div>
  );
}
