"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/site/copy-chip";
import { MonoLabel } from "@/components/ui/mono-label";
import type { DirectoryProfileView } from "@/lib/data/directory";
import type { StructuredFields } from "@/lib/directory/profile";

/*
 * ── LE PROFIL PSYCHOLOGY TODAY, À L'ÉCRAN ───────────────────────────────
 *
 * L'offre promet « son profil Psychology Today intégral rédigé ». Ce n'est pas
 * un texte : c'est un FORMULAIRE plus une prose, et les deux se collent à des
 * endroits différents de l'annuaire. L'écran suit cette forme au lieu de les
 * fondre en un seul bloc qu'elle devrait redécouper elle-même.
 *
 * ⚠ LE PREMIER PARAGRAPHE EST SON PROPRE BLOC, et ce n'est pas une mise en
 * page. Deux raisons, toutes deux écrites dans `lib/directory/profile.ts` :
 * c'est le SEUL morceau que les résultats de recherche de l'annuaire
 * affichent, et c'est celui que The First Line (L6) réécrira. Il porte donc
 * son propre bouton de copie et sa propre ancre (`#directory-first-paragraph`),
 * pour qu'un lot ultérieur puisse le viser sans toucher au reste.
 */

const FIELD_LABELS: Record<keyof StructuredFields, string> = {
  licensed_state: "Licensed in",
  issues: "Issues",
  therapy_types: "Types of therapy",
  client_focus: "Client focus",
  insurance: "Insurance",
};

/*
 * L'ordre du formulaire de l'annuaire, pas l'ordre alphabétique ni celui des
 * clés de l'objet. Une praticienne qui recopie champ par champ descend la page
 * une fois.
 */
const FIELD_ORDER: (keyof StructuredFields)[] = [
  "licensed_state",
  "issues",
  "therapy_types",
  "client_focus",
  "insurance",
];

