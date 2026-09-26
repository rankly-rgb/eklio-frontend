import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

/*
 * ── ⚠ VINGT MÉCANISMES DANS LE HARNAIS, UN SEUL CÔTÉ PRODUIT ────────────
 *
 * Recensé le 2026-09-26, et c'est pire que ce que le brief supposait. Deux
 * mécanismes manquaient, croyait-on — le garde-fou de banque et la libération
 * des assignations. La vérité mesurée : sur la chaîne produit entière,
 * **AUCUN** des vingt n'est présent. Ni `checkMonth`, ni le portillon par post,
 * ni la mention de licence, ni le juge de complétude, ni la passe de révision,
 * ni la banque — ni même le crédit de contenu.
 *
 * ⚠ LE CRÉDIT NON PLUS, ET C'EST UNE CORRECTION DE MA PREMIÈRE LECTURE. Un
 * premier relevé, fait avec une correspondance de mots nus, avait vu
 * `reserve_credit` dans la chaîne : il l'avait trouvé dans un COMMENTAIRE de
 * `copy-batch.ts`. Le chemin produit appelle `reserve_content_image` —
 * l'allocation d'IMAGES — et `approve_content_month`. Le quota de trente posts
 * achetés par mois, que `reserve_credit` tient dans le harnais, n'est tenu
 * nulle part sur le chemin produit.
 *
 * ⚠ ET LA CAUSE N'EST PAS UN OUBLI, C'EST DEUX GÉNÉRATEURS. Le harnais passe
 * par les onze archétypes, tire dans la banque de sujets et compose des cartes
 * vectorielles. Le chemin produit (`generateMonth`, `pipeline.ts`) écrit une
 * ligne et une légende par post, dessine des fonds photographiques, n'appelle
 * jamais `next_topic_for_kit`, ne produit aucun `payload` — et rend
 * `ethicsCheck: { passed: true }` EN DUR.
 *
 * Porter « les deux mécanismes manquants » n'a donc pas de sens : on ne peut pas
 * garder une banque que ce chemin ne consulte pas. Voir F45.
 *
 * ── CE QUE CE FICHIER FAIT ──────────────────────────────────────────────
 *
 * Il ne réclame pas la parité — elle n'est pas atteignable tant que le produit
 * n'a pas le générateur du harnais. Il tient le RECENSEMENT : chaque mécanisme
 * présent d'un seul côté doit porter une raison NOMMÉE. Un mécanisme ajouté au
 * harnais sans équivalent produit et sans raison fait tomber ce test, et
 * quelqu'un doit décider lequel des deux il rejoint.
 */

const HARNESS = "scripts/local-render/20-month.ts";
const PRODUCT_ROOTS = [
  "lib/content/generate/run.ts",
  "app/api/cron/content-month/route.ts",
  "app/api/cron/release-topics/route.ts",
];

/** La chaîne transitive d'un fichier, par ses imports locaux. */
function chainOf(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/from "(@\/[^"]+|\.\.?\/[^"]+)"/g)) {
      const spec = m[1];
      const base = spec.startsWith("@/") ? spec.slice(2) : normalize(join(dirname(file), spec));
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(base + ext)) {
          stack.push(base + ext);
          break;
        }
      }
    }
  }
  return seen;
}

/**
 * Les mécanismes d'un ensemble de fichiers.
 *
 * ⚠ DÉRIVÉS DE DEUX SOURCES MÉCANIQUES, pas d'une liste. Les fonctions
 * importées de `lib/` — c'est-à-dire ce que le fichier fait faire à autre chose
 * — et les noms de RPC, qui sont des chaînes littérales et donc invisibles au
 * compilateur. Les secondes sont celles qui se perdent : un appelant produit
 * peut appeler `next_topic_for_kit` sans qu'aucun type ne l'y oblige.
 */
function mechanismsOf(files: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/\brpc(?:\s*as[^)]*\))?\s*\(\s*"([a-z_]+)"/g)) out.add(m[1]);
    for (const m of src.matchAll(/"(release_stale_topic_assignments|drawable_count_for_kit|next_topic_for_kit|assign_topic_to_kit|reserve_credit|settle_credit)"/g)) {
      out.add(m[1]);
    }
    for (const m of src.matchAll(/\b(check[A-Z]\w*|guardBank|judgeCompleteness|reviseMonth|licenceMissingMessage|licenceMention|composeWithFallback|bankShortfall)\s*\(/g)) {
      out.add(m[1]);
    }
  }
  return out;
}

