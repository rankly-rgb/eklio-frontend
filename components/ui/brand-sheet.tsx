import type { BriefDraft } from "@/lib/brief/schemas";
import {
  EMOTION_OPTIONS,
  FAMILLE_CHROMATIQUE_OPTIONS,
  METIER_OPTIONS,
  OBJECTIF_SITE_OPTIONS,
  SPECIALTY_OPTIONS,
  STYLE_TYPOGRAPHIQUE_OPTIONS,
  TONE_SLIDERS,
  optionLabel,
} from "@/lib/brief/steps";

type Entry = { key: string; value: string | undefined };

function truncate(value: string | undefined, max = 64): string | undefined {
  if (!value || value.trim() === "") return undefined;
  const clean = value.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function labels(
  options: { value: string; label: string }[],
  values: string[] | undefined
): string | undefined {
  if (!values || values.length === 0) return undefined;
  const found = values
    .map((v) => optionLabel(options, v))
    .filter((v): v is string => v !== undefined);
  return found.length > 0 ? found.join(" · ") : undefined;
}

/* Mots de ton retenus : le pôle vers lequel chaque curseur penche. */
function toneWords(draft: BriefDraft): string | undefined {
  const words = TONE_SLIDERS.map(({ name, left, right }) => {
    const value = draft[name];
    if (typeof value !== "number" || value === 3) return undefined;
    return value < 3 ? left : right;
  }).filter((v): v is string => v !== undefined);
  return words.length > 0 ? words.join(" · ") : undefined;
}

export function buildBrandSheetEntries(
  projectName: string,
  draft: BriefDraft
): Entry[] {
  // `metier` porte le type de licence ; « autre » est la branche libre.
  const license =
    draft.metier === "autre"
      ? truncate(draft.metier_autre)
      : optionLabel(METIER_OPTIONS, draft.metier);

  return [
    { key: "practice", value: truncate(draft.nom_activite) ?? projectName },
    { key: "license", value: license },
    { key: "specialties", value: labels(SPECIALTY_OPTIONS, draft.specialties) },
    { key: "offer", value: truncate(draft.offre_principale) },
    { key: "problem", value: truncate(draft.probleme_resolu) },
    { key: "gains", value: truncate(draft.resultat_client) },
    { key: "ideal client", value: truncate(draft.cible_description) },
    { key: "tone", value: toneWords(draft) },
    { key: "feelings", value: labels(EMOTION_OPTIONS, draft.emotions) },
    {
      key: "palette",
      value: labels(FAMILLE_CHROMATIQUE_OPTIONS, draft.familles_chromatiques),
    },
    {
      key: "typography",
      value: optionLabel(STYLE_TYPOGRAPHIQUE_OPTIONS, draft.style_typographique),
    },
    {
      key: "site goal",
      value: optionLabel(OBJECTIF_SITE_OPTIONS, draft.objectif_site),
    },
    { key: "action", value: truncate(draft.action_attendue) },
  ];
}

/*
 * La fiche de marque en construction — seule zone crème de l'écran.
 * Chaque champ renseigné apparaît en `clé : valeur` ; les champs vides
 * restent en pointillés avec le libellé grisé.
 */
export function BrandSheet({
  projectName,
  draft,
}: {
  projectName: string;
  draft: BriefDraft;
}) {
  const entries = buildBrandSheetEntries(projectName, draft);

  return (
    <section
      aria-label="Brand sheet in progress"
      className="rounded bg-accent-surface p-5"
    >
      <h2 className="label-mono mb-4 text-ink-soft">Brand sheet</h2>
      <dl className="flex flex-col gap-2.5 font-mono text-xs leading-relaxed">
        {entries.map(({ key, value }) => (
          <div key={key} className="flex items-baseline gap-2">
            {value !== undefined ? (
              <>
                <dt className="shrink-0 text-ink-soft">{key}:</dt>
                <dd className="min-w-0 break-words text-ink">{value}</dd>
              </>
            ) : (
              <>
                <dt className="shrink-0 text-ink-muted">{key}:</dt>
                <dd
                  aria-label="not filled in yet"
                  className="flex-1 self-center border-b border-dotted border-ink-muted"
                />
              </>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
