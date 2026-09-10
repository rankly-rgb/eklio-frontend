import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * ── LE MUR EST TOMBÉ SUR TOUTE LA SURFACE, OU SUR AUCUNE ────────────────
 *
 * « Le brief tourne sans compte » a été livré en convertissant TROIS routes
 * (`POST /api/briefs`, `generate`, `email-link`) et en laissant les six autres
 * sur `authenticate()`. Résultat, pour une visiteuse anonyme :
 *
 *   PATCH /api/briefs/[id]              401 — l'autosave ne sauvegardait RIEN
 *   POST  /api/briefs/[id]/suggest      401 — « Write it for me »
 *   POST  /api/briefs/[id]/rephrase     401 — « Help me say it »
 *   POST  /api/briefs/[id]/tone-cards   401 — l'étape 5 entière
 *   POST  /api/briefs/[id]/usp-options  401 — l'écran de positionnement
 *   POST  /api/briefs/[id]/usp-confirm  401 — le choix de positionnement
 *
 * Rien de tout cela ne casse un test, ne casse un build, ni ne se voit en
 * relisant la route convertie : chaque fichier était juste, isolément. C'est
 * exactement la classe de défaut qu'un test de source attrape et qu'un test de
 * comportement rate, parce que le trou est dans ce qui N'A PAS été écrit.
 *
 * Deux règles, donc, et elles portent sur le RÉPERTOIRE, pas sur une liste :
 *   1. aucune route du brief n'appelle `authenticate()` ;
 *   2. toute route du brief qui appelle le modèle passe par `consumeAnonSpend`.
 */

const ROUTES_DIR = join(process.cwd(), "app/api/briefs");

/** Les points d'entrée modèle, tels qu'ils s'importent dans une route. */
const MODEL_ENTRY_POINTS = [
  "runGenerationPipeline",
  "generateToneCards",
  "generateUspOptions",
  "suggestFieldText",
  "rephrase",
] as const;

/**
 * Les routes qui appellent le modèle, déclarées. La règle 2 vérifie que cette
 * liste correspond EXACTEMENT à ce que les sources font — une nouvelle route
 * modèle non déclarée fait échouer le test, ce qui est le seul moment où
 * quelqu'un se demandera si elle est plafonnée.
 */
const MODEL_CALLING = [
  "[id]/generate/route.ts",
  "[id]/rephrase/route.ts",
  "[id]/suggest/route.ts",
  "[id]/tone-cards/route.ts",
  "[id]/usp-options/route.ts",
].sort();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "__tests__" ? [] : walk(full);
    }
    return entry === "route.ts" ? [full] : [];
  });
}

/** Le source sans ses commentaires : une règle qui matche sa propre prose ment. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const FILES = walk(ROUTES_DIR).map((path) => ({
  relative: path.slice(ROUTES_DIR.length + 1),
  code: stripComments(readFileSync(path, "utf8")),
}));

/** Appelle-t-elle réellement le modèle ? */
function callsModel(code: string): boolean {
  return MODEL_ENTRY_POINTS.some((name) =>
    new RegExp(`\\b${name}\\s*\\(`).test(code)
  );
}

describe("la surface du brief", () => {
  it("compte les neuf routes attendues — sinon cette suite ne prouve rien", () => {
    // ⚠ GARDE ANTI-VIDE. Si `walk` cassait, les deux règles ci-dessous
    // passeraient sur une liste vide, en silence.
    expect(FILES.length).toBe(9);
    expect(FILES.map((f) => f.relative).sort()).toEqual(
      [
        "route.ts",
        "[id]/route.ts",
        "[id]/email-link/route.ts",
        "[id]/generate/route.ts",
        "[id]/rephrase/route.ts",
        "[id]/suggest/route.ts",
        "[id]/tone-cards/route.ts",
        "[id]/usp-confirm/route.ts",
        "[id]/usp-options/route.ts",
      ].sort()
    );
  });

  it("⚠ n'appelle `authenticate()` nulle part — le brief entier tourne sans compte", () => {
    const offenders = FILES.filter((f) => /\bauthenticate\s*\(/.test(f.code));
    expect(offenders.map((f) => f.relative)).toEqual([]);
  });

  it("résout l'appelante partout où elle lit ou écrit un brief", () => {
    // `POST /api/briefs` crée le brief et n'a donc personne à résoudre : c'est
    // la seule exception, et elle est nommée plutôt que déduite.
    const mustResolve = FILES.filter((f) => f.relative !== "route.ts");
    expect(mustResolve.length).toBe(8);
    for (const file of mustResolve) {
      expect(file.code, file.relative).toMatch(/resolveBriefCaller\s*\(/);
    }
  });
});

describe("⚠ ce qui appelle le modèle passe par le plafond anonyme", () => {
  it("la liste déclarée est exactement ce que les sources font", () => {
    const measured = FILES.filter((f) => callsModel(f.code))
      .map((f) => f.relative)
      .sort();
    expect(measured).toEqual(MODEL_CALLING);
  });

  it.each(MODEL_CALLING)("%s consomme un compte avant l'appel", (relative) => {
    const file = FILES.find((f) => f.relative === relative);
    expect(file, relative).toBeDefined();
    expect(file!.code).toMatch(/consumeAnonSpend\(\s*"(reveal|assist)"/);
    // Et seulement pour une anonyme : une utilisatrice connectée est bornée
    // par son crédit, pas par le plafond des inconnues.
    expect(file!.code).toMatch(/caller\.kind === "anon"/);
  });

  it("aucune route non-modèle ne consomme un compte pour rien", () => {
    const spending = FILES.filter(
      (f) => /consumeAnonSpend\s*\(/.test(f.code) && !callsModel(f.code)
    );
    expect(spending.map((f) => f.relative)).toEqual([]);
  });

  it("CANARY — la règle mord vraiment", () => {
    // Une route inventée qui appelle le modèle sans plafond : si `callsModel`
    // ou la regex du plafond se mettait à ne plus rien matcher, ce test le
    // dirait avant que la vraie règle ne devienne décorative.
    const fake = `
      const caller = await resolveBriefCaller();
      const text = await suggestFieldText({ supabase, projectId, field, userId });
    `;
    expect(callsModel(fake)).toBe(true);
    expect(fake).not.toMatch(/consumeAnonSpend\(\s*"(reveal|assist)"/);

    // Et la prose ne compte pas : un commentaire qui NOMME `authenticate()`
    // ne doit pas se lire comme un appel.
    expect(stripComments("/* appelait authenticate() */\nconst x = 1;")).not.toMatch(
      /\bauthenticate\s*\(/
    );
  });
});
