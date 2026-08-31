import {
  authenticate,
  json,
  notFound,
  serverError,
} from "@/lib/api/handler";
import { loadBrief, writeToneCards } from "@/lib/data/brief";
import { readCatalog } from "@/lib/catalog/read";
import { generateToneCards } from "@/lib/generation/tone-cards";
import { computeHowYouWorkInputsHash } from "@/lib/generation/how-you-work-hash";
import { toneCardsSchema } from "@/lib/generation/how-you-work-shapes";

/*
 * POST /api/briefs/[id]/tone-cards — §2.2.
 *
 * IDEMPOTENT à dessein : le client appelle cette route à CHAQUE entrée sur
 * l'étape 5, sans garder trace lui-même de ce qui a déjà été généré. C'est le
 * serveur qui décide, en comparant `tone_cards_inputs_hash`, s'il y a
 * réellement quelque chose à faire — la même donnée que le §2.2 demande de
 * vérifier, mais vérifiée ici plutôt que dupliquée côté client.
 */

export const maxDuration = 60;

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/briefs/[id]/tone-cards">
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const bundle = await loadBrief(auth.session.supabase, id, auth.session.userId);
  if (!bundle) return notFound();

  const catalog = await readCatalog(auth.session.supabase);
  const currentHash = computeHowYouWorkInputsHash(bundle.brief);

  const existing = toneCardsSchema.safeParse(bundle.brief.tone_cards);
  if (existing.success && bundle.brief.tone_cards_inputs_hash === currentHash) {
    return json({ ok: true, tone_cards: existing.data, generated: true });
  }

  try {
    const result = await generateToneCards(bundle, catalog);

    if (!result.ok) {
      return json({
        ok: true,
        fallback: true,
        message:
          "These are our standard openings — we couldn't write custom ones just now.",
      });
    }

    const write = await writeToneCards(
      auth.session.supabase,
      id,
      result.cards,
      currentHash
    );
    if (!write.ok) return serverError("POST /api/briefs/tone-cards", write.detail);

    return json({ ok: true, tone_cards: result.cards, generated: true });
  } catch (error) {
    return serverError("POST /api/briefs/tone-cards", error);
  }
}
