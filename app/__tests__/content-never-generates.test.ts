import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * ── LOT 6 NE GÉNÈRE RIEN, ET C'EST VÉRIFIÉ PLUTÔT QU'ÉCRIT ──────────────
 *
 * Le calendrier, l'éditeur et le journal de publication sont de l'ÉCRITURE :
 * chaque mot y est tapé par elle. Aucun de ces chemins ne doit atteindre un
 * crédit de génération, le budget d'images, ni le client du modèle.
 *
 * Deux raisons de le tenir par un test :
 *
 *   1. C'est de l'argent. `consume_generation_credit` prélève un crédit
 *      qu'elle a payé, et un autosave qui l'appellerait une fois par frappe
 *      viderait son compte sans que rien ne casse visiblement.
 *   2. Le lot suivant remplira ces mêmes légendes avec un modèle. Le jour où
 *      il le fera, ce test doit devenir rouge et forcer une décision explicite
 *      — pas laisser un appel s'ajouter en silence dans un fichier d'éditeur.
 *
 * ⚠ CE QUI EST AUTORISÉ, ET POURQUOI : la page d'un item LIT `brand_images`
 * (`getBrandImages`, `computeImageFingerprint`, `loadImageContext`) pour
 * donner une source à `<PhotoSlot>` quand une photographie existe déjà. Lire
 * n'est pas générer. Ce sont les chemins de DÉPENSE qui sont interdits, et ils
 * sont nommés un par un ci-dessous.
 */

const ROOT = resolve(__dirname, "../..");

/** Les surfaces de LOT 6, toutes. */
const CONTENT_PATHS = [
  "lib/data/content.ts",
  "lib/content",
  "app/api/brand-kits/[id]/content",
  "app/api/brand-kits/[id]/publishing-log",
  "app/api/content-items",
  "app/app/content",
  "components/content",
];

/** Tout ce qui coûte de l'argent, par son nom d'appel. */
const SPENDING = [
  "consume_generation_credit",
  "consumeGenerationCredit",
  "hasGenerationCredit",
  "release_generation_credit",
  "image_budget_cents",
  "reserve_image_regeneration",
  "reserveImageRegeneration",
  "settleImageRegeneration",
  "generateBrandImage",
  "openAiImageClient",
  "openAiImageClientFromEnv",
  "OPENAI_API_KEY",
  "anthropic",
  "Anthropic",
];

function walk(path: string): string[] {
  const full = join(ROOT, path);
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return walk(child);
    return /\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

function files(): string[] {
  return CONTENT_PATHS.flatMap((path) =>
    /\.tsx?$/.test(path) ? (existsSync(join(ROOT, path)) ? [path] : []) : walk(path)
  );
}

const FILES = files();

/** Le code seul : un commentaire qui NOMME un chemin de dépense ne dépense rien. */
function code(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("l'énumération elle-même", () => {
  it("trouve bien les fichiers du lot", () => {
    // Sans cette garde, un balayage cassé rendrait tout le reste vacuously
    // true — le pire des faux verts, et sur le sujet de l'argent.
    expect(FILES.length).toBeGreaterThanOrEqual(8);
  });

  it("couvre chacune des trois surfaces", () => {
    expect(FILES.some((path) => path.startsWith("app/app/content"))).toBe(true);
    expect(FILES.some((path) => path.startsWith("app/api/content-items"))).toBe(true);
    expect(FILES.some((path) => path.startsWith("components/content"))).toBe(true);
  });
});

describe("aucune surface de contenu n'atteint un chemin de dépense", () => {
  it.each(FILES)("%s", (path) => {
    const source = code(path);
    const found = SPENDING.filter((needle) => source.includes(needle));
    expect(
      found,
      `${path} atteint un chemin de dépense : ${found.join(", ")}.\n` +
        "Écrire une légende n'est pas une génération. Si un lot ultérieur ajoute\n" +
        "vraiment un modèle ici, c'est une décision explicite : elle change ce\n" +
        "test, elle ne le contourne pas."
    ).toEqual([]);
  });

  it("l'énumération interdite est bien appliquée, pas vacuously vraie", () => {
    // Témoin : une chaîne fautive DOIT être attrapée par la même règle.
    const canary = "await supabase.rpc('consume_generation_credit', { p_brand_kit_id: id });";
    expect(SPENDING.filter((needle) => canary.includes(needle))).toEqual([
      "consume_generation_credit",
    ]);
  });
});

describe("la lecture d'une photographie reste permise, et reste une lecture", () => {
  it("la page d'un item lit brand_images sans jamais en demander une", () => {
    const source = code("app/app/content/[id]/page.tsx");
    // Elle lit…
    expect(source).toContain("getBrandImages");
    // …et ne réclame rien : ni réclamation d'emplacement, ni marquage.
    for (const write of ["claimBrandImage", "markBrandImageReady", "markBrandImageFailed"]) {
      expect(source).not.toContain(write);
    }
  });

  it("il n'y a qu'un seul motif de photographie : PhotoSlot", () => {
    // Pas de second squelette de chargement inventé pour l'occasion.
    const editor = code("components/content/item-editor.tsx");
    expect(editor).toContain("<PhotoSlot");
    expect(editor).not.toContain("Skeleton");
    expect(editor).not.toContain("animate-pulse");
  });
});
