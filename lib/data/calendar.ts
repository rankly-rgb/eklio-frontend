import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MonthlyPresenceStatus } from "@/types/supabase";

/*
 * Le calendrier éditorial du mois.
 *
 * La lecture passe par `calendar_summary(p_user_id, p_month)`, qui renvoie les
 * items TRIÉS et les deux compteurs. Un seul aller-retour, et le tri vient de
 * la base plutôt que d'un `sort` côté client qui pourrait diverger.
 *
 * `monthly_presence_content` est en LECTURE SEULE pour l'utilisateur : la RLS
 * refuse INSERT, UPDATE et DELETE. Tout ce qui écrit ici (le cron mensuel, le
 * remplissage des titres) passe par le client service_role, côté serveur.
 */

type Client = SupabaseClient<Database>;

export const calendarItemSchema = z.object({
  id: z.string(),
  month: z.string(),
  day_of_month: z.number().int(),
  type: z.enum(["post", "story"]),
  status: z.enum(["locked", "draft", "ready", "published"]),
  title: z.string().nullable(),
  caption: z.string().nullable(),
  visual_spec: z.unknown().nullable(),
  published_at: z.string().nullable(),
});

export type CalendarItem = z.infer<typeof calendarItemSchema>;

export const calendarSummarySchema = z.object({
  items: z.array(calendarItemSchema),
  ready_count: z.number().int(),
  locked_count: z.number().int(),
});

export type CalendarSummary = z.infer<typeof calendarSummarySchema>;

export const EMPTY_CALENDAR: CalendarSummary = {
  items: [],
  ready_count: 0,
  locked_count: 0,
};

/** Le premier jour du mois, au format `date` attendu par la base. */
export function monthKey(date: Date, timeZone = "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}-01`;
}

/** `2026-09-01` → `SEPTEMBER`, pour le libellé mono de l'en-tête de section. */
export function monthLabel(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
}

export async function loadCalendar(
  supabase: Client,
  userId: string,
  month: string
): Promise<CalendarSummary> {
  const { data, error } = await supabase.rpc("calendar_summary", {
    p_user_id: userId,
    p_month: month,
  });

  if (error) {
    console.error("[calendar] calendar_summary", error);
    return EMPTY_CALENDAR;
  }

  const parsed = calendarSummarySchema.safeParse(data);
  if (!parsed.success) {
    console.error("[calendar] shape", parsed.error.issues);
    return EMPTY_CALENDAR;
  }
  return parsed.data;
}

/**
 * Une tuile est-elle rendue en clair ?
 *
 * `draft` et `ready` sont ouverts, `locked` est flouté. `published` l'est aussi
 * — il a été publié, donc il a été lisible. Le droit d'accès lui-même n'est PAS
 * décidé ici : il vient de `isEntitledToMonthlyPresence`, appliqué au moment de
 * la génération et de l'ouverture (§7).
 */
export function isVisible(status: MonthlyPresenceStatus | string): boolean {
  return status !== "locked";
}
