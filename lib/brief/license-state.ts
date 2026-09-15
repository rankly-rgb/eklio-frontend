import type { LicenseTypeState } from "@/lib/catalog/types";

/*
 * ── UN TITRE APPARTIENT À UNE JURIDICTION ───────────────────────────────
 *
 * ⚠ TROUVÉ SUR LE CHEMIN DE PRODUCTION RÉEL. La prose du profil annonçait
 * « I'm a Licensed Mental Health Counselor (LMHC) in Portland, Oregon ».
 * L'Oregon ne délivre pas de LMHC : le titre y est LPC. Et le modèle n'avait
 * rien inventé — le brief portait `license_type_id = 'lmhc'` avec
 * `state = 'OR'`, parce que rien, nulle part, ne savait qu'un titre est
 * rattaché à un État. `license_types` est un catalogue national et sans État ;
 * l'écran 1 proposait donc les dix titres quel que soit l'État tapé deux
 * champs plus bas.
 *
 * Un titre d'exercice faux sur une page publique n'est pas une coquille :
 * c'est un problème devant le board de la praticienne.
 *
 * ── CE MODULE NE PORTE AUCUNE DONNÉE ────────────────────────────────────
 *
 * La matrice « quel État délivre quel titre » vit EN BASE
 * (`license_type_states`, §6), comme tous les autres catalogues, et la base
 * est aussi celle qui REFUSE à l'écriture
 * (`project_briefs_license_state_gate`). Ce fichier ne porte que la règle,
 * pure, pour que l'écran 1 puisse filtrer ses puces AVANT qu'elle ne choisisse
 * — un refus après coup serait un mur, pas une aide.
 *
 * ⚠ LE FRONT N'EST PAS L'AUTORITÉ, ET NE DOIT PAS SE LIRE COMME TEL. Ce qui
 * décide est le trigger. Ceci décide de ce qu'on MONTRE.
 */

/** Le code USPS, tel qu'on le compare — elle tape ce qu'elle veut. */
export function normalizeState(state: string | null | undefined): string | null {
  const trimmed = (state ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
}

/**
 * Les titres que cet État délivre.
 *
 * ⚠ UN ÉTAT NON RENSEIGNÉ NE FILTRE RIEN, et rend donc `null` plutôt qu'une
 * liste vide. La différence est tout le sujet : une liste vide dirait « cet
 * État ne délivre aucun de nos titres », ce qui viderait l'écran 1 de la
 * praticienne qui n'a pas encore tapé son État. `null` veut dire « la question
 * n'est pas encore posée », et l'appelant montre alors tout.
 */
export function titlesIssuedIn(
  state: string | null | undefined,
  matrix: LicenseTypeState[]
): Set<string> | null {
  const code = normalizeState(state);
  if (!code) return null;

  return new Set(
    matrix
      .filter((row) => row.state_code.toUpperCase() === code)
      .map((row) => row.license_type_id)
  );
}

/**
 * Ce couple est-il possible ?
 *
 * ⚠ LES DEUX MOITIÉS ABSENTES RENDENT `true`, et ce n'est pas de la
 * permissivité : un brief incomplet n'est pas un brief faux. L'écran 1 a déjà
 * ses phrases pour « choisis ta licence » et « dis-nous où » ; y superposer
 * « ce titre n'existe pas dans un État que tu n'as pas encore nommé » serait
 * une erreur sur une question qu'on n'a pas posée. Même prédicat, mêmes
 * bornes, que `license_state_allowed()` en base.
 */
export function licenseAllowedInState(
  licenseTypeId: string | null | undefined,
  state: string | null | undefined,
  matrix: LicenseTypeState[]
): boolean {
  if (!licenseTypeId) return true;

  /*
   * ⚠ UNE MATRICE VIDE N'EST PAS UN ÉTAT QUI NE DÉLIVRE RIEN, et confondre les
   * deux refusait TOUS les briefs — trouvé par la sonde, pas par relecture.
   *
   * `titlesIssuedIn` rend un Set vide pour un État absent de la matrice, ce
   * qui est juste quand la matrice existe : ce Set-là veut dire « cet État ne
   * délivre aucun de nos dix titres ». Mais `stepIssue` déclare `matrix = []`
   * par défaut, pour qu'un appelant qui ne la câble pas ne vérifie rien. Sans
   * la ligne ci-dessous, ce défaut-là refusait chaque couple au lieu de n'en
   * refuser aucun — un mur, sur tous les briefs, faute d'un argument.
   *
   * C'est le défaut permissif du README dans l'autre sens : pas « ça accepte
   * ce qu'il ne fallait pas », mais « ça refuse tout », et les deux se
   * présentent comme un résultat plausible.
   */
  if (matrix.length === 0) return true;

  const issued = titlesIssuedIn(state, matrix);
  if (issued === null) return true;

  return issued.has(licenseTypeId);
}
