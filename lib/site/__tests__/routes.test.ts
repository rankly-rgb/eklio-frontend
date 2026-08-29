import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/*
 * Les routes de l'éditeur de site forwardent le JWT — et NE PEUVENT PAS
 * retomber sur `service_role`.
 *
 * ── Pourquoi ce test existe ──────────────────────────────────────────────
 *
 * `auth.uid()` cadre les huit fonctions du contrat. Sur une connexion
 * `service_role` il vaut NULL, et toute écriture répond `unauthenticated` :
 * l'appel ne donne PAS les données de quelqu'un d'autre, il ne marche pas du
 * tout. C'est le genre de panne qui n'apparaît qu'en production, sur le compte
 * d'une praticienne, et jamais dans un test de rendu.
 *
 * Le balayage REMONTE la chaîne d'imports locaux, comme
 * `app/__tests__/max-duration.test.ts` : une route qui importerait un helper
 * qui, lui, ouvre un client admin serait attrapée aussi.
 */

const ROOT = resolve(__dirname, "../../..");
const APP_DIR = join(ROOT, "app");

/*
 * Ce qu'on cherche : un APPEL au client admin, ou une lecture directe de la
 * clé de service. Pas une mention — `lib/supabase/server.ts` est
 * inévitablement atteignable (c'est lui qui porte aussi le client de session)
 * et il DÉFINIT `createAdminClient` ; le commentaire de `lib/site/rpc.ts`
 * explique pourquoi on ne s'en sert pas. Chercher le mot attraperait les deux.
 */
const SERVICE_ROLE_CALLS = [
  /\bcreateAdminClient\s*\(/,
  /process\.env\.SUPABASE_SERVICE_ROLE_KEY/,
];

/** Le module qui définit le client admin — sa définition n'est pas un usage. */
const ADMIN_CLIENT_DEFINITION = "lib/supabase/server.ts";

/** Retire commentaires de bloc et de ligne : on lit du code, pas de la prose. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function findFiles(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return findFiles(full, keep);
    return keep(entry.name) ? [full] : [];
  });
}

function resolveImport(spec: string, fromFile: string): string | null {
  const base = spec.startsWith("@/")
    ? join(ROOT, spec.slice(2))
    : spec.startsWith(".")
      ? join(dirname(fromFile), spec)
      : null;
  if (base === null) return null;

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Tous les fichiers locaux atteignables depuis un point d'entrée. */
function reachableFrom(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    for (const match of readFileSync(file, "utf8").matchAll(
      /from\s+["']([^"']+)["']/g
    )) {
      const resolved = resolveImport(match[1], file);
      if (resolved) queue.push(resolved);
    }
  }
  return [...seen];
}

/** Les routes et la page de l'éditeur — tout ce qui parle aux huit RPC. */
const SITE_ENTRY_POINTS = [
  ...findFiles(join(APP_DIR, "api/brand-kits/[id]"), (name) => name === "route.ts").filter(
    (file) => /\/site-(spec|output)\//.test(file) || /\/site-(spec|output)\/route\.ts$/.test(file)
  ),
  join(APP_DIR, "app/brand-kits/[id]/site/page.tsx"),
];

function relative(file: string): string {
  return file.slice(ROOT.length + 1).replace(/\\/g, "/");
}

describe("les points d'entrée de l'éditeur de site", () => {
  it("le balayage trouve bien les routes", () => {
    // Sans cette garde, un balayage cassé rendrait tout le reste vacuously
    // true — le pire des faux verts.
    expect(SITE_ENTRY_POINTS.length).toBeGreaterThanOrEqual(7);
    for (const file of SITE_ENTRY_POINTS) expect(existsSync(file)).toBe(true);
  });

  it.each(SITE_ENTRY_POINTS.map((file) => [relative(file), file] as const))(
    "%s n'atteint jamais service_role",
    (_label, entry) => {
      const offenders = reachableFrom(entry)
        .filter((file) => relative(file) !== ADMIN_CLIENT_DEFINITION)
        .filter((file) => {
          const source = stripComments(readFileSync(file, "utf8"));
          return SERVICE_ROLE_CALLS.some((pattern) => pattern.test(source));
        });

      expect(offenders.map(relative)).toEqual([]);
    }
  );

  it.each(
    SITE_ENTRY_POINTS.filter((file) => file.endsWith("route.ts")).map(
      (file) => [relative(file), file] as const
    )
  )("%s s'authentifie avant d'appeler quoi que ce soit", (_label, file) => {
    const source = readFileSync(file, "utf8");

    // `authenticate()` rend le client de session — clé anon + cookies, donc
    // le jeton de l'appelante en `Authorization`. C'est LUI qui est forwardé.
    expect(source).toContain("authenticate()");
    expect(source).toContain("auth.session.supabase");
    expect(source).toMatch(/if \(!auth\.ok\) return auth\.response;/);
  });
});

describe("les huit entrées du contrat, et rien d'autre", () => {
  const rpcSource = readFileSync(join(ROOT, "lib/site/rpc.ts"), "utf8");

  it.each([
    "site_spec_get",
    "site_spec_patch",
    "site_spec_reset",
    "site_spec_set_target",
    "site_output_get",
    "site_output_mark_copied",
    "site_spec_fix_contrast",
    "site_catalog",
  ])("%s est appelée par la couche RPC", (fn) => {
    expect(rpcSource).toContain(`"${fn}"`);
  });

  it("l'ancien chemin `/site-prompt` a bien disparu", () => {
    // Il composait le prompt DANS ce dépôt. Deux sources pour un même texte, ça
    // finit par en donner deux différents.
    expect(
      existsSync(join(APP_DIR, "api/brand-kits/[id]/site-prompt/route.ts"))
    ).toBe(false);
    expect(existsSync(join(ROOT, "components/kit/site-prompt-block.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "components/kit/copy-site-prompt.tsx"))).toBe(false);
  });

  it("aucune route n'écrit brand_kits.site_prompt", () => {
    /*
     * C'est un CACHE que la base rafraîchit à chaque écriture du spec, gardé
     * pour que les consommateurs existants continuent de marcher. La flèche ne
     * va que dans un sens.
     *
     * `types/supabase.ts` est exclu : il DÉCLARE la colonne, ce qui n'est pas
     * l'écrire. Le motif est borné (`\\b`) pour viser la colonne et non
     * l'événement d'analytique `site_prompt_copied`, qui est un autre mot.
     */
    const offenders = new Set<string>();
    for (const entry of SITE_ENTRY_POINTS) {
      for (const file of reachableFrom(entry)) {
        if (relative(file) === "types/supabase.ts") continue;
        if (/\bsite_prompt\b/.test(stripComments(readFileSync(file, "utf8")))) {
          offenders.add(relative(file));
        }
      }
    }
    expect([...offenders]).toEqual([]);
  });
});