/*
 * ⚠ CHAQUE EXEMPTION DIT POURQUOI, et aucune ne dit « pas encore ». Une liste
 * d'exemptions sans raison est une liste qui grandit.
 */
const ONLY_IN_HARNESS: Record<string, string> = {
  /* ── la banque : le chemin produit ne tire pas de sujets ─────────────── */
  guardBank:
    "garde une banque de sujets que le chemin produit ne consulte pas : il passe par planMonth et n'appelle jamais le tirage (F45)",
  drawable_count_for_kit:
    "compte le tirable par archétype pour guardBank ; sans tirage côté produit, il n'y a rien à compter",
  assign_topic_to_kit:
    "le tirage de banque n'existe que sur le chemin archétypes : rien à assigner quand rien n'est tiré",

  /* ── les trente contrôles : ils portent sur des payloads d'archétypes ── */
  checkMonth:
    "les trente contrôles portent sur un mois d'archétypes composés ; le chemin produit ne produit aucun payload (F45)",
  checkPostAlone:
    "moitié par post de checkMonth — un post produit n'a ni payload, ni surtitre, ni pied de carte à contrôler",
  judgeCompleteness:
    "juge la complétude d'une LIGNE de carte de trente caractères ; le chemin produit n'écrit pas de lignes de carte",
  reviseMonth:
    "réécrit les libellés répétés d'un payload d'archétype — il n'y a aucun payload côté produit",
  composeWithFallback:
    "la composition vectorielle des onze archétypes ; le chemin produit compose par un port injecté qui dessine des fonds photographiques",

  /* ── la licence : la plus grave des absences ─────────────────────────── */
  licenceMissingMessage:
    "⚠ CELLE-CI EST GRAVE. Le pied de licence est posé par composeWithFallback ; un mois produit ne porterait AUCUNE mention, ce que la Californie exige dans toute publicité (F45)",
  licenceMention:
    "même raison que licenceMissingMessage : la mention se compose sur la carte, et le chemin produit ne compose pas de cartes",

  /* ── le crédit : tenu, mais pas celui-là ─────────────────────────────── */
  reserve_credit:
    "⚠ le chemin produit tient l'allocation d'IMAGES (reserve_content_image), pas le crédit de contenu : le quota de trente posts achetés n'y est tenu nulle part (F45)",
  settle_credit:
    "même raison que reserve_credit — et c'est lui qui écrit le coût réel au livre, donc le coût d'un mois produit n'y apparaîtrait pas",

  /* ── et une qui est présente des deux côtés, autrement ───────────────── */
  checkEthics:
    "présent des DEUX côtés en réalité : le chemin produit l'appelle par lib/ethics/guard.ts, à la réécriture. Listé ici parce que le harnais l'appelle AUSSI en direct, sur les quatre colonnes de la gâchette, juste avant l'insert",
};

/*
 * ⚠ CETTE CARTE EST EXACTEMENT AUSSI LONGUE QUE CE QUE L'EXTRACTEUR TROUVE, et
 * un test le vérifie. Les premières versions portaient quatre exemptions pour
 * des contrôles que le harnais n'appelle pas lui-même — `checkCount`,
 * `checkSellsSlots`, `checkInventedIdentity`, `checkAdvertisingEthics` — et une
 * pour `next_topic_for_kit`, qui n'apparaît qu'en commentaire. Une exemption
 * pour un mécanisme que personne n'appelle est une ligne qui ment sur ce qu'elle
 * protège, et elle survivrait au retrait du mécanisme.
 */

