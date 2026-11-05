import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  F142 (2026-11-05) : UN ARGUMENT OBLIGATOIRE NE REÇOIT JAMAIS `undefined`
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `apply_on_demand_write` recevait `undefined` sur six arguments sans valeur par
 * défaut : la clé disparaissait de l'appel, PostgREST ne trouvait plus la
 * fonction. Rien ne l'a dit, parce que le fichier de types avait été retouché à
 * la main et déclarait ces arguments facultatifs.
 *
 * Ce contrôle lit les arguments OBLIGATOIRES dans les types GÉNÉRÉS
 * (`types/supabase.ts`, régénéré depuis un rejeu des migrations) et parcourt
 * chaque appel `.rpc("…", { … })` de `app/` et `lib/` : un argument obligatoire
 * qui reçoit `undefined`, ou `… ?? undefined`, fait rougir le test. Un argument
 * facultatif (une valeur par défaut en base) peut le recevoir.
 */
const ROOT = join(__dirname, "../../..");
const TYPES = readFileSync(join(ROOT, "types/supabase.ts"), "utf8");

/** Fonction → arguments obligatoires, lus dans le bloc `Args` généré. */
function requiredArgs(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const m of TYPES.matchAll(/"?([a-z0-9_]+)"?:\s*\{\s*Args:\s*\{([^}]*)\}/g)) {
    const required = new Set([...m[2].matchAll(/"?([a-z0-9_]+)"?(\?)?:/g)].filter((a) => !a[2]).map((a) => a[1]));
    out.set(m[1], new Set([...(out.get(m[1]) ?? []), ...required]));
  }
  return out;
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Les appels `.rpc("nom", { … })` d'un fichier, avec le texte de leur objet d'arguments. */
function rpcCalls(src: string): Array<{ fn: string; args: string }> {
  const out: Array<{ fn: string; args: string }> = [];
  for (const m of src.matchAll(/\.rpc\(\s*"([a-z0-9_]+)"\s*,\s*\{/g)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") depth -= 1;
      i += 1;
    }
    out.push({ fn: m[1], args: src.slice(start, i - 1) });
  }
  return out;
}

describe("aucun argument obligatoire d'une fonction de base ne reçoit undefined", () => {
  const required = requiredArgs();

  it("les types générés portent les arguments obligatoires (le contrôle a de quoi lire)", () => {
    expect(required.get("apply_on_demand_write")).toEqual(
      new Set(["p_write_id", "p_title", "p_caption", "p_on_image_text", "p_alt_text", "p_compose_archetype", "p_payload"])
    );
  });

  it("dans app/ et lib/, chaque appel .rpc(…) passe une valeur ou un null à ses arguments obligatoires", () => {
    const offences: string[] = [];
    let calls = 0;
    for (const file of [...sources(join(ROOT, "app")), ...sources(join(ROOT, "lib"))]) {
      const src = readFileSync(file, "utf8");
      for (const call of rpcCalls(src)) {
        calls += 1;
        const needed = required.get(call.fn);
        if (!needed) continue;
        for (const a of call.args.matchAll(/(?:^|[,{\s])(p_[a-z0-9_]+)\s*:\s*([^,\n]+)/g)) {
          if (needed.has(a[1]) && /(^|\?\?\s*)undefined\b/.test(a[2].trim())) offences.push(`${file.slice(ROOT.length + 1)} — ${call.fn}.${a[1]} = ${a[2].trim()}`);
        }
      }
    }
    expect(calls).toBeGreaterThan(10);
    expect(offences).toEqual([]);
  });

  it("provoqué : l'appel d'avant F142 est attrapé", () => {
    const before = `supabase.rpc("apply_on_demand_write", { p_write_id: input.writeId, p_title: input.title ?? undefined, p_rationale: input.rationale ?? undefined });`;
    const [call] = rpcCalls(before);
    const needed = required.get(call.fn)!;
    const hits = [...call.args.matchAll(/(?:^|[,{\s])(p_[a-z0-9_]+)\s*:\s*([^,\n]+)/g)].filter((a) => needed.has(a[1]) && /(^|\?\?\s*)undefined\b/.test(a[2].trim()));
    expect(hits.map((h) => h[1])).toEqual(["p_title"]);
  });
});
