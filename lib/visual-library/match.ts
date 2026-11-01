import type { LibraryEntry } from "@/lib/visual-library/inventory";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'ILLUSTRATION EST CHOISIE PAR LE SENS — OU PAS DU TOUT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le défaut corrigé : la même plante en pot posée sur « EFT listens for
 * patterns », « Curiosity about patterns » et « CBT is not forgetting », parce
 * que le dessin était fixé par l'ARCHÉTYPE (`DRAWING_FOR`), pas par le contenu.
 *
 * ── CE QUI APPARIE, ET POURQUOI CES SIGNAUX ─────────────────────────────
 *
 * Mesuré sur la banque de production (186 sujets) et sur le mois de décembre
 * 2026 (30 posts) avant d'écrire une ligne :
 *
 *   FORT    le titre du sujet, la ligne d'image, la ligne de carte, les
 *           libellés et gloses du diagramme. C'est ce que le post DIT, en
 *           peu de mots choisis.
 *   FAIBLE  la première phrase de la légende. Elle ne peut que CONFIRMER une
 *           expression thématique entière (0,5), jamais suffire par un mot.
 *           Avec la légende comme signal fort, la couverture montait à 80 % —
 *           et « When the Past Interrupts » prenait l'orage (« mood »),
 *           « Feeling Is Not Surrender » les fils parallèles (« two »,
 *           « once »). Un objet au hasard, exactement le défaut à corriger.
 *
 * ── LE BARÈME, FIXÉ AVANT LA MESURE ─────────────────────────────────────
 *
 *   1    une expression thématique entière dans les signaux forts
 *        (« hidden load », « breaking a pattern », « loss »)
 *   1    l'objet dessiné nommé (« echo », « map », « bridge », « anchor »)
 *   0,5  chaque mot thématique distinct de plus, dans les signaux forts
 *   0,5  une expression thématique entière dans la légende
 *   0,5  la famille nommée (« EMDR », « grief », « pace ») — elle oriente,
 *        elle ne suffit jamais seule
 *
 *   SEUIL : 1. En dessous, `null` — et la composition du post est refusée,
 *   jamais une illustration par défaut, jamais la première de la famille.
 *
 * ⚠ AUCUN MODÈLE. C'est un appariement, pas une rédaction : un appel par post
 * coûterait plus cher que le post, et ne serait pas reproductible.
 *
 * ⚠ LES MOTS GÉNÉRIQUES NE COMPTENT PAS (« two », « once », « time »,
 * « change », « work »…) : ils sont dans les thèmes et dans tous les posts.
 * ⚠ ET LES IDIOMES NON PLUS : « room » (make room), « line », « light », « key »
 * (key idea) ne nomment pas un objet dans ces textes.
 */

export const MATCH_THRESHOLD = 1;

const STOP = new Set(
  ("a an the of and or to in on at for with without from by is are be as it its this that what your you our we i " +
    "not no over between after before into out up down then now one all any each every can may might will would could " +
    "should do does did has have had more most less than so very just only also about which who whom how why when where " +
    "there here their them they his her").split(" ")
);

export function stem(word: string): string {
  for (const suffix of ["ings", "ing", "edly", "ed", "ies", "es", "s", "ly"]) {
    if (word.length > suffix.length + 3 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length) + (suffix === "ies" ? "y" : "");
    }
  }
  return word;
}

export function tokens(text: string | null | undefined): string[] {
  return ((text ?? "").toLowerCase().replace(/[’‘]/g, "'").match(/[a-z]+/g) ?? [])
    .filter((w) => !STOP.has(w))
    .map(stem);
}

const WEAK = new Set(
  "two once time change work pass way place made held kept small own thing over across back between being life lives one open"
    .split(" ")
    .map(stem)
);

/*
 * L'objet que chaque dessin MONTRE, quand un post peut le nommer. Tenu à la main,
 * dessin par dessin : un nom d'objet tiré mécaniquement de l'identifiant
 * apporterait « two », « open », « drawn ».
 */
