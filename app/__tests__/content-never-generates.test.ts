import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * ── CE TEST EST DEVENU ROUGE, ET C'ÉTAIT PRÉVU ──────────────────────────
 *
 * Sa version d'origine interdisait TOUT chemin de dépense sur TOUTE surface
 * de contenu, et elle disait d'elle-même ce qui suit :
 *
 *   « Le lot suivant remplira ces mêmes légendes avec un modèle. Le jour où
 *     il le fera, ce test doit devenir rouge et forcer une décision explicite
 *     — pas laisser un appel s'ajouter en silence dans un fichier d'éditeur. »
 *
 * Ce jour est arrivé : `lib/content/generate/` écrit le mois. La décision est
 * donc prise ici, explicitement, et la règle est RESSERRÉE plutôt
 * qu'assouplie — parce que la question n'a jamais été « est-ce que le contenu
 * dépense » mais « QUELLE bourse ».
 *
 * ── LES DEUX RÈGLES, MAINTENANT ─────────────────────────────────────────
 *
 * 1. LES SURFACES D'ÉCRITURE NE DÉPENSENT TOUJOURS RIEN, ET C'EST ABSOLU.
 *    Le calendrier, l'éditeur, le journal, les routes qu'elle touche : chaque
 *    mot y est tapé par elle. Un autosave qui appellerait un crédit une fois
 *    par frappe viderait son compte sans que rien ne casse visiblement.
 *
 * 2. LE GÉNÉRATEUR DÉPENSE, MAIS SUR UNE SEULE BOURSE. Il y en a trois dans
 *    ce produit et les confondre serait un vol :
 *
 *      • `content_image_allowance` — mensuelle, remise à zéro par
 *        construction, attachée à l'abonnement à 39 $. LA SIENNE.
 *      • `plans.image_budget_cents` — une cagnotte À VIE attachée à un achat
 *        unique. Elle a payé sept photographies avec son kit ; cet argent est
 *        à elle jusqu'à ce qu'elle le dépense.
 *      • `consume_generation_credit` — les régénérations de direction.
 *
 *    Le générateur ne doit atteindre QUE la première, et ce test le vérifie
 *    fichier par fichier plutôt que de le faire confiance à une revue.
 */

const ROOT = resolve(__dirname, "../..");

/*
 * ── ⚠ LA RÈGLE S'EST RESSERRÉE UNE SECONDE FOIS, ET VOICI POURQUOI ──────
 *
 * « Write it » met un chemin de dépense DANS `app/api/content-items`, qui est
 * une de ses surfaces d'écriture. Ce test est devenu rouge, ce qui est
 * exactement son travail : il a forcé la décision au lieu de laisser l'appel
 * s'ajouter en silence.
 *
 * La décision : **une seule route de cette surface dépense, elle est nommée
 * ici, et elle ne peut toucher QUE la bourse des régénérations.** Tout le
 * reste de l'arbre reste absolu — l'autosave, la publication, le journal, le
 * swap. Un autosave qui appellerait un crédit une fois par frappe viderait
 * son compte sans que rien ne casse visiblement.
 *
 * ⚠ ET L'EXEMPTION EST UN CHEMIN EXACT, PAS UN PRÉFIXE. `write/route.ts`,
 * pas `write*` : une seconde route ajoutée à côté devrait repasser par cette
 * décision.
 */
const SPENDS_ON_PURPOSE = ["app/api/content-items/[id]/write/route.ts"];

/** Les surfaces d'ÉCRITURE : ce qu'elle tape, et ce qui l'affiche. */
const HER_SURFACES = [
  "lib/data/content.ts",
  "lib/content/respond.ts",
  "app/api/brand-kits/[id]/content",
  "app/api/brand-kits/[id]/publishing-log",
  "app/api/content-items",
  "app/app/content",
  "components/content",
];

/** La surface qui GÉNÈRE, et elle seule. */
const GENERATOR = "lib/content/generate";

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

/**
 * Les bourses INTERDITES au générateur : les deux qui ne sont pas la sienne.
 * Tout le reste de `SPENDING` lui est permis — un modèle qui écrit une légende
 * est précisément ce qu'il est là pour faire.
 */
