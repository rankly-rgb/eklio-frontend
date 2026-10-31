import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { render } from "@/lib/compose/engine";
import { carouselSlides } from "@/lib/content/slides";
import { composeFontFiles, composeToPng } from "@/lib/kit/render/compose-raster";
import type { ContentItem } from "@/lib/data/content";
import type { ReviewCard } from "@/lib/content/review";
import { CARD_BUCKET, type CardRasteriser, type CardStorePort } from "@/lib/content/month/card-store";

/*
 * Les deux coutures de `card-store.ts` côté produit : relire les posts du mois
 * avec le client d'administration du cron, et déposer dans `content-assets`.
 *
 * ⚠ AUCUNE DÉCISION ICI. Quelle carte, sous quelle clé : `card-store.ts` et
 * `reviewCardFrom`. Ce fichier nomme les tables et rend les erreurs.
 */

export function serverCardStorePort(db: SupabaseClient<Database>): CardStorePort {
  return {
    async monthItems(monthId) {
      const items = await db
        .from("content_items")
        .select("id, theme, title, payload, compose_archetype, topic_id")
        .eq("month_id", monthId);
      if (items.error) throw new Error(`content_items: ${items.error.message}`);
      const rows = items.data ?? [];

      const topicIds = [...new Set(rows.map((r) => r.topic_id).filter((id): id is string => !!id))];
      const topics = topicIds.length
        ? await db.from("content_topics").select("id, payload, archetype_key, intent, timely").in("id", topicIds)
        : { data: [], error: null };
      if (topics.error) throw new Error(`content_topics: ${topics.error.message}`);
      const intents = await db.from("content_intents").select("id, label");
      if (intents.error) throw new Error(`content_intents: ${intents.error.message}`);

      /*
       * ⚠ LE LIBELLÉ D'ANGLE EST CELUI QUE `get_content_month` REND :
       * `content_intents.label` du sujet. C'est lui qui fait le surtitre de la
       * carte à l'écran ; le prendre ailleurs changerait la carte, donc la clé.
       */
      const label = new Map((intents.data ?? []).map((i) => [i.id, i.label]));
      const byId = new Map((topics.data ?? []).map((t) => [t.id, t]));
      return rows.map((r) => {
        const t = r.topic_id ? byId.get(r.topic_id) : undefined;
        const topic: ContentItem["topic"] = t
          ? { id: t.id, angle: t.intent, angle_label: label.get(t.intent) ?? null, archetype_key: t.archetype_key, timely: !!t.timely }
          : null;
        return {
          item: {
            id: r.id,
            theme: r.theme,
            title: r.title,
            payload: (r.payload ?? null) as ContentItem["payload"],
            compose_archetype: r.compose_archetype,
            topic,
          },
          topic: t ? { payload: t.payload, archetype_key: t.archetype_key } : null,
        };
      });
    },

    async upload(path, png) {
      const { error } = await db.storage
        .from(CARD_BUCKET)
        .upload(path, png, { contentType: "image/png", upsert: true });
      return error?.message ?? null;
    },
  };
}

/**
 * Le moteur réel : exactement ce que la route d'image sert, en PNG.
 *
 * ⚠ UN CARROUSEL EST GARDÉ PAR SA PREMIÈRE CARTE. C'est elle que le flux montre ;
 * les suivantes restent servies une à une par la route, à la demande.
 */
export const serverCardRasteriser: CardRasteriser = async (card: ReviewCard) => {
  const slides = carouselSlides(card);
  if (slides.kind === "refused") throw new Error(slides.message);
  const svg =
    slides.kind === "slides"
      ? slides.slides[0].svg
      : render({
          archetype: card.archetypeKey,
          payload: card.payload,
          palette: card.palette,
          eyebrow: card.eyebrow,
          headline: card.headline,
          footer: card.footer,
        } as Parameters<typeof render>[0]).svg;
  return new Uint8Array(composeToPng(svg, await composeFontFiles()));
};
