import { DANGLING } from "@/lib/content/generate/copy-batch";
import type { DirectionPalette } from "@/lib/compose/palette";

/*
 * ── CE QU'UN MOIS DOIT PASSER AVANT D'ÊTRE LIVRÉ ────────────────────────
 *
 * ⚠ AUCUN DE CES CONTRÔLES NE LIT UNE IMAGE, ET C'EST LEUR RAISON D'ÊTRE.
 *
 * Six mois réels ont été générés le 2026-09-21. **Quatre affichaient un
 * entonnoir parfait** — 30 écrits, 30 visuels, zéro pénurie, zéro repli — et
 * trois de ces quatre étaient mauvais. Chaque défaut a été trouvé en REGARDANT
 * la planche, par une personne ou par un évaluateur indépendant ; aucun ne
 * faisait échouer quoi que ce soit.
 *
 * Le pire se lisait même dans les mesures comme une amélioration : le mélange
 * d'archétypes s'est effondré à cinq sur onze au moment où la pénurie de
 * banque a disparu — parce que la variété des mois précédents était un effet
 * de bord de cette pénurie.
 *
 * Chacun des défauts ci-dessous est donc devenu un CALCUL. Les seuils sortent
 * des mois déjà produits, pas d'une intuition, et chacun est justifié à
 * l'endroit où il est écrit.
 */

export type Finding = {
  /** Le nom du contrôle, pour qu'un journal dise lequel a parlé. */
  check: string;
  detail: string;
};

/* ── 1. Le mélange ───────────────────────────────────────────────────── */

/**
 * Les bornes du mélange, mesurées sur les mois réellement produits.
 *
 *   compte           archétypes distincts   archétype dominant   phrases seules
 *   wren.ashcombe            8                   36,7 %              36,7 %
 *   perrin.vale              5                   36,7 %              36,7 %
 *   marlow.quint            11                   23,3 %              23,3 %
 *   isla.thornbury          10                   30,0 %              30,0 %
 *
 * ⚠ `perrin.vale` EST LE MOIS QUE CES SEUILS EXISTENT POUR REFUSER : cinq
 * archétypes, six icebergs identiques, onze phrases seules — et un entonnoir
 * parfait. `isla.thornbury`, validé à l'œil, tombe exactement sur 30,0 % : le
 * seuil est donc un dépassement STRICT, sinon le seul mois validé échouerait.
 */
export const MONTH_LIMITS = {
  /** Aucun archétype au-delà de 30 % du mois. */
  maxArchetypeShare: 0.3,
  /** Au moins 7 archétypes distincts sur 30 posts. */
  minDistinctArchetypes: 7,
  /** Les phrases seules sous 40 %. */
  maxLoneSentenceShare: 0.4,
  /**
   * La distance RGB minimale entre deux aplats d'une même carte.
   *
   * ⚠ EN ΔE76, PAS EN RGB, ET C'EST CE CHANGEMENT QUI A RÉVÉLÉ LE DÉFAUT.
   * Le seuil valait 24 en distance RGB, où `#DDC096` et `#D1AA73` sont à 43 —
   * donc « distinctes ». Une notation indépendante les a relevées comme quasi
   * identiques : en ΔE76 elles ne sont qu'à 11,7.
   *
   * 15 est le seuil retenu. En dessous, deux aplats voisins d'une même carte
   * se lisent comme un seul ; au-dessus, la séparation tient même sur les
   * fonds sombres, où les écarts sont naturellement plus serrés.
   */
  minTintDistance: 15,
  /**
   * ⚠ COMBIEN DE FOIS LE MÊME VISUEL PEUT PARAÎTRE DANS UN MOIS. MESURÉ.
   *
   * Le 2026-09-23, un mois a passé TOUS les contrôles avec **neuf cartes
   * praticiennes identiques en tête de planche** : même trois lignes — « EMDR
   * / Oakland, CA / Taking new clients » —, même dessin de porte, seul le
   * titre changeait. `mix.dominant` ne l'a pas vu parce que 9 sur 30 font
   * exactement 30,0 %, soit le plafond au centième près.
   *
   * La carte praticienne n'a pas de contenu propre : son payload vient du
   * brief et ne varie donc PAS d'un post à l'autre. Un deuxième exemplaire
   * est déjà la même carte avec un autre titre ; un neuvième est un mois qui
   * s'ouvre sur neuf fois la même image.
   *
   * Deux, et pas un : la carte qui dit comment elle travaille peut revenir
   * une fois dans le mois. Au-delà, c'est de la répétition, et c'est le même
   * défaut que deux titres identiques — un cran plus bas.
   */
  maxIdenticalPayloads: 2,
} as const;

