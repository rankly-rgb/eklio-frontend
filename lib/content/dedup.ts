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
 * qui disent la même chose sans partager un seul mot — « la carte ne colle
 * plus » et « le territoire a changé » passeraient. C'est la limite du
 * procédé, elle est assumée, et la parade est ailleurs : élargir la dérivation
 * des thèmes quand trois thèmes ne couvrent pas trente posts.
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
 * c'est le sujet du mois. « map » qui revient dans exactement deux, c'est la
 * même idée écrite deux fois. Le seuil se lit tout seul et ne demande aucune
 * connaissance du domaine.
 */
const DISTINCTIVE_AT_MOST = 2;

/** Assez proche pour qu'une lectrice y voie deux fois la même idée. */
const SAME_SENSE_OVERLAP = 0.5;

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
      const shared = keys[i].filter((k) => keys[j].includes(k));
      const overlap = jaccard(keys[i], keys[j]);
      const rare = shared.filter((k) => (df.get(k) ?? 0) <= DISTINCTIVE_AT_MOST);

      if (overlap >= SAME_SENSE_OVERLAP) {
        out.push({ a: i, b: j, why: `${Math.round(overlap * 100)} % de mots en commun` });
      } else if (rare.length >= 2) {
        out.push({ a: i, b: j, why: `deux mots distinctifs partagés : ${rare.join(", ")}` });
      } else if (rare.length === 1) {
        out.push({ a: i, b: j, why: `un mot que nul autre titre ne porte : ${rare[0]}` });
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
