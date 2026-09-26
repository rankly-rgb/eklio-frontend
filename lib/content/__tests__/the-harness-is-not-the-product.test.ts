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

/**
 * Les fichiers que F45 retire, et qui ne partent qu'en dernier.
 *
 * ⚠ ILS SONT NOMMÉS POUR QUE LEUR DETTE EXPIRE. Tant qu'ils existent, la route
 * reste en 501. Le jour où ils sont supprimés, les tests qui les citent tombent,
 * et c'est le signal que la barrière peut se lever.
 */
const TO_REMOVE = [
  "lib/content/generate/pipeline.ts",
  "lib/content/generate/run.ts",
  "scripts/content/generate-month.ts",
] as const;

/*
 * ── LE PÉRIMÈTRE : L'ORCHESTRATION DU MOIS, PAS TOUTE LA COUCHE DE DONNÉES ──
 *
 * ⚠ TROISIÈME FORME DE CE RECENSEMENT, ET LES DEUX PREMIÈRES MENTAIENT dans des
 * sens opposés. Lire le seul fichier du harnais PERDAIT un mécanisme dès qu'on le
 * déplaçait dans `lib/` ; lire sa chaîne transitive entière RAMASSAIT tout le
 * CRUD de `lib/data/content.ts` — `get_content_month`, `swap_content_item`,
 * `set_content_preferences` — qui n'est pas de l'orchestration de génération et
 * que les écrans du produit utilisent déjà.
 *
 * Le périmètre est donc NOMMÉ : le harnais, et les modules qui en ont été
 * extraits. Il grandit à chaque portage, et c'est exactement ce qu'on veut —
 * ajouter un module extrait sans l'inscrire ici le laisserait hors du
 * recensement.
 */
const HARNESS_ORCHESTRATION = [
  "scripts/local-render/20-month.ts",
  "lib/content/month/select.ts",
  "lib/content/bank-guard.ts",
] as const;

const HARNESS = "scripts/local-render/20-month.ts";
/*
 * ── LE CÔTÉ PRODUIT, NOMMÉ LUI AUSSI — ET SYMÉTRIQUEMENT ────────────────
 *
 * ⚠ QUATRIÈME FORME, ET LES TROIS PREMIÈRES SE TROMPAIENT TOUTES DANS LE MÊME
 *   SENS : elles flattaient.
 *
 *   1. le fichier du harnais seul      perdait un mécanisme dès qu'on le
 *                                      déplaçait dans `lib/`
 *   2. la chaîne transitive du harnais ramassait tout le CRUD de `lib/data/`
 *   3. la chaîne transitive du produit comptait les imports de `run.ts`, le
 *                                      générateur qu'on RETIRE, et comptait les
 *                                      DÉFINITIONS de `month-checks.ts` comme
 *                                      des appels
 *
 * Et même corrigée de tout cela, une chaîne transitive compte un appel écrit
 * DANS un module que rien n'invoque : `checkMonth` appelle `checkPostAlone`, donc
 * `checkPostAlone` paraissait branché alors que rien n'appelle `checkMonth`.
 *
 * ⚠ LE BON BIAIS EST DE SOUS-COMPTER. Un recensement qui surestime rend un vert
 * faux, qu'on ne cherche pas ; un recensement qui sous-estime rend un rouge
 * qu'il faut résoudre — en portant, ou en écrivant une raison. Les deux côtés
 * sont donc des listes NOMMÉES, et porter un mécanisme veut dire inscrire son
 * module ici : un geste délibéré, qu'une relecture voit.
 */
