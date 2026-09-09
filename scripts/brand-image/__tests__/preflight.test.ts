import { describe, expect, it } from "vitest";
import {
  WATCHED_PATHS,
  dirtyWatchedPaths,
  parsePromptVersion,
  preflightProblems,
} from "@/scripts/brand-image/preflight";

/*
 * Le préflight de la génération d'images.
 *
 * ── Pourquoi il existe ───────────────────────────────────────────────────
 *
 * Quatre tentatives de LA génération réelle ont échoué, toujours pour la même
 * raison et jamais avec un message qui le disait : un checkout en retard sur
 * `origin/main`, ou sur une autre branche, avec des fichiers non commités sous
 * `lib/images/` qui bloquaient silencieusement chaque `git pull`. La course
 * partait alors d'un `IMAGE_PROMPT_VERSION` périmé, dont l'empreinte a déjà
 * ses sept images en stockage, et la pipeline répondait `already_ready` — ce
 * qui est correct, et se lit comme une panne.
 *
 * Les fonctions ci-dessous sont pures. `runPreflight` leur passe ce que git
 * répond ; c'est ici qu'on vérifie qu'elles en tirent les bonnes conclusions.
 */

describe("parsePromptVersion", () => {
  it("lit la version telle qu'elle est écrite", () => {
    expect(parsePromptVersion("export const IMAGE_PROMPT_VERSION = 7;")).toBe(7);
    expect(parsePromptVersion("export const IMAGE_PROMPT_VERSION  =  12 ;")).toBe(12);
  });

  it("rend null plutôt que de deviner", () => {
    // Un `null` fait échouer le préflight avec un message ; un 0 inventé
    // ferait passer une comparaison fausse.
    expect(parsePromptVersion("const IMAGE_PROMPT_VERSION = 7;")).toBeNull();
    expect(parsePromptVersion("")).toBeNull();
  });

  it("la vraie constante du dépôt se lit bien", async () => {
    // Garde anti-vacuité : si la déclaration change de forme, le motif
    // ci-dessus rendrait `null` pour toujours et le préflight refuserait tout.
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../../../lib/images/config.ts"), "utf8");
    expect(parsePromptVersion(source)).toBeTypeOf("number");
  });
});

describe("dirtyWatchedPaths", () => {
  it("ne retient que ce qui change ce qu'une course génère", () => {
    const porcelain = [" M lib/images/prompt.ts", "?? notes.md", " M app/page.tsx"].join("\n");
    expect(dirtyWatchedPaths(porcelain)).toEqual(["lib/images/"]);
  });

  it("attrape les deux répertoires surveillés", () => {
    const porcelain = [" M lib/images/config.ts", " M scripts/brand-image/generate-one.ts"].join("\n");
    expect(dirtyWatchedPaths(porcelain)).toEqual(WATCHED_PATHS);
  });

  it("lit la DESTINATION d'un renommage, pas la source", () => {
    expect(dirtyWatchedPaths("R  old/thing.ts -> lib/images/thing.ts")).toEqual(["lib/images/"]);
  });

  it("un arbre propre ne signale rien", () => {
    expect(dirtyWatchedPaths("")).toEqual([]);
    expect(dirtyWatchedPaths("\n  \n")).toEqual([]);
  });

  it("et une modification ailleurs n'empêche pas la course", () => {
    // Le préflight n'est pas une police de l'arbre de travail : il ne refuse
    // que ce qui change le résultat.
    expect(dirtyWatchedPaths(" M README.md\n M app/app/page.tsx")).toEqual([]);
  });
});

describe("preflightProblems", () => {
  const clean = { localVersion: 7, remoteVersion: 7, behindBy: 0, dirty: [] as string[] };

  it("un checkout à jour et propre ne pose aucun problème", () => {
    expect(preflightProblems(clean)).toEqual([]);
  });

  it("⚠ une version divergente est nommée avec ses DEUX valeurs", () => {
    const [problem] = preflightProblems({ ...clean, localVersion: 5, remoteVersion: 7 });
    expect(problem.title).toContain("5");
    expect(problem.title).toContain("7");
    // Et le message dit pourquoi ça se lit comme une panne.
    expect(problem.detail).toContain("already_ready");
  });

  it("un retard est nommé en nombre de commits", () => {
    const [problem] = preflightProblems({ ...clean, behindBy: 3 });
    expect(problem.title).toContain("3 commits behind");
    expect(problem.fix).toContain("git pull --ff-only origin main");
  });

  it("le singulier est correct à un commit", () => {
    expect(preflightProblems({ ...clean, behindBy: 1 })[0].title).toContain("1 commit behind");
  });

  it("⚠ l'arbre sale est signalé EN PREMIER, parce qu'il bloque le reste", () => {
    /*
     * C'est la leçon des quatre tentatives : dire « fais un pull » sans dire
     * pourquoi le pull va échouer est exactement ce qui s'est passé.
     */
    const problems = preflightProblems({
      localVersion: 5,
      remoteVersion: 7,
      behindBy: 4,
      dirty: ["lib/images/"],
    });
    expect(problems).toHaveLength(3);
    expect(problems[0].title).toContain("Uncommitted changes");
  });

  it("⚠ chaque correctif est un `stash push`, JAMAIS un abandon", () => {
    /*
     * Elle a des modifications locales qui valent la peine d'être gardées.
     * Un `checkout --` ou un `reset --hard` dans ces instructions serait une
     * perte de travail causée par un outil censé la protéger.
     */
    const problems = preflightProblems({
      localVersion: 5,
      remoteVersion: 7,
      behindBy: 4,
      dirty: ["lib/images/", "scripts/brand-image/"],
    });
    const fixes = problems.flatMap((problem) => problem.fix).join("\n");
    expect(fixes).toContain("git stash push");
    expect(fixes).not.toMatch(/reset --hard|checkout --|clean -[a-z]*f/);
  });

  it("et il dit que .env.local ne bouge pas", () => {
    // Les jetons de la course vivent là, non suivis. Le dire évite la
    // question, qui coûterait une cinquième tentative.
    const [problem] = preflightProblems({ ...clean, dirty: ["lib/images/"] });
    expect(problem.fix.join("\n")).toContain(".env.local");
  });

  it("une version illisible refuse aussi, plutôt que de supposer", () => {
    const problems = preflightProblems({ ...clean, localVersion: null });
    expect(problems).toHaveLength(1);
    expect(problems[0].title).toContain("could not be read");
  });

  it("un `origin/main` injoignable ne bloque pas une course par ailleurs saine", () => {
    /*
     * `remoteVersion: null` veut dire « git n'a pas répondu », pas « les
     * versions diffèrent ». Refuser là-dessus rendrait le script inutilisable
     * hors ligne pour une raison qui n'en est pas une.
     */
    expect(preflightProblems({ ...clean, remoteVersion: null, behindBy: null })).toEqual([]);
  });
});
