import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * ── UN SEUL MODÈLE DE MOIS ──────────────────────────────────────────────
 *
 * L'accueil comptait `monthly_presence_content` (via `calendar_summary`)
 * pendant que `/app/content` rendait `content_items`. Deux modèles pour le
 * même mois, c'est la panne que ce dépôt fabrique en série : l'accueil dit un
 * nombre, le calendrier en montre un autre, et rien n'échoue. Pire ici : la
 * vieille table porte ZÉRO ligne, donc le nombre affiché n'était pas
 * seulement différent, il était vide.
 *
 * L'accueil est passé sur `content_items`. Ce test empêche le retour en
 * arrière : plus personne ne LIT ni n'ÉCRIT la vieille table, sauf le seul
 * appelant restant, nommé ci-dessous avec sa raison.
 */

const ROOT = resolve(__dirname, "../..");
const ROOTS = ["app", "components", "lib"];

/**
 * LE SEUL appelant restant, et pourquoi il l'est.
 *
 * Le cron mensuel écrit encore la vieille table. Il n'a JAMAIS été activé en
 * production — c'est l'état « construit, jamais allumé » que FINDINGS.md
 * enregistre depuis septembre, et c'est pourquoi la table est vide. Le
 * déplacer demande de décider comment un item GÉNÉRÉ et PAYANT vit dans une
 * table qu'elle peut éditer, ce qui est une décision produit, pas un
 * déplacement mécanique. Il reste donc où il est, à l'arrêt, et cette entrée
 * dit exactement pourquoi.
 */
const PARKED: Record<string, string> = {
  "app/api/cron/monthly/route.ts":
    "The Monthly Presence generation cron, built and never turned on. Porting it means deciding how a paid, generated item lives in a table she can edit -- a product decision, not a move. Until then it must not be enabled: it would write rows nothing reads.",
};

const OLD_MODEL = ["monthly_presence_content", "calendar_summary", "ensure_month_skeleton"];

function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(child);
    return /\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

/** Du CODE seulement : un commentaire qui NOMME la vieille table n'y touche pas. */
function code(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const FILES = ROOTS.flatMap((dir) => walk(dir));

describe("l'énumération elle-même", () => {
  it("balaye bien le dépôt", () => {
    // Un balayage cassé rendrait la garde vacuously true.
    expect(FILES.length).toBeGreaterThan(150);
  });

  it("l'appelant garé existe encore, et porte sa raison", () => {
    // Une exemption qui survit au fichier qu'elle exemptait couvrira le
    // prochain à porter ce nom.
    for (const [path, reason] of Object.entries(PARKED)) {
      expect(FILES).toContain(path);
      expect(reason.length).toBeGreaterThan(80);
    }
  });
});

describe("personne ne lit plus la vieille table", () => {
  it("aucun fichier hors PARKED ne la touche", () => {
    /*
     * Un seul test plutôt qu'un par fichier : trois cents lignes vertes ne
     * disent rien de plus qu'une, et l'échec doit nommer TOUS les contrevenants
     * d'un coup plutôt qu'un seul.
     */
    const offenders = FILES.filter((path) => !(path in PARKED))
      .map((path) => [path, OLD_MODEL.filter((needle) => code(path).includes(needle))] as const)
      .filter(([, found]) => found.length > 0)
      .map(([path, found]) => `${path} → ${found.join(", ")}`);

    expect(
      offenders,
      "Ces fichiers touchent l'ancien modèle de mois.\n" +
        "Il n'y a qu'un modèle : `content_items`. Si un nouvel appelant est vraiment\n" +
        "nécessaire, c'est une décision explicite — il s'inscrit dans PARKED avec sa\n" +
        "raison, il ne s'ajoute pas en silence."
    ).toEqual([]);
  });

  it("la règle est appliquée, pas vacuously vraie", () => {
    const canary = 'await supabase.rpc("calendar_summary", { p_user_id: userId });';
    expect(OLD_MODEL.filter((needle) => canary.includes(needle))).toEqual(["calendar_summary"]);
  });
});

describe("l'accueil et le calendrier comptent les mêmes lignes", () => {
  it("l'agrégat de l'accueil lit `get_content_month`", () => {
    const home = code("lib/data/home.ts");
    expect(home).toContain("getContentMonth");
    expect(home).not.toContain("loadCalendar");
  });

  it("la grille de l'accueil ne verrouille plus rien", () => {
    // Les tuiles verrouillées appartenaient au contenu généré POUR elle
    // derrière un abonnement. `content_items`, ce sont ses mots à elle : il
    // n'y a rien à déverrouiller, et rien à flouter.
    const grid = code("components/home/content-grid.tsx");
    expect(grid).not.toContain("lockedCount");
    expect(grid).not.toContain("MonthlyPresenceModal");
    expect(grid).not.toContain("unlock");
  });
});
