import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * ── LE GARDE-FOU, ÉTENDU APRÈS UNE TROISIÈME OCCURRENCE ─────────────────
 *
 * Trois fois le même défaut, à trois endroits :
 *
 *   1. `lib/brief/platform.ts` — construit, testé, jamais importé par un
 *      écran, pendant que l'étape 1 EXIGEAIT la réponse qu'il devait
 *      qualifier. Un brief neuf se bloquait sur une question invisible.
 *   2. `lib/directory/profile.ts` — le profil Psychology Today, livrable
 *      CENTRAL de The Foundation, importé par son seul test.
 *   3. `lib/billing/offer.ts` — le catalogue applicatif des six SKU, qu'aucun
 *      écran ne lit.
 *
 * À chaque fois la suite était verte, parce que chaque module était juste.
 * Ce qui manquait était entre eux.
 *
 * ── ⚠ POURQUOI LA RÈGLE N'EST PAS UNIVERSELLE ───────────────────────────
 *
 * « Tout module de `lib/` doit être importé par un écran » est FAUX, et une
 * règle fausse ailleurs vaut moins qu'une règle exacte ici. `lib/stripe/`
 * n'est atteint que par un webhook, `lib/api/cron/` que par une tâche
 * planifiée, `lib/generation/` tourne derrière des routes qui ne rendent
 * rien : exiger un écran de ces dossiers-là produirait des exemptions, et une
 * liste d'exemptions est une liste que l'on allonge au lieu de corriger.
 *
 * Les dossiers couverts sont donc ÉNUMÉRÉS, chacun avec sa raison, et le
 * critère est le même pour les trois : **un module de ce dossier décrit
 * quelque chose que la cliente ACHÈTE ou PARCOURT**. Un tel module qu'aucun
 * écran n'atteint est, par construction, une promesse qui n'existe pas pour
 * elle — qu'il soit juste ou non.
 *
 * Ajouter un dossier ici est un choix à défendre en une phrase. S'il n'y en a
 * pas, le dossier n'a rien à y faire.
 */

const ROOT = resolve(__dirname, "../..");

/**
 * ⚠ LES DOSSIERS COUVERTS, ET LA RAISON DE CHACUN.
 *
 * La raison n'est pas décorative : elle est affichée dans le message d'échec,
 * pour que la personne qui le lit sache si son module relève vraiment de la
 * règle ou si c'est le dossier qui a été mal choisi.
 */
const COVERED = [
  {
    dir: "lib/brief",
    why:
      "ce dossier décrit le PARCOURS du brief : un module qu'aucun écran " +
      "n'atteint est une étape qui n'existe pas pour la cliente",
  },
  {
    dir: "lib/directory",
    why:
      "ce dossier décrit le profil d'annuaire, livrable CENTRAL de The " +
      "Foundation : un module non branché est un livrable vendu et jamais montré",
  },
  {
    dir: "lib/ethics",
    why:
      "ce dossier décrit ce qui REFUSE, et le refus fait partie de ce qui est " +
      "vendu : le badge BOARD-SAFE COPY est une promesse faite à la cliente. " +
      "Un module de refus qu'aucun chemin n'appelle est une protection " +
      "annoncée et absente — pire qu'absente, puisqu'elle rassure",
  },
  {
    dir: "lib/billing",
    why:
      "ce dossier décrit ce qui est VENDU — paliers, SKU, droits : une règle " +
      "de vente qu'aucun écran ne lit est une règle qui ne s'applique à personne",
  },
] as const;

/*
 * ⚠ CE QUI EST EXCLU DANS CES DOSSIERS, ET POURQUOI — nommé une fois ici
 * plutôt que par des exceptions dispersées.
 *
 *   __tests__   un module importé seulement par son propre test est
 *               exactement le cas que ce fichier attrape
 *   fixtures    des données pour les tests et les écrans de démonstration,
 *               pas une étape ni un livrable
 */
const SKIP = ["__tests__", "fixtures"] as const;

/**
 * ⚠ LA DETTE CONNUE, NOMMÉE — ELLE DOIT RACCOURCIR.
 *
 * `lib/billing/offer.ts` est le miroir applicatif des six SKU de l'offre du
 * 13 septembre. Aucun écran ne le lit pour une raison précise et déjà écrite :
 * **la nouvelle offre n'est en vitrine nulle part**. `/pricing` et
 * `/app/checkout` itèrent `ORDERED_PLANS`, qui vaut `LEGACY_KIT_TIERS` —
 * `foundation` et `roster` existent dans `KIT_PLANS` et ne sont proposés par
 * aucun écran (`OUT_OF_SCOPE.md` §30, `DECISIONS_NEEDED.md` §15).
 *
 * Le brancher reviendrait à mettre la nouvelle offre en vente, ce qui est
 * **L23** et pas ce lot.
 *
 * ⚠ CE N'EST PAS UNE EXEMPTION, C'EST UNE ÉCHÉANCE. Trois choses la tiennent :
 * l'entrée porte le lot qui la lève ; la liste est épinglée à l'unité, donc en
 * allonger une est un acte visible dans un diff ; et le module doit CONTINUER
 * d'exister, sinon la dette a été effacée au lieu d'être payée.
 */
