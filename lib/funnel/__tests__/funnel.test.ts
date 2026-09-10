import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { safeProps } from "@/lib/funnel/sink";

const ROOT = resolve(__dirname, "../../..");

function walk(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "__tests__" || entry === "node_modules" ? [] : walk(full, keep);
    }
    return keep(entry) ? [full] : [];
  });
}

/**
 * Le source sans ses commentaires.
 *
 * ⚠ SANS ÇA, LA RÈGLE ATTRAPE SA PROPRE PROSE. Le premier passage a échoué sur
 * `app/api/briefs/[id]/route.ts`, dont un commentaire EXPLIQUE que
 * `funnel_report` compte des projets distincts — une phrase qui décrit la
 * règle, pas une lecture de la table. Une garde qui punit l'explication de
 * la garde finit par faire supprimer l'explication.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const APP_FILES = walk(
  join(ROOT, "app"),
  (name) => name.endsWith(".ts") || name.endsWith(".tsx")
).map((path) => ({
  relative: path.slice(ROOT.length + 1),
  source: stripComments(readFileSync(path, "utf8")),
}));

/*
 * ── LA MESURE N'INFORME AUCUN ÉCRAN ─────────────────────────────────────
 *
 * C'est la contrainte de fond du lot, et c'est celle qui se perd le plus
 * facilement : le jour où un chiffre du tunnel apparaît dans le produit, il
 * cesse d'être une mesure et devient une affirmation sur d'autres personnes.
 * « Douze praticiennes ont choisi cette direction cette semaine » est une
 * phrase qu'Eklio ne dira jamais.
 *
 * La règle est donc structurelle plutôt que morale : rien sous `app/` ne
 * NOMME la table ni son rapport. L'écriture passe par `track()`, qui passe par
 * `lib/funnel/sink.ts`, qui est le seul chemin — et la lecture n'a aucun
 * chemin du tout depuis le produit.
 */
const FORBIDDEN_IN_APP = [
  "funnel_report",
  "funnel_events",
  "funnel_steps",
  "purge_funnel_events",
] as const;

/*
 * La seule exception, nommée : le cron de rétention SUPPRIME des lignes, il
 * n'en lit aucune et n'en rend aucune. Il n'informe donc rien — il n'y a
 * personne devant lui. Toute autre entrée dans cette liste voudrait dire que
 * le produit s'est mis à lire son propre tunnel, ce qui est exactement ce que
 * ce fichier existe pour empêcher.
 */
const APP_EXEMPT = ["app/api/cron/purge-events/route.ts"];

describe("⚠ le tunnel n'informe aucun écran du produit", () => {
  it("le balayage trouve bien la surface — sinon ce fichier ne prouve rien", () => {
    expect(APP_FILES.length).toBeGreaterThan(60);
    expect(APP_FILES.some((f) => f.relative === "app/page.tsx")).toBe(true);
  });

  it.each(FORBIDDEN_IN_APP)("aucun fichier de `app/` ne nomme `%s`", (needle) => {
    const offenders = APP_FILES.filter(
      (file) => file.source.includes(needle) && !APP_EXEMPT.includes(file.relative)
    );
    expect(offenders.map((file) => file.relative)).toEqual([]);
  });

  it("la seule lecture du dépôt est le script, et il vit hors de `app/`", () => {
    const reader = readFileSync(join(ROOT, "scripts/funnel.ts"), "utf8");
    expect(reader).toContain("funnel_report");
    // Et il exige la clé de service, donc il ne peut pas être appelé depuis
    // un navigateur même si quelqu'un l'importait.
    expect(reader).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("CANARY — la règle mord", () => {
    const fake = 'const rows = await supabase.rpc("funnel_report", {});';
    expect(FORBIDDEN_IN_APP.some((needle) => fake.includes(needle))).toBe(true);
  });
});

/*
 * ── CE QUI NE PEUT PAS PARTIR AVEC UN ÉVÉNEMENT ─────────────────────────
 *
 * La vraie défense est le CHECK `funnel_props_are_safe` en base : il ne peut
 * pas être oublié par un nouvel appelant. `safeProps` le DOUBLE côté client
 * pour que la charge fautive soit rognée plutôt que de perdre l'événement
 * entier sur une violation de contrainte — les seuils des deux doivent donc
 * rester identiques, et ces tests figent les seuils.
 */
describe("safeProps — les seuils sont ceux du CHECK en base", () => {
  it("laisse passer ce que le produit envoie vraiment", () => {
    const props = { step: 4, projectId: "abc", reason: "ip_cap", ok: true, id: null };
    expect(safeProps(props)).toEqual(props);
  });

  it("⚠ jette une chaîne de plus de 64 caractères, et dit qu'elle a été jetée", () => {
    // 65 caractères : la première longueur que la base refuse.
    const result = safeProps({ quote: "x".repeat(65), step: 4 });
    expect(result.quote).toBeUndefined();
    expect(result.step).toBe(4);
    // Le FAIT qu'on ait tenté vaut d'être su ; son contenu, jamais.
    expect(result.dropped_props).toBe(1);
  });

  it("garde une chaîne de 64 caractères — la borne est inclusive des deux côtés", () => {
    const sixtyFour = "y".repeat(64);
    expect(safeProps({ id: sixtyFour }).id).toBe(sixtyFour);
  });

  it("jette une clé trop longue", () => {
    const result = safeProps({ ["k".repeat(41)]: 1, step: 2 });
    expect(Object.keys(result).sort()).toEqual(["dropped_props", "step"]);
  });

  it("ne dépasse jamais douze clés une fois le marqueur ajouté", () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < 30; i += 1) wide[`k${i}`] = i;
    const result = safeProps(wide);
    expect(Object.keys(result).length).toBeLessThanOrEqual(12);
    expect(result.dropped_props).toBe(19);
  });

  it("ne fabrique pas de marqueur quand rien n'a été jeté", () => {
    expect(safeProps({ step: 1 })).toEqual({ step: 1 });
  });
});