/** Le nombre de posts sous lequel les proportions ne veulent plus rien dire. */
const MIX_APPLIES_FROM = 10;

export const LONE_SENTENCE = "single_statement";

export function checkMix(archetypes: string[]): Finding[] {
  const out: Finding[] = [];
  const n = archetypes.length;
  if (n < MIX_APPLIES_FROM) return out;

  const counts = new Map<string, number>();
  for (const a of archetypes) counts.set(a, (counts.get(a) ?? 0) + 1);

  if (counts.size < MONTH_LIMITS.minDistinctArchetypes) {
    out.push({
      check: "mix.distinct",
      detail: `${counts.size} archétypes distincts sur ${n} posts, minimum ${MONTH_LIMITS.minDistinctArchetypes}`,
    });
  }

  for (const [archetype, count] of counts) {
    const share = count / n;
    if (share > MONTH_LIMITS.maxArchetypeShare) {
      out.push({
        check: "mix.dominant",
        detail: `${archetype} occupe ${(share * 100).toFixed(1)} % du mois (${count}/${n}), plafond ${MONTH_LIMITS.maxArchetypeShare * 100} %`,
      });
    }
  }

  const lone = (counts.get(LONE_SENTENCE) ?? 0) / n;
  if (lone >= MONTH_LIMITS.maxLoneSentenceShare) {
    out.push({
      check: "mix.loneSentence",
      detail: `phrases seules à ${(lone * 100).toFixed(1)} %, plafond ${MONTH_LIMITS.maxLoneSentenceShare * 100} %`,
    });
  }
  return out;
}

/* ── 2. Les titres en double ─────────────────────────────────────────── */

const normaliseTitle = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");

/**
 * Deux fois le même titre sur le mois ASSEMBLÉ.
 *
 * ⚠ EN PLUS DU DÉDOUBLONNAGE AU TIRAGE, PAS À SA PLACE. Celui-là compare les
 * titres de banque ; la carte porte la ligne coupée à trente caractères, et
 * deux titres distincts peuvent s'y réduire au même texte APRÈS la comparaison.
 * Le mois de marlow.quint est sorti avec deux cartes « When the body
 * disagrees ». Ce contrôle regarde ce qui sera imprimé.
 */
export function checkDuplicateTitles(titles: string[]): Finding[] {
  const seen = new Map<string, number>();
  const out: Finding[] = [];
  for (const title of titles) {
    const key = normaliseTitle(title);
    if (!key) continue;
    const before = seen.get(key) ?? 0;
    if (before === 1) out.push({ check: "titles.duplicate", detail: `« ${title} » apparaît plus d'une fois` });
    seen.set(key, before + 1);
  }
  return out;
}

/* ── 3. Le mot suspendu ──────────────────────────────────────────────── */

