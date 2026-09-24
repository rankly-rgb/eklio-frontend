import { DANGLING } from "@/lib/content/generate/copy-batch";
import type { DirectionPalette } from "@/lib/compose/palette";
import { EYEBROW_MAX_CHARS, EYEBROW_MAX_WORDS } from "@/lib/content/bands";
import {
  checkUnfinished, checkCarouselPanels, checkBorrowed, checkClinicalClaim,
  checkSellsSlots, checkStraightQuotes, checkAcronym,
  type CompletenessVerdicts,
} from "@/lib/content/writing-checks";

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
  /**
   * ⚠ AU MOINS DEUX CARROUSELS PAR MOIS. MESURÉ : IL Y EN AVAIT ZÉRO.
   *
   * Trois mois livrés d'affilée, quatre-vingt-dix posts, pas un carrousel —
   * avec vingt-trois sujets de carrousel libres en banque (F22). Deux causes
   * empilées : l'ordre de tirage condamnait la dernière famille, et le modèle
   * rendait `cards` au premier niveau.
   *
   * Les deux sont corrigées. Ce plancher existe parce que RIEN NE L'AURAIT
   * DIT : `mix.distinct` demande sept archétypes sur onze, donc un mois à dix
   * passe, et le onzième peut manquer depuis toujours. Le carrousel est le
   * format que les onze références utilisent le plus et celui où une lectrice
   * s'arrête ; son absence n'est pas une variation de mélange.
   *
   * Deux, pas un : un seul carrousel est un accident qui peut se reproduire à
   * l'identique le mois suivant sans que le chiffre bouge.
   */
  minCarousels: 2,
  /**
   * ⚠ LA PART D'UNE FAMILLE SOUS LAQUELLE LE MOIS N'EST PLUS LE MOIS VISÉ.
   *
   * Exprimée en fraction de la part VISÉE, pas du mois : le tirage demande
   * `ceil(CANDIDATES / 3)` par famille, donc un tiers chacune, et le plancher
   * en est la moitié. Sur trente posts : un sixième, soit cinq.
   *
   * ⚠ MESURÉ SUR LES SIX MOIS ENREGISTRÉS, et c'est la seule raison pour
   * laquelle il vaut un demi et pas autre chose :
   *
   *   isla    12 / 10 /  8      marlow  10 / 11 /  9
   *   perrin  11 / 11 /  8      wren    11 / 14 /  5
   *   odile    9 / 11 / 10      pia      2 / 20 /  8
   *
   * Cinq mois sur six tiennent, `wren` exactement au plancher — le
   * dépassement est donc STRICT, comme pour `mix.dominant` et pour la même
   * raison. Le sixième, `pia`, est celui que ce plancher existe pour refuser :
   * ZÉRO PHRASE SEULE sur trente posts, livré sans un constat. L'ordre de
   * tirage avait été inversé pour sauver le carrousel (F22), et la phrase
   * seule a pris sa place dans le trou — le même défaut, l'autre bout.
   */
  minFamilyOfTarget: 0.5,
} as const;

/**
 * Les trois familles de format, et ce que chacune porte.
 *
 * ⚠ ELLE VIT ICI, PAS DANS LE HARNAIS, parce que c'est le contrôle qui a
 * besoin d'elle. Le harnais en tire son ordre de tirage et ses poids — il
 * compte `carousel` deux fois, qui est un poids de tirage et non une
 * composition — mais la liste des formats d'une famille est la même des deux
 * côtés, et une seule des deux copies aurait vieilli.
 */
export const FORMAT_FAMILIES: Record<string, readonly string[]> = {
  statement: ["single_statement", "practitioner_card"],
  simple: ["surface_and_beneath", "comparison_pair", "numbered_strategies", "cycle", "concentric_control"],
  varied: ["carousel", "quadrant_model", "annotated_curve", "lettered_technique"],
};

/** La famille d'un archétype, ou `null` s'il n'en a pas. */
export function familyOf(archetype: string): string | null {
  return Object.entries(FORMAT_FAMILIES).find(([, keys]) => keys.includes(archetype))?.[0] ?? null;
}

/**
 * Le plancher d'une famille sur un mois de `n` posts.
 *
 * ⚠ CALCULÉ SUR LA COMPOSITION VISÉE, PAS POSÉ À LA MAIN. Si une quatrième
 * famille apparaît, la part visée tombe à un quart et le plancher suit : un
 * seuil écrit en dur aurait exigé d'un mois à quatre familles ce qu'on
 * demandait à un mois à trois.
 */
export function familyFloor(n: number): number {
  const target = n / Object.keys(FORMAT_FAMILIES).length;
  return Math.floor(target * MONTH_LIMITS.minFamilyOfTarget);
}

