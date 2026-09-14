import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * ── LE GARDE-FOU QUI MANQUAIT ───────────────────────────────────────────
 *
 * `lib/brief/platform.ts` a été écrit, testé par deux fichiers, et importé par
 * AUCUN fichier de `app/` ni de `components/`. Toute la suite était verte.
 *
 * Ce n'était pas du code mort inoffensif : `stepIssue("practice")` EXIGEAIT
 * `site_platform_id`, et l'écran n'offrait pas le champ. Un brief neuf se
 * bloquait à l'étape 1 sur une question que personne ne posait. La moitié
 * « décider » avait été construite, la moitié « demander » jamais — et rien ne
 * comparait les deux.
 *
 * ⚠ CE TEST N'EST PAS UNE CHASSE AU CODE MORT. Il porte sur `lib/brief/`
 * uniquement, et pour une raison précise : ce dossier décrit un PARCOURS. Un
 * module de parcours que l'interface n'atteint pas est, par construction, une
 * étape qui n'existe pas pour la cliente — qu'elle soit juste ou non.
 * L'étendre à `lib/` entier en ferait une règle générale fausse : un module de
 * génération n'a aucune raison d'être importé par un écran.
 *
 * Et il se lit dans les deux sens. Un module ajouté ici sans être branché est
 * rouge ; un module retiré d'un écran sans être retiré d'ici l'est aussi.
 */

const ROOT = resolve(__dirname, "../../..");

/** Tous les `.ts`/`.tsx` d'un dossier, en descendant. */
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

/*
 * `fixtures` est exclu : ce sont des données pour les tests et les écrans de
 * démonstration, pas une étape du parcours. `__tests__` aussi, évidemment —
 * un module importé seulement par son propre test est exactement le cas que ce
 * fichier existe pour attraper.
 */
const BRIEF_MODULES = sourcesUnder(join(ROOT, "lib/brief"), [
  "__tests__",
  "fixtures",
]).map((path) => path.slice(join(ROOT, "lib/brief/").length).replace(/\.tsx?$/, ""));

/** Le texte de tout ce qui est rendu : `app/` et `components/`. */
const SCREEN_SOURCES = [
  ...sourcesUnder(join(ROOT, "app")),
  ...sourcesUnder(join(ROOT, "components"), ["__tests__"]),
]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

describe("⚠ tout module de lib/brief/ atteint un écran", () => {
  it("le recensement n'est pas vide", () => {
    // Une garde anti-vacuité : un `it.each` sur une liste vide est vert.
    expect(BRIEF_MODULES.length).toBeGreaterThanOrEqual(4);
    expect(BRIEF_MODULES).toContain("platform");
    expect(BRIEF_MODULES).toContain("flow");
  });

  it.each(BRIEF_MODULES)(
    "lib/brief/%s est importé par app/ ou components/",
    (module) => {
      /*
       * On cherche le chemin d'import, pas le nom de fichier : `@/lib/brief/x`
       * tel qu'il s'écrit dans un `import`. Un module nommé `platform` se
       * confondrait sinon avec le mot « platform » dans une phrase d'écran.
       */
      const importPath = `@/lib/brief/${module}`;
      expect(
        SCREEN_SOURCES.includes(importPath),
        `lib/brief/${module}.ts n'est importé par aucun fichier de app/ ni de ` +
          `components/. Ce dossier décrit le PARCOURS : un module qu'aucun ` +
          `écran n'atteint est une étape qui n'existe pas pour la cliente. ` +
          `C'est exactement ce qui est arrivé à lib/brief/platform.ts — ` +
          `construit, testé, et jamais branché, pendant que l'étape 1 exigeait ` +
          `la réponse qu'il devait qualifier. Branchez-le, ou retirez-le.`
      ).toBe(true);
    }
  );
});
