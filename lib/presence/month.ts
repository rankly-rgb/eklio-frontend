/*
 * Le mois d'un livrable Monthly Presence.
 *
 * `monthly_presence_content.month` est une `date` contrainte en base par
 * `month = date_trunc('month', month)::date` : elle est TOUJOURS calée au
 * premier du mois, et la paire (project_id, month) est unique. Un mois mal
 * calé n'entre donc pas en base — il est rejeté par le CHECK, pas silencieux.
 *
 * Tout est calculé en UTC, délibérément. Le fuseau du serveur ne doit pas
 * décider dans quel mois tombe un livrable : un praticien à Honolulu et un
 * serveur à Francfort ne sont pas d'accord sur la date pendant dix heures par
 * jour, et « le mois courant » deviendrait une question d'infrastructure.
 *
 * Module pur : ni I/O, ni SDK, ni React.
 */

/** Clé de mois telle qu'elle part en base : `YYYY-MM-01`. */
export type MonthKey = string;

const MONTH_KEY = /^\d{4}-\d{2}-01$/;

/** Le premier du mois de `date`, en UTC, au format attendu par la colonne. */
export function monthStart(date: Date): MonthKey {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/** Vrai si la valeur est une clé de mois valide, calée au premier. */
export function isMonthKey(value: string): value is MonthKey {
  if (!MONTH_KEY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && monthStart(parsed) === value;
}

/**
 * Relit une valeur de mois venue de la base ou d'une URL.
 *
 * Rend `null` sur tout ce qui n'est pas calé au premier : la colonne refuse
 * déjà ces valeurs, et les laisser passer jusqu'à l'insert transformerait une
 * faute d'appel en erreur Postgres opaque.
 */
export function parseMonthKey(
  value: string | null | undefined
): MonthKey | null {
  return value && isMonthKey(value) ? value : null;
}

/** « March 2026 » — le mois tel qu'il est écrit dans l'interface, en anglais. */
export function formatMonth(month: MonthKey): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}T00:00:00Z`));
}

/** Nombre de jours du mois — borne du calendrier éditorial. */
export function daysInMonth(month: MonthKey): number {
  const date = new Date(`${month}T00:00:00Z`);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
}

/** Nom du jour de la semaine pour une date du mois — « Tuesday ». */
export function weekdayOf(month: MonthKey, day: number): string {
  const date = new Date(`${month}T00:00:00Z`);
  date.setUTCDate(day);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
}
