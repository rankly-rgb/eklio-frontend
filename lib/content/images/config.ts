/*
 * ── LE CHEMIN VISUEL CUSTOM : LE SEUL QUI DÉPENSE DE L'ARGENT ───────────
 *
 * Trente publications par mois sont RENDUES (`lib/compose/`) et ne coûtent
 * rien. Ce fichier décrit l'exception : l'image qu'elle demande elle-même,
 * qui appelle une API facturée.
 *
 * ⚠ SÉPARÉ DE `lib/images/config.ts`, ET CE N'EST PAS UNE DUPLICATION.
 *
 * Celui-là décrit les PHOTOGRAPHIES DE MARQUE : sept slots, un forfait par
 * image, `gpt-image-1`, une cagnotte à vie achetée avec le kit. Celui-ci
 * décrit une image de CONTENU : à la demande, facturée au jeton, adossée à un
 * crédit mensuel. Deux produits, deux modèles, deux façons de compter — les
 * réunir voudrait dire qu'un seul des deux plafonds s'applique aux deux.
 */

/**
 * `gpt-image-2.5-flare` — génération rapide et de haute qualité, le défaut du
 * catalogue pour l'usage courant. `gpt-image-2.5-sunburst` est plus capable et
 * n'est pas retenu : une carte de contenu n'est pas une photographie de
 * marque, et la vitesse compte davantage ici que le dernier pour-cent.
 *
 * ⚠ IDENTIFIANT NON DATÉ PAR DÉFAUT, SNAPSHOT ÉPINGLABLE.
 * `CONTENT_IMAGE_MODEL=gpt-image-2.5-flare-2026-09-08` fige le comportement
 * le jour où une régression de rendu doit être reproduite. Le non daté suit
 * les améliorations ; le daté suit une enquête.
 */
export const CONTENT_IMAGE_MODEL =
  process.env.CONTENT_IMAGE_MODEL ?? "gpt-image-2.5-flare";

/** Portrait 4:5, le même cadre que le moteur de composition. */
export const CONTENT_IMAGE_SIZE = "1024x1536" as const;

/**
 * Les six qualités que le modèle accepte.
 *
 * ⚠ CE N'EST PAS LA LISTE DE CE QU'EKLIO ACHÈTE. Voir `QUALITY_ORDER` et le
 * plafond ci-dessous : la moitié de ces valeurs est refusée par le code.
 */
export const MODEL_QUALITIES = ["low", "medium", "high", "xhigh", "max", "auto"] as const;
export type ContentImageQuality = (typeof MODEL_QUALITIES)[number];

/**
 * L'ordre de dépense, du moins cher au plus cher.
 *
 * ⚠ `auto` N'EST PAS DANS CET ORDRE, ET C'EST POURQUOI IL EST REFUSÉ. Il
 * laisse le modèle choisir, et un plafond qu'une autre partie décide n'est pas
 * un plafond. Une variable d'environnement réglée sur `auto` est une erreur de
 * configuration, pas une préférence — et elle échoue ici plutôt qu'à la
 * facture.
 */
export const QUALITY_ORDER = ["low", "medium", "high", "xhigh", "max"] as const;

/** Levée quand la configuration demande une qualité qu'Eklio n'achète pas. */
export class ContentImageQualityError extends Error {
  constructor(asked: string, ceiling: string) {
    super(
      `CONTENT_IMAGE_QUALITY="${asked}" is above the ceiling "${ceiling}" (or is not an ordered ` +
        `quality). Eklio buys ${QUALITY_ORDER.slice(0, QUALITY_ORDER.indexOf(ceiling as never) + 1).join(
          " or "
        )} for content images; anything else is refused here rather than at the invoice.`
    );
    this.name = "ContentImageQualityError";
  }
}

function rank(quality: string): number {
  return (QUALITY_ORDER as readonly string[]).indexOf(quality);
}

/**
 * La qualité demandée, ou une erreur.
 *
 * ⚠ REFUSÉE PAR LE CODE, PAS DÉCONSEILLÉE. `high` et au-delà existent chez le
 * modèle et ne sont pas achetées ici. Et la ligne de `custom_visual_generations`
 * porte le même refus (`custom_visual_quality_check`), donc une variable mal
 * réglée ne peut pas non plus passer par un chemin qui oublierait cette
 * fonction.
 */
