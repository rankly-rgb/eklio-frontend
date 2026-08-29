import type { PracticeDetails } from "@/lib/site/types";

/*
 * Les coordonnées — et le seul champ qui mérite qu'on le réclame.
 *
 * ── `practitioner_name` ──────────────────────────────────────────────────
 *
 * Le nom de la praticienne, distinct du nom de la practice. Un site de
 * thérapie qui ne nomme pas la thérapeute n'est pas seulement une page
 * incomplète : c'est la publicité d'une pratique sous licence qui ne nomme pas
 * la licenciée. C'est donc LE détail sur lequel on insiste quand il est vide,
 * et le seul.
 *
 * ── Pourquoi c'est conditionné à la PRÉSENCE de la clé ───────────────────
 *
 * Le champ arrive côté base après ce lot. Rendre le contrôle avant qu'il
 * existe donnerait une écriture refusée en `unknown_field` sur un contrôle que
 * la praticienne vient de remplir. On le rend donc dès que la clé apparaît
 * dans `practice_details`, et pas avant — aucun déploiement à faire le jour où
 * elle arrive.
 *
 * `null` et `""` comptent comme PRÉSENTS : la clé est là, la valeur est vide,
 * c'est exactement le cas où il faut la réclamer.
 */

export const PRACTITIONER_NAME_KEY = "practitioner_name" as const;

/** La base expose-t-elle le champ ? (La clé, pas sa valeur.) */
export function hasPractitionerName(details: PracticeDetails): boolean {
  return Object.hasOwn(details, PRACTITIONER_NAME_KEY);
}

/** Le champ existe et n'est pas rempli — le seul cas qu'on signale. */
export function practitionerNameMissing(details: PracticeDetails): boolean {
  return (
    hasPractitionerName(details) &&
    (details.practitioner_name ?? "").trim() === ""
  );
}

/**
 * Les champs de coordonnées, dans l'ordre où ils se lisent.
 *
 * `practitioner_name` EN PREMIER quand il est là : c'est le nom qui apparaît
 * sur le site, avant celui de la structure.
 */
export type DetailField = { key: keyof PracticeDetails; label: string };

const AFTER_NAME: DetailField[] = [
  { key: "practice_name", label: "Practice name" },
  { key: "license_label", label: "License" },
  { key: "license_number", label: "License number" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

export function detailFields(details: PracticeDetails): DetailField[] {
  return hasPractitionerName(details)
    ? [{ key: PRACTITIONER_NAME_KEY, label: "Your name" }, ...AFTER_NAME]
    : AFTER_NAME;
}
