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
      return dropE(word.slice(0, -suffix.length) + (suffix === "ies" ? "y" : ""));
    }
  }
  return dropE(word);
}

/*
 * ⚠ LE « e » FINAL TOMBE (2026-11-01). Sans lui, « change » restait « change » et
 * « changed » devenait « chang » : le mot générique était écarté, sa forme
 * conjuguée comptait comme un mot thématique, et « plans changed » appariait
 * tout ce qui parle d'un plan. Même racine pour les deux, désormais.
 */
function dropE(word: string): string {
  return word.length > 4 && word.endsWith("e") ? word.slice(0, -1) : word;
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
 * ══════════════════════════════════════════════════════════════════════════
 *  LES MOTS QUI NE DÉPARTAGENT RIEN — MESURÉS, PAS CHOISIS
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Fréquence documentaire sur la banque de production (186 sujets, 2026-11-01),
 * titre + ligne d'image + diagramme : les mots de thème présents dans 20 % des
 * sujets ou plus. Feel 45 %, old 41 %, present 39 %, life 37 %, still 33 %, past
 * 33 %, change 26 + 22 %, plan 24 %, future 23 %, happen 20 %.
 *
 * Ils COMPTENT dans une expression entière (« the past in the present »,
 * « changed plans » restent des thèmes) mais jamais comme mot isolé : seuls,
 * ils faisaient poser l'ammonite par « old, still » et la tablette des règles
 * par « long ago ». Un resserrement — le seuil ne bouge pas.
 */
const NON_DISCRIMINATING = new Set(
  "feel old present life still past change plan future happen".split(" ").map(stem)
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
  /* Lot 6 (2026-11-01). */
  "change-detour-arrow": ["detour"], "change-marked-calendar": ["calendar"], "change-rerouted-line": ["reroute"],
  "delay-forming-drop": ["drop"], "delay-icicle-thaw": ["thaw", "icicle"], "delay-letter-slot": ["letter"],
  "delay-sundial": ["sundial"],
  "mem-ammonite": ["ammonite", "fossil"], "mem-footprints": ["footprints"], "mem-long-shadow": ["shadow"],
  "mem-mended-bowl": ["mended", "bowl"], "mem-pressed-leaf": ["leaf"], "mem-returning-tide": ["tide"],
  "mem-root-under-floor": ["floor"],
  "priv-closed-fan": ["fan"], "priv-drawn-curtain": ["curtain"], "priv-sealed-envelope": ["envelope"],
  "prot-latched-box": ["latch"], "prot-shell": ["shell"], "prot-thorn-branch": ["thorn"], "prot-turtle-shell": ["turtle"],
  "rule-blank-signpost": ["signpost"], "rule-grooved-tablet": ["tablet"], "rule-ruler": ["ruler", "yardstick"],
  "rule-worn-path": ["worn"],
};

/* La famille nommée dans le texte : elle oriente, elle ne suffit pas. */
const FAMILY_WORDS: Record<string, string[]> = {
  grief: ["grief", "grieve", "loss"], anx: ["anxiety", "anxious", "worry"], anger: ["anger", "angry"],
  bound: ["boundary", "boundaries"], mem: ["memory", "memories", "remember"], pace: ["pace"],
  ground: ["grounding"], emdr: ["emdr"], eft: ["eft"], cbt: ["cbt"], agency: [], practice: ["therapy", "session"],
  change: [], delay: [], priv: ["privacy", "private"], prot: ["protective", "protection"], rule: ["rule", "rules"],
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

export type Match = {
  id: string;
  score: number;
  reasons: string[];
  /** Expressions entières + objet nommé : ce qui départage deux scores égaux, avant l'identifiant. */
  precise: number;
};

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
     * ⚠ UNE EXPRESSION EST ENTIÈRE QUAND TOUS SES MOTS SONT LÀ — génériques
     * compris. « carrying your own » exige « own » : réduit à « carry », il posait
     * la lanterne sur « Protection, not defect ». Et « changed plans » compte
     * entier quand le post dit « plans changed », même si « change » seul est
     * générique (corrigé le 2026-11-01 : la première version de cette règle
     * l'écartait).
     */
    if (all.every((w) => strong.has(w))) {
      score += 1;
      whole += 1;
      reasons.push(phrase);
    } else if (content.length >= 2 && content.every((w) => strong.has(w) || weak.has(w))) {
      score += 0.5;
      reasons.push(`${phrase} (légende)`);
    }
    for (const w of content) if (strong.has(w) && !NON_DISCRIMINATING.has(w)) hits.add(w);
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
  /* La preuve précise : une expression entière, un objet nommé. Elle départage à score égal. */
  return { id: entry.id, score, reasons, precise: whole + (object ? 1 : 0) };
}

/** Les illustrations au-dessus du seuil, de la meilleure à la moins bonne ; à égalité, par identifiant. */
/*
 * ⚠ MÉMORISÉ PAR POST ET PAR INVENTAIRE. Le sélecteur rejoue l'attribution du
 * mois à chaque tour et à chaque déplacement essayé (`placeByDrawing`) ; les
 * candidats d'un post ne dépendent que de son texte et de l'inventaire, pas de
 * sa place. Clés faibles : rien ne survit au mois.
 */
const memo = new WeakMap<PostSignals, WeakMap<LibraryEntry[], Match[]>>();

export function candidates(post: PostSignals, entries: LibraryEntry[]): Match[] {
  let byInventory = memo.get(post);
  if (!byInventory) memo.set(post, (byInventory = new WeakMap()));
  const hit = byInventory.get(entries);
  if (hit) return hit;
  const out = rawCandidates(post, entries);
  byInventory.set(entries, out);
  return out;
}

function rawCandidates(post: PostSignals, entries: LibraryEntry[]): Match[] {
  return entries
    .filter((e) => e.drawable)
    .map((e) => scoreOne(post, e))
    .filter((m) => m.score >= MATCH_THRESHOLD)
    /*
     * ⚠ À SCORE ÉGAL, LA PREUVE PRÉCISE D'ABORD. « Plans changed without
     * permission » sur « When the map changes » : la clé (« permission », un mot)
     * et la carte pliée (« map », l'objet nommé) faisaient 1 chacune, et l'ordre
     * alphabétique donnait la clé.
     */
    .sort((a, b) => b.score - a.score || b.precise - a.precise || a.id.localeCompare(b.id));
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
 * L'écart minimal entre deux posts qui portent le même dessin.
 *
 * ⚠ RÉGLÉ PAR NAIMA LE 2026-11-01, À LA PLACE DE « JAMAIS DEUX FOIS DANS LE MOIS ».
 * Un fil Instagram montre neuf à douze vignettes à la fois : deux reprises
 * éloignées ne se voient pas, deux reprises voisines sautent aux yeux. L'unicité
 * stricte coûtait trois posts sur trente en décembre, sans rien protéger de
 * visible. Ce n'est PAS le seuil d'appariement — lui garantit que le dessin dit
 * le sujet, et il ne bouge pas.
 */
export const REPEAT_SPACING = 10;

/** Les dessins interdits au rang `index` : ceux posés aux neuf rangs précédents. */
export function blockedAt(index: number, chosen: Array<string | null>, spacing = REPEAT_SPACING): Set<string> {
  const out = new Set<string>();
  for (let j = Math.max(0, index - spacing + 1); j < index; j += 1) {
    const id = chosen[j];
    if (id) out.add(id);
  }
  return out;
}

/**
 * Un mois entier, dans l'ordre de publication : deux posts à moins de
 * `REPEAT_SPACING` rangs d'écart ne portent jamais le même dessin.
 */
export function assignMonth(posts: PostSignals[], entries: LibraryEntry[], spacing = REPEAT_SPACING): Array<Match | null> {
  const chosen: Array<string | null> = [];
  return posts.map((post, i) => {
    const m = chooseIllustration(post, entries, blockedAt(i, chosen, spacing));
    chosen.push(m?.id ?? null);
    return m;
  });
}