export function resolveQuality(
  asked: string = process.env.CONTENT_IMAGE_QUALITY ?? "low",
  ceiling: string = process.env.CONTENT_IMAGE_QUALITY_CEILING ?? "medium"
): ContentImageQuality {
  const ceilingRank = rank(ceiling);
  const askedRank = rank(asked);
  if (ceilingRank < 0 || askedRank < 0 || askedRank > ceilingRank) {
    throw new ContentImageQualityError(asked, ceiling);
  }
  return asked as ContentImageQuality;
}

/* ── LE PRIX, ET IL N'Y EN A QU'UN ───────────────────────────────────── */

/**
 * 30 $ par million de jetons de SORTIE IMAGE.
 *
 * ⚠ VÉRIFIÉ LE 20 SEPTEMBRE 2026.
 * Source : la grille tarifaire OpenAI, https://platform.openai.com/docs/pricing
 *
 * ⚠ IL N'Y A PAS DE PRIX FORFAITAIRE PAR IMAGE POUR CE MODÈLE, et c'est la
 * différence qui gouverne tout ce fichier. `lib/images/config.ts` porte une
 * table `(modèle, qualité, taille) → cents` pour `gpt-image-1`, qui en publie
 * une. Reproduire cette forme ici produirait un nombre faux le jour où la
 * consommation en jetons d'une image change — c'est-à-dire n'importe quel
 * jour — et il serait faux EN SILENCE, parce qu'une table ne se plaint pas.
 *
 * La documentation du modèle dit d'ailleurs explicitement que le calculateur
 * de GPT Image 2 n'estime pas la consommation de 2.5.
 *
 * Donc : `actual_cost_usd` se calcule depuis l'objet `usage` de la réponse, et
 * depuis lui seul.
 */
export const IMAGE_OUTPUT_PER_MTOK = 30.0;

/**
 * Ce que cette image a coûté, depuis ce que l'API a dit avoir consommé.
 *
 * ⚠ CE CHIFFRE COUVRE LES JETONS DE SORTIE IMAGE ET RIEN D'AUTRE. Les jetons
 * de texte du prompt sont facturés à part, à un tarif que je n'ai pas vérifié
 * le 20 septembre 2026 — et un nombre inventé dans une colonne qui s'appelle
 * `actual_cost_usd` serait pire qu'une colonne incomplète. Le prompt d'une
 * carte fait quelques dizaines de jetons face à des milliers de jetons
 * d'image ; l'écart est petit, mais il est réel et il est nommé ici plutôt
 * que dilué.
 *
 * Rend `null` quand l'API n'a rien dit : on n'invente pas un coût, on écrit
 * qu'on ne l'a pas.
 */
export function imageCostUsd(usage: { output_tokens?: number | null } | null): number | null {
  const out = usage?.output_tokens;
  if (typeof out !== "number" || !Number.isFinite(out) || out < 0) return null;
  return (out / 1_000_000) * IMAGE_OUTPUT_PER_MTOK;
}

/**
 * L'estimation posée AVANT l'appel, pour la réservation de crédit.
 *
 * ⚠ C'EST UNE HYPOTHÈSE, ET ELLE EST DATÉE COMME TELLE. Un portrait 1024×1536
 * en qualité `low` consomme de l'ordre de 1 500 jetons de sortie ; `medium`,
 * de l'ordre du double. Ces ordres de grandeur n'ont PAS été mesurés contre
 * l'API — ils servent à réserver, pas à facturer, et `settleFromUsage` écrit
 * le vrai.
 *
 * `ESTIMATE_DRIFT_WARN` ci-dessous est ce qui rend l'hypothèse falsifiable.
 */
export const ESTIMATED_OUTPUT_TOKENS: Record<"low" | "medium", number> = {
  low: 1_500,
  medium: 3_000,
};

export function estimatedCostUsd(quality: "low" | "medium"): number {
  return (ESTIMATED_OUTPUT_TOKENS[quality] / 1_000_000) * IMAGE_OUTPUT_PER_MTOK;
}

/**
 * Au-delà de cet écart relatif entre estimé et réel, on journalise.
 *
 * ⚠ C'EST LE SIGNAL QUE L'HYPOTHÈSE A DÉRIVÉ, et c'est le seul qu'elle ait.
 * Une estimation qui ne se compare jamais au réel est une constante que
 * personne ne relira ; celle-ci se dénonce elle-même.
 */
export const ESTIMATE_DRIFT_WARN = 0.5;
