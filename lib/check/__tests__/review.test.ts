import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { reviewText } from "@/lib/check/review";
import { rewriteAndRescan, MAX_REWRITE_ATTEMPTS } from "@/lib/check/rewrite";
import type { EthicsRule } from "@/lib/catalog/types";

/*
 * ── CE QUE CE FICHIER TIENT, PAR ORDRE D'IMPORTANCE ─────────────────────
 *
 * 1. LA SORTIE DU MODÈLE EST RE-SCANNÉE. C'est le point du lot. Un modèle à
 *    qui l'on demande de retirer une garantie produit très souvent une
 *    garantie plus douce, et une réécriture rendue sans contrôle est PIRE
 *    qu'aucune réécriture : elle est crue davantage, précisément parce
 *    qu'Eklio l'a donnée.
 * 2. L'ÉCHEC EST DIT. Quand la réécriture enfreint encore, `resolved` est faux
 *    et `after` liste ce qu'elle enfreint. Rien n'est masqué.
 * 3. AUCUN SCORE, AUCUN POURCENTAGE, AUCUN « COMPLIANT » nulle part sur cette
 *    surface.
 *
 * Le réécriveur est INJECTÉ : aucun test ici ne dépense un centime.
 */

const RULES: EthicsRule[] = [
  {
    id: "proven",
    short_label: "No promised outcomes",
    description: "Never claim a result. Therapy has no guaranteed outcome.",
    example_forbidden: "heals your anxiety",
    active: true,
    sort_order: 1,
  } as EthicsRule,
];

/** Enfreint `proven` : un verbe de résolution suivi d'une condition. */
const DIRTY = "I heal anxiety, and my method is proven.";
/** La réécriture ADOUCIE — la panne exacte que le re-scan existe pour attraper. */
const SOFTENED = "My approach will help you heal your anxiety.";
const CLEAN = "A quiet room in Austin for people who want to think things through.";

describe("le scan déterministe", () => {
  it("trouve la règle enfreinte et cite ses mots à elle", () => {
    const review = reviewText(DIRTY, RULES);
    expect(review.clear).toBe(false);
    expect(review.findings[0]?.ruleId).toBe("proven");
    expect(review.findings[0]?.excerpt).toContain("heal anxiety");
  });

  it("prend le texte de la RÈGLE en base, pas celui du pattern", () => {
    // Corriger une règle en base corrige ce qu'elle lit, sans déploiement.
    expect(reviewText(DIRTY, RULES).findings[0]?.description).toBe(
      "Never claim a result. Therapy has no guaranteed outcome."
    );
  });

  it("une règle absente de la table ne rend pas la consigne muette", () => {
    const withoutRules = reviewText(DIRTY, []);
    expect(withoutRules.findings[0]?.description.length).toBeGreaterThan(10);
    expect(withoutRules.findings[0]?.label).toBe("proven");
  });

  it("un texte propre ne trouve rien, et « clear » ne veut dire que ça", () => {
    const review = reviewText(CLEAN, RULES);
    expect(review.findings).toEqual([]);
    expect(review.clear).toBe(true);
  });
});

describe("⚠ la sortie du modèle est RE-SCANNÉE", () => {
  it("une réécriture qui adoucit la promesse est attrapée", async () => {
    // LE test de ce lot. Le modèle remplace « heal anxiety » par « help you
    // heal your anxiety » — la même promesse, en plus long. Sans re-scan,
    // Eklio la lui rendrait comme si elle était réglée.
    const rewrite = vi.fn(async () => SOFTENED);
    const outcome = await rewriteAndRescan(DIRTY, RULES, rewrite);

    expect(outcome.resolved).toBe(false);
    expect(outcome.after.some((finding) => finding.ruleId === "proven")).toBe(true);
    // Et elle est RENDUE quand même : cacher l'échec la laisserait sans rien.
    expect(outcome.text).toBe(SOFTENED);
  });

  it("une réécriture propre passe, et le dit", async () => {
    const rewrite = vi.fn(async () => CLEAN);
    const outcome = await rewriteAndRescan(DIRTY, RULES, rewrite);

    expect(outcome.resolved).toBe(true);
    expect(outcome.after).toEqual([]);
    expect(outcome.text).toBe(CLEAN);
    expect(outcome.attempts).toBe(1);
  });

  it("une seule reprise, jamais une boucle", async () => {
    const rewrite = vi.fn(async () => SOFTENED);
    const outcome = await rewriteAndRescan(DIRTY, RULES, rewrite);

    expect(rewrite).toHaveBeenCalledTimes(MAX_REWRITE_ATTEMPTS);
    expect(outcome.attempts).toBe(MAX_REWRITE_ATTEMPTS);
    expect(MAX_REWRITE_ATTEMPTS).toBe(2);
  });

  it("la seconde tentative reçoit ce qui reste, pas la demande d'origine", async () => {
    // Redemander la même chose au même modèle est une dépense pour rien.
    const seen: string[] = [];
    const rewrite = vi.fn(async (_system: string, instruction: string) => {
      seen.push(instruction);
      return SOFTENED;
    });
    await rewriteAndRescan(DIRTY, RULES, rewrite);

    expect(seen[0]).toContain("heal anxiety");
    expect(seen[1]).toContain("heal your anxiety");
  });
});

