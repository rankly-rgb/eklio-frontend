import { z } from "zod";
import { PAGES_WANTED } from "@/lib/brief/schemas";
import { kitTierSchema, type PageKey } from "@/lib/kit/tiers";

/*
 * Forme du kit de marque : schéma zod, types, et relecture tolérante de ce qui
 * est stocké dans `brand_kits.content` (jsonb).
 *
 * Module PUR, séparé de `lib/ai/kit.ts` à dessein : la page de kit relit ce
 * contenu et n'a aucune raison de tirer le SDK Anthropic dans son graphe
 * d'imports. La génération, elle, importe ce module.
 *
 * Le prompt multi-plateformes ne fait PAS partie de cette forme : il est
 * persisté dans la colonne `brand_kits.multi_builder_prompt` (colonne de
 * premier ordre déjà présente au schéma), pas dans le jsonb. Il n'existe donc
 * qu'à un seul endroit.
 */

/*
 * Bornes hautes volontairement LARGES.
 *
 * L'API n'autorise pas `minItems`/`maxItems` dans un schéma d'outil strict :
 * « 3 à 5 exemples » n'est qu'une consigne en langage naturel, jamais une
 * garantie. Une borne serrée côté zod ne discipline donc pas le modèle — elle
 * jette un kit entier, après deux minutes de génération, parce qu'il a écrit un
 * exemple de trop. Ces bornes ne sont plus qu'un garde-fou contre l'aberrant.
 *
 * Deux traitements, selon ce que coûte le dépassement :
 * - une LISTE D'EXEMPLES en trop est du surplus → on garde les premiers ;
 * - de la PROSE trop longue est du contenu → on l'accepte, jamais on ne la
 *   tronque au milieu d'une phrase.
 */
const shortText = z.string().trim().min(1).max(800);
const bodyText = z.string().trim().min(1).max(12000);

/**
 * Liste d'exemples : au moins un, et on ne conserve que les `max` premiers.
 *
 * Normaliser plutôt que rejeter — c'est toute la différence entre un kit livré
 * et un « Something went wrong » après deux minutes d'attente.
 */
function cappedExamples(max: number, item = shortText) {
  return z
    .array(item)
    .min(1)
    .transform((items) => items.slice(0, max));
}

export const voiceGuideSchema = z.object({
  /* Le guide en affiche 3 : les suivants sont écartés, pas refusés. */
  adjectives: cappedExamples(3, z.string().trim().min(1).max(60)),
  do_examples: cappedExamples(5),
  dont_examples: cappedExamples(5),
});

export const pageSectionSchema = z.object({
  heading: shortText,
  body: bodyText,
});

/*
 * `page` est contraint à l'énumération du brief : le modèle ne peut pas
 * inventer une page qui n'existe pas au produit. Qu'il ait bien rendu les
 * pages DEMANDÉES est une vérification distincte, faite à la génération
 * (`lib/ai/kit.ts`), parce qu'elle dépend du tier.
 */
export const pageCopySchema = z.object({
  page: z.enum(PAGES_WANTED),
  // Borne haute large : une page riche en sections reste un livrable valide,
  // et la refuser jetterait tout le kit avec elle.
  sections: z.array(pageSectionSchema).min(1).max(20),
});

export const socialTemplateSchema = z.object({
  name: shortText,
  purpose: shortText,
  layout: bodyText,
  example_caption: bodyText,
});

export const kitContentSchema = z.object({
  positioning_statement: bodyText,
  brand_story: bodyText,
  voice_and_tone: voiceGuideSchema,
  website_copy: z.array(pageCopySchema).min(1),
  social_templates: z.array(socialTemplateSchema),
});

export type VoiceGuide = z.infer<typeof voiceGuideSchema>;
export type PageSection = z.infer<typeof pageSectionSchema>;
export type PageCopy = z.infer<typeof pageCopySchema>;
export type SocialTemplate = z.infer<typeof socialTemplateSchema>;
export type KitContent = z.infer<typeof kitContentSchema>;

/*
 * Ce qui part réellement en base, dans `content`.
 *
 * Le tier N'Y EST PLUS. Au Lot 3 il vivait dans ce jsonb faute de colonne
 * dédiée ; la migration du Lot 4 (`eklio-backend`) a ajouté `brand_kits.tier`,
 * colonne de premier ordre contrainte par un CHECK, et c'est elle qui fait
 * désormais foi — c'est la seule qui soit requêtable et qui ne puisse pas
 * dériver du contenu.
 *
 * Le champ reste ACCEPTÉ en lecture, et seulement en lecture : les kits
 * générés avant le Lot 4 le portent dans leur jsonb, et les refuser
 * rendrait leur page illisible pour rien. Plus rien ne l'écrit.
 */
export const storedKitSchema = kitContentSchema.extend({
  /** Hérité du Lot 3, toléré en relecture. La vérité est `brand_kits.tier`. */
  tier: kitTierSchema.optional(),
});

export type StoredKit = z.infer<typeof storedKitSchema>;

/**
 * Relit `brand_kits.content`. Renvoie `null` si le contenu stocké ne tient pas
 * la forme attendue — la page affiche alors une invitation à régénérer plutôt
 * que de planter ou de rendre un livrable à trous.
 */
export function parseStoredKit(stored: unknown): StoredKit | null {
  const parsed = storedKitSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

/**
 * Toutes les chaînes du kit qu'un praticien pourrait publier telles quelles.
 *
 * C'est ce que la garde déontologique vérifie. La page About et la page
 * Approach sont la fuite la plus probable — c'est là qu'une promesse de
 * résultat se glisse — donc on aplatit CHAQUE titre et CHAQUE corps de CHAQUE
 * page, sans échantillonner.
 *
 * `dont_examples` en est délibérément absent : ce sont des contre-exemples,
 * affichés sous « never write this ». Les vérifier reviendrait à exiger du
 * modèle qu'il illustre une faute sans jamais l'écrire — la génération
 * boucherait sur sa propre pédagogie et finirait en échec. Ce sont les seules
 * chaînes du kit non soumises au contrôle, et elles ne sont jamais présentées
 * comme de la copy à publier.
 */
export function publishableKitText(
  content: KitContent,
  websitePrompt: string
): string[] {
  return [
    content.positioning_statement,
    content.brand_story,
    ...content.voice_and_tone.adjectives,
    ...content.voice_and_tone.do_examples,
    ...content.website_copy.flatMap((page) =>
      page.sections.flatMap((section) => [section.heading, section.body])
    ),
    ...content.social_templates.flatMap((template) => [
      template.name,
      template.purpose,
      template.example_caption,
    ]),
    // Le prompt multi-plateformes contient la copy que le constructeur de site
    // va reproduire : il est publiable par ricochet.
    websitePrompt,
  ];
}

/** Pages effectivement présentes dans un kit, dans l'ordre où il les porte. */
export function kitPages(content: KitContent): PageKey[] {
  return content.website_copy.map((page) => page.page);
}
