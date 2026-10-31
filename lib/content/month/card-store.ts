import { createHash } from "node:crypto";
import { ENGINE_VERSION, TYPE } from "@/lib/compose/constants";
import { normalise } from "@/lib/compose/hash";
import { reviewCardFrom, type CardItem, type ReviewCard } from "@/lib/content/review";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LES CARTES DU MOIS SONT FAITES À LA GÉNÉRATION, ET GARDÉES
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ TROUVÉ SUR LE PREMIER MOIS RÉEL (novembre 2026, kit 45de0dac). Les 24 posts
 * affichaient « NOT COMPOSED YET ». L'orchestrateur composait bien chaque carte
 * — c'est ainsi qu'il prouve qu'elle tient et que son pied porte la licence —
 * puis la JETAIT : `ContentItemRow` n'a pas de champ pour elle, et la vignette
 * du flux affichait sa mention d'attente sans condition, son commentaire datant
 * d'avant que le pipeline mensuel soit câblé. Ce n'était pas une composition
 * « différée à l'approbation » : rien, nulle part, ne l'aurait faite.
 *
 * ── CE QUI EST GARDÉ EST LA CARTE DE L'ÉCRAN, PAS CELLE DE L'ORCHESTRATEUR ─
 *
 * La carte que l'orchestrateur compose sert de preuve (elle tient, le pied porte
 * la mention) ; elle n'est pas celle que la praticienne regarde. L'écran de
 * relecture et la route de téléchargement décident la leur par `reviewCardFrom` :
 * palette claire par post, surtitre tiré du libellé d'angle, pied « cabinet ·
 * licence ». Garder l'autre afficherait dans le flux une carte qu'elle ne
 * télécharge pas. Ici, c'est donc `reviewCardFrom` — la même fonction, sur les
 * mêmes colonnes relues après écriture.
 *
 * ── LA CLÉ EST CE QUI EST DESSINÉ, TOUT CE QUI EST DESSINÉ ──────────────
 *
 * `rendered_assets.content_hash` (lib/compose/hash.ts) ne couvre ni le surtitre,
 * ni le titre, ni le pied. Deux cartes au même diagramme et à des licences
 * différentes y auraient la même clé — et un cache qui sert une ancienne licence
 * est une publicité fautive qui a l'air d'une carte. `cardKey` couvre la carte
 * entière, plus les planchers et la version du moteur. Un post modifié depuis
 * (mise en page, titre, payload) a une autre clé : le flux ne trouve plus de
 * carte gardée et compose à la demande, il ne montre jamais l'ancienne.
 */

/** Le hachage de tout ce qui est dessiné sur une carte. */
export function cardKey(card: ReviewCard): string {
  const material = JSON.stringify(
    normalise({ card, typography: TYPE, engine: ENGINE_VERSION })
  );
  return createHash("sha256").update(material).digest("hex");
}

/**
 * Le chemin dans `content-assets`.
 *
 * ⚠ IL COMMENCE PAR LE KIT : c'est le premier segment que la policy de lecture
 * (`brand_kit_asset_path_owner`) lit. Un autre préfixe donnerait un objet que
 * personne ne peut lire, et on ne le verrait qu'à l'ouverture du flux.
 */
export function cardPath(kitId: string, itemId: string, key: string): string {
  return `${kitId}/cards/${itemId}/${key}.png`;
}

export const CARD_BUCKET = "content-assets";

/** La carte que l'écran montrera pour ce post, et son chemin — ou `null`. */
export function storedCardFor(
  kitId: string,
  item: CardItem,
  topic: { payload: unknown; archetype_key: string } | null,
  direction: DirectionPalette | null,
  practiceName: string | null,
  licence: string | null
): { card: ReviewCard; path: string } | null {
  const card = reviewCardFrom(item, topic, direction, practiceName, licence);
  if (!card) return null;
  return { card, path: cardPath(kitId, item.id, cardKey(card)) };
}

export type CardStorePort = {
  /** Les posts du mois, relus après écriture, avec le sujet que la carte lit. */
  monthItems(monthId: string): Promise<Array<{ item: CardItem; topic: { payload: unknown; archetype_key: string } | null }>>;
  /** Dépose les octets ; rend `null` en cas de succès, le message sinon. */
  upload(path: string, png: Uint8Array): Promise<string | null>;
};

/** Le moteur réel, ou une doublure : la carte en PNG, ou une erreur nommée. */
export type CardRasteriser = (card: ReviewCard) => Promise<Uint8Array>;

export type StoredCards = {
  stored: number;
  failed: Array<{ itemId: string; why: string }>;
};

/**
 * Compose et dépose la carte de chaque post du mois.
 *
 * ⚠ NE LÈVE JAMAIS, ET NE FAIT JAMAIS ÉCHOUER LE MOIS. Les posts sont écrits et
 * payés ; une carte qui n'a pas pu être déposée sera composée à la demande par
 * le flux, ce qui est la même carte. Les échecs sont RENDUS, pas tus : le
 * rapport du mois les dit.
 */
export async function storeMonthCards(
  port: CardStorePort,
  rasterise: CardRasteriser,
  input: {
    kitId: string;
    monthId: string;
    direction: DirectionPalette | null;
    practiceName: string | null;
    licence: string | null;
  }
): Promise<StoredCards> {
  const out: StoredCards = { stored: 0, failed: [] };
  let rows: Awaited<ReturnType<CardStorePort["monthItems"]>>;
  try {
    rows = await port.monthItems(input.monthId);
  } catch (error) {
    out.failed.push({ itemId: "*", why: `lecture des posts du mois : ${(error as Error).message}` });
    return out;
  }
  for (const { item, topic } of rows) {
    const target = storedCardFor(input.kitId, item, topic, input.direction, input.practiceName, input.licence);
    if (!target) {
      out.failed.push({ itemId: item.id, why: "rien à composer (pas de payload, pas de palette)" });
      continue;
    }
    try {
      const png = await rasterise(target.card);
      const error = await port.upload(target.path, png);
      if (error) out.failed.push({ itemId: item.id, why: `dépôt : ${error}` });
      else out.stored += 1;
    } catch (error) {
      out.failed.push({ itemId: item.id, why: `composition : ${(error as Error).message}` });
    }
  }
  return out;
}