const OBJECTS: Record<string, string[]> = {
  "grief-empty-chair": ["chair"], "grief-folded-map": ["map"], "grief-unlit-candle": ["candle"],
  "grief-single-stem": ["stem", "flower"], "grief-open-window": ["window"], "grief-two-paths": ["path"],
  "anx-iceberg": ["iceberg"], "anx-tangled-thread": ["thread", "tangle"], "anx-overflowing-cup": ["cup", "overflow"],
  "anx-looping-line": ["loop"], "anx-many-doors": ["doors"], "anx-static-wave": ["wave"],
  "anger-gauge": ["gauge"], "anger-kettle": ["kettle"], "anger-storm-cloud": ["storm", "cloud"], "anger-pressure-valve": ["valve"],
  "bound-gate-in-fence": ["fence"], "bound-raised-palm": ["palm"], "bound-door-ajar": ["ajar"],
  "mem-tree-rings": ["rings", "tree"], "mem-sediment-layers": ["layers", "sediment"], "mem-echo-rings": ["echo"],
  "mem-photo-frame": ["photo", "photograph"], "mem-rearview": ["rearview", "mirror"], "mem-folded-paper": ["crease", "paper"],
  "pace-hourglass": ["hourglass"], "pace-stepping-stones": ["stepping", "stones"], "pace-staircase-landing": ["stairs", "staircase", "landing"],
  "pace-seedling-stages": ["seedling", "seed"], "pace-unwinding-spiral": ["spiral", "unwind"], "pace-metronome": ["metronome", "rhythm"],
  "ground-anchor": ["anchor"], "ground-roots": ["roots"], "ground-mountain": ["mountain"], "ground-breath-wave": ["breath", "breathe"],
  "ground-feet-standing": ["feet"],
  "emdr-lighthouse": ["lighthouse"], "emdr-bridge": ["bridge"], "emdr-two-way-arc": ["bilateral"], "emdr-pendulum": ["pendulum"],
  "emdr-horizon-boat": ["boat"],
  "eft-two-chairs": ["chairs"], "eft-interlocking-rings": ["interlock"], "eft-cord-between-hands": ["cord"], "eft-nest": ["nest"],
  "eft-parallel-threads": ["parallel"], "eft-shelter": ["shelter", "roof"],
  "cbt-balance-scale": ["scale", "weigh"], "cbt-magnifier": ["magnify", "magnifier"], "cbt-fork-in-road": ["fork", "road"],
  "cbt-broken-loop": ["cycle", "loop"], "cbt-sorting-shelves": ["shelves"],
  "agency-compass": ["compass"], "agency-key": ["unlock"], "agency-lantern": ["lantern"], "agency-sunrise-horizon": ["sunrise", "dawn"],
  "agency-open-gate": ["gate"],
  "practice-doorway": ["doorway", "threshold"], "practice-two-cups": ["cups", "tea"], "practice-clock": ["clock", "minutes"],
  "practice-notebook": ["notebook"],
};

/* La famille nommée dans le texte : elle oriente, elle ne suffit pas. */
const FAMILY_WORDS: Record<string, string[]> = {
  grief: ["grief", "grieve", "loss"], anx: ["anxiety", "anxious", "worry"], anger: ["anger", "angry"],
  bound: ["boundary", "boundaries"], mem: ["memory", "memories", "remember"], pace: ["pace"],
  ground: ["grounding"], emdr: ["emdr"], eft: ["eft"], cbt: ["cbt"], agency: [], practice: ["therapy", "session"],
};

export type PostSignals = {
  /** Le titre du sujet de banque. */
  title?: string | null;
  /** La ligne d'image (`hook`). */
  hook?: string | null;
  /** La ligne de carte. */
  cardLine?: string | null;
  /** Le payload du diagramme : libellés, gloses, phrase. */
  payload?: unknown;
  /** La légende — seule sa première phrase est lue, et seulement pour confirmer. */
  caption?: string | null;
};