/** Le nombre de posts sous lequel les proportions ne veulent plus rien dire. */
const MIX_APPLIES_FROM = 10;

export const LONE_SENTENCE = "single_statement";
export const CAROUSEL = "carousel";

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
  /*
   * ⚠ LE PLANCHER DE CARROUSELS EST DANS LE MÉLANGE, PAS À CÔTÉ. Trois mois
   * sont sortis sans un seul carrousel en affichant un mélange conforme :
   * `mix.distinct` se contente de sept archétypes sur onze, donc l'absence du
   * format le plus important ne déplaçait aucun chiffre.
   */
  /*
   * ── ⚠ UN FORMAT ATTENDU PEUT DISPARAÎTRE SANS DÉPLACER UN CHIFFRE ───
   *
   * Le mois du 2026-09-24 est sorti avec ZÉRO PHRASE SEULE sur trente posts,
   * et aucun contrôle ne l'a vu : `mix.distinct` se contente de sept
   * archétypes sur onze, `mix.dominant` et `mix.loneSentence` sont des
   * PLAFONDS. Tout ce jeu de bornes ne sait dire que « trop », jamais « pas
   * assez » — et le carrousel était le seul format à avoir un plancher.
   *
   * Chaque famille en a un maintenant, tiré de la part que le tirage lui
   * vise. Un mois où une famille passe sous la moitié de sa part n'est pas un
   * mélange qui penche : c'est un autre mois que celui qui a été acheté.
   */
  const floor = familyFloor(n);
  for (const [family, keys] of Object.entries(FORMAT_FAMILIES)) {
    const held = keys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
    if (held < floor) {
      out.push({
        check: `mix.floor.${family}`,
        detail: `la famille ${family} ne porte que ${held} post(s) sur ${n}, plancher ${floor} (${keys.join(", ")})`,
      });
    }
  }

  const carousels = counts.get(CAROUSEL) ?? 0;
  if (carousels < MONTH_LIMITS.minCarousels) {
    out.push({
      check: "mix.carousel",
      detail: `${carousels} carrousel(s) dans le mois, minimum ${MONTH_LIMITS.minCarousels}`,
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
  /**
   * La bande de surtitre, telle qu'elle sera imprimée.
   *
   * ⚠ C'EST LA VALEUR RENDUE, PAS CELLE D'OÙ ELLE VIENT. `eyebrowFor`
   * met en capitales, retire la ponctuation et raccourcit ; un contrôle qui
   * lirait l'entrée ne verrait pas « CORRECTAMYTH », qui est ce que la
   * clinicienne, elle, a vu.
   */
  eyebrow?: string;
};

export type MonthUnderCheck = {
  posts: PostUnderCheck[];
  /**
   * Combien de posts le mois promet.
   *
   * ⚠ MESURÉ : UN MOIS DE QUINZE POSTS A ÉTÉ LIVRÉ SANS UN SEUL CONSTAT, le
   * 2026-09-23, sur une banque à sec. Le rapport portait bien un `shortfall`
   * — « statement: 5 of 18 (the bank had no more) » — mais c'était une ligne
   * de rapport, pas un contrôle : rien ne refusait le mois.
   *
   * Un mois court n'est pas un mois imparfait, c'est la moitié de ce qui a
   * été acheté. « Un mois qui échoue n'est jamais livré » vaut aussi quand ce
   * qui échoue est le NOMBRE.
   */
  wanted?: number;
  direction: DirectionPalette;
  /**
   * Les modalités que la praticienne a saisies, pour le contrôle de sigle.
   *
   * ⚠ ELLES VIENNENT DU BRIEF, PAS DU CONTENU. C'est la règle de F16 : aucun
   * contrôle ne tire sa référence de la source qu'il surveille.
   */
  modalities?: string[];
  /**
   * Ce qu'un juge a dit des lignes que le lexique n'a pas su trancher.
   *
   * ⚠ UNE LIGNE ABSENTE N'EST PAS REFUSÉE. L'absence de verdict n'est pas un
   * verdict : un juge muet ne doit pas refuser un mois entier.
   */
  completeness?: CompletenessVerdicts;
  /** Le nom du cabinet, seul nom qu'une carte a le droit de porter. */
  practiceName?: string;
  /** Les autres chaînes du brief qu'une carte peut légitimement nommer. */
  identityAllowList?: string[];
  /**
   * Le catalogue `content_intents`, IDENTIFIANTS COMPRIS.
   *
   * ⚠ IL VIENT DE LA BASE, PAS DES POSTS. C'est la règle de F16 : un
   * contrôle qui tirerait la liste des valeurs observées les autoriserait
   * toutes, « CORRECTAMYTH » compris. Absent, le contrôle ne vérifie que la
   * forme — une liste vide n'est pas une liste.
   *
   * ⚠ ET LES IDENTIFIANTS SONT LA MOITIÉ UTILE. « CORRECTAMYTH » ne colle
   * pas les mots du libellé (« Myth, gently corrected ») mais ceux du CODE,
   * `correct_a_myth`. Un contrôle qui ne connaîtrait que les libellés ne
   * saurait pas lire le défaut qu'il est là pour lire.
   */
  eyebrowCatalogue?: Array<{ id: string; label: string }>;
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

export function checkCount(count: number, wanted: number | undefined): Finding[] {
  if (wanted === undefined || count >= wanted) return [];
  return [{
    check: "month.short",
    detail: `${count} posts pour ${wanted} promis — la banque n'en portait pas assez`,
  }];
}

/**
 * Toutes les chaînes écrites par le modèle dans un mois, nommées.
 *
 * ⚠ LA LIGNE DE CARTE EN FAIT PARTIE, ET C'EST CE QUI MANQUAIT. `checkEthics`
 * recevait `caption + altText + payload` : le TITRE n'était lu par aucune
 * règle déontologique. « Efficiency can become trauma » est un titre.
 */
export function writtenLinesIn(posts: PostUnderCheck[]): Array<{ where: string; text: string; archetype: string }> {
  const out: Array<{ where: string; text: string; archetype: string }> = [];
  for (const post of posts) {
    const where = `« ${post.cardLine || post.title} »`;
    out.push({ where: `${where} — ligne de carte`, text: post.cardLine || post.title, archetype: post.archetype });
    for (const s of stringsIn(post.payload)) {
      out.push({ where: `${where} — ${s.where}`, text: s.text, archetype: post.archetype });
    }
  }
  return out;
}

/* ── 12. La bande de surtitre ───────────────────────────────── */

/**
 * Ce qu'une bande mono a le droit de porter.
 *
 * ── ⚠ QUATRE CODES INTERNES ONT ÉTÉ IMPRIMÉS SUR DES CARTES PUBLIABLES ──
 *
 * Une notation indépendante les a relevés sur deux planches : « CORRECTAMYTH »,
 * « BEHINDTHEPRACTICE », « ONLY ONE », « A SOFT INVITATION ». Trois causes
 * distinctes, et aucune n'était celle qu'on croyait.
 *
 * 1. « CORRECTAMYTH » / « BEHINDTHEPRACTICE » : le harnais passait
 *    `topic.intent` — un identifiant — dans un champ nommé `angleLabel`. Mise
 *    en capitales, la ponctuation tombe, le tiret bas avec : les mots se
 *    collent. Le chemin produit lisait le bon champ depuis le début ; une même
 *    fonction de rendu avait deux appelants dont un seul juste.
 * 2. « ONLY ONE » : le catalogue porte « You are not the only one » pour
 *    `normalise`. Six mots pour une bande qui en tient quatre — le rendu
 *    retirait les mots outils (you, are, not, the) et gardait les trois
 *    premiers restants. Il restait un fragment qui dit le CONTRAIRE de la
 *    phrase dont il vient. Ce n'était pas un drapeau de pagination, comme la
 *    notation l'a lu : c'était pire.
 * 3. « A SOFT INVITATION » n'était pas un défaut. C'est le libellé `invite`,
 *    rendu correctement. Il est ici pour qu'on cesse de le chercher.
 *
 * ⚠ CE CONTRÔLE NE RÉPARE AUCUNE DES TROIS. Le harnais passe maintenant le
 * libellé, la base refuse un libellé trop long, et ce contrôle est le troisième
 * verrou : celui qui refuse le mois si les deux premiers ont été contournés.
 */
export function checkEyebrow(
  posts: PostUnderCheck[],
  catalogue: Array<{ id: string; label: string }>,
  practiceName?: string
): Finding[] {
  const out: Finding[] = [];
  const normalise = (v: string) => v.trim().replace(/\s+/g, " ").toUpperCase();
  const letters = (v: string) => v.replace(/[^a-z]/gi, "").toUpperCase();

  /* Ce qu'une bande a le droit de porter : un libellé, ou le nom du cabinet. */
  const allowed = new Set(
    [...catalogue.map((c) => c.label), ...(practiceName ? [practiceName] : [])].map(normalise)
  );
  /* Ce qu'elle n'a le droit de porter sous aucune forme : un code interne. */
  const codes = new Set(catalogue.map((c) => letters(c.id)));
  /*
   * Et le vocabulaire des deux, pour reconnaître un mot collé qu'aucune des
   * deux listes ne nomme — le prochain code, celui qui n'existe pas encore.
   */
  const vocabulary = new Set(
    catalogue
      .flatMap((c) => [...c.id.split(/[^a-z]+/i), ...c.label.split(/[^a-z]+/i)])
      .map((w) => w.toLowerCase())
      .filter(Boolean)
  );
  const runsTogether = (token: string): boolean => {
    const word = token.toLowerCase();
    if (word.length < 8 || vocabulary.has(word)) return false;
    /* Découpable en morceaux qui sont tous du vocabulaire. */
    const reachable = new Array<boolean>(word.length + 1).fill(false);
    reachable[0] = true;
    for (let end = 1; end <= word.length; end += 1) {
      for (let start = 0; start < end; start += 1) {
        if (reachable[start] && vocabulary.has(word.slice(start, end))) {
          reachable[end] = true;
          break;
        }
      }
    }
    return reachable[word.length];
  };

  for (const post of posts) {
    /* ⚠ Un surtitre non fourni n'est pas un surtitre fautif. */
    if (post.eyebrow === undefined) continue;
    const where = `« ${post.cardLine || post.title} »`;
    const say = (check: string, detail: string) => out.push({ check, detail: `${where} : ${detail}` });

    const value = post.eyebrow.trim();
    if (!value) {
      say("eyebrow.empty", "la bande de surtitre est vide");
      continue;
    }

    const words = value.split(/\s+/).filter(Boolean);
    if (words.length > EYEBROW_MAX_WORDS) {
      say("eyebrow.length", `« ${value} » fait ${words.length} mots (${EYEBROW_MAX_WORDS} au plus)`);
      continue;
    }
    if (value.length > EYEBROW_MAX_CHARS) {
      say("eyebrow.length", `« ${value} » fait ${value.length} caractères (${EYEBROW_MAX_CHARS} au plus)`);
      continue;
    }

    /*
     * Un identifiant se reconnaît à sa couture — tiret bas, chiffre, casse
     * mêlée — ou, une fois les capitales passées dessus, à ce qu'il EST.
     */
    /*
     * ⚠ ET LA COMPARAISON NE TRAVERSE PAS UNE ESPACE. Retirer les espaces
     * avant de comparer faisait de « BEHIND THE PRACTICE » — le libellé,
     * correctement rendu — le code `behind_the_practice`. Un code n'a pas
     * d'espace : c'est par là qu'on les distingue, et c'est justement ce qui
     * rend « BEHINDTHEPRACTICE » reconnaissable.
     */
    const seamless = words.length === 1 && codes.has(letters(value));
    if (/[_\d]/.test(value) || /[a-z][A-Z]/.test(value) || seamless) {
      say("eyebrow.identifier", `« ${value} » est un identifiant interne`);
      continue;
    }

    const glued = words.find(runsTogether);
    if (glued) {
      say("eyebrow.glued", `« ${glued} » est un mot collé, pas un mot`);
      continue;
    }

    if (allowed.size > 0 && !allowed.has(normalise(value))) {
      say("eyebrow.unlisted", `« ${value} » n'est pas un libellé autorisé`);
    }
  }
  return out;
}

export function checkMonth(month: MonthUnderCheck): Finding[] {
  const out: Finding[] = [];
  out.push(...checkCount(month.posts.length, month.wanted));
  out.push(...checkMix(month.posts.map((p) => p.archetype)));
  out.push(...checkDuplicateTitles(month.posts.map((p) => p.cardLine || p.title)));
  out.push(...checkIdenticalPayloads(month.posts));
  out.push(...checkEyebrow(month.posts, month.eyebrowCatalogue ?? [], month.practiceName));

  /*
   * ── LES SEPT CONTRÔLES D'ÉCRITURE (F26) ───────────────────────────────
   *
   * ⚠ ILS LISENT TOUTES LES CHAÎNES, LIGNE DE CARTE COMPRISE. Les sept
   * défauts trouvés à la main sur un mois vert vivaient dans des champs que
   * rien ne lisait, ou que lisait quelque chose qui ne refusait rien.
   */
  const written = writtenLinesIn(month.posts);
  out.push(...checkUnfinished(written, month.completeness));
  out.push(...checkCarouselPanels(month.posts));
  out.push(...checkBorrowed(written));
  out.push(...checkClinicalClaim(written));
  out.push(...checkSellsSlots(written));
  out.push(...checkStraightQuotes(written));
  out.push(...checkAcronym(month.posts, month.modalities ?? []));

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
