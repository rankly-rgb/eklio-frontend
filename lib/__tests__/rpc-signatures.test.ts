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

/**
 * Paramètres FACULTATIFS que ce dépôt doit malgré tout toujours envoyer.
 *
 * `grant_plan_allowance` a `p_grant_key text DEFAULT NULL`, donc la forme à
 * deux arguments compile et s'exécute. Elle n'est PAS idempotente contre la
 * forme à trois : sa clé de repli est l'id de session de checkout, une chaîne
 * différente d'un id d'event. Mélanger les deux formes octroie DEUX FOIS.
 *
 * Le test des paramètres requis ne peut pas l'attraper — le paramètre est
 * facultatif pour la base, obligatoire pour nous. D'où cette liste.
 */
const ALWAYS_PASS: Record<string, { arg: string; why: string }> = {
  grant_plan_allowance: {
    arg: "p_grant_key",
    why:
      "La forme à deux arguments retombe sur l'id de session de checkout, qui " +
      "n'est pas l'id d'event : mélanger les deux formes octroie deux fois.",
  },
};

/**
 * Déclarations écrites À LA MAIN, d'après une description et non d'après la
 * base. Chacune est une supposition tant qu'elle n'est pas régénérée.
 *
 * La liste n'est pas décorative : elle a déjà eu tort deux fois
 * (`p_stripe_event_id` au lieu de `p_grant_key`, `status`/`reason` au lieu de
 * `new_status`/`event_type`). Elle doit RÉTRÉCIR à chaque régénération, et un
 * test échoue si elle grandit sans qu'on le décide.
 */
const UNCONFIRMED = [
  "record_purchase_status_event",
] as const;

const DECLARED = declaredArgs();
const SITES = callSites();

describe("l'extraction elle-même", () => {
  it("lit les fonctions déclarées", () => {
    // Sans cette garde, un parseur cassé rendrait tout le reste vacuously
    // true — sur exactement le sujet où un faux vert coûte le plus cher.
    expect(DECLARED.size).toBeGreaterThan(5);
    // `supabase gen types` alphabétise les clés de `Args`, quel que soit
    // l'ordre de déclaration en SQL (vérifié aussi sur
    // `record_purchase_status_event`, dont l'ordre déclaré n'est pas
    // alphabétique) — l'ordre attendu ici suit celui du générateur, pas celui
    // de la signature SQL.
    expect(DECLARED.get("grant_plan_allowance")?.map((arg) => arg.name)).toEqual([
      "p_grant_key",
      "p_project_id",
      "p_tier",
    ]);
  });

  it("trouve les appels", () => {
    expect(SITES.length).toBeGreaterThanOrEqual(5);
    expect(SITES.map((site) => site.fn)).toContain("grant_plan_allowance");
  });
});

describe("les paramètres facultatifs qu'on doit quand même envoyer", () => {
  it.each(Object.entries(ALWAYS_PASS))("%s", (fn, rule) => {
    const sites = SITES.filter((site) => site.fn === fn);
    expect(sites.length, `Aucun appel à ${fn} trouvé.`).toBeGreaterThan(0);

    for (const site of sites) {
      expect(
        site.keys.includes(rule.arg),
        `${site.file} appelle ${fn} sans \`${rule.arg}\`.\n${rule.why}`
      ).toBe(true);
    }
  });
});

