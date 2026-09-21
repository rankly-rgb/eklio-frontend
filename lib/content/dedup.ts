/*
 * ── DEUX TITRES DE MÊME SENS DANS UN MOIS ───────────────────────────────
 *
 * Le mois rendu le 2026-09-21b en portait six paires :
 *
 *   « Life rewrote itself »        / « When life rewrites itself »
 *   « When the map stops matching » / « When the map no longer fits »
 *   trois variantes de « competence masks … »
 *
 * Chacun de ces titres passait les contrôles un par un — budget de mots,
 * éthique, longueur — parce qu'aucun contrôle ne regardait les AUTRES titres
 * du mois. Une abonnée qui publie trente posts en publie trente différents ;
 * deux fois la même idée en trente jours, c'est un mois qui a l'air court.
 *
 * ⚠ SANS PLONGEMENTS VECTORIELS, ET C'EST UNE CONTRAINTE, PAS UN PIS-ALLER.
 * Un appel d'embeddings par titre, c'est un appel payant de plus par post, une
 * dépendance de plus sur le chemin de génération, et un seuil de similarité
 * que personne ne sait justifier en revue. Une comparaison lexicale normalisée
 * se lit, se teste, et rend le même verdict deux fois.
 *
 * ── CE QU'ELLE ATTRAPE, ET CE QU'ELLE LAISSE PASSER ─────────────────────
 *
 * Elle attrape les reformulations, qui sont le cas réel : même noyau de mots,
 * flexion ou tournure différente. Elle ne prétend pas attraper deux phrases
 * qui disent la même chose sans partager assez de mots — « la carte ne colle
 * plus » et « le territoire a changé » passeraient, et « the map stops
 * matching » / « the map no longer fits » aussi, faute de partager plus que
 * « map ». C'est la limite du procédé, elle est mesurée (voir le bloc sur la
 * règle retirée), et la parade est ailleurs : élargir la dérivation des thèmes
 * quand trois thèmes ne couvrent pas trente posts.
 */

/**
 * Les mots qui ne distinguent rien.
 *
 * ⚠ AUCUN MOT DU DOMAINE ICI. Pas de « burnout », pas de « rest », pas de
 * « therapy » : la fréquence s'en charge toute seule (voir `rareKeys`), et une
 * liste de vocabulaire métier serait une liste à tenir à jour pour chaque
 * spécialité qu'Eklio ouvrira ensuite.
 */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "when", "while", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did", "have", "has", "had",
  "of", "in", "on", "at", "to", "for", "with", "from", "by", "as", "into", "over", "after", "before",
  "you", "your", "yours", "it", "its", "itself", "they", "them", "their", "we", "our", "us",
  "not", "no", "yes", "so", "too", "very", "just", "only", "more", "most", "less", "least",
  "what", "which", "who", "whom", "whose", "how", "why", "where", "there", "here", "then", "than",
  "can", "could", "will", "would", "shall", "should", "may", "might", "must",
  "about", "again", "still", "even", "ever", "never", "always", "some", "any", "all", "each",
  "long", "longer", "keep", "keeps", "stop", "stops", "make", "makes", "get", "gets", "one", "two",
]);

/**
 * La clef d'un mot : ses quatre premières lettres.
 *
 * ⚠ UN RADICAL APPROXIMATIF VAUT MIEUX QU'UN VRAI DÉSUFFIXEUR ICI. « rewrote »
 * et « rewrites » n'ont pas le même radical — aucun désuffixeur par règles ne
 * les rapproche, il faudrait une table de verbes irréguliers. Leurs quatre
 * premières lettres, elles, sont « rewr » des deux côtés.
 *
 * Le prix de l'approximation est connu : « content » et « contest » partagent
 * « cont ». C'est une collision, elle rapproche deux titres qui n'ont rien à
 * voir, et la conséquence est qu'un sujet est reposé au lieu d'être publié —
 * jamais qu'un doublon sort. L'erreur va dans le bon sens.
 */