describe("le recensement harnais / produit", () => {
  const harness = mechanismsOf([HARNESS]);
  const product = mechanismsOf(chainOf(PRODUCT_ROOTS));

  it("le recensement trouve bien quelque chose des deux côtés", () => {
    expect(harness.size, "le harnais ne porte plus aucun mécanisme reconnaissable").toBeGreaterThan(10);
    expect(product.size, "la chaîne produit ne porte plus aucun mécanisme").toBeGreaterThan(0);
  });

  /*
   * ⚠ LE TEST QUI TOMBE QUAND UN MÉCANISME ARRIVE SANS ÉQUIVALENT. C'est la
   * classe de F27 : deux moitiés justes, la jonction fausse. Personne ne
   * remarquait que le produit n'avait rien, parce que rien ne comparait.
   */
  it("aucun mécanisme du harnais n'est absent du produit sans raison nommée", () => {
    const orphans = [...harness].filter((m) => !product.has(m) && !(m in ONLY_IN_HARNESS));
    expect(
      orphans.sort(),
      `mécanisme(s) du harnais sans équivalent produit ni raison : ${orphans.join(", ")}`
    ).toEqual([]);
  });

  it("la carte d'exemptions ne porte rien de plus que ce qui existe", () => {
    const extra = Object.keys(ONLY_IN_HARNESS).filter((m) => !harness.has(m));
    expect(
      extra.sort(),
      `exemption(s) pour un mécanisme que le harnais n'appelle pas : ${extra.join(", ")}`
    ).toEqual([]);
  });

  it("chaque exemption dit pourquoi, et concerne un mécanisme qui existe encore", () => {
    for (const [mechanism, why] of Object.entries(ONLY_IN_HARNESS)) {
      expect(harness.has(mechanism), `${mechanism} n'est plus dans le harnais — exemption périmée`).toBe(true);
      expect(why.length, mechanism).toBeGreaterThan(30);
      expect(why, `${mechanism} : « pas encore » n'est pas une raison`).not.toMatch(/pas encore|à faire|TODO/i);
    }
  });

  /*
   * ⚠ ET LA LIBÉRATION, ELLE, EST BIEN DES DEUX CÔTÉS DÉSORMAIS. C'est le seul
   * mécanisme du harnais qui était portable tel quel : il ne dépend d'aucun
   * générateur, seulement de la banque. Sa route planifiée existe.
   */
  it("la libération des assignations est des deux côtés", () => {
    expect(harness.has("release_stale_topic_assignments")).toBe(true);
    expect(
      product.has("release_stale_topic_assignments"),
      "la route planifiée de libération a disparu du produit"
    ).toBe(true);
  });

  it("le crédit est des deux côtés", () => {
    for (const rpc of ["reserve_credit", "settle_credit"]) {
      expect(harness.has(rpc) || product.has(rpc), rpc).toBe(true);
    }
  });
});

/*
 * ── ⚠ ET LA ROUTE PLANIFIÉE EST ENREGISTRÉE ─────────────────────────────
 *
 * Une route `cron` qui n'est pas dans `vercel.json` ne tourne jamais, et rien
 * ne le dit : elle répond correctement quand on l'appelle à la main. C'est
 * exactement la forme du défaut que `content-month` porte encore (aucune entrée,
 * et c'est délibéré pour celle-là).
 */
describe("la route de libération tourne vraiment", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons?: Array<{ path: string; schedule: string }>;
  };

  it("elle a une entrée dans vercel.json", () => {
    const entry = (vercel.crons ?? []).find((c) => c.path === "/api/cron/release-topics");
    expect(entry, "/api/cron/release-topics n'est pas planifiée — elle ne tournera jamais").toBeDefined();
    expect(entry!.schedule).toMatch(/^\S+ \S+ \S+ \S+ \S+$/);
  });

  it("elle exige le secret de cron avant tout", () => {
    const src = readFileSync("app/api/cron/release-topics/route.ts", "utf8");
    const auth = src.indexOf("authorizeCron(request)");
    const work = src.indexOf('rpc("release_stale_topic_assignments")');
    expect(auth).toBeGreaterThan(-1);
    expect(auth, "elle balaie avant de vérifier qui appelle").toBeLessThan(work);
  });

  /*
   * ⚠ ELLE ÉCHOUE FERMÉ. Un balai qui ne tourne pas laisse des sujets bloqués,
   * récupérable au tour suivant ; répondre « ok » sur un balayage qui n'a pas eu
   * lieu ferait croire la banque saine.
   */
  it("une erreur rend 500, pas ok", () => {
    const src = readFileSync("app/api/cron/release-topics/route.ts", "utf8");
    expect(src).toContain("{ ok: false, released: 0 }, { status: 500 }");
  });
});
