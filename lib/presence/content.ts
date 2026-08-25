import { z } from "zod";
import {
  MONTHLY_PRESENCE_POSTS,
  MONTHLY_PRESENCE_STORIES,
} from "@/lib/billing/plans";

/*
 * Forme du livrable Monthly Presence : schéma zod, types, relecture tolérante
 * de ce qui est stocké dans `monthly_presence_content.content` (jsonb).
 *
 * Module PUR, séparé de `lib/ai/monthly-presence.ts` pour la même raison que
 * `lib/kit/content.ts` l'est de `lib/ai/kit.ts` : la page relit ce contenu et
 * n'a aucune raison de tirer le SDK Anthropic dans son graphe d'imports.
 *
 * ── Leçon n°2 du kit, appliquée d'emblée ─────────────────────────────────
 *
 * AUCUNE BORNE CASSANTE. « 12 posts » est une consigne en langage naturel,
 * jamais une garantie : l'API n'autorise pas `minItems`/`maxItems` dans un
 * schéma d'outil strict. Une borne serrée côté zod ne discipline donc pas le
 * modèle — elle JETTE un livrable entier, après une à deux minutes de
 * génération, parce qu'il a écrit un post de trop. C'est exactement ce qui a
 * détruit un kit complet pour six contre-exemples au lieu de cinq.
 *
 * On NORMALISE : on garde les premiers, on n'en refuse aucun. Et la prose
 * garde des bornes larges — la tronquer au milieu d'une phrase serait pire que
 * de l'accepter longue.
 */

const shortText = z.string().trim().min(1).max(800);
const bodyText = z.string().trim().min(1).max(6000);

/**
 * Liste normalisée : au moins un élément, on ne conserve que les `max`
 * premiers. Jamais de rejet sur le compte.
 */
function cappedList<T extends z.ZodType>(max: number, item: T) {
  return z
    .array(item)
    .min(1)
    .transform((items) => items.slice(0, max));
}

export const presencePostSchema = z.object({
  /** Le sujet, tel qu'il apparaît dans le calendrier. */
  title: shortText,
  /** Première ligne du post — celle qui s'affiche avant « … plus ». */
  hook: shortText,
  /** Le post complet, prêt à publier. */
  caption: bodyText,
  /** Ce que ce post apprend au lecteur. Psychoéducation, jamais un résultat. */
  teaches: shortText,
});

export const presenceStorySchema = z.object({
  title: shortText,
  /** Ce que le praticien filme ou écrit, décrit pas à pas. */
  prompt: bodyText,
  purpose: shortText,
});

export const calendarEntrySchema = z.object({
  /*
   * Le jour du mois. Borne large et non cassante : `1..31` couvre tous les
   * mois, et un jour hors du mois est écarté à la normalisation plutôt que de
   * faire échouer le livrable entier (cf. `clampCalendar`).
   */
  day: z.number().int().min(1).max(31),
  /** Ce qui se publie ce jour-là, nommé comme le post ou la story. */
  publish: shortText,
  /** La note pratique : moment de la journée, format, rappel de ton. */
  note: shortText,
});

export const monthlyPresenceSchema = z.object({
  /** Le fil du mois, en deux ou trois phrases. */
  month_focus: bodyText,
  posts: cappedList(MONTHLY_PRESENCE_POSTS, presencePostSchema),
  stories: cappedList(MONTHLY_PRESENCE_STORIES, presenceStorySchema),
  /* Un mois compte au plus 31 jours ; au-delà c'est du bruit, pas du contenu. */
  calendar: cappedList(31, calendarEntrySchema),
});

export type PresencePost = z.infer<typeof presencePostSchema>;
export type PresenceStory = z.infer<typeof presenceStorySchema>;
export type CalendarEntry = z.infer<typeof calendarEntrySchema>;
export type MonthlyPresence = z.infer<typeof monthlyPresenceSchema>;

/**
 * Écarte les entrées de calendrier qui tombent hors du mois, et les remet en
 * ordre.
 *
 * Normalisation, pas validation : un 31 février est une erreur du modèle sur
 * UNE entrée, pas une raison de jeter douze posts et quatre stories. On la
 * retire, on garde le reste.
 */
export function clampCalendar(
  entries: CalendarEntry[],
  daysInMonth: number
): CalendarEntry[] {
  return entries
    .filter((entry) => entry.day >= 1 && entry.day <= daysInMonth)
    .sort((a, b) => a.day - b.day);
}

/**
 * Relit `monthly_presence_content.content`. Rend `null` si la forme stockée ne
 * tient pas — la page propose alors de régénérer plutôt que d'afficher un mois
 * à trous.
 */
export function parseStoredPresence(stored: unknown): MonthlyPresence | null {
  const parsed = monthlyPresenceSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

/**
 * Toutes les chaînes du livrable qu'un praticien pourrait publier telles
 * quelles.
 *
 * C'est ce que la garde déontologique vérifie, et c'est la SURFACE LA PLUS
 * VOLUMINEUSE ET LA PLUS RÉPÉTÉE du produit : douze posts par mois, tous les
 * mois, publiés sans relecture d'un tiers. Le kit se relit une fois ; ceci part
 * en ligne douze fois. On aplatit donc CHAQUE champ de CHAQUE entrée, sans
 * échantillonner.
 *
 * Rien n'en est exclu — contrairement au kit, où les `dont_examples` sont des
 * contre-exemples affichés sous « never write this ». Ici, tout est de la copy
 * destinée à être publiée, y compris les notes du calendrier : elles sont lues
 * par le praticien juste avant de publier, et une consigne fautive s'y
 * recopierait dans le post.
 */
export function publishablePresenceText(content: MonthlyPresence): string[] {
  return [
    content.month_focus,
    ...content.posts.flatMap((post) => [
      post.title,
      post.hook,
      post.caption,
      post.teaches,
    ]),
    ...content.stories.flatMap((story) => [
      story.title,
      story.prompt,
      story.purpose,
    ]),
    ...content.calendar.flatMap((entry) => [entry.publish, entry.note]),
  ];
}
