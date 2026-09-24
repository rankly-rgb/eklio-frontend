/*
 * ── ⚠ QUATRE CENTS POSTS PRODUITS, ZÉRO NUMÉRO DE LICENCE ───────────────
 *
 * Trouvé par l'audit du corpus (F35). Californie B&P §4980.44 (LMFT), §4996.2
 * (LCSW) et §4999.80 (LPCC) exigent le TYPE et le NUMÉRO de licence dans
 * **toute** publicité ; d'autres États imposent l'équivalent. Chacun des
 * quatre cents posts déjà produits est une infraction publicitaire en l'état.
 *
 * ⚠ ET CE N'ÉTAIT PAS UN DÉFAUT DE CONTRÔLE. `project_briefs` portait déjà
 * `license_type_id` et `state`, mais aucune colonne pour le numéro : aucun
 * contrôle ne peut exiger ce qu'il n'y a rien à mettre. C'est la raison pour
 * laquelle le trou a tenu quatre cents posts, et la raison pour laquelle il se
 * corrige par une migration avant de se corriger par un contrôle.
 *
 * ── LA RÈGLE LA PLUS STRICTE, PAS CINQUANTE RÈGLES ──────────────────────
 *
 * Les cinquante-et-un territoires servis n'imposent pas la même chose : tous
 * exigent le titre, une partie exige le numéro. Gérer cinquante variantes
 * demanderait de vérifier cinquante boards et de maintenir la matrice
 * ensuite ; appliquer la plus stricte partout demande un champ. Le produit
 * porte donc **abréviation + numéro** dans chaque publicité, partout.
 */

/**
 * L'abréviation par défaut d'un type de licence.
 *
 * ⚠ ELLE EST UN REPLI, PAS LA SOURCE. `license_type_states.abbreviation`
 * existe précisément pour qu'un board qui imprime autrement ait sa propre
 * valeur — la Californie écrit `PSY` là où un autre État écrira
 * `Licensed Psychologist`. Cette table-ci sert quand la matrice ne dit rien.
 */
export const LICENCE_ABBREVIATION: Record<string, string> = {
  lmft: "LMFT",
  lcsw: "LCSW",
  lpcc: "LPCC",
  lpc: "LPC",
  lcpc: "LCPC",
  lmhc: "LMHC",
  lmsw: "LMSW",
  licsw: "LICSW",
  lsw: "LSW",
  licensed_psychologist: "PSY",
};

export type LicenceFacts = {
  licenseTypeId: string | null | undefined;
  licenseNumber: string | null | undefined;
  /** Ce que le board de l'État imprime, quand la matrice le dit. */
  abbreviation?: string | null;
};

/**
 * La mention qui doit paraître sur chaque publication, ou `null`.
 *
 * ⚠ `null` N'EST PAS UNE MENTION VIDE : c'est un mois qu'on ne génère pas.
 * Rendre une chaîne vide ferait passer le contrôle en imprimant rien, ce qui
 * est exactement l'état des quatre cents posts déjà produits.
 */
export function licenceMention(facts: LicenceFacts): string | null {
  const number = facts.licenseNumber?.trim();
  if (!number) return null;
  const type = facts.licenseTypeId?.trim();
  if (!type) return null;
  const abbreviation = facts.abbreviation?.trim() || LICENCE_ABBREVIATION[type];
  if (!abbreviation) return null;
  return `${abbreviation} ${number}`;
}

/**
 * Ce qu'on répond à une praticienne dont le brief n'a pas de quoi le porter.
 *
 * ⚠ IL NOMME LE CHAMP. « Le brief est incomplet » envoie chercher dans onze
 * champs ; « il manque le numéro de licence » se règle en trente secondes.
 */
export function licenceMissingMessage(facts: LicenceFacts): string | null {
  if (licenceMention(facts)) return null;
  const missing: string[] = [];
  if (!facts.licenseNumber?.trim()) missing.push("le numéro de licence (`license_number`)");
  if (!facts.licenseTypeId?.trim()) missing.push("le type de licence (`license_type_id`)");
  if (missing.length === 0) {
    missing.push(`une abréviation pour « ${facts.licenseTypeId} » (\`license_type_states.abbreviation\`)`);
  }
  return (
    `impossible de générer un mois : ${missing.join(" et ")} manque au brief. ` +
    `La Californie et d'autres États exigent le type ET le numéro de licence dans TOUTE publicité ; ` +
    `un post sans cette mention est une infraction publicitaire, et le produit ne l'écrit pas.`
  );
}

/**
 * La mention est-elle portée par ce pied de carte ?
 *
 * ⚠ ON CHERCHE LA MENTION EXACTE, PAS SES MORCEAUX. Un pied qui porterait
 * « LMFT » sans numéro, ou le numéro sans le titre, satisferait deux tests
 * séparés et aucune règle de board.
 */
export function footerCarriesLicence(footer: string | undefined, mention: string): boolean {
  if (!footer) return false;
  const flat = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  return flat(footer).includes(flat(mention));
}
