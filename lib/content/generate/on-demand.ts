import { ARCHETYPES } from "@/lib/compose/archetypes/index";
import { budgetErrors } from "@/lib/compose/budget";
import type { BrandContext, TopicRequest } from "@/lib/content/generate/copy-batch";
import { writeOnePost, type WriteOnePort } from "@/lib/content/generate/write-one";
import type { SuggestedTopic } from "@/lib/data/on-demand";

/*
 * ── DE CE QU'ELLE DEMANDE À UN POST ÉCRIT ───────────────────────────────
 *
 * Deux entrées, un seul chemin :
 *
 *   un sujet suggéré   → son archétype, son titre, son hook, son intention
 *   « my own idea »    → un archétype CHOISI, sa phrase comme titre et hook
 *
 * ⚠ ET APRÈS CE FICHIER, RIEN NE LES DISTINGUE. Les deux produisent un
 * `TopicRequest`, passent par `writeOnePost`, et sont validées par
 * `validateCopy` — donc par le même schéma d'archétype, le même budget de
 * mots, la même garde déontologique côté base à l'écriture. Une idée libre
 * n'a aucun chemin plus court.
 */

/** Ce que le format demandé impose. « Single card » par défaut. */
export type PostFormat = "single" | "carousel";

/*
 * ⚠ LE CHOIX D'ARCHÉTYPE POUR UNE IDÉE LIBRE EST DÉTERMINISTE, PAS DEMANDÉ
 * AU MODÈLE.
 *
 * Le laisser choisir voudrait dire qu'il rend un `archetype_key` qu'il faut
 * ensuite valider, et qu'un archétype inventé coûte un second appel. Et
 * surtout : le préfixe mis en cache DÉPEND de l'archétype
 * (`archetypeInstruction`). Un archétype décidé par le modèle serait connu
 * trop tard pour cacher quoi que ce soit — chaque idée libre paierait
 * l'écriture du cache.
 *
 * `single_statement` est le défaut pour une raison de fond : une idée
 * exprimée en une phrase EST une déclaration. Les autres formes supposent une
 * structure (des étapes, deux côtés, des anneaux) qu'elle n'a pas donnée, et
 * fabriquer cette structure serait inventer ce qu'elle voulait dire.
 */
export const FREE_IDEA_ARCHETYPE = "single_statement";
export const CAROUSEL_ARCHETYPE = "carousel";

export function archetypeForRequest(input: {
  topic: SuggestedTopic | null;
  format: PostFormat;
}): string {
  if (input.format === "carousel") return CAROUSEL_ARCHETYPE;
  return input.topic?.archetype_key ?? FREE_IDEA_ARCHETYPE;
}

/** Ce qu'on envoie au modèle, quelle que soit l'entrée. */
export function toTopicRequest(input: {
  topic: SuggestedTopic | null;
  idea: string | null;
  format: PostFormat;
  checkin: string;
  /** Ce qu'elle a déjà écrit sur ce post, s'il y a quelque chose. */
  existingTitle?: string | null;
  existingCaption?: string | null;
}): TopicRequest {
  const archetypeKey = archetypeForRequest({ topic: input.topic, format: input.format });

  if (input.topic) {
    return {
      topicId: input.topic.id,
      archetypeKey,
      title: input.topic.title,
      hook: input.topic.hook,
      intent: input.topic.angle,
      checkin: input.checkin,
    };
  }

  /*
   * ⚠ CE QU'ELLE A DÉJÀ ÉCRIT SERT DE POINT DE DÉPART ET N'EST JAMAIS PERDU.
   * Un post rouvert avec un titre et trois lignes de légende porte déjà une
   * intention ; la jeter pour repartir d'une phrase serait lui faire
   * recommencer. Ce qui est déjà là entre dans la demande, et l'écrasement
   * effectif est décidé plus haut, avec sa confirmation.
   */
  const seed = [input.idea, input.existingTitle, input.existingCaption]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const idea = seed[0] ?? "";
  return {
    topicId: "free-idea",
    archetypeKey,
    title: idea.slice(0, 120),
    hook: seed.slice(1).join(" — ").slice(0, 240) || idea.slice(0, 240),
    /*
     * ⚠ UNE INTENTION RÉELLE DU CATALOGUE, pas un mot inventé. `educate` est
     * celle qui décrit « expliquer comment le travail fonctionne », et c'est
     * ce que fait une idée qu'elle formule elle-même. Le préfixe ne connaît
     * que ce vocabulaire-là.
     */
    intent: "educate",
    checkin: input.checkin,
  };
}