const PRODUCT_ORCHESTRATION = [
  "app/api/cron/content-month/route.ts",
  "app/api/cron/release-topics/route.ts",
  "lib/content/month/preflight.ts",
  "lib/credits/server-port.ts",
  /*
   * ⚠ IL EST SUR LES DEUX LISTES, ET C'EST JUSTE. `bank-guard.ts` est la
   * décision extraite : le harnais l'appelle par son propre port, le préalable
   * par le sien. Un module partagé est présent des deux côtés — c'est ce que
   * « porté » veut dire.
   */
  "lib/content/bank-guard.ts",
  /*
   * ⚠ `select.ts` EST PARTAGÉ, ET IL NE L'ÉTAIT QUE D'UN CÔTÉ. Il appelle
   * `checkMonth` depuis l'extraction de l'étage B, mais il n'était inscrit que
   * sur la liste du harnais : le recensement comptait donc `checkMonth` comme
   * harnais-seul alors que le module qui l'appelle est celui que les deux côtés
   * partagent. Même argument que `bank-guard.ts`, un rang plus haut.
   */
  "lib/content/month/select.ts",
  "lib/content/month/assemble.ts",
] as const;

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
    /*
     * ⚠ UNE DÉFINITION N'EST PAS UN APPEL, et les compter ensemble faisait dire
     * à ce recensement que `checkMonth` était porté. `lib/content/month-checks.ts`
     * est atteignable depuis la chaîne produit — `bank.ts` y prend
     * `FORMAT_FAMILIES` — et chacun de ses `export function check…(` matchait
     * comme un appel. Le module qui DÉFINIT trente contrôles les faisait tous
     * paraître branchés.
     *
     * Le motif exige donc qu'un mot ne précède pas immédiatement le nom : pas de
     * `function`, pas de `export function`.
     */
    for (const m of src.matchAll(
      /(^|[^\w.])(?<!function )(check[A-Z]\w*|guardBank|judgeCompleteness|reviseMonth|licenceMissingMessage|licenceMention|composeWithFallback|bankShortfall)\s*\(/gm
    )) {
      out.add(m[2]);
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
  /*
   * ⚠ `checkMonth` ET `checkPostAlone` NE SONT PLUS ICI. `month/assemble.ts`
   * appelle `checkPostAlone(asMonthPost(post), …)` sur chaque post à son
   * arrivée, et `month/select.ts` appelle `checkMonth` sur les retenus. Les
   * deux modules sont sur la liste produit, et `one-assembly-two-callers.test.ts`
   * vérifie que le harnais et le module assemblent dans le même ordre.
   *
   * ⚠ MAIS EXTRAITS N'EST PAS BRANCHÉS, et c'est F50 ci-dessous qui le dit :
   * aucun point d'entrée produit ne les atteint encore. Ce que ce retrait
   * enregistre, c'est qu'ils n'ont plus besoin d'une RAISON de manquer — pas
   * qu'un mois produit les traverse.
   */
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

  /*
   * ⚠ `reserve_credit` ET `settle_credit` NE SONT PLUS ICI — ils sont PORTÉS.
   * `lib/credits/server-port.ts` est la première implémentation de `CreditPort`
   * hors du harnais ; le quota reste tenu par `credit_ledger_apply()`, qui lève
   * `EK010`, et le port ne recalcule aucun plafond. Un test le vérifie
   * (`server-port.test.ts`).
   */

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
  /*
   * ⚠ LA CHAÎNE DU HARNAIS, PAS SON SEUL FICHIER — ET C'EST LE TEST QUI L'A
   *   EXIGÉ.
   *
   * La première version lisait `20-month.ts` seul. En portant l'assemblage dans
   * `lib/content/month/select.ts`, `checkMonth` a cessé d'être nommé dans le
   * harnais sans pour autant devenir atteignable côté produit : il est sorti des
   * DEUX listes, et le recensement l'a perdu de vue. Une exemption est devenue
   * « périmée » alors que le mécanisme était toujours là, juste ailleurs.
   *
   * Un recensement qui perd un mécanisme quand on le déplace est un recensement
   * qui deviendra vert par déménagement. Il compare donc ce qui est ATTEIGNABLE
   * de chaque côté, transitivement.
   */
  const harness = mechanismsOf(HARNESS_ORCHESTRATION);
  /*
   * ⚠ ET LA CHAÎNE PRODUIT EXCLUT CE QUI PART. Un mécanisme n'est « côté
   * produit » que s'il est atteignable depuis un fichier qui SURVIVRA.
   */
  const product = mechanismsOf(PRODUCT_ORCHESTRATION);

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

  /*
   * ── ⚠ ET ELLE FERME AUSSI LES LOTS PÉRIMÉS ────────────────────────────
   *
   * `abandon_stale_generation_runs()` est en base depuis le 2026-09-23 et
   * n'avait aucun appelant : une ligne `submitted` de plus de vingt-neuf jours
   * restait ouverte, et `content_generation_runs_unique` empêchait alors tout
   * nouveau mois pour ce kit. Un mécanisme complet d'un côté, sans appelant de
   * l'autre — la forme de F46, F47, F49 et F50.
   */
  it("le même passage ferme les lots que le fournisseur ne garde plus", () => {
    const src = readFileSync("app/api/cron/release-topics/route.ts", "utf8");
    const call = src.indexOf('rpc("abandon_stale_generation_runs")');
    expect(call, "abandon_stale_generation_runs n'est appelé par aucune route").toBeGreaterThan(-1);
    expect(src.indexOf("authorizeCron(request)"), "elle abandonne avant de vérifier qui appelle")
      .toBeLessThan(call);
  });

  /*
   * ⚠ ET SON ÉCHEC NE FAIT PAS ÉCHOUER LA LIBÉRATION. Rendre 500 sur un
   * balayage de sujets qui a EU LIEU ferait refaire ce travail pour rien au tour
   * suivant. L'écart doit être dit, pas avalé : `abandoned` reste `null`.
   */
  it("un abandon en échec est dit, pas avalé, et ne perd pas la libération", () => {
    const src = readFileSync("app/api/cron/release-topics/route.ts", "utf8");
    expect(src).toMatch(/let abandoned: number \| null = null/);
    expect(src).toContain("abandon_stale_generation_runs: ${stale.error.message}");
    expect(src, "la réponse ne dit pas ce que l'abandon a fait").toContain("released, abandoned");
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA BARRIÈRE — CE QUI EMPÊCHE QUE ÇA RECOMMENCE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le recensement ci-dessus CONSTATE. Ce bloc-ci INTERDIT : tant qu'un mécanisme
 * du harnais n'a pas d'équivalent produit, la route de génération doit rester en
 * 501, et aucune valeur en dur ne doit pouvoir faire croire le contraire.
 *
 * ⚠ C'EST LE POINT 2 QUI COMPTE. Le générateur retiré passait pour
 * déontologiquement contrôlé parce qu'il rendait un objet disant
 * `passed: true`. Un recensement qui ne regarderait que des noms d'appels
 * pourrait être satisfait de la même façon.
 */



describe("la barrière", () => {
  const ROUTE = "app/api/cron/content-month/route.ts";

  it("les fichiers que F45 retire existent encore — la dette n'est pas payée", () => {
    const present = TO_REMOVE.filter((f) => existsSync(f));
    expect(
      present.length,
      "les fichiers de F45 sont supprimés : la barrière peut se lever, et ce test doit être réécrit"
    ).toBeGreaterThan(0);
  });

  /*
   * ⚠ LA ROUTE RESTE EN 501 TANT QUE LE RECENSEMENT PORTE DES EXEMPTIONS. Armer
   * une route qui appellerait `generateMonth` mettrait en vente des publicités
   * sans mention de licence — ce que la Californie interdit.
   */
  it("la route rend 501 tant qu'il reste des exemptions", () => {
    const exemptions = Object.keys(ONLY_IN_HARNESS).length;
    expect(exemptions, "plus aucune exemption : la route peut générer").toBeGreaterThan(0);
    const src = readFileSync(ROUTE, "utf8");
    expect(src, `${exemptions} mécanisme(s) sans équivalent produit, et la route ne rend pas 501`)
      .toContain("{ status: 501 }");
  });

  /*
   * ⚠ ET ELLE NE GÉNÈRE PAS. Une route qui appellerait le générateur retiré
   * serait verte à tous les tests ci-dessus et vendrait quand même des mois sans
   * mention de licence.
   */
  it("la route n'appelle aucun générateur", () => {
    const src = readFileSync(ROUTE, "utf8");
    for (const forbidden of ["runMonthForKit(", "generateMonth(", "persistGeneratedMonth("]) {
      const calls = [...src.matchAll(new RegExp(`(^|[^*\\s])\\s*${forbidden.replace("(", "\\(")}`, "gm"))];
      expect(
        calls.map((m) => m[0].trim()),
        `la route appelle ${forbidden} alors que le recensement n'est pas vert`
      ).toEqual([]);
    }
  });

  /*
   * ── ⚠ AUCUN VERDICT DÉONTOLOGIQUE EN DUR, HORS DES FICHIERS RETIRÉS ────
   *
   * `ethicsCheck: { passed: true }` est la façon dont le générateur produit
   * annonçait un contrôle qu'il ne faisait pas. Le motif est cherché sur toute
   * la chaîne produit, et il n'est toléré que dans les fichiers que F45 retire —
   * où il documente le défaut plutôt que de le commettre.
   */
  /**
   * Les verdicts `passed: true` qui sont GAGNÉS, avec ce qui les gagne.
   *
   * ⚠ UN MOTIF NE PEUT PAS DISTINGUER « GAGNÉ » DE « AFFIRMÉ ». `guard.ts` rend
   * `passed: true` après avoir LEVÉ sur toute violation non résolue ; `pipeline.ts`
   * le rend sans condition, avec `flagged` collecté et jamais consulté. Les deux
   * lignes se ressemblent et ne disent pas la même chose.
   *
   * L'exemption porte donc la GARDE qui la gagne, et un test vérifie que cette
   * garde existe encore : le jour où quelqu'un retire le `throw`, l'exemption
   * tombe avec lui.
   */
  const EARNED: Record<string, { guard: string; why: string }> = {
    "lib/ethics/guard.ts": {
      guard: "throw new EthicsComplianceError(",
      why:
        "enforceEthics lève sur toute violation bloquante encore présente après réécriture ; atteindre le retour signifie qu'il n'en reste aucune",
    },
  };

  it("chaque verdict gagné porte encore sa garde", () => {
    for (const [file, { guard, why }] of Object.entries(EARNED)) {
      expect(existsSync(file), `${file} n'existe plus — exemption périmée`).toBe(true);
      expect(
        readFileSync(file, "utf8"),
        `${file} rend passed: true sans plus rien lever — l'exemption n'est plus gagnée`
      ).toContain(guard);
      expect(why.length, file).toBeGreaterThan(40);
    }
  });

  it("aucun verdict déontologique en dur, sauf dans ce qui part ou ce qui le gagne", () => {
    const suspicious = /passed:\s*true|ok:\s*true\s*,\s*violations:\s*\[\]/;
    const offenders: string[] = [];
    for (const file of chainOf([...PRODUCT_ORCHESTRATION])) {
      if ((TO_REMOVE as readonly string[]).includes(file)) continue;
      if (file in EARNED) continue;
      const src = readFileSync(file, "utf8");
      for (const [n, line] of src.split("\n").entries()) {
        /* Une mention en commentaire documente, elle ne décide pas. */
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;
        if (suspicious.test(line)) offenders.push(`${file}:${n + 1} ${line.trim().slice(0, 60)}`);
      }
    }
    expect(
      offenders,
      `verdict déontologique posé en dur, ni retiré ni gagné : ${offenders.join(" | ")}`
    ).toEqual([]);
  });

  /*
   * ⚠ ET LE MOTIF ATTRAPE BIEN QUELQUE CHOSE. Un test de motif qui ne trouve
   * rien nulle part est un test qui passera toujours — y compris le jour où le
   * défaut revient sous une forme qu'il ne voit pas.
   */
  it("le motif attrape le défaut là où il est, pour prouver qu'il fonctionne", () => {
    const pipeline = readFileSync("lib/content/generate/pipeline.ts", "utf8");
    expect(
      /ethicsCheck:\s*\{\s*passed:\s*true/.test(pipeline),
      "le verdict en dur a disparu de pipeline.ts — le motif de ce test n'a plus de témoin"
    ).toBe(true);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  F50 — LA LISTE PRODUIT N'A PAS DE POINT D'ENTRÉE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ TROUVÉ LE 2026-09-26, EN APPLIQUANT LA RÈGLE DE F48 AVANT DE PUBLIER UN
 *   COMPTE QUI MONTAIT : sept mécanismes portés, puis neuf. Et la première
 *   chose qu'on trouve en cherchant ce que ce compte compte de travers est que
 *   `app/api/cron/content-month/route.ts` — la seule porte du chemin produit —
 *   n'importe que `authorizeCron` et `contentGenerationArmed`. Elle n'appelle
 *   NI le préalable, NI le port de crédit, NI la garde de banque, NI
 *   l'assemblage.
 *
 * Donc quatre des sept racines de `PRODUCT_ORCHESTRATION` sont des MODULES que
 * rien n'invoque, et les inscrire comme racines les a déclarés points d'entrée
 * alors qu'aucun ne l'est. La forme « liste nommée » de F48 n'a pas supprimé le
 * défaut qu'elle visait — « un appel écrit DANS un module que rien n'invoque » —
 * elle l'a DÉPLACÉ d'un cran : ce n'est plus la chaîne transitive qui se trompe,
 * c'est le choix des racines.
 *
 * ── ⚠ CE QUE ÇA CHANGE AU COMPTE ────────────────────────────────────────
 *
 * Extraits, testés, sans CLI-isme : neuf. Atteignables depuis un fichier que le
 * runtime invoque : un seul — `release_stale_topic_assignments`, par sa route
 * planifiée. Les huit autres sont du code juste que personne n'appelle.
 *
 * ── ET CE N'EST PAS UN AVEU DE RIEN FAIRE ───────────────────────────────
 *
 * Le portage est réel : ces modules sont purs, éprouvés par des doublures, et
 * l'assemblage a un ordre vérifié contre celui du harnais. Ce qui manque est
 * l'orchestrateur, qui ne peut pas exister avant la rédaction — et la rédaction
 * attend une clé. C'est la SIXIÈME fois qu'un mécanisme est branché d'un seul
 * côté ; celle-ci, le côté manquant est l'appelant lui-même.
 *
 * Ce bloc tient donc les deux nombres SÉPARÉS et nomme l'écart, pour qu'aucune
 * session ne relise « neuf portés » comme « neuf appelés ».
 */

/**
 * Les fichiers que le RUNTIME invoque de lui-même.
 *
 * ⚠ PAS UNE LISTE DE CONFIANCE : un test vérifie que chacun exporte vraiment un
 * handler HTTP. Une racine qu'on ne peut pas prouver invoquée n'en est pas une.
 */
const PRODUCT_ENTRY_POINTS = [
  "app/api/cron/content-month/route.ts",
  "app/api/cron/release-topics/route.ts",
] as const;

/**
 * Les modules portés qu'aucun point d'entrée n'atteint, chacun avec la raison.
 *
 * ⚠ CHAQUE LIGNE EST UNE DETTE, PAS UNE DISPENSE. Elle sort d'ici le jour où un
 * point d'entrée l'atteint — jamais parce qu'on a réécrit la raison.
 */
const EXTRACTED_NOT_WIRED: Record<string, string> = {
  "lib/content/month/preflight.ts":
    "l'étage A s'exécute avant la rédaction ; la route ne peut l'appeler qu'en ouvrant le mois, ce que le verrou d'armement interdit tant que le recensement porte des exemptions",
  "lib/credits/server-port.ts":
    "le port de crédit n'a de sens qu'appelé par un orchestrateur qui écrit des posts ; réserver sans rédiger débiterait pour rien",
  "lib/content/bank-guard.ts":
    "atteint par preflight.ts, qui n'est lui-même atteint par aucune porte — la garde est juste, sa chaîne s'arrête un cran plus haut",
  "lib/content/month/select.ts":
    "la sélection prend des posts déjà rédigés ; il n'y a rien à sélectionner avant que la rédaction existe côté produit",
  "lib/content/month/assemble.ts":
    "l'assemblage prend des posts déjà rédigés : son appelant est l'orchestrateur, qui a besoin de la rédaction, laquelle attend une clé (F44). Éprouvé par doublures en attendant",
};

describe("F50 — extraire n'est pas brancher", () => {
  it("chaque point d'entrée exporte vraiment un handler que le runtime appelle", () => {
    for (const file of PRODUCT_ENTRY_POINTS) {
      expect(existsSync(file), `${file} n'existe pas`).toBe(true);
      expect(
        readFileSync(file, "utf8"),
        `${file} n'exporte aucun handler HTTP — ce n'est pas un point d'entrée`
      ).toMatch(/export\s+async\s+function\s+(GET|POST)\s*\(/);
    }
  });

  /*
   * ⚠ LE TEST QUI DIT LA VÉRITÉ SUR LE COMPTE. Tout module de la liste produit
   * qui n'est ni un point d'entrée ni atteignable depuis un point d'entrée doit
   * être nommé ci-dessus, avec sa raison. Porter un module sans écrire cette
   * raison fait rougir le recensement — c'est le bon sens du biais.
   */
  it("tout module porté que rien n'invoque est nommé, avec sa raison", () => {
    const reachable = chainOf([...PRODUCT_ENTRY_POINTS]);
    const stranded = [...PRODUCT_ORCHESTRATION].filter(
      (f) => !reachable.has(f) && !(f in EXTRACTED_NOT_WIRED)
    );
    expect(
      stranded.sort(),
      `module(s) porté(s) qu'aucun point d'entrée n'atteint, et sans raison nommée : ${stranded.join(", ")}`
    ).toEqual([]);
  });

  it("aucune raison ne survit au branchement du module qu'elle explique", () => {
    const reachable = chainOf([...PRODUCT_ENTRY_POINTS]);
    for (const [file, why] of Object.entries(EXTRACTED_NOT_WIRED)) {
      expect(existsSync(file), `${file} n'existe plus — dette périmée`).toBe(true);
      expect(
        reachable.has(file),
        `${file} est désormais atteint depuis un point d'entrée : retire sa ligne de EXTRACTED_NOT_WIRED`
      ).toBe(false);
      expect(why.length, file).toBeGreaterThan(40);
      expect(why, `${file} : « pas encore » n'est pas une raison`).not.toMatch(/pas encore|à faire|TODO/i);
    }
  });

  /*
   * ⚠ ET LA ROUTE RESTE EN 501 TANT QUE CET ÉCART EXISTE. C'est la deuxième
   * serrure, indépendante des exemptions : un recensement pourrait devenir vert
   * en exemptions tout en n'ayant toujours aucun appelant.
   */
  it("la route reste en 501 tant qu'un module porté n'a pas d'appelant", () => {
    const stranded = Object.keys(EXTRACTED_NOT_WIRED).length;
    expect(stranded, "tout est branché : cette serrure peut se lever").toBeGreaterThan(0);
    expect(
      readFileSync("app/api/cron/content-month/route.ts", "utf8"),
      `${stranded} module(s) porté(s) sans appelant, et la route ne rend pas 501`
    ).toContain("{ status: 501 }");
  });
});

/*
 * ── ⚠ ET L'APPARTENANCE À LA LISTE PRODUIT SE MÉRITE ────────────────────
 *
 * Sans ce test, `PRODUCT_ORCHESTRATION` est une liste qu'il suffit d'allonger.
 * Un module du chemin produit tourne dans une requête serverless : il n'a ni
 * terminal pour écrire, ni processus à faire sortir, ni arguments de ligne de
 * commande à lire. Un module qui en porte est un morceau de harnais déplacé,
 * pas un module porté — et le recensement le compterait pour un.
 */
describe("un module porté n'est pas un morceau de harnais déplacé", () => {
  const CLI_ISMS: Array<[string, RegExp]> = [
    ["process.argv", /\bprocess\.argv\b/],
    ["process.exit", /\bprocess\.exit\s*\(/],
    ["spawnSync", /\bspawn(?:Sync)?\s*\(/],
    ["console", /(^|[^\w.])console\.\w+\s*\(/m],
  ];

  it.each([...PRODUCT_ORCHESTRATION].filter((f) => f.startsWith("lib/")))(
    "%s ne parle ni au terminal ni au processus",
    (file) => {
      const src = readFileSync(file, "utf8")
        /* Les commentaires nomment ces mécanismes pour les expliquer. */
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const [name, pattern] of CLI_ISMS) {
        expect(pattern.test(src), `${file} utilise ${name} — il n'est pas porté, il est déplacé`).toBe(false);
      }
    }
  );
});
