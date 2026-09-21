import type { ContentItem, ContentMonth } from "@/lib/data/content";

/*
 * ── CE QUI EST À EKLIO ET CE QUI EST À ELLE ─────────────────────────────
 *
 * Les deux vivent dans `content_items` et se ressemblent en base. À l'écran ce
 * sont deux choses différentes, et les confondre a produit exactement ce que
 * la preview montrait : **une grande carte vide, avec Swap, Edit et Approve,
 * sur un post qu'elle avait créé elle-même en janvier.**
 *
 * Swap sur un post à elle n'a aucun sens — il n'y a pas de sujet à retirer du
 * paquet. Approve non plus : approuver, c'est accepter ce qu'Eklio propose, et
 * il ne proposait rien.
 *
 * ── LE SIGNAL EST `month_id`, PAS `topic` ───────────────────────────────
 *
 * ⚠ ET CE N'EST PAS CE QUE LE BRIEF DIT, DONC VOICI POURQUOI. Le brief écrit
 * « un item sans sujet issu de la banque n'est jamais rendu comme un post
 * généré ». L'intention est juste ; le critère ne tient pas dans un cas réel.
 *
 * `topic` peut devenir `null` sur un VRAI post généré : il suffit que le sujet
 * soit retiré de la banque après coup — `content_items.topic_id` est
 * `on delete set null`, et `content_item_json` documente ce cas en toutes
 * lettres. Classer sur `topic` ferait donc basculer un post du mois vers
 * « ses propres posts » le jour d'un nettoyage de banque, **et lui retirerait
 * Swap sur exactement le post qui en a le plus besoin.**
 *
 * `month_id` ne peut pas partir : c'est l'appartenance à un `content_months`,
 * et rien ne l'efface. Il dit précisément « ce post fait partie du mois
 * qu'Eklio a écrit », ce qui est la question posée.
 *
 * L'intention du brief est tenue par construction : `create_content_item` —
 * l'ancien bouton « New item » — laisse `month_id` à NULL, et
 * `update_content_item` n'accepte pas cette clef. Un post à elle ne peut donc
 * pas prendre un `month_id`, et un post du mois ne peut pas le perdre.
 */

/** Ce post fait-il partie d'un mois qu'Eklio a écrit ? */
export function isGenerated(item: ContentItem): boolean {
  return item.month_id !== null;
}

/*
 * ── « VIDE » VEUT DIRE : IL N'Y A RIEN À MONTRER ────────────────────────
 *
 * ⚠ LE STATUT NE COMPTE PAS, ET LA DATE NON PLUS. Un post daté sans un mot
 * dedans reste une carte blanche ; un brouillon d'une phrase est un vrai
 * brouillon. Ce qui décide est s'il PORTE quelque chose : un titre, une
 * légende, une ligne d'image, ou une photographie choisie.
 *
 * ⚠ ET RIEN N'EST SUPPRIMÉ. Un post vide disparaît du FLUX, pas de la base :
 * il reste dans le calendrier, il garde son identifiant, et son écran d'édition
 * s'ouvre toujours. Effacer les données de quelqu'un pour ranger un écran est
 * un échange qu'on ne propose pas.
 */
export function isEmptyDraft(item: ContentItem): boolean {
  const carries = [item.title, item.caption, item.on_image_text, item.image_slot];
  return carries.every((value) => (value ?? "").trim() === "");
}

/**
 * Un post généré qui n'a pas abouti.
 *
 * ⚠ CE N'EST PAS LA MÊME CHOSE QU'UN BROUILLON VIDE, et il ne se range pas au
 * même endroit. Elle n'a rien fait : la génération a échoué. Le masquer lui
 * ferait compter 29 cartes pour 30 posts sans savoir pourquoi ; le montrer en
 * grande carte blanche lui ferait croire qu'elle a du travail à faire dessus.
 *
 * Il porte donc son propre état compact, et **Swap y reste l'action
 * principale** — c'est un post de la banque, il y a un autre sujet à tirer.
 *
 * Le critère est « ni légende ni ligne d'image » : ce sont les deux choses
 * qu'une génération produit. Un titre seul ne fait pas un post.
 */
export function isFailedGeneration(item: ContentItem): boolean {
  if (!isGenerated(item)) return false;
  return (item.caption ?? "").trim() === "" && (item.on_image_text ?? "").trim() === "";
}

export type PartitionedMonth = {
  /** Les posts du mois écrit par Eklio, dans l'ordre reçu. */
  generated: ContentItem[];
  /** Ses propres posts, ceux qui portent quelque chose. Section secondaire. */
  hers: ContentItem[];
  /**
   * Ses brouillons vides. **Ni affichés, ni supprimés** — ce compte existe
   * pour qu'un écran puisse dire qu'ils sont là plutôt que de les escamoter.
   */
  emptyDrafts: ContentItem[];
};

export function partitionMonth(model: ContentMonth): PartitionedMonth {
  /*
   * ⚠ `items` ET `unscheduled` ENSEMBLE. Le RPC les sépare sur la présence
   * d'une date, ce qui est une question de calendrier. Ici la question est à
   * qui appartient le post, et un post du mois sans date reste un post du
   * mois.
   */
  const all = [...model.items, ...model.unscheduled];

  const generated: ContentItem[] = [];
  const hers: ContentItem[] = [];
  const emptyDrafts: ContentItem[] = [];

  for (const item of all) {
    if (isGenerated(item)) generated.push(item);
    else if (isEmptyDraft(item)) emptyDrafts.push(item);
    else hers.push(item);
  }

  return { generated, hers, emptyDrafts };
}

/**
 * Le mois est-il vide ?
 *
 * ⚠ IL L'EST DÈS QU'AUCUN POST N'A ÉTÉ GÉNÉRÉ, quels que soient ses propres
 * posts. C'est la question à laquelle l'état vide répond — « Eklio a-t-il
 * écrit mon mois ? » — et trois brouillons à elle n'y répondent pas oui.
 */
export function hasNoGeneratedPosts(model: ContentMonth): boolean {
  return partitionMonth(model).generated.length === 0;
}