const KNOWN_DEBT = [
  {
    /*
     * ⚠ UNE MESURE QUE LE PRODUIT DIT MONTRER, ET QUE RIEN NE MONTRE. Son
     * propre en-tête l'annonce : « The one reading measure the product shows
     * […] always rendered as "Reading level · 8th grade" ». Aucun écran ne la
     * rend. Ce n'est pas un refus qui dort, c'est une promesse d'affichage
     * sans affichage — le cas exact des trois occurrences qui ont fait écrire
     * ce fichier.
     *
     * Il n'est pas branché ici parce que le brancher demande un ÉCRAN, et
     * « ni écran, ni vitrine » tient depuis le 18 septembre.
     */
    module: "lib/ethics/readability",
    owner: "L24",
    why:
      "son en-tête annonce « the one reading measure the product shows », et " +
      "aucun écran ne la rend. La brancher demande un écran, ce que le lot " +
      "en cours exclut explicitement.",
  },
  {
    module: "lib/billing/offer",
    owner: "L23",
    why:
      "la nouvelle offre n'est en vitrine sur aucun écran — /pricing et " +
      "/app/checkout itèrent LEGACY_KIT_TIERS. Le brancher, c'est la mettre " +
      "en vente, et c'est L23.",
  },
] as const;

/*
 * `Set<string>` à dessein : `KNOWN_DEBT` est `as const`, donc son union de
 * modules est littérale. Un `Set` de cette union refuserait `has(module)` sur
 * une chaîne quelconque — et c'est bien une chaîne quelconque qu'on lui donne,
 * puisque la question est justement « ce module-ci est-il dans la liste ».
 */
const DEBT_MODULES = new Set<string>(KNOWN_DEBT.map((entry) => entry.module));

function sourcesUnder(dir: string, skip: readonly string[] = []): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      if (skip.includes(entry)) continue;
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * ⚠ LES RACINES SONT `app/` SEUL, ET PAS `components/`.
 *
 * Trouvé en sondant ce fichier : avec `components/` parmi les racines,
 * supprimer la page du profil d'annuaire laissait la suite VERTE — parce que
 * `components/kit/directory-profile.tsx` importe encore le module, et qu'un
 * composant que PLUS AUCUNE PAGE NE REND comptait quand même comme un écran.
 *
 * C'est le même défaut d'un cran plus haut : un composant que rien ne rend est
 * aussi mort que le module qu'il importe. Seul `app/` est une racine réelle —
 * une page, une route, une action serveur : quelque chose qu'un navigateur
 * peut atteindre. `components/` se traverse comme n'importe quel module.
 */
const APP_ROOTS = sourcesUnder(join(ROOT, "app"), ["__tests__"]);

/**
 * ⚠ ATTEINT PAR UNE CHAÎNE, PAS SEULEMENT EN DIRECT.
 *
 * `lib/kit/launch-copy.ts` n'est importé par aucun écran : il passe par
 * `lib/launch/material.ts`, lui-même importé par `components/launch/`. Exiger
 * un import DIRECT rendrait ce test rouge sur du code parfaitement branché, et
 * un test qu'on doit désarmer cesse d'être un test.
 *
 * On part donc des écrans et on descend, exactement comme le ferait un
 * bundler.
 */
/*
 * ⚠ LES DEUX FORMES D'IMPORT. `@/…` domine dans ce dépôt, mais un composant
 * qui importe son voisin en `./…` casserait la chaîne et rendrait un module
 * branché faussement rouge — un test qu'on doit désarmer cesse d'être un test.
 */
const IMPORT = /from\s+["'](@\/[^"']+|\.{1,2}\/[^"']+)["']/g;

function reachableModules(): Set<string> {
  const seen = new Set<string>();
  const readModule = (mod: string): string | null => {
    for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      try {
        return readFileSync(join(ROOT, mod + ext), "utf8");
      } catch {
        /* essaie l'extension suivante */
      }
    }
    return null;
  };

  /** `@/a/b` → `a/b` ; `./c` depuis `a/b.ts` → `a/c`. */
  const resolveSpec = (spec: string, from: string): string =>
    spec.startsWith("@/")
      ? spec.slice(2)
      : join(from.split("/").slice(0, -1).join("/"), spec);

  const queue: string[] = [];
  for (const path of APP_ROOTS) {
    const from = path.slice(ROOT.length + 1);
    for (const match of readFileSync(path, "utf8").matchAll(IMPORT)) {
      queue.push(resolveSpec(match[1], from));
    }
  }

  while (queue.length > 0) {
    const mod = queue.pop() as string;
    if (seen.has(mod)) continue;
    seen.add(mod);
    const source = readModule(mod);
    if (source === null) continue;
    for (const match of source.matchAll(IMPORT)) {
      queue.push(resolveSpec(match[1], mod + ".ts"));
    }
  }
  return seen;
}