/**
 * Le résultat d'un « Write it », prêt à être écrit sur le post.
 *
 * ⚠ `slides` N'EST RENSEIGNÉ QUE POUR UN CARROUSEL, et il ne remplace pas
 * `payload` : le payload du carrousel EST la liste des cartes. Les slides
 * rendues sont dérivées, pas stockées.
 */
export type OnDemandWrite = {
  ok: boolean;
  reason?: string;
  archetypeKey: string;
  payload?: unknown;
  caption?: string;
  altText?: string;
  rationale?: string;
  title?: string;
  onImageText?: string;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  retried: boolean;
};

export async function runOnDemandWrite(
  port: WriteOnePort,
  input: {
    brand: BrandContext;
    request: TopicRequest;
  }
): Promise<OnDemandWrite> {
  const result = await writeOnePost(port, { brand: input.brand, topic: input.request });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      archetypeKey: input.request.archetypeKey,
      usage: result.usage,
      retried: result.retried,
    };
  }

  /*
   * ⚠ LE BUDGET EST REVÉRIFIÉ ICI, APRÈS `validateCopy`, ET CE N'EST PAS
   * REDONDANT. `validateCopy` le vérifie sur le payload tel quel ; pour un
   * carrousel, chaque carte a AUSSI son propre budget, et le budget du
   * conteneur ne le dit pas. Un carrousel dont la troisième slide déborde
   * passerait sinon jusqu'au moteur, qui le refuserait à la composition —
   * c'est-à-dire après avoir facturé.
   */
  const perCard = cardBudgetErrors(input.request.archetypeKey, result.payload);
  if (perCard.length > 0) {
    return {
      ok: false,
      reason: "over_budget",
      archetypeKey: input.request.archetypeKey,
      usage: result.usage,
      retried: result.retried,
    };
  }

  return {
    ok: true,
    archetypeKey: input.request.archetypeKey,
    payload: result.payload,
    caption: result.caption,
    altText: result.altText,
    rationale: result.rationale,
    /*
     * Le titre et la ligne d'image viennent du contenu, pas d'un champ
     * séparé : le modèle n'en rend pas, et en demander deux de plus
     * rallongerait le préfixe pour une information qui est déjà là.
     */
    title: displayTitle(input.request, result.payload),
    onImageText: displayTitle(input.request, result.payload),
    usage: result.usage,
    retried: result.retried,
  };
}

/** Les erreurs de budget de CHAQUE carte d'un carrousel. Vide sinon. */
export function cardBudgetErrors(archetypeKey: string, payload: unknown): string[] {
  if (archetypeKey !== CAROUSEL_ARCHETYPE) return [];
  const cards = (payload as { cards?: Array<{ archetype_key?: string; payload?: unknown }> })?.cards;
  if (!Array.isArray(cards)) return ["carousel: no cards"];

  const out: string[] = [];
  cards.forEach((card, index) => {
    const key = card?.archetype_key;
    if (typeof key !== "string" || !ARCHETYPES[key]) {
      out.push(`cards[${index}]: unknown archetype`);
      return;
    }
    for (const error of budgetErrors(key, card.payload)) {
      out.push(`cards[${index}].${error.path}: said ${error.said}, allowed ${error.allowed}`);
    }
  });
  return out;
}

/**
 * La ligne qui va sur la carte et sert de titre.
 *
 * Pour une déclaration c'est la déclaration ; sinon c'est le titre du sujet.
 * ⚠ JAMAIS UNE PHRASE FABRIQUÉE : une carte qui porte un titre que personne
 * n'a écrit est exactement ce que la garde déontologique ne peut pas voir
 * venir, puisqu'il n'est passé par aucun modèle ni aucune relecture.
 */
function displayTitle(request: TopicRequest, payload: unknown): string {
  const statement = (payload as { statement?: unknown })?.statement;
  if (typeof statement === "string" && statement.trim() !== "") return statement;
  return request.title;
}