const KEY_LENGTH = 4;

/** Les clefs distinctives d'un titre, sans doublon, dans l'ordre d'apparition. */
export function keysOf(title: string): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const raw of title.toLowerCase().split(/[^a-z']+/)) {
    const word = raw.replace(/'/g, "");
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    const key = word.slice(0, KEY_LENGTH);
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const B = new Set(b);
  const shared = a.filter((k) => B.has(k)).length;
  return shared / (new Set([...a, ...b]).size);
}

/** Combien de titres du corpus portent chaque clef. */
function documentFrequency(corpus: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const keys of corpus) for (const k of new Set(keys)) df.set(k, (df.get(k) ?? 0) + 1);
  return df;
}

/**
 * Une clef est distinctive quand deux titres au plus la portent.
 *
 * ⚠ C'EST LA FRÉQUENCE QUI DÉCIDE, PAS UNE LISTE. Dans un mois sur
 * l'épuisement, « burnout » revient dans huit titres : ce n'est pas un doublon,
 * c'est le sujet du mois. Le seuil se lit tout seul et ne demande aucune
 * connaissance du domaine.
 */
const DISTINCTIVE_AT_MOST = 2;

/** Assez proche pour qu'une lectrice y voie deux fois la même idée. */
const SAME_SENSE_OVERLAP = 0.5;

/*
 * ── ⚠ IL Y AVAIT UNE TROISIÈME RÈGLE, ET ELLE A COÛTÉ VINGT POSTS ───────
 *
 * Elle disait : deux titres qui partagent UN SEUL mot distinctif — un mot que
 * nul autre titre du lot ne porte — redisent la même chose. Elle attrapait la
 * sixième paire du mois du 2026-09-21b, « When the map stops matching » et
 * « When the map no longer fits », que les deux règles ci-dessus laissent
 * passer puisqu'elles ne partagent que « map ».
 *
 * Mesuré sur la banque réelle, au tirage du mois de thea.brannon : **106
 * sujets refusés sur 116, et un mois de 10 posts au lieu de 30.** Les motifs
 * étaient « un mot que nul autre titre ne porte : life », puis « : emdr ».
 * Dans un mois écrit pour une praticienne EMDR dont le thème est le retour au
 * travail, « life » dans deux titres sur dix n'est pas une répétition — et un
 * mot présent dans deux titres sur dix a mécaniquement une fréquence de 2,
 * donc il est « distinctif » au sens de la règle. Elle ne mesurait pas la
 * redondance, elle mesurait la taille du lot.
 *
 * La règle est retirée plutôt qu'ajustée, parce qu'aucun réglage ne la sauve :
 * « map / map » et « life / life » ont exactement la même signature lexicale
 * — un mot porteur en commun. Les distinguer demande de savoir lequel des deux
 * est le SUJET du titre, ce qu'une comparaison lexicale ne sait pas et ce que
 * des plongements sauraient. Le cahier des charges les interdit, et il a
 * raison : le prix d'un doublon manqué est un post redondant dans le mois, le
 * prix de cette règle était vingt posts manquants.
 *
 * Ce qui reste attrape donc les REFORMULATIONS — même noyau de mots, tournure
 * différente — soit cinq des six paires du mois rendu. La sixième passe, et
 * c'est écrit ici plutôt que caché derrière un seuil.
 */

/**
 * Les clefs partagées, les termes composés comptant pour un.
 *
 * ── ⚠ « NERVOUS SYSTEM » A COÛTÉ SEPT POSTS ────────────────────────────
 *
 * Mesuré au tirage du mois de juno.calvert : **51 sujets refusés sur 76**, et
 * un mois de 23 posts au lieu de 30 faute de stock. Quinze de ces refus
 * portaient le même motif — « deux mots distinctifs partagés : nerv, syst ».
 *
 * « nervous system » est UN terme, écrit en deux mots. La règle des deux clefs
 * partagées le comptait pour deux et rapprochait donc n'importe quels titres
 * mentionnant le système nerveux — dans un mois écrit par une praticienne
 * EMDR, c'est-à-dire la moitié d'entre eux.
 *
 * ⚠ ET J'AVAIS ÉCARTÉ CE CORRECTIF POUR UNE RAISON FAUSSE. Le commentaire
 * précédent disait que fusionner un bigramme partagé casserait un vrai positif
 * du même mois, « competence masks exhaustion » / « when competence masks the
 * cost ». Vérification faite, non : ces deux titres ont un recouvrement de
 * Jaccard de 0.50, donc la PREMIÈRE règle les attrape, et elle les attrape
 * que le bigramme soit fusionné ou pas. La paire « nervous system », elle, est
 * à 0.29. Les deux cas se séparent tout seuls ; il suffisait de mesurer au
 * lieu de raisonner.
 *
 * Deux clefs adjacentes DANS LES DEUX titres sont donc un seul concept. Deux
 * clefs partagées mais séparées dans l'un des deux restent deux.
 */
function sharedConcepts(a: string[], b: string[]): string[] {
  const inB = new Set(b);
  const shared = a.filter((k) => inB.has(k));
  const adjacentIn = (keys: string[], x: string, y: string) => {
    const i = keys.indexOf(x);
    return i !== -1 && keys[i + 1] === y;
  };

  const merged: string[] = [];
  for (let i = 0; i < shared.length; i += 1) {
    const x = shared[i];
    const y = shared[i + 1];
    const compound =
      y !== undefined &&
      (adjacentIn(a, x, y) || adjacentIn(a, y, x)) &&
      (adjacentIn(b, x, y) || adjacentIn(b, y, x));
    merged.push(compound ? `${x} ${y}` : x);
    if (compound) i += 1;
  }
  return merged;
}

export type Collision = { a: number; b: number; why: string };

/**
 * Les paires de titres de même sens dans un lot.
 *
 * Trois règles, dans cet ordre de force : la moitié des mots en commun, deux
 * clefs distinctives partagées, ou une seule clef que personne d'autre ne
 * porte.
 */
export function collisionsIn(titles: string[]): Collision[] {
  const keys = titles.map(keysOf);
  const df = documentFrequency(keys);
  const out: Collision[] = [];

  for (let i = 0; i < titles.length; i += 1) {
    for (let j = i + 1; j < titles.length; j += 1) {
      const concepts = sharedConcepts(keys[i], keys[j]);
      const overlap = jaccard(keys[i], keys[j]);
      // Un concept composé est distinctif si l'une de ses deux clefs l'est.
      const rare = concepts.filter((c) =>
        c.split(" ").some((k) => (df.get(k) ?? 0) <= DISTINCTIVE_AT_MOST)
      );

      if (overlap >= SAME_SENSE_OVERLAP) {
        out.push({ a: i, b: j, why: `${Math.round(overlap * 100)} % de mots en commun` });
      } else if (rare.length >= 2) {
        out.push({ a: i, b: j, why: `deux mots distinctifs partagés : ${rare.join(", ")}` });
      }
    }
  }
  return out;
}

/**
 * Ce titre redit-il l'un de ceux déjà retenus ?
 *
 * ⚠ C'EST LA FORME QUI SERT AU TIRAGE. Un mois se compose sujet par sujet :
 * la question posée à chaque tirage est « celui-ci redit-il un précédent »,
 * pas « le lot final est-il propre ». Les deux vues partagent exactement le
 * même verdict — `collisionsIn` appliqué au lot augmenté — pour qu'aucune
 * divergence ne s'installe entre ce qui est refusé au tirage et ce qu'un
 * contrôle final rattraperait.
 */
export function redundantAgainst(title: string, accepted: string[]): string | null {
  if (accepted.length === 0) return null;
  const hit = collisionsIn([...accepted, title]).find((c) => c.b === accepted.length);
  return hit ? `« ${accepted[hit.a]} » — ${hit.why}` : null;
}
