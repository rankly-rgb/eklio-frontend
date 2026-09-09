import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/*
 * ⚠ THREE METERS, AND EACH PATH SPENDS EXACTLY ONE OF THEM.
 *
 * ── Why this file exists ─────────────────────────────────────────────────
 *
 * Two reports from this chantier said opposite things about which meter image
 * generation spends. One said `plans.image_budget_cents`; the other said
 * `consume_generation_credit`. Only one could be true, and neither author had
 * traced it — the wiring had moved under both of them.
 *
 * That is not a documentation problem, it is a money problem: the directions
 * meter is three to twelve regenerations of a WHOLE BRAND, sold at 79 to 249
 * USD. Anything that quietly spends it drains what she bought without her
 * having asked for it. The next chantier is a monthly content generation; if
 * it inherits the wrong meter it will empty a customer's brand regenerations
 * on its own schedule.
 *
 * So the wiring is asserted, not described:
 *
 *   images        → plans.image_budget_cents      (reserve → settle, in cents)
 *   directions    → consume_generation_credit     (the ladder she bought)
 *   check rewrite → a daily count, neither meter  (it costs a fraction of a cent)
 */

const ROOT = resolve(__dirname, "../..");
const FORBIDDEN = "consume_generation_credit";

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function code(file: string): string {
  return stripComments(readFileSync(file, "utf8"));
}