describe("l'argent", () => {
  it("un texte déjà propre n'atteint JAMAIS le modèle", async () => {
    // Donc il ne peut pas coûter un crédit : la garde est structurelle, pas
    // une condition dans la route.
    const rewrite = vi.fn(async () => "should never be called");
    const outcome = await rewriteAndRescan(CLEAN, RULES, rewrite);

    expect(rewrite).not.toHaveBeenCalled();
    expect(outcome.attempts).toBe(0);
    expect(outcome.resolved).toBe(true);
    expect(outcome.text).toBe(CLEAN);
  });

  it("une réponse vide laisse SON texte intact et se déclare inchangée", async () => {
    // Une boîte vide ressemble à des mots effacés. On rend les siens.
    const outcome = await rewriteAndRescan(DIRTY, RULES, async () => "   ");
    expect(outcome.unchanged).toBe(true);
    expect(outcome.text).toBe(DIRTY);
    expect(outcome.resolved).toBe(false);
  });
});

describe("aucun score, aucun pourcentage, aucun « compliant »", () => {
  /*
   * Trois refus, et ils sont tenus par un test parce qu'ils sont exactement
   * ce qu'une session pressée rajoute pour « rendre l'écran plus lisible ».
   */
  const ROOT = resolve(__dirname, "../../..");
  const SURFACES = [
    "lib/check/review.ts",
    "lib/check/rewrite.ts",
    "components/check/check-view.tsx",
    "app/app/check/page.tsx",
    "app/api/check/route.ts",
    "app/api/check/rewrite/route.ts",
  ];

  const FORBIDDEN = ["compliant", "compliance score", "score", "percentage", "% safe", "passRate"];

  function code(path: string): string {
    return readFileSync(join(ROOT, path), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  }

  it("les cinq surfaces existent", () => {
    for (const path of SURFACES) expect(code(path).length).toBeGreaterThan(100);
  });

  it.each(SURFACES)("%s n'affiche ni score ni verdict", (path) => {
    const body = code(path).toLowerCase();
    const found = FORBIDDEN.filter((needle) => body.includes(needle.toLowerCase()));
    expect(
      found,
      `${path} introduit un verdict : ${found.join(", ")}.\n` +
        "Un score serait un nombre qu'Eklio ne sait pas calculer, et « compliant »\n" +
        "est une conclusion juridique alors qu'il s'agit de six expressions régulières."
    ).toEqual([]);
  });

  it("la règle est appliquée, pas vacuously vraie", () => {
    const canary = 'return <p>Your copy is 92% compliant.</p>;';
    expect(FORBIDDEN.filter((needle) => canary.toLowerCase().includes(needle))).toEqual([
      "compliant",
    ]);
  });
});

describe("son texte n'est jamais conservé", () => {
  const ROOT = resolve(__dirname, "../../..");

  function walk(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const child = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(child);
      return /\.tsx?$/.test(entry.name) ? [child] : [];
    });
  }

  const FILES = [...walk("lib/check"), ...walk("app/api/check"), ...walk("components/check")];

  it("l'énumération trouve bien les fichiers", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(4);
  });

  it.each(FILES)("%s n'écrit nulle part ce qu'elle a collé", (path) => {
    const body = readFileSync(join(ROOT, path), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // Aucune persistance d'aucune sorte sur cette surface.
    for (const forbidden of [".insert(", ".upsert(", ".update(", "localStorage", "sessionStorage"]) {
      expect(body, `${path} persiste quelque chose`).not.toContain(forbidden);
    }
    // Et le texte ne part pas non plus dans une propriété d'analytics.
    expect(body).not.toMatch(/track\([^)]*\btext\b/);
  });
});
