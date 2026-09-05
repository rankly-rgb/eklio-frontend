import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * TÉLÉCHARGER N'EST JAMAIS UNE GÉNÉRATION.
 *
 * Rien de ce qui sert un fichier qu'elle a déjà payé ne doit appeler
 * `consume_generation_credit` : ni l'asset, ni le PDF, ni la composition,
 * ni le manifeste. Le crédit paie un MODÈLE qui écrit du texte ; ré-écrire
 * les mêmes pixels depuis le même vecteur ne coûte qu'un passage de resvg.
 *
 * Ce test existe pour le lot « tailles et formats à la demande », et c'est
 * là que le bug était le plus probable : une largeur choisie après coup
 * ressemble à une nouvelle sortie, et la route qui la sert ressemble à une
 * route de génération. Elle n'en est pas une — le rendu est mis en cache
 * sous LA MÊME empreinte que le natif, parce que c'est le même rendu.
 *
 * ── Pourquoi une analyse statique plutôt qu'un test d'intégration ────────
 *
 * L'appel fautif serait ajouté par une session future qui croit bien faire,
 * pas déclenché par une entrée particulière. Une garde qui lit le code
 * attrape cela au commit ; un test d'intégration ne l'attraperait qu'en
 * exerçant précisément le chemin qu'on vient d'ajouter.
 */

const ROOT = resolve(__dirname, "../..");
const FORBIDDEN_CALL = "consume_generation_credit";

/** Le chemin complet de la livraison : asset, PDF, composition, manifeste. */
const DELIVERY_DIRS = ["lib/kit", "components/kit", "app/api/brand-kits/[id]/assets"];
const DELIVERY_FILES = [
  "app/api/brand-kits/[id]/pdf/route.ts",
  "app/api/brand-kits/[id]/site-output/pdf/route.ts",
];

/** La route qui, elle, génère bel et bien — le témoin positif du dépouilleur. */
const GENERATION_ROUTE = "app/api/briefs/[id]/generate/route.ts";

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    // Les tests du dépôt nomment l'appel pour l'interdire ou l'assurer —
    // c'est le code livré qui est en cause ici, pas ce qui le vérifie.
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Retire les commentaires sans toucher au code. Un bloc `/* … *\/` d'abord,
 * puis les lignes dont le PREMIER caractère non blanc ouvre un commentaire :
 * une ligne de code qui contient une URL (`https://…`) garde ainsi tout son
 * contenu, là où un dépouilleur naïf en mangerait la fin — et avec elle un
 * appel réel.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*");
    })
    .join("\n");
}

const FILES = [
  ...DELIVERY_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir))),
  ...DELIVERY_FILES.map((file) => join(ROOT, file)),
];

function relative(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

describe("l'énumération elle-même", () => {
  it("couvre bien le chemin de livraison", () => {
    // Sans cette garde, une énumération cassée rendrait le test suivant
    // vacuously true — exactement le faux vert qu'il doit rendre impossible.
    expect(FILES.length).toBeGreaterThan(20);
  });

  it("couvre nommément la route et le module des variantes", () => {
    const names = FILES.map(relative);
    expect(names).toContain("app/api/brand-kits/[id]/assets/[key]/route.ts");
    expect(names).toContain("lib/kit/render/variants.ts");
    expect(names).toContain("app/api/brand-kits/[id]/assets/zip/route.ts");
    expect(names).toContain("lib/kit/asset-rpc.ts");
  });

  it("le dépouilleur de commentaires laisse le code intact", () => {
    // Témoin positif : la route de génération appelle réellement le crédit,
    // et l'appel doit survivre au dépouillement. S'il disparaissait, le test
    // ci-dessous passerait au vert pour la mauvaise raison.
    const generation = withoutComments(readFileSync(join(ROOT, GENERATION_ROUTE), "utf8"));
    expect(generation).toContain(FORBIDDEN_CALL);

    // Et un commentaire, lui, disparaît bien : `lib/kit/asset-rpc.ts` nomme
    // l'appel dans une docstring pour dire qu'il ne le fait pas.
    const rpc = readFileSync(join(ROOT, "lib/kit/asset-rpc.ts"), "utf8");
    expect(rpc).toContain(FORBIDDEN_CALL);
    expect(withoutComments(rpc)).not.toContain(FORBIDDEN_CALL);
  });
});

describe("le chemin de livraison ne consomme aucun crédit", () => {
  it(`aucun de ces fichiers n'appelle « ${FORBIDDEN_CALL} »`, () => {
    const offenders = FILES.filter((file) =>
      withoutComments(readFileSync(file, "utf8")).includes(FORBIDDEN_CALL)
    ).map(relative);

    expect(
      offenders,
      "Télécharger n'est jamais une génération. Le crédit paie un appel modèle ;\n" +
        "servir un fichier déjà rendu — à sa taille native, à une autre largeur,\n" +
        "ou dans un autre format — n'en est pas un. Une largeur choisie après coup\n" +
        "est le MÊME rendu, re-rasterisé depuis le même vecteur et mis en cache\n" +
        "sous la même empreinte.\n" +
        `Appel trouvé dans : ${offenders.join(", ")}`
    ).toEqual([]);
  });
});