function relative(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

/** Every local module reachable from an entry point, imports followed. */
function reachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];

  const resolveImport = (spec: string, from: string): string | null => {
    const base = spec.startsWith("@/")
      ? join(ROOT, spec.slice(2))
      : spec.startsWith(".")
        ? join(dirname(from), spec)
        : null;
    if (base === null) return null;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
      if (existsSync(candidate)) return candidate;
    }
    return null;
  };

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(/from\s+["']([^"']+)["']/g)) {
      const resolved = resolveImport(match[1], file);
      if (resolved) queue.push(resolved);
    }
  }
  return [...seen];
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : filesUnder(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/*
 * Everything that can cause an image to be made: the library itself, the two
 * routes that call it, and the operator script. Import chains are followed,
 * so a helper three modules down that reached for the wrong meter is caught.
 */
const IMAGE_ENTRY_POINTS = [
  join(ROOT, "lib/images/generate.ts"),
  join(ROOT, "app/api/brand-kits/[id]/images/route.ts"),
  join(ROOT, "app/api/brand-kits/[id]/images/[slot]/route.ts"),
  join(ROOT, "scripts/brand-image/generate-one.ts"),
];

const IMAGE_REACHABLE = [...new Set(IMAGE_ENTRY_POINTS.flatMap(reachableFrom))]
  // `types/supabase.ts` DECLARES every RPC in the database, which is not
  // calling one. Excluding it is the same exemption `lib/site/__tests__/
  // routes.test.ts` makes for the same reason.
  .filter((file) => relative(file) !== "types/supabase.ts");

describe("l'énumération elle-même", () => {
  it("les points d'entrée d'image existent tous", () => {
    for (const entry of IMAGE_ENTRY_POINTS) {
      expect(existsSync(entry), `${relative(entry)} a disparu`).toBe(true);
    }
  });

  it("le balayage remonte bien les chaînes d'import", () => {
    /*
     * Sans cette garde, un `reachableFrom` cassé rendrait le bloc suivant
     * vacuously true — un test vert qui ne teste plus rien, sur exactement le
     * sujet où ça coûte le plus cher.
     */
    expect(IMAGE_REACHABLE.length).toBeGreaterThanOrEqual(15);
    // Et il atteint bien la couche RPC, qui est là où un mauvais compteur
    // s'écrirait.
    expect(IMAGE_REACHABLE.map(relative)).toContain("lib/images/rpc.ts");
  });
});

describe("⚠ aucun chemin d'image n'atteint le compteur des directions", () => {
  it.each(IMAGE_REACHABLE.map((file) => [relative(file), file] as const))(
    "%s",
    (path, file) => {
      expect(
        code(file).includes(FORBIDDEN),
        `${path} atteint \`${FORBIDDEN}\`.\n` +
          "C'est l'échelle des DIRECTIONS — trois à douze régénérations d'une\n" +
          "marque entière, vendues 79 à 249 USD. Une photographie se paie en\n" +
          "cents sur `plans.image_budget_cents`, jamais là-dessus."
      ).toBe(false);
    }
  );

  it("⚠ le canari : le motif attraperait bien un retour du mauvais compteur", () => {
    const canary = 'await supabase.rpc("consume_generation_credit", { p_brand_kit_id: id });';
    expect(stripComments(canary).includes(FORBIDDEN)).toBe(true);
    // Et un commentaire qui le NOMME ne compte pas — plusieurs de ces
    // fichiers expliquent précisément pourquoi ils ne l'appellent pas.
    expect(stripComments("// never consume_generation_credit\n").includes(FORBIDDEN)).toBe(false);
  });
});

describe("⚠ aucun chemin d'image ne consomme avant d'avoir vérifié", () => {
  const generate = code(join(ROOT, "lib/images/generate.ts"));

  it("la réservation précède l'appel au modèle", () => {
    const reserve = generate.indexOf("reserveImageSpend(");
    const call = generate.indexOf("client.generate(");
    expect(reserve).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(-1);
    expect(
      reserve < call,
      "Le modèle est appelé avant que le budget ne soit réservé.\n" +
        "Il n'existe aucun remboursement après livraison dans ce produit :\n" +
        "dépenser d'abord et vérifier ensuite n'a pas de marche arrière."
    ).toBe(true);
  });

  it("un refus de réservation rend la fonction AVANT tout appel", () => {
    const refusal = generate.indexOf("if (!reserved.ok)");
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(generate.indexOf("client.generate("));
    expect(generate.slice(refusal, generate.indexOf("client.generate("))).toContain("return {");
  });

  it("la dépense n'est définitive qu'une fois l'image écrite", () => {
    // `settle(..., true)` vient après `markBrandImageReady`, jamais avant.
    const ready = generate.indexOf("markBrandImageReady(");
    const settleTrue = generate.indexOf("settleImageSpend(supabase, brandKitId, costCents, true)");
    expect(ready).toBeGreaterThan(-1);
    expect(settleTrue).toBeGreaterThan(ready);
  });

  it("et chaque sortie en échec relâche la réservation", () => {
    /*
     * Elle ne doit jamais payer une photographie qu'elle n'a pas reçue. Chaque
     * `return { ok: false` postérieur à la réservation est précédé d'un
     * `release()` — sauf le refus de réservation lui-même, qui n'a rien à
     * relâcher.
     */
    const after = generate.slice(generate.indexOf("const release ="));
    const failures = [...after.matchAll(/return \{\s*ok: false/g)];
    expect(failures.length).toBeGreaterThanOrEqual(4);
    expect([...after.matchAll(/await release\(\)/g)].length).toBeGreaterThanOrEqual(failures.length);
  });

  it("⚠ EVERY image reserves, not only a regeneration", () => {
    /*
     * C'était la moitié fausse de l'ancien câblage : les sept premières ne
     * tiraient sur rien, donc le seul enregistrement de ce qu'un kit avait
     * coûté en photographies vivait dans le plafond quotidien GLOBAL de
     * l'opérateur, pas dans une ligne à elle.
     */
    expect(generate).not.toMatch(/if \(isRegeneration\)\s*\{\s*const reserved/);
    expect(generate).toMatch(/const reserved = await reserveImageSpend\(/);
  });
});

describe("le compteur des directions reste celui des directions", () => {
  it("la génération de directions le dépense toujours", () => {
    // L'autre moitié de la règle : elle ne dit pas « personne ne dépense »,
    // elle dit « chacun dépense le sien ».
    const generateRoute = code(join(ROOT, "app/api/briefs/[id]/generate/route.ts"));
    expect(generateRoute).toContain(FORBIDDEN);
  });

  it("⚠ la réécriture de Check ne dépense plus AUCUN des deux", () => {
    const rewrite = code(join(ROOT, "app/api/check/rewrite/route.ts"));
    expect(rewrite).not.toContain(FORBIDDEN);
    expect(rewrite).not.toContain("image_budget_cents");
    expect(rewrite).not.toContain("brand_kit_has_generation_credit");
    // Ce qui la borne à la place, et c'est un compte, pas de l'argent.
    expect(rewrite).toContain("consumeCheckRewrite(supabase)");
  });

  it("et sa borne est comptée AVANT l'appel au modèle", () => {
    const rewrite = code(join(ROOT, "app/api/check/rewrite/route.ts"));
    const bound = rewrite.indexOf("consumeCheckRewrite(supabase)");
    const call = rewrite.indexOf("rewriteAndRescan(");
    expect(bound).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(bound);
  });

  it("le nombre lui-même vit en base, pas dans le code", () => {
    /*
     * Une limite en dur est une limite qui demande un déploiement pour bouger,
     * le jour où vingt s'avère être le mauvais chiffre.
     */
    const allowance = code(join(ROOT, "lib/check/allowance.ts"));
    expect(allowance).toContain('supabase.rpc("consume_check_rewrite")');
    expect(allowance).not.toMatch(/\b20\b/);
  });

  it("⚠ et ce n'est PAS le limiteur en mémoire", () => {
    // `lib/api/rate-limit.ts` est par processus et son propre en-tête le dit.
    // Un plafond quotidien qu'un redéploiement remet à zéro n'est pas un
    // plafond.
    const allowance = code(join(ROOT, "lib/check/allowance.ts"));
    expect(allowance).not.toContain("@/lib/api/rate-limit");
  });
});

describe("rien d'autre dans le dépôt ne dépense le compteur des directions", () => {
  const CALLERS = filesUnder(join(ROOT, "app"))
    .concat(filesUnder(join(ROOT, "lib")))
    .filter((file) => code(file).includes(FORBIDDEN))
    .map(relative);

  it("et la liste est exactement celle-ci", () => {
    /*
     * Une énumération fermée plutôt qu'une règle : le jour où un nouveau
     * chemin le dépense, ce test le nomme, et quelqu'un décide si c'est
     * voulu. La génération de contenu mensuel — le prochain chantier — est
     * précisément le chemin qui ne doit pas s'y ajouter par distraction.
     */
    expect(CALLERS).toEqual(["app/api/briefs/[id]/generate/route.ts"]);
  });
});
