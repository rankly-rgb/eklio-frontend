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
 * ⚠ VIDE, ET C'EST L'ÉTAT FORT.
 *
 * Cette carte portait UN appelant garé : le cron mensuel, qui écrivait encore
 * la vieille table. La session 2 du chantier Content a supprimé le cron ET son
 * générateur (`lib/generation/monthly.ts`), et la migration 20260910082539 a
 * retiré la table elle-même, ses deux RPC, le genre de notification
 * `content_ready` et l'index partiel dont la clé était la forme du payload.
 *
 * « Zéro appelant » est une invariante plus forte que « un seul appelant » :
 * il n'y a plus d'exemption à faire grandir. Une entrée rajoutée ici
 * ressusciterait un modèle de mois qui n'existe plus en base — l'ajout
 * échouerait de toute façon à l'exécution, mais il doit d'abord échouer ici,
 * à la lecture.
 */
const PARKED: Record<string, string> = {};

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

  it("plus aucun appelant n'est garé", () => {
    /*
     * L'assertion a changé de sens avec la session 2 : elle vérifiait qu'une
     * exemption ne survivait pas au fichier qu'elle exemptait ; elle vérifie
     * maintenant qu'il n'y en a plus aucune. La boucle reste, parce que le
     * jour où quelqu'un en rajoute une, elle doit encore exiger un motif
     * écrit — mais le compte, lui, doit être zéro.
     */
    for (const [path, reason] of Object.entries(PARKED)) {
      expect(FILES).toContain(path);
      expect(reason.length).toBeGreaterThan(80);
    }
    expect(Object.keys(PARKED)).toEqual([]);
  });

  it("le cron mensuel et son générateur n'existent plus", () => {
    // Supprimés plutôt que portés : le nouveau système a d'autres entrées,
    // d'autres contraintes, une autre table de sortie et une autre
    // architecture d'images. Porter aurait fait entrer les hypothèses de
    // l'ancien modèle dans le nouveau — la dérive que ce chantier existe pour
    // arrêter.
    for (const gone of [
      "app/api/cron/monthly/route.ts",
      "lib/generation/monthly.ts",
      "lib/presence/month.ts",
    ]) {
      expect(FILES).not.toContain(gone);
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