describe("ce qui reste supposé", () => {
  it("la liste des déclarations non confirmées ne grandit pas toute seule", () => {
    // Elle a déjà eu tort deux fois. Elle doit rétrécir à chaque régénération
    // des types, jamais s'allonger sans décision.
    expect([...UNCONFIRMED]).toEqual(["record_purchase_status_event"]);
  });

  it("chacune est bien déclarée, faute de quoi la liste ment", () => {
    for (const fn of UNCONFIRMED) expect(DECLARED.has(fn)).toBe(true);
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

/* ────────────────────────────────────────────────────────────────────────
 * LES COLONNES, pour la même raison exactement.
 *
 * `purchase_status_events` a été déclaré à la main dans `types/supabase.ts`
 * — `purchase_id`, `status`, `previous_status`, `stripe_event_id`, `reason` —
 * d'après la description de la table, pas d'après la table. C'est la même
 * classe d'erreur que `p_grant_key` : un nom faux passe la compilation et
 * échoue à l'écriture, en production, sur le chemin du paiement.
 *
 * ⚠ CE QUE CE TEST FAIT, ET CE QU'IL NE FAIT PAS. Tant que ces types sont
 * écrits à la main, il compare mes appels à mes propres suppositions, et il
 * passe. Sa valeur arrive à la RÉGÉNÉRATION : le jour où `types/supabase.ts`
 * est refait depuis la base, toute colonne inventée devient rouge, ici, avec
 * le fichier et le nom. C'est le seul instant où la divergence est visible
 * d'ici, et c'est celui-là qu'on instrumente.
 *
 * Les `.select()` ne sont PAS couverts : leurs chaînes portent des jointures
 * (`*, projects!inner(user_id, name)`) qu'on ne parserait pas honnêtement. Le
 * risque y est aussi moindre — un select sur une colonne absente échoue tout
 * de suite et bruyamment, là où un insert peut écrire à côté.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Les colonnes acceptées en écriture, par table (`Insert` ∪ `Update`).
 *
 * Balayage LIGNE À LIGNE, et pas par expression régulière sur des tranches :
 * le fichier généré imbrique `Row`, `Insert`, `Update` et `Relationships` à
 * des profondeurs fixes, et l'indentation est un repère bien plus solide
 * qu'un appariement d'accolades sur 1 200 lignes.
 */
function declaredColumns(): Map<string, Set<string>> {
  const types = readFileSync(join(ROOT, "types/supabase.ts"), "utf8");
  const lines = types
    .slice(types.indexOf("    Tables: {"), types.indexOf("    Functions: {"))
    .split("\n");

  const found = new Map<string, Set<string>>();
  let table: string | null = null;
  let section: string | null = null;

  for (const line of lines) {
    const isTable = /^ {6}(\w+): \{$/.exec(line);
    if (isTable) {
      table = isTable[1];
      section = null;
      continue;
    }
    const isSection = /^ {8}(\w+): [{[]/.exec(line);
    if (isSection) {
      section = isSection[1];
      continue;
    }
    if (!table || (section !== "Insert" && section !== "Update")) continue;

    const column = /^ {10}(\w+)\??:/.exec(line);
    if (!column) continue;

    const set = found.get(table) ?? new Set<string>();
    set.add(column[1]);
    found.set(table, set);
  }
  return found;
}

/** Tous les `.from("t").insert|update|upsert({ … })`, avec les colonnes écrites. */
function writeSites(): { file: string; table: string; columns: string[] }[] {
  const sites: { file: string; table: string; columns: string[] }[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || full.includes("__tests__")) continue;

      const source = readFileSync(full, "utf8");
      for (const match of source.matchAll(
        /\.from\(\s*"(\w+)"\s*\)\s*\n?\s*\.(insert|update|upsert)\(\s*\{/g
      )) {
        const open = (match.index ?? 0) + match[0].length - 1;
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

        /*
         * Uniquement les clés de PREMIER niveau de l'objet : un jsonb
         * imbriqué (`content`, `directions`) porte des clés qui ne sont pas
         * des colonnes. On les repère par leur indentation relative.
         */
        const body = source.slice(open + 1, close);
        const indents = [...body.matchAll(/^( +)\w+:/gm)].map(
          (line) => line[1].length
        );
        const top = indents.length > 0 ? Math.min(...indents) : 0;
        const columns = [...body.matchAll(/^( +)(\w+):/gm)]
          .filter((line) => line[1].length === top)
          .map((line) => line[2]);

        sites.push({
          file: full.slice(ROOT.length + 1).replace(/\\/g, "/"),
          table: match[1],
          columns,
        });
      }
    }
  };
  for (const dir of ["lib", "app", "components"]) walk(join(ROOT, dir));
  return sites;
}

const COLUMNS = declaredColumns();
const WRITES = writeSites();

describe("l'extraction des colonnes", () => {
  it("lit les tables déclarées", () => {
    expect(COLUMNS.size).toBeGreaterThan(5);
    /*
     * Les VRAIES colonnes, corrigées d'après la table. Deux de mes
     * suppositions étaient fausses : `status` n'existe pas — c'est
     * `new_status` — et `reason` n'existe pas du tout, `event_type` porte le
     * type Stripe brut.
     */
    expect([...(COLUMNS.get("purchase_status_events") ?? [])].sort()).toEqual([
      "amount_cents",
      "created_at",
      "event_type",
      "id",
      "new_status",
      "occurred_at",
      "previous_status",
      "purchase_id",
      "stripe_event_id",
    ]);
  });

  it("trouve les écritures", () => {
    expect(WRITES.length).toBeGreaterThanOrEqual(5);
  });

  it("PERSONNE n'écrit `purchase_status_events` à la main", () => {
    /*
     * `record_purchase_status_event` remplit `previous_status` depuis la ligne
     * et fait avancer `purchases.status` dans la même transaction. Un insert
     * direct ferait diverger le journal de ce qu'il raconte, et rouvrirait la
     * fenêtre où l'une des deux écritures réussit sans l'autre.
     */
    expect(
      WRITES.filter((site) => site.table === "purchase_status_events")
    ).toEqual([]);
  });
});

describe("chaque écriture ne nomme que des colonnes déclarées", () => {
  it.each(WRITES.map((site) => [`${site.file} → ${site.table}`, site] as const))(
    "%s",
    (_label, site) => {
      const declared = COLUMNS.get(site.table);
      expect(
        declared,
        `La table ${site.table} n'est pas déclarée dans types/supabase.ts.`
      ).toBeDefined();

      for (const column of site.columns) {
        expect(
          declared!.has(column),
          `${site.file} écrit \`${column}\` dans ${site.table}, qui ne la déclare pas.\n` +
            "Si les types viennent d'être régénérés, c'est la base qui a raison :\n" +
            "la colonne a été supposée, et l'écriture échouera en production."
        ).toBe(true);
      }
    }
  );
});