const WRONG_PURSE = [
  "consume_generation_credit",
  "consumeGenerationCredit",
  "hasGenerationCredit",
  "release_generation_credit",
  "image_budget_cents",
  "reserve_image_regeneration",
  "reserveImageRegeneration",
  "settleImageRegeneration",
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

function expand(paths: string[]): string[] {
  return paths.flatMap((path) =>
    /\.tsx?$/.test(path) ? (existsSync(join(ROOT, path)) ? [path] : []) : walk(path)
  );
}

const FILES = expand(HER_SURFACES).filter((path) => !SPENDS_ON_PURPOSE.includes(path));

/** La route qui dépense à dessein, éprouvée à part et plus durement. */
const DELIBERATE = expand(HER_SURFACES).filter((path) => SPENDS_ON_PURPOSE.includes(path));
const GENERATOR_FILES = expand([GENERATOR]);

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

  it("trouve le générateur, et ne le range pas parmi ses surfaces à elle", () => {
    expect(GENERATOR_FILES.length).toBeGreaterThanOrEqual(5);
    expect(FILES.some((path) => path.startsWith(GENERATOR))).toBe(false);
  });
});

describe("aucune surface d'écriture n'atteint un chemin de dépense", () => {
  it.each(FILES)("%s", (path) => {
    const source = code(path);
    const found = SPENDING.filter((needle) => source.includes(needle));
    expect(
      found,
      `${path} atteint un chemin de dépense : ${found.join(", ")}.\n` +
        "Écrire une légende n'est pas une génération. Ce qu'elle tape ne coûte\n" +
        "rien, et la génération vit dans lib/content/generate, pas ici."
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

describe("le générateur dépense, et sur la bonne bourse seulement", () => {
  it.each(GENERATOR_FILES)("%s", (path) => {
    const source = code(path);
    const found = WRONG_PURSE.filter((needle) => source.includes(needle));
    expect(
      found,
      `${path} atteint ${found.join(", ")}.\n` +
        "La dépense d'images de contenu tire sur content_image_allowance, qui se\n" +
        "remet à zéro chaque mois. Jamais sur la cagnotte à vie du kit, jamais sur\n" +
        "les crédits de régénération de direction : elle a payé les deux séparément."
    ).toEqual([]);
  });

  it("cette règle-là aussi mord", () => {
    const canary = "const remaining = plan.image_budget_cents - used;";
    expect(WRONG_PURSE.filter((needle) => canary.includes(needle))).toEqual([
      "image_budget_cents",
    ]);
  });

  it("et le générateur ne dépense que par un port injecté, jamais par une RPC en dur", () => {
    // ⚠ La réservation et le règlement passent par `AllowancePort`, que
    //   l'appelant fournit. Le pipeline ne connaît ni supabase ni le nom des
    //   RPC : c'est ce qui rend le sens interdit — dessiner d'abord, réserver
    //   ensuite — impossible à écrire par distraction.
    const pipeline = code("lib/content/generate/pipeline.ts");
    expect(pipeline).toContain("AllowancePort");
    expect(pipeline).not.toContain("supabase");
    expect(pipeline).not.toContain(".rpc(");
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

describe("⚠ LA SEULE ROUTE QUI DÉPENSE À DESSEIN", () => {
  it("elle existe, et l'exemption ne porte pas sur un fichier disparu", () => {
    /*
     * Une exemption qui ne correspond à rien est une exemption qui protégera
     * silencieusement le mauvais fichier le jour où quelqu'un renomme la
     * route.
     */
    expect(DELIBERATE).toEqual(SPENDS_ON_PURPOSE);
  });

  it.each(DELIBERATE)("%s ne touche QUE la bourse des régénérations", (path) => {
    const source = code(path);
    const wrong = WRONG_PURSE.filter((needle) => source.includes(needle));
    expect(
      wrong,
      `${path} atteint une bourse qui n'est pas la sienne : ${wrong.join(", ")}.\n` +
        "« Write it » se règle sur les régénérations (10 par mois) et sur rien\n" +
        "d'autre. Les photographies de marque sont une cagnotte À VIE payée avec\n" +
        "le kit, et les régénérations de direction sont un troisième compte."
    ).toEqual([]);
  });

  it.each(DELIBERATE)("%s réserve AVANT d'appeler le modèle", (path) => {
    /*
     * ⚠ L'ORDRE EST LA RÈGLE. Réserver après l'appel ferait découvrir un
     * quota épuisé une fois les jetons dépensés : Eklio aurait payé pour un
     * post qu'elle n'a pas le droit d'avoir.
     */
    const source = code(path);
    const reserve = source.indexOf("beginWrite");
    const call = source.indexOf("runOnDemandWrite");
    expect(reserve, "beginWrite absent").toBeGreaterThan(-1);
    expect(call, "runOnDemandWrite absent").toBeGreaterThan(-1);
    expect(reserve).toBeLessThan(call);
  });

  it.each(DELIBERATE)("%s relâche le crédit quand rien n'est produit", (path) => {
    // Un échec qui garde le crédit est un vol silencieux.
    expect(code(path)).toContain("releaseWrite");
  });
});
