import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * Chaque `supabase.rpc(...)` passe les arguments que la base DÉCLARE.
 *
 * ── Pourquoi ce test existe ──────────────────────────────────────────────
 *
 * `grant_plan_allowance` a été écrit contre une signature SUPPOSÉE
 * (`p_stripe_event_id`) avant que la vraie ne soit livrée (`p_grant_key`). Un
 * nom de paramètre faux n'échoue pas discrètement, et il n'échoue pas au bon
 * endroit : PostgREST ne trouve aucune surcharge, le handler jette,
 * `forgetEvent` désarme l'idempotence, Stripe rejoue — et l'achat reste
 * enregistré pendant que l'allocation n'arrive jamais. TypeScript n'attrape
 * rien, parce que le mensonge est dans le fichier de types lui-même.
 *
 * Ce test ne parle pas à la base. Ce qu'il tient, c'est que les APPELS et les
 * TYPES ne divergent pas : le jour où quelqu'un corrige une signature — ou
 * régénère `types/supabase.ts` depuis la base — tout appel resté en arrière
 * devient rouge. C'est la moitié du problème qu'on peut fermer d'ici. L'autre
 * moitié se ferme en régénérant les types, et rien dans ce dépôt ne peut le
 * faire à notre place.
 */

const ROOT = resolve(__dirname, "../..");

type DeclaredArg = { name: string; optional: boolean };

/** Les paramètres déclarés de chaque fonction, par nom. */
function declaredArgs(): Map<string, DeclaredArg[]> {
  const types = readFileSync(join(ROOT, "types/supabase.ts"), "utf8");
  const block = types.slice(types.indexOf("    Functions: {"));
  const found = new Map<string, DeclaredArg[]>();

  for (const match of block.matchAll(/^ {6}(\w+):\s*\{/gm)) {
    const name = match[1];
    // La déclaration tient dans les quelques lignes qui suivent le nom.
    const window = block.slice(match.index ?? 0, (match.index ?? 0) + 600);
    const args = /Args:\s*(\{[^}]*\}|Record<[^>]*>)/.exec(window);
    if (!args) continue;

    if (args[1].startsWith("Record")) {
      found.set(name, []);
      continue;
    }
    found.set(
      name,
      [...args[1].matchAll(/(\w+)(\??):/g)].map((param) => ({
        name: param[1],
        optional: param[2] === "?",
      }))
    );
  }
  return found;
}

/** Tous les `.rpc("name", { … })` du dépôt, avec les clés réellement passées. */
function callSites(): { file: string; fn: string; keys: string[] }[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !full.includes("__tests__")) {
        files.push(full);
      }
    }
  };
  for (const dir of ["lib", "app", "components"]) walk(join(ROOT, dir));

  const sites: { file: string; fn: string; keys: string[] }[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\.rpc\(\s*"(\w+)"\s*,\s*\{/g)) {
      const open = (match.index ?? 0) + match[0].length - 1;
      // Appariement d'accolades : l'objet peut porter des littéraux imbriqués.
      let depth = 0;
      let close = open;
      for (let i = open; i < source.length; i += 1) {
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            close = i;
            break;
          }
        }
      }
      const keys = [
        ...source.slice(open + 1, close).matchAll(/^\s*(\w+)\s*:/gm),
      ].map((key) => key[1]);
      sites.push({
        file: file.slice(ROOT.length + 1).replace(/\\/g, "/"),
        fn: match[1],
        keys,
      });
    }
  }
  return sites;
}

const DECLARED = declaredArgs();
const SITES = callSites();

describe("l'extraction elle-même", () => {
  it("lit les fonctions déclarées", () => {
    // Sans cette garde, un parseur cassé rendrait tout le reste vacuously
    // true — sur exactement le sujet où un faux vert coûte le plus cher.
    expect(DECLARED.size).toBeGreaterThan(5);
    expect(DECLARED.get("grant_plan_allowance")?.map((arg) => arg.name)).toEqual([
      "p_project_id",
      "p_tier",
      "p_grant_key",
    ]);
  });

  it("trouve les appels", () => {
    expect(SITES.length).toBeGreaterThanOrEqual(5);
    expect(SITES.map((site) => site.fn)).toContain("grant_plan_allowance");
  });
});

describe("chaque appel correspond à sa déclaration", () => {
  it.each(SITES.map((site) => [`${site.file} → ${site.fn}`, site] as const))(
    "%s",
    (_label, site) => {
      const declared = DECLARED.get(site.fn);
      expect(
        declared,
        `${site.fn} n'est pas déclarée dans types/supabase.ts.`
      ).toBeDefined();

      const names = new Set(declared!.map((arg) => arg.name));
      for (const key of site.keys) {
        expect(
          names.has(key),
          `${site.file} passe \`${key}\` à ${site.fn}, qui ne le déclare pas.\n` +
            `Paramètres déclarés : ${[...names].join(", ") || "(aucun)"}.\n` +
            "PostgREST ne trouvera aucune surcharge : la route jettera, et Stripe\n" +
            "rejouera indéfiniment sur la même erreur."
        ).toBe(true);
      }

      const passed = new Set(site.keys);
      for (const arg of declared!) {
        if (arg.optional) continue;
        expect(
          passed.has(arg.name),
          `${site.file} n'envoie pas \`${arg.name}\`, requis par ${site.fn}.`
        ).toBe(true);
      }
    }
  );
});