export type Match = { id: string; score: number; reasons: string[] };

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== "archetype_key" && k !== "kind" && k !== "type")
      .flatMap(([, v]) => stringsIn(v));
  }
  return [];
}

function firstSentence(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(t);
  return (m ? m[0] : t.split("\n")[0] ?? "").trim();
}

/** Le score d'une illustration pour un post, avec ce qui l'a fait monter. */
export function scoreOne(post: PostSignals, entry: LibraryEntry): Match {
  const strong = new Set(
    [post.title, post.hook, post.cardLine, ...stringsIn(post.payload)].flatMap((t) => tokens(t))
  );
  const weak = new Set(tokens(firstSentence(post.caption)));
  let score = 0;
  const reasons: string[] = [];
  const hits = new Set<string>();
  let whole = 0;
  for (const phrase of entry.themes ?? []) {
    const all = tokens(phrase);
    const content = all.filter((w) => !WEAK.has(w));
    if (content.length === 0) continue;
    /*
     * ⚠ UNE EXPRESSION QUE LES MOTS GÉNÉRIQUES RÉDUISENT À UN MOT N'EST PAS
     * ENTIÈRE. « carrying your own » devient « carry » : compté comme une
     * expression, il posait la lanterne sur « Protection, not defect ». Il ne
     * vaut plus qu'un mot.
     */
    const reduced = all.length > 1 && content.length === 1;
    if (!reduced && content.every((w) => strong.has(w))) {
      score += 1;
      whole += 1;
      reasons.push(phrase);
    } else if (content.length >= 2 && content.every((w) => strong.has(w) || weak.has(w))) {
      score += 0.5;
      reasons.push(`${phrase} (légende)`);
    }
    for (const w of content) if (strong.has(w)) hits.add(w);
  }
  /* Les mots thématiques distincts au-delà de ceux déjà comptés par une expression entière. */
  const extra = Math.max(0, hits.size - whole);
  if (extra > 0) {
    score += 0.5 * extra;
    reasons.push(`mots : ${[...hits].sort().join(", ")}`);
  }
  const object = (OBJECTS[entry.id] ?? []).map(stem).find((w) => strong.has(w));
  if (object) {
    score += 1;
    reasons.push(`objet : ${object}`);
  }
  const family = entry.id.split("-")[0];
  if ((FAMILY_WORDS[family] ?? []).map(stem).some((w) => strong.has(w))) {
    score += 0.5;
    reasons.push(`famille : ${family}`);
  }
  return { id: entry.id, score, reasons };
}

/** Les illustrations au-dessus du seuil, de la meilleure à la moins bonne ; à égalité, par identifiant. */
export function candidates(post: PostSignals, entries: LibraryEntry[]): Match[] {
  return entries
    .filter((e) => e.drawable)
    .map((e) => scoreOne(post, e))
    .filter((m) => m.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * L'illustration d'un post, hors celles déjà prises dans le mois — ou `null`.
 *
 * ⚠ `null` EST UNE RÉPONSE. Elle refuse la composition du post ; le sélecteur
 * prend un remplaçant. Poser un objet sans rapport est pire que refuser.
 */
export function chooseIllustration(post: PostSignals, entries: LibraryEntry[], taken: ReadonlySet<string>): Match | null {
  return candidates(post, entries).find((m) => !taken.has(m.id)) ?? null;
}

/**
 * Un mois entier, dans l'ordre : deux posts ne portent jamais la même illustration.
 * Trente posts pour soixante-quatre dessins.
 */
export function assignMonth(posts: PostSignals[], entries: LibraryEntry[]): Array<Match | null> {
  const taken = new Set<string>();
  return posts.map((post) => {
    const m = chooseIllustration(post, entries, taken);
    if (m) taken.add(m.id);
    return m;
  });
}
