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
  const type = facts.licenseTypeId?.trim();
  if (!type) return null;
  const abbreviation = facts.abbreviation?.trim() || LICENCE_ABBREVIATION[type];
  if (!abbreviation) return null;
  /*
   * ⚠ LE NUMÉRO EST RELU SANS SON SIGLE (F73), même s'il a été enregistré
   * avec : les numéros saisis avant la normalisation sont encore en base.
   */
  const number = normaliseLicenceNumber(facts.licenseNumber, [abbreviation]);
  if (!number) return null;
  return `${abbreviation} ${number}`;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Le numéro sans le sigle qu'on a pu taper devant.
 *
 * ── ⚠ « LMFT LMFT 123456 » SUR TOUTES LES CARTES (F73) ──────────────────
 *
 * `licenceMention` compose `${abréviation} ${numéro}`. Une praticienne qui
 * tape son numéro comme son board l'imprime — « LMFT 123456 », « PSY29384 » —
 * voyait son sigle deux fois sur chaque publication, et aucun contrôle ne le
 * voyait : la mention figurait bien au pied, doublée.
 *
 * Retire en tête, autant de fois qu'il y en a, un sigle de licence connu (ou
 * ceux qu'on passe), avec ses séparateurs (`#`, `:`, `.`, `-`, espaces). Si ce
 * qui reste n'a plus de chiffre, rien n'est retiré : ce n'était pas un sigle
 * devant un numéro, et la règle de forme de la base en jugera.
 */
export function normaliseLicenceNumber(raw: string | null | undefined, extra: string[] = []): string | null {
  const typed = raw?.trim();
  if (!typed) return null;
  const titles = [...new Set([...Object.values(LICENCE_ABBREVIATION), ...extra.map((e) => e.trim()).filter(Boolean)])]
    .sort((a, b) => b.length - a.length)
    .map(escape);
  const lead = new RegExp(`^(?:${titles.join("|")})(?![A-Za-z])[\\s.#:-]*`, "i");
  let rest = typed;
  for (let m = lead.exec(rest); m && m[0].length > 0; m = lead.exec(rest)) rest = rest.slice(m[0].length);
  return /[0-9]/.test(rest) ? rest.trim() : typed;
}

/**
 * Combien de fois un sigle paraît dans un texte, comme mot (collé à des
 * chiffres compris : « LMFT123 » compte).
 */
export function licenceTitleCount(text: string, title: string): number {
  const re = new RegExp(`(?<![A-Za-z])${escape(title.trim())}(?![A-Za-z])`, "gi");
  return [...text.matchAll(re)].length;
}

/**
 * Les sigles qu'un pied de carte porte plus d'une fois. Le sigle de la mention
 * (ce qui précède son premier chiffre) et chaque sigle connu sont comptés.
 */
export function repeatedLicenceTitles(footer: string, mention: string): string[] {
  const head = mention.trim().split(/\s+/);
  const firstDigit = head.findIndex((w) => /[0-9]/.test(w));
  const words = head.slice(0, firstDigit < 0 ? head.length : firstDigit);
  /*
   * ⚠ UNE MENTION DÉJÀ DOUBLÉE (« Psychologist Psychologist 4521 ») a pour sigle
   * son motif de base : sinon le bloc doublé ne paraît qu'une fois, et passe.
   */
  let unit = words.length;
  for (let k = 1; k <= words.length / 2; k += 1) {
    if (words.length % k === 0 && words.every((w, i) => w.toLowerCase() === words[i % k].toLowerCase())) {
      unit = k;
      break;
    }
  }
  const own = words.slice(0, unit).join(" ");
  const titles = [...new Set([own, ...Object.values(LICENCE_ABBREVIATION)].filter(Boolean))];
  return titles.filter((t) => licenceTitleCount(footer, t) > 1);
}

/**
 * Ce qu'on répond à une praticienne dont le brief n'a pas de quoi le porter.
 *
 * ⚠ IL NOMME LE CHAMP. « Le brief est incomplet » envoie chercher dans onze
 * champs ; « il manque le numéro de licence » se règle en trente secondes.
 */
export function licenceMissingMessage(facts: LicenceFacts): string | null {
  if (licenceMention(facts)) return null;
  /*
   * ⚠ ET IL DIT OÙ LE REMPLIR (F64). Le numéro a une seule autorité,
   * `project_briefs.license_number` ; la praticienne l'écrit depuis Réglages ou
   * depuis l'éditeur de site, et les deux y aboutissent. Nommer la colonne sans
   * nommer l'écran envoyait une praticienne chercher un champ qu'elle ne voit pas.
   */
  const missing: string[] = [];
  const where: string[] = [];
  if (!facts.licenseNumber?.trim()) {
    missing.push("le numéro de licence (`license_number`)");
    where.push(
      "le numéro se remplit dans Settings → Practice details → « License number » (/app/settings), " +
        "ou dans l'éditeur de site, panneau « Your details »"
    );
  }
  if (!facts.licenseTypeId?.trim()) {
    missing.push("le type de licence (`license_type_id`)");
    where.push("le type se choisit à l'étape licence du brief");
  }
  if (missing.length === 0) {
    missing.push(`une abréviation pour « ${facts.licenseTypeId} » (\`license_type_states.abbreviation\`)`);
    where.push("l'abréviation vient de la matrice des États, vérifiée à la main (docs/production/F12-comment-verifier.md)");
  }
  return (
    `impossible de générer un mois : ${missing.join(" et ")} manque au brief. ` +
    `Où : ${where.join(" ; ")}. ` +
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