/**
 * Les mots outils sur lesquels AUCUNE ligne ne peut finir.
 *
 * ── ⚠ DEUX LISTES, PARCE QU'IL Y A DEUX TRAVAUX ────────────────────────
 *
 * `DANGLING`, importée de la consigne, est faite pour un TITRE : elle
 * comprend les pronoms, les auxiliaires et les négations, parce qu'un titre
 * qui finit sur « you get » ou « doesn't » attend visiblement la suite.
 *
 * Appliquée aux champs d'un payload, elle refuse des gloses parfaitement
 * finies. Mesuré sur un vrai mois, seize refus d'un coup : « your body says
 * no », « before you know why », « You misread it », « what happened and what
 * didn't ». Ce sont des fragments, et un fragment est ce qu'une glose EST.
 *
 * Le cahier des charges nomme précisément les catégories : article,
 * préposition, conjonction, relatif. Celle-ci s'y tient — et rien d'autre.
 *
 * ⚠ `that` N'Y EST PAS. Il n'est relatif qu'au MILIEU d'une proposition ;
 * en dernier mot il est démonstratif, et « After that » est fini.
 */
const DANGLING_IN_FIELD = new Set([
  // articles — aucun emploi ne les met en fin de phrase
  "a", "an", "the",
  /*
   * ⚠ PRESQUE PLUS AUCUNE PRÉPOSITION, ET C'EST L'ANGLAIS QUI L'IMPOSE.
   *
   * Trois tours de faux positifs ont fini par dire la même chose : l'anglais
   * STRANDE ses prépositions. « information to work with », « where it comes
   * from », « what she's good at », « what it turns into » sont tous finis, et
   * chacun a été refusé à tort par une version de cette liste.
   *
   * Ne restent que celles qui ne strandent pas : `of`, `to` (marqueur
   * d'infinitif — « the body learns to » est vraiment coupé) et `than`.
   */
  "of", "to", "than",
  // conjonctions sans emploi adverbial
  "and", "or", "but", "nor", "because", "although", "though", "unless",
  "until", "whereas",
  // relatifs
  "which", "who", "whom", "whose",
]);