const REACHED = reachableModules();

describe("⚠ tout module d'un dossier couvert atteint un écran", () => {
  it("le recensement des dossiers n'est pas vide, et chacun donne sa raison", () => {
    // Garde anti-vacuité : un `it.each` sur une liste vide est vert.
    expect(COVERED.length).toBeGreaterThanOrEqual(3);
    for (const entry of COVERED) {
      expect(entry.why.length, `${entry.dir} n'explique pas pourquoi`).toBeGreaterThan(40);
    }
  });

  for (const { dir, why } of COVERED) {
    const modules = sourcesUnder(join(ROOT, dir), SKIP).map((path) =>
      path.slice(ROOT.length + 1).replace(/\.tsx?$/, "")
    );

    it(`${dir} porte des modules`, () => {
      // Un dossier vidé ou renommé rendrait la boucle ci-dessous vide, donc verte.
      expect(modules.length, `${dir} ne contient aucun module`).toBeGreaterThan(0);
    });

    it.each(modules)("%s est atteint depuis un écran", (module) => {
      if (DEBT_MODULES.has(module)) {
        /*
         * Une dette nommée, avec son lot. Elle n'est pas verte par
         * indulgence : le bloc « la dette ne grandit pas » ci-dessous
         * l'épingle à l'unité, et exige que le module existe encore.
         */
        return;
      }
      expect(
        REACHED.has(module),
        `${module}.ts n'est atteint par aucun écran de app/ ni components/, ` +
          `même par une chaîne d'imports. ${why}. Branchez-le, ou retirez-le. ` +
          `(Si ce dossier ne relève pas de cette règle, c'est le dossier qu'il ` +
          `faut retirer de COVERED — avec une raison, pas une exception.)`
      ).toBe(true);
    });
  }
});

describe("⚠ la dette ne grandit pas, et ne s'efface pas non plus", () => {
  it("elle tient en DEUX entrées, et chacune nomme son lot", () => {
    /*
     * ⚠ 1 → 3 → 2, DANS LA MÊME JOURNÉE, ET LES DEUX MOUVEMENTS COMPTENT.
     * L'entrée de `lib/ethics` dans COVERED a fait apparaître deux orphelins ;
     * `lib/ethics/claims` a été branché le jour même dans
     * `generateDirectoryProfile` et sa dette est donc PAYÉE — c'est la sonde
     * « une dette réellement branchée doit sortir de la liste » qui l'a exigé,
     * et elle a eu raison : le laisser ici ferait croire à une dette qui
     * n'existe plus. Allonger OU raccourcir reste un acte visible dans un
     * diff, avec sa raison.
     */
    expect(
      KNOWN_DEBT.length,
      "Une dette de plus a été ajoutée. Ce n'est pas interdit — c'est " +
        "délibéré, et ça doit se voir dans un diff. Mettez à jour ce compte " +
        "en même temps, avec la raison."
    ).toBe(2);
    for (const entry of KNOWN_DEBT) {
      expect(entry.owner).toMatch(/^L\d+$/);
      expect(entry.why.length).toBeGreaterThan(40);
    }
  });

  it("⚠ chaque module en dette EXISTE ENCORE", () => {
    /*
     * Sans ceci, supprimer `lib/billing/offer.ts` rendrait la suite verte et
     * la dette « payée ». Ce n'est pas la même chose que de la payer.
     */
    for (const entry of KNOWN_DEBT) {
      const exists = ["", ".ts", ".tsx"].some((ext) => {
        try {
          statSync(join(ROOT, entry.module + ext));
          return true;
        } catch {
          return false;
        }
      });
      expect(exists, `${entry.module} a disparu — la dette a été effacée, pas payée`).toBe(true);
    }
  });

  it("une dette réellement branchée doit sortir de la liste", () => {
    /*
     * L'inverse compte autant : le jour où L23 met la nouvelle offre en
     * vitrine, `lib/billing/offer` devient atteint, et le laisser ici ferait
     * croire à une dette qui n'existe plus.
     */
    for (const entry of KNOWN_DEBT) {
      expect(
        REACHED.has(entry.module),
        `${entry.module} EST maintenant atteint depuis un écran : retirez-le ` +
          `de KNOWN_DEBT, la dette est payée.`
      ).toBe(false);
    }
  });
});
