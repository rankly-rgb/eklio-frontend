/*
 * Les tokens de l'app, RECOPIÉS pour l'e-mail et pour les pages autonomes.
 *
 * POURQUOI UNE COPIE — `styles/tokens.css` est la seule source des couleurs de
 * l'application, et cette règle tient partout où il y a une feuille de style.
 * Deux surfaces n'en ont pas :
 *
 *   - les E-MAILS. Aucun client e-mail sérieux ne résout `var(--ink)` ; les
 *     couleurs doivent être écrites en littéral dans les attributs `style`.
 *   - la page de DÉSINSCRIPTION, qui est servie en HTML nu par un route
 *     handler, sans le bundle CSS de l'application : elle est cliquée depuis
 *     un client e-mail et doit s'afficher même si tout le reste est
 *     indisponible.
 *
 * Ce fichier est donc le SEUL endroit où ces valeurs sont dupliquées, et elles
 * doivent rester égales à celles de `styles/tokens.css`.
 */

export const EMAIL_COLORS = {
  bg: "#FDFCFA",
  card: "#F6F2EA",
  ink: "#26211C",
  ink2: "#6F675E",
  line: "#EBE6E0",
  accent: "#B4653F",
} as const;