function StructuredBlock({ fields }: { fields: StructuredFields }) {
  const present = FIELD_ORDER.filter((key) => (fields[key]?.length ?? 0) > 0);

  if (present.length === 0) {
    /*
     * ⚠ UN CAS NORMAL, PAS UNE PANNE — `profile.test.ts` a son test pour ça.
     * Une praticienne qui n'a coché aucune spécialité et n'a pas donné d'état
     * n'a rien à recopier ici, et le dire est plus utile qu'un cadre vide.
     */
    return (
      <p className="text-helper leading-prose text-ink-2">
        Nothing to fill in yet — these come from your brief. Add a state and a
        specialty there and they will appear here.
      </p>
    );
  }

  return (
    <dl className="flex flex-col gap-4">
      {present.map((key) => {
        const values = fields[key] ?? [];
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <dt>
              <MonoLabel as="span">{FIELD_LABELS[key]}</MonoLabel>
            </dt>
            {/*
              Une valeur par ligne plutôt qu'une liste séparée par des virgules :
              le formulaire de l'annuaire les prend une par une, et une chaîne
              jointe se recoupe mal. C'est aussi ce que
              `buildDirectoryProfile` refuse de faire en amont — il ne joint
              rien et n'insère aucun séparateur.
            */}
            <dd className="flex flex-wrap gap-x-2 gap-y-1 text-ui text-ink">
              {values.map((value) => (
                <span
                  key={value}
                  className="rounded-pill border border-line px-2.5 py-1 text-helper"
                >
                  {value}
                </span>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * ⚠ LE DÉCLENCHEUR, ICI ET PAS AILLEURS.
 *
 * La génération s'appelle depuis l'écran du profil : c'est l'endroit où son
 * absence est VISIBLE, où la cliente est déjà venue pour ce livrable, et le
 * seul où « écrivez-le » répond à une question qu'elle vient de se poser.
 *
 * Les trois autres places envisagées et écartées, pour que le choix se relise :
 * la révélation (elle n'a pas encore choisi de direction, donc pas de kit à
 * quoi rattacher un profil) ; le pipeline de génération du kit (il coûterait
 * un appel modèle de plus à CHAQUE kit, y compris aux paliers qui ne vendent
 * pas ce livrable) ; la checklist de lancement (l'étape « update_directory »
 * est une course sur le site d'un tiers, pas un endroit où l'on attend
 * soixante secondes).
 *
 * Une seconde génération réécrit : `save_directory_profile` fait un
 * `on conflict (brand_kit_id, platform) do update`, donc il n'y a jamais deux
 * profils pour une même praticienne.
 */
function WriteItButton({
  brandKitId,
  hasProse,
}: {
  brandKitId: string;
  hasProse: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setError(null);
    setRunning(true);
    try {
      /* L'identifiant est passé en prop, pas dérivé de l'URL courante : une
         route déplacée casserait un `replace` sans que rien ne le dise. */
      const response = await fetch(`/api/brand-kits/${brandKitId}/directory`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "We could not write it just now. Try again in a moment.");
        return;
      }
      /* La page est un composant serveur : c'est elle qui relit la base. */
      startTransition(() => router.refresh());
    } catch {
      setError("We could not reach the server. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button onClick={run} disabled={running || pending}>
          {running || pending
            ? "Writing…"
            : hasProse
              ? "Write it again"
              : "Write my statement"}
        </Button>
      </div>
      {error === null ? null : (
        <p className="text-helper leading-prose text-ink-2">{error}</p>
      )}
    </div>
  );
}

function ProseAbsent({ issue }: { issue: DirectoryProfileView["proseIssue"] }) {
  /*
   * ⚠ DEUX ABSENCES, DEUX PHRASES. « Rien n'a été produit » et « ce qui est
   * rangé ne passe plus les bornes » envoient chercher à deux endroits
   * différents ; les confondre sous un « indisponible » fait perdre la
   * journée de celle qui cherche.
   */
  if (issue === "stored_prose_rejected") {
    return (
      <p className="text-helper leading-prose text-ink-2">
        Your profile text is saved but did not pass our own length and
        repetition checks, so we are not showing it rather than handing you
        something to publish that we would not stand behind. This is on us —
        write in and we will regenerate it.
      </p>
    );
  }

  return (
    <p className="text-helper leading-prose text-ink-2">
      Your profile text has not been written yet. The fields above come from
      your brief and are ready to copy now; the paragraphs come from a
      generation that has not run for this kit.
    </p>
  );
}

export function DirectoryProfile({
  brandKitId,
  view,
}: {
  brandKitId: string;
  view: DirectoryProfileView;
}) {
  const { structured, prose, proseIssue } = view;

  return (
    <div className="flex max-w-[720px] flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-subsection font-medium text-ink">
            The form fields
          </h3>
          <p className="text-helper leading-prose text-ink-2">
            These are the checkboxes and dropdowns on your Psychology Today
            profile, filled in from what you told us.
          </p>
        </div>
        <StructuredBlock fields={structured} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-subsection font-medium text-ink">
            Your personal statement
          </h3>
          <p className="text-helper leading-prose text-ink-2">
            The first paragraph is the only part that shows in search results.
            It is separate here because that is how it will be read — and
            because it is the one piece you are most likely to rewrite.
          </p>
        </div>

        {prose === null ? (
          <div className="flex flex-col gap-4">
            <ProseAbsent issue={proseIssue} />
            <WriteItButton brandKitId={brandKitId} hasProse={false} />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/*
              ⚠ L'ANCRE ET LE BOUTON PROPRES AU PREMIER PARAGRAPHE. The First
              Line (L6) réécrit CE bloc-là et pas la suite ; lui donner son
              identité maintenant évite d'avoir à découper l'écran ensuite.
            */}
            <div
              id="directory-first-paragraph"
              className="flex flex-col gap-2 rounded-card border border-line p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <MonoLabel as="span">First paragraph</MonoLabel>
                <CopyButton text={prose.firstParagraph} variant="secondary">
                  Copy
                </CopyButton>
              </div>
              <p className="whitespace-pre-wrap text-ui leading-prose text-ink">
                {prose.firstParagraph}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <MonoLabel as="span">The rest</MonoLabel>
                <CopyButton text={prose.body} variant="secondary">
                  Copy
                </CopyButton>
              </div>
              <p className="whitespace-pre-wrap text-ui leading-prose text-ink">
                {prose.body}
              </p>
            </div>

            {/*
              Le tout d'un bloc, parce que le formulaire de l'annuaire n'a
              qu'un seul champ pour les deux. Assemblé ICI, à l'affichage —
              `buildDirectoryProfile` refuse délibérément de fabriquer cette
              chaîne, pour qu'une relecture ultérieure n'ait pas à la
              redécouper.
            */}
            <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
              <WriteItButton brandKitId={brandKitId} hasProse />
              <CopyButton text={`${prose.firstParagraph}\n\n${prose.body}`}>
                Copy the whole statement
              </CopyButton>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
