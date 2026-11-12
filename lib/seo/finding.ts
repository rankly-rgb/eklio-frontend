/**
 * Un constat de contrôle : le nom de la règle et ce qui l'a fait échouer, en
 * clair. La même forme que `lib/content/month-checks.ts` (`{check, detail}`),
 * pour qu'un rapport de pièce se lise comme un rapport de mois.
 *
 * Le `detail` est renvoyé TEL QUEL au rédacteur lors de la réécriture ciblée :
 * il doit dire quoi corriger, pas seulement que c'est faux.
 */
export type Finding = { check: string; detail: string };