const lastWord = (text: string) => {
  const words = text.trim().split(/\s+/);
  return (words[words.length - 1] ?? "").toLowerCase().replace(/[^a-z']/g, "");
};

/**
 * Une ligne qui se termine sur un mot outil.
 *
 * ⚠ SUR TOUTE LIGNE, COUPÉE OU NON. Le rognage ne s'appliquait qu'aux lignes
 * trop longues, sur l'idée qu'un mot traînant est un artefact de la coupe.
 * « Efficiency can mask what » fait vingt-cinq caractères : personne ne l'a
 * coupée, le modèle avait écrit une phrase inachevée, et elle est sortie telle
 * quelle.
 */
export function checkDangling(
  lines: Array<{ where: string; text: string }>,
  /** `"line"` pour un titre, `"field"` pour un libellé ou une glose. */
  kind: "line" | "field" = "line"
): Finding[] {
  const list = kind === "line" ? DANGLING : DANGLING_IN_FIELD;
  const out: Finding[] = [];
  for (const { where, text } of lines) {
    const word = lastWord(text);
    // Un seul mot n'est pas une phrase suspendue : c'est une étiquette.
    if (text.trim().split(/\s+/).length < 2) continue;
    if (list.has(word)) {
      out.push({ check: "text.dangling", detail: `${where} se termine sur « ${word} » : « ${text} »` });
    }
  }
  return out;
}

/* ── 4. La recopie ───────────────────────────────────────────────────── */

/** Toutes les chaînes d'un payload, où qu'elles soient rangées. */
export function stringsIn(payload: unknown, path = "payload"): Array<{ where: string; text: string }> {
  if (typeof payload === "string") return [{ where: path, text: payload }];
  if (Array.isArray(payload)) return payload.flatMap((v, i) => stringsIn(v, `${path}[${i}]`));
  if (payload && typeof payload === "object") {
    return Object.entries(payload as Record<string, unknown>).flatMap(([k, v]) => stringsIn(v, `${path}.${k}`));
  }
  return [];
}

/**
 * Un champ du payload qui reprend la ligne de carte ou le titre.
 *
 * ⚠ TOUS LES ARCHÉTYPES, PAS SEULEMENT LA CARTE PRATICIENNE. C'est elle qui
 * l'a révélé — les trois du mois de marlow.quint avaient leur première ligne
 * identique à leur titre, mot pour mot — mais rien n'empêchait un libellé de
 * diagramme de faire pareil, et deux cartes `surface_and_beneath` d'un mois
 * antérieur le faisaient déjà.
 *
 * La carte imprime la ligne une fois, en haut, à la plus grande taille de la
 * carte. La réécrire dans un champ imprime les mêmes mots deux fois en deux
 * tailles et gâche le champ où ils se posent.
 */
export function checkEcho(cardLine: string, title: string, payload: unknown): Finding[] {
  const targets = [cardLine, title].map(normaliseTitle).filter((t) => t.length >= 8);
  if (targets.length === 0) return [];
  const out: Finding[] = [];
  for (const { where, text } of stringsIn(payload)) {
    const value = normaliseTitle(text);
    if (value.length < 8) continue;
    if (targets.includes(value)) {
      out.push({ check: "text.echo", detail: `${where} reprend la ligne de carte : « ${text} »` });
    }
  }
  return out;
}

/* ── 5. L'identité inventée ──────────────────────────────────────────── */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL = /https?:\/\/|\bwww\.[a-z0-9-]+\.[a-z]{2,}/i;
const PHONE = /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;
/** Un identifiant social : « @quelquechose » d'au moins trois caractères. */
const HANDLE = /(^|\s)@[a-z0-9._]{3,}/i;
/** Un nom de cabinet : des mots capitalisés suivis d'un suffixe de métier. */
const PRACTICE_NAME = /\b[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)*\s+(?:Therapy|Counselling|Counseling|Psychotherapy|Practice|Wellness|Clinic)\b/g;

/**
 * Une carte n'invente ni coordonnée, ni nom de cabinet.
 *
 * ── ⚠ LE DÉFAUT LE PLUS GRAVE DE LA SÉRIE, ET AUCUN CONTRÔLE NE LE VOYAIT ─
 *
 * Une carte praticienne, à l'intérieur d'un carrousel du mois d'Isla
 * Thornbury, portait :
 *
 *     "Rowan Mercier Therapy", "Evening slots open in October",
 *     "rowan@rowanmercier.com"
 *
 * Le pied de la même carte — et des trente-neuf fichiers du mois — dit « Isla
 * Thornbury Therapy ». Le nom et l'adresse sont INVENTÉS : il n'existe aucun
 * chemin de données entre deux comptes, et « rowan@rowanmercier.com » n'a
 * jamais été saisi nulle part.
 *
 * Ce n'est pas un défaut de mise en page. Une adresse fabriquée sur une carte
 * publiable envoie des clientes vers une boîte qui n'appartient à personne, et
 * un nom de cabinet fabriqué est une usurpation. Deux mois sur douze en
 * portaient une ; aucune suite, aucun budget de mots, aucun contrôle éthique
 * ne les a vus.
 *
 * Aucune carte n'a de raison légitime de porter une adresse, une URL ou un
 * téléphone : ces informations vivent dans le profil, pas dans le contenu.
 * Le nom du cabinet, lui, n'est autorisé que s'il EST celui du compte.
 */
export function checkInventedIdentity(
  payload: unknown,
  practiceName: string,
  /*
   * ⚠ TOUT CE QUE LA PRATICIENNE A SAISI, ET RIEN D'AUTRE. Sans cette liste,
   * le contrôle ne peut que reconnaître des FORMES — une arobase, un suffixe
   * « Therapy » — et il suffit d'une tournure qu'aucune expression régulière
   * ne couvre pour qu'un nom inventé passe. Avec elle, la question devient
   * la bonne : ce nom est-il dans le brief ?
   */
  allowed: string[] = []
): Finding[] {
  const out: Finding[] = [];
  const permitted = [practiceName, ...allowed]
    .filter(Boolean)
    .map((v) => v.trim().toLowerCase());

  for (const { where, text } of stringsIn(payload)) {
    if (EMAIL.test(text)) out.push({ check: "identity.contact", detail: `${where} porte une adresse e-mail : « ${text} »` });
    if (URL.test(text)) out.push({ check: "identity.contact", detail: `${where} porte une URL : « ${text} »` });
    if (PHONE.test(text)) out.push({ check: "identity.contact", detail: `${where} porte un numéro : « ${text} »` });
    if (HANDLE.test(text)) out.push({ check: "identity.contact", detail: `${where} porte un identifiant social : « ${text} »` });

    /*
     * Un nom de cabinet est repéré par son suffixe de métier, puis confronté à
     * ce que le brief porte. « Therapy » seul ne déclenche rien ; « Rowan
     * Mercier Therapy » sur le compte d'Isla, si.
     */
    for (const m of text.matchAll(PRACTICE_NAME)) {
      const named = m[0].trim();
      if (!permitted.includes(named.toLowerCase())) {
        out.push({
          check: "identity.practice",
          detail: `${where} nomme « ${named} », qui n'est pas dans le brief (cabinet : « ${practiceName} »)`,
        });
      }
    }
  }
  return out;
}

/* ── 6. La saturation des teintes ────────────────────────────────────── */

const rgbOf = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * La distance perceptuelle entre deux couleurs — ΔE76, dans l'espace Lab.
 *
 * ── ⚠ LA DISTANCE RGB DISAIT « 43 » LÀ OÙ L'ŒIL VOIT « PRESQUE PAREIL » ──
 *
 * Le contrôle mesurait une distance euclidienne en RGB, avec un seuil de 24.
 * `#DDC096` et `#D1AA73` en sont à 43 : il les déclarait distinctes. Un
 * évaluateur indépendant les a pourtant relevées comme « quasi identiques,
 * même teinte », et il avait raison — en ΔE76 elles ne sont qu'à **11,7**.
 *
 * Le RGB n'est pas perceptuel : il compte les bits, pas ce qu'on voit. Deux
 * jaunes séparés de 43 unités RGB se ressemblent beaucoup plus que deux bleus
 * séparés d'autant. Lab est fait pour cette question-là, et c'est l'unité dans
 * laquelle la remarque a été formulée.
 */
function toLab(hex: string): [number, number, number] | null {
  const rgb = rgbOf(hex);
  if (!rgb) return null;
  const lin = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  // sRGB → XYZ (D65), puis XYZ → Lab.
  const x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047;
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function colourDistance(a: string, b: string): number {
  const x = toLab(a);
  const y = toLab(b);
  if (!x || !y) return Number.POSITIVE_INFINITY;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Les remplissages écrits dans un SVG, dédoublonnés, sans `none`. */
export function fillsIn(svg: string): string[] {
  const out = new Set<string>();
  for (const m of svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)) out.add(m[1].toUpperCase());
  return [...out];
}

/**
 * Les aplats d'une carte : adoucis, et distincts les uns des autres.
 *
 * ⚠ MESURÉ SUR LES COULEURS ÉCRITES DANS LE SVG, pas sur la palette qui a
 * servi à le produire. Un contrôle qui relit la palette vérifie que le
 * générateur est d'accord avec lui-même ; celui-ci vérifie ce qui part chez
 * l'abonnée.
 */
export function checkTints(svg: string, direction: DirectionPalette): Finding[] {
  const out: Finding[] = [];
  const raw = [direction.primary, direction.secondary]
    .filter(Boolean)
    .map((c) => c.toUpperCase());

  const fills = fillsIn(svg).filter((f) => f !== direction.paper.toUpperCase());

  for (const fill of fills) {
    if (raw.includes(fill)) {
      out.push({
        check: "tints.raw",
        detail: `${fill} est une couleur de marque brute, pas un aplat adouci`,
      });
    }
  }

  // Les teintes d'une même carte ne se répètent pas de près.
  const tints = fills.filter((f) => !raw.includes(f) && f !== direction.dark.toUpperCase());
  for (let i = 0; i < tints.length; i += 1) {
    for (let j = i + 1; j < tints.length; j += 1) {
      const d = colourDistance(tints[i], tints[j]);
      if (d < MONTH_LIMITS.minTintDistance) {
        out.push({
          check: "tints.tooClose",
          detail: `${tints[i]} et ${tints[j]} sont à ${d.toFixed(0)} de distance, minimum ${MONTH_LIMITS.minTintDistance}`,
        });
      }
    }
  }
  return out;
}

/* ── Le mois entier ──────────────────────────────────────────────────── */

export type PostUnderCheck = {
  archetype: string;
  title: string;
  cardLine: string;
  payload: unknown;
  /** Le SVG livré, quand il a déjà été composé. */
  svg?: string;
};

export type MonthUnderCheck = {
  posts: PostUnderCheck[];
  direction: DirectionPalette;
  /** Le nom du cabinet, seul nom qu'une carte a le droit de porter. */
  practiceName?: string;
  /** Les autres chaînes du brief qu'une carte peut légitimement nommer. */
  identityAllowList?: string[];
};

/**
 * Tout ce qu'un mois doit passer. Une liste vide veut dire « livrable ».
 *
 * ⚠ UN MOIS QUI ÉCHOUE N'EST JAMAIS LIVRÉ. C'est l'appelant qui corrige —
 * retirage, changement d'archétype, réécriture d'un champ — puis repose la
 * question. Ce module ne corrige rien : il dit ce qui ne va pas, avec de quoi
 * le retrouver.
 */
/*
 * ── ⚠ DEUX POSTS AU MÊME PAYLOAD SONT LE MÊME VISUEL ───────────────────
 *
 * `checkDuplicateTitles` compare ce qui est ÉCRIT en tête. Ce contrôle-ci
 * compare ce qui est DESSINÉ en dessous, et c'est par là qu'un mois entier
 * est passé : neuf cartes praticiennes au payload rigoureusement identique,
 * neuf titres différents, et pas un contrôle pour le dire.
 */
export function checkIdenticalPayloads(posts: PostUnderCheck[]): Finding[] {
  const seen = new Map<string, string[]>();
  for (const post of posts) {
    if (post.payload === null || post.payload === undefined) continue;
    const key = JSON.stringify(post.payload);
    if (key === "{}" || key === "null") continue;
    seen.set(key, [...(seen.get(key) ?? []), post.cardLine || post.title]);
  }
  const out: Finding[] = [];
  for (const [, titles] of seen) {
    if (titles.length <= MONTH_LIMITS.maxIdenticalPayloads) continue;
    out.push({
      check: "mix.samePayload",
      detail:
        `${titles.length} posts au payload identique, plafond ${MONTH_LIMITS.maxIdenticalPayloads} : ` +
        titles.map((t) => `« ${t} »`).join(", "),
    });
  }
  return out;
}

export function checkMonth(month: MonthUnderCheck): Finding[] {
  const out: Finding[] = [];
  out.push(...checkMix(month.posts.map((p) => p.archetype)));
  out.push(...checkDuplicateTitles(month.posts.map((p) => p.cardLine || p.title)));
  out.push(...checkIdenticalPayloads(month.posts));

  for (const post of month.posts) {
    const where = `« ${post.cardLine || post.title} »`;
    out.push(...checkDangling([{ where: `${where} — ligne de carte`, text: post.cardLine || post.title }], "line"));
    out.push(
      ...checkDangling(
        stringsIn(post.payload).map((s) => ({ where: `${where} — ${s.where}`, text: s.text })),
        "field"
      )
    );
    out.push(...checkEcho(post.cardLine, post.title, post.payload));
    if (month.practiceName) {
      out.push(...checkInventedIdentity(post.payload, month.practiceName, month.identityAllowList ?? []));
    }
    if (post.svg) out.push(...checkTints(post.svg, month.direction));
  }
  return out;
}
