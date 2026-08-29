import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * TOUTE surface de `brand-kits` est gardée, ou l'est explicitement pas.
 *
 * ── Pourquoi ce test existe ──────────────────────────────────────────────
 *
 * Ajouter une route et oublier la vérification EST le mode de défaillance que
 * tout ce lot corrige. Le PDF et la page de kit ont passé des semaines
 * ouverts, non pas parce que quelqu'un avait décidé qu'ils le soient, mais
 * parce qu'ils étaient gardés par un EFFET DE BORD — une praticienne non
 * payante ne pouvait plus écrire `selected_direction_id`, donc elle n'arrivait
 * pas jusqu'à eux. Personne n'a rien décidé, et personne n'a rien vu.
 *
 * Une convention n'empêche pas ça. Une énumération, si : une route nouvelle
 * est soit gardée, soit inscrite ci-dessous avec sa raison, soit rouge.
 *
 * ── Les deux mécanismes de garde, et ils sont tous les deux réels ────────
 *
 *   1. LA VÉRIFICATION EXPLICITE — la route appelle `isBrandKitEntitled`, qui
 *      pose la question à `brand_kit_entitled` en base.
 *   2. LE REFUS DE LA BASE — la route appelle une fonction dont la base
 *      refuse l'appel pour un kit non déverrouillé (`payment_required` sur les
 *      RPC de l'éditeur de site, refus d'écriture sur `selectDirection`). La
 *      route n'a alors rien à décider : elle SURFACE le refus.
 *
 * Le second est le plus sûr des deux — une route qui oublie ne reçoit rien
 * plutôt que tout — mais il n'existe que là où la base porte déjà la garde.
 * D'où les deux.
 */

const ROOT = resolve(__dirname, "../..");
const ROUTES_DIR = join(ROOT, "app/api/brand-kits");

/**
 * Ce qui est GRATUIT, et pourquoi.
 *
 * C'est ici que la décision de produit se prend, à la main, une ligne par
 * surface. Elle est vide aujourd'hui : rien sous `brand-kits` n'est gratuit.
 * La révélation, elle, est gratuite et entière — mais elle est une page, pas
 * une route d'API, et elle ne sert pas de livrable.
 */
const FREE: Record<string, string> = {};

/** Les appels qui posent la question du droit, explicitement. */
const EXPLICIT_CHECK = /\bisBrandKitEntitled\s*\(/;

/**
 * Les appels que la BASE refuse pour un kit non déverrouillé.
 *
 * Repérés par leur nom d'appel dans le fichier de route, pas par un import :
 * `lib/data/brand-kit.ts` est atteint par presque tout le monde pour
 * `loadBrandKit`, et remonter la chaîne d'imports classerait comme gardée
 * n'importe quelle route qui lit un kit.
 */
const DB_REFUSED = [
  /\bselectDirection\s*\(/,
  /\bsiteSpecGet\s*\(/,
  /\bsiteSpecPatch\s*\(/,
  /\bsiteSpecReset\s*\(/,
  /\bsiteSpecSetTarget\s*\(/,
  /\bsiteSpecFixContrast\s*\(/,
  /\bsiteOutputGet\s*\(/,
  /\bsiteOutputMarkCopied\s*\(/,
];

/**
 * Ce qui prouve qu'un refus de la base est bien RENDU à l'appelante.
 *
 * `siteResponse` traduit `payment_required` en 402 ; une route qui compose sa
 * réponse elle-même doit écrire le code. Sans cette seconde assertion, une
 * route pourrait se réclamer du refus de la base et l'avaler en 500.
 */
const SURFACES_REFUSAL = [/\bsiteResponse\s*\(/, /\b402\b/];

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

/** On lit du CODE, pas de la prose : un commentaire ne garde rien. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function relative(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

const ROUTES = routeFiles(ROUTES_DIR);

describe("l'énumération elle-même", () => {
  it("trouve bien les routes", () => {
    // Sans cette garde, un balayage cassé rendrait tout le reste vacuously
    // true — le pire des faux verts, et sur exactement le sujet où il coûte
    // le plus cher.
    expect(ROUTES.length).toBeGreaterThanOrEqual(9);
  });

  it("l'allowlist ne contient que des routes qui existent", () => {
    // Une entrée périmée est une exemption qui survit à la route qu'elle
    // exemptait, et qui couvrira la prochaine à porter ce nom.
    const known = new Set(ROUTES.map(relative));
    for (const path of Object.keys(FREE)) expect(known).toContain(path);
  });
});

describe("chaque route de brand-kits est gardée", () => {
  it.each(ROUTES.map((file) => [relative(file), file] as const))(
    "%s",
    (path, file) => {
      if (path in FREE) {
        // Décision explicite : elle doit porter sa raison, pas juste son nom.
        expect(FREE[path].length).toBeGreaterThan(20);
        return;
      }

      const source = code(file);
      const checked = EXPLICIT_CHECK.test(source);
      const refused = DB_REFUSED.some((pattern) => pattern.test(source));

      expect(
        checked || refused,
        `${path} ne vérifie pas le droit.\n` +
          "Trois issues, et il faut en choisir une :\n" +
          "  - appeler `isBrandKitEntitled(supabase, brandKitId)` ;\n" +
          "  - passer par une fonction que la base refuse elle-même ;\n" +
          "  - l'inscrire dans FREE, avec la raison pour laquelle elle est gratuite."
      ).toBe(true);

      if (refused && !checked) {
        expect(
          SURFACES_REFUSAL.some((pattern) => pattern.test(source)),
          `${path} s'appuie sur le refus de la base mais ne le rend pas.\n` +
            "Un refus avalé en 500 est un cul-de-sac ; en 402 c'est une offre."
        ).toBe(true);
      }
    }
  );
});

/*
 * Les PAGES qui rendent le kit. Même mode de défaillance, même énumération —
 * une page qui rend le livrable est une surface comme une autre.
 */
const KIT_PAGES = [
  "app/app/brand-kits/[id]/page.tsx",
  "app/app/brand-kits/[id]/site/page.tsx",
];

describe("les pages du kit sont gardées", () => {
  it.each(KIT_PAGES)("%s", (path) => {
    const source = code(join(ROOT, path));
    const checked = EXPLICIT_CHECK.test(source);
    const refused = DB_REFUSED.some((pattern) => pattern.test(source));

    expect(checked || refused).toBe(true);
    // Une page ne rend pas un 402 : elle EMMÈNE au checkout. Un écran vide se
    // lirait comme une panne plutôt que comme une offre. L'adresse est parfois
    // composée dans une variable, d'où les deux assertions plutôt qu'un motif
    // qui exigerait de l'écrire en toutes lettres dans l'appel.
    expect(source).toMatch(/\bredirect\(/);
    expect(source).toContain("/app/checkout");
  });

  it("la révélation, elle, reste libre — et c'est le point de vente", () => {
    const source = code(join(ROOT, "app/app/brand-kits/[id]/reveal/page.tsx"));
    expect(EXPLICIT_CHECK.test(source)).toBe(false);
    expect(source).not.toContain("/app/checkout");
  });
});