/*
 * ── LE SEUL POINT D'ENTRÉE NON AUTHENTIFIÉ ──────────────────────────────
 *
 * `POST /api/e` écrit dans une table sans qu'on sache qui appelle. Ce qui rend
 * ça acceptable est UNIQUEMENT que son vocabulaire soit fermé : deux noms, pas
 * de propriétés, pas d'identifiants. Lu dans la source plutôt qu'exécuté —
 * une route Next a besoin d'un contexte de requête, et c'est la FORME du
 * fichier qui porte la garantie.
 */
describe("⚠ la balise publique a un vocabulaire fermé", () => {
  const source = stripComments(
    readFileSync(join(ROOT, "app/api/e/route.ts"), "utf8")
  );

  it("n'accepte que les deux noms de la phase « reach »", () => {
    expect(source).toMatch(
      /const PUBLIC_EVENTS = \["landing_viewed", "pricing_viewed"\] as const;/
    );
  });

  it("ne lit aucune propriété du corps de la requête", () => {
    // Un `props` accepté depuis le navigateur serait un champ de texte libre
    // ouvert sur une table — exactement ce que le CHECK existe pour empêcher.
    expect(source).not.toMatch(/\bprops\b/);
    expect(source).not.toMatch(/projectId|brandKitId|userId/);
  });

  it("ne lit ni n'écrit de cookie", () => {
    expect(source).not.toMatch(/cookies\(\)|document\.cookie|set-cookie/i);
  });

  it("est limitée en débit et ne répond jamais autre chose que 204", () => {
    expect(source).toMatch(/rateLimit\(/);
    expect(source).not.toMatch(/status:\s*(?!204)\d{3}/);
  });
});

/*
 * ── LA FRONTIÈRE QUI N'EN ÉTAIT PAS UNE ─────────────────────────────────
 *
 * `lib/analytics.ts` porte « SERVEUR UNIQUEMENT » dans son en-tête depuis le
 * premier jour, et deux composants CLIENT l'importaient quand même —
 * `asset-library-view.tsx` et `in-situ-panel.tsx`. Ça compilait, parce que
 * `track()` ne faisait qu'un `console.info` : rien ne distinguait un appel
 * serveur d'un appel navigateur. Ces événements-là partaient dans la console
 * de la praticienne et nulle part ailleurs.
 *
 * `next build` a fini par le dire, mais seulement le jour où `track()` a ouvert
 * un client Supabase. Une phrase dans un en-tête n'est pas une frontière ; ce
 * test en est une.
 */
describe("⚠ aucun composant client n'importe l'écrivain serveur", () => {
  const CLIENT_FILES = [
    ...walk(join(ROOT, "components"), (name) => name.endsWith(".tsx") || name.endsWith(".ts")),
    ...walk(join(ROOT, "app"), (name) => name.endsWith(".tsx") || name.endsWith(".ts")),
  ]
    .map((path) => ({
      relative: path.slice(ROOT.length + 1),
      source: readFileSync(path, "utf8"),
    }))
    .filter((file) => /^\s*["']use client["']/.test(file.source));

  it("le balayage trouve bien des composants client", () => {
    // Sans cette garde, une regex cassée rendrait la règle vacuously vraie.
    expect(CLIENT_FILES.length).toBeGreaterThan(20);
  });

  it("aucun n'importe `@/lib/analytics`", () => {
    const offenders = CLIENT_FILES.filter((file) =>
      /from\s+["']@\/lib\/analytics["']/.test(stripComments(file.source))
    );
    expect(offenders.map((file) => file.relative)).toEqual([]);
  });

  it("aucun n'importe l'évier, ni `next/headers`", () => {
    const offenders = CLIENT_FILES.filter((file) => {
      const code = stripComments(file.source);
      return (
        /from\s+["']@\/lib\/funnel\/sink["']/.test(code) ||
        /from\s+["']next\/headers["']/.test(code)
      );
    });
    expect(offenders.map((file) => file.relative)).toEqual([]);
  });

  it("CANARY — la règle mord", () => {
    const fake = '"use client";\nimport { track } from "@/lib/analytics";';
    expect(/^\s*["']use client["']/.test(fake)).toBe(true);
    expect(/from\s+["']@\/lib\/analytics["']/.test(fake)).toBe(true);
    // ... et ne confond pas le module client avec le module serveur.
    expect(
      /from\s+["']@\/lib\/analytics["']/.test('import { trackClient } from "@/lib/analytics-client";')
    ).toBe(false);
  });
});
