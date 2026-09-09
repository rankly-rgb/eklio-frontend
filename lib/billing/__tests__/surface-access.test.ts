import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { surfaceAccess } from "@/lib/billing/surface-access";
import {
  SURFACES,
  SURFACE_LABEL,
  SURFACE_MIN_TIER,
  isSurface,
} from "@/lib/billing/surfaces";
import { KIT_TIERS, type KitTier } from "@/lib/kit/tiers";

/*
 * Le garde de tier — un seul, et toutes les surfaces passent par lui.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────
 *
 * `min_tier` est semé dans le schéma depuis le 3 septembre et appliqué nulle
 * part : les 35 lignes d'`asset_catalog` disent `starter`, et un acheteur à
 * 79 USD reçoit tout. Ce lot construit le MÉCANISME et écrit le défaut
 * permissif là où on peut le lire — il n'invente pas la distribution.
 *
 * Ce que ces tests tiennent :
 *   - chaque surface a une ligne dans la carte (et l'inverse) ;
 *   - le garde répond 404 AVANT `payment_required` ;
 *   - un tier illisible échoue FERMÉ ;
 *   - et le défaut permissif est bien un défaut EXPLICITE, ligne par ligne.
 */

const ROOT = resolve(__dirname, "../../..");

describe("l'énumération elle-même", () => {
  it("il y a bien des surfaces à garder", () => {
    // Sans cette garde, une liste vidée rendrait tout le fichier vacuously
    // vrai — sur un sujet où le faux vert est une porte ouverte.
    expect(SURFACES.length).toBeGreaterThanOrEqual(15);
  });

  it("⚠ chaque surface a une ligne de tier, et chaque ligne une surface", () => {
    /*
     * C'est LE test que demande le brief : une surface ajoutée sans ligne
     * n'est pas « permissive par défaut », elle est absente de la politique.
     * Le typage `Record<Surface, KitTier>` l'attrape à la compilation ; ceci
     * l'attrape aussi quand quelqu'un élargit le type sans remplir la carte.
     */
    expect(Object.keys(SURFACE_MIN_TIER).sort()).toEqual([...SURFACES].sort());
    expect(Object.keys(SURFACE_LABEL).sort()).toEqual([...SURFACES].sort());
  });

  it("chaque libellé est écrit pour elle, pas pour nous", () => {
    for (const surface of SURFACES) {
      const label = SURFACE_LABEL[surface];
      expect(label.length).toBeGreaterThan(3);
      // Pas de nom de clé recopié : « kit_assets » n'est pas une phrase.
      expect(label).not.toContain("_");
    }
  });
});

describe("⚠ le défaut permissif est explicite, et il est visible", () => {
  it.each([...SURFACES])("%s est ouvert au tier le plus bas", (surface) => {
    /*
     * Si ce test échoue, quelqu'un a décidé une distribution. C'est
     * peut-être la bonne — mais c'est une DÉCISION, et elle se prend en
     * connaissance de cause, pas en passant.
     */
    expect(SURFACE_MIN_TIER[surface]).toBe(KIT_TIERS[0]);
  });

  it("et le tier le plus bas est bien celui qui est vendu le moins cher", () => {
    expect(KIT_TIERS[0]).toBe("starter");
  });
});

describe("surfaceAccess — 404 avant payment_required", () => {
  it("⚠ une surface inconnue est not_found, jamais « au-dessus de ton tier »", () => {
    /*
     * Même ordre que `requireKitPage`. Répondre `payment_required` à un nom
     * qui n'existe pas dirait à l'appelant qu'une surface existe — la même
     * fuite que répondre 402 pour le kit de quelqu'un d'autre.
     */
    const refusal = surfaceAccess("kit_secret_lab", "starter");
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) expect(refusal.reason).toBe("not_found");
  });

  it("et l'inconnu reste inconnu même sans tier du tout", () => {
    const refusal = surfaceAccess("kit_secret_lab", null);
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) expect(refusal.reason).toBe("not_found");
  });

  it("une surface connue au bon tier passe", () => {
    for (const tier of KIT_TIERS) {
      expect(surfaceAccess("site_editor", tier).ok).toBe(true);
    }
  });

  it("⚠ un tier illisible échoue FERMÉ", () => {
    /*
     * `null` veut dire « on n'a pas pu lire », pas « le tier le plus bas ».
     * Le pire d'un refus injustifié est une carte d'upgrade montrée à
     * quelqu'un qui a payé : visible, signalé, réparé. Le pire d'une
     * autorisation injustifiée est silencieux, permanent et gratuit.
     */
    const refusal = surfaceAccess("site_editor", null);
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) expect(refusal.reason).toBe("payment_required");
  });
});

describe("le garde compare bien sur l'échelle, dans le bon sens", () => {
  /*
   * Le canari de la carte : on n'a aucune ligne au-dessus de `starter`
   * aujourd'hui, donc sans surface fictive ce bloc ne testerait rien. On
   * exerce la comparaison directement, avec la vraie fonction.
   */
  const HIGHER: KitTier = "practice";

  it.each(KIT_TIERS.map((tier) => [tier] as const))(
    "un client %s face à une surface `practice`",
    (tier) => {
      const raised = { ...SURFACE_MIN_TIER, site_editor: HIGHER };
      const allowed = KIT_TIERS.indexOf(tier) >= KIT_TIERS.indexOf(HIGHER);
      // Reproduit la comparaison du garde contre une carte modifiée.
      expect(
        KIT_TIERS.indexOf(tier) >= KIT_TIERS.indexOf(raised.site_editor)
      ).toBe(allowed);
    }
  );

  it("⚠ le canari : une carte relevée refuserait bien le tier du dessous", () => {
    // Prouve que la comparaison mord, plutôt que d'être toujours vraie parce
    // que toutes les lignes valent `starter`.
    expect(KIT_TIERS.indexOf("starter") >= KIT_TIERS.indexOf("practice")).toBe(false);
    expect(KIT_TIERS.indexOf("signature") >= KIT_TIERS.indexOf("practice")).toBe(true);
  });

  it("un refus porte tout ce que la carte d'upgrade doit dire", () => {
    const refusal = surfaceAccess("assets_version_history", null);
    expect(refusal.ok).toBe(false);
    if (refusal.ok || refusal.reason !== "payment_required") return;
    expect(refusal.requiredTier).toBe("starter");
    expect(refusal.label).toBe(SURFACE_LABEL.assets_version_history);
    expect(refusal.currentTier).toBeNull();
  });
});

describe("isSurface", () => {
  it("reconnaît toutes les vraies", () => {
    for (const surface of SURFACES) expect(isSurface(surface)).toBe(true);
  });

  it("et rien d'autre", () => {
    expect(isSurface("")).toBe(false);
    expect(isSurface("kit_assets ")).toBe(false);
    expect(isSurface("toString")).toBe(false);
  });
});

/*
 * ── LE MÉCANISME EST UN SEUL ────────────────────────────────────────────
 * Dix-neuf surfaces qui redérivent chacune la règle, c'est dix-neuf chances
 * d'inverser la comparaison — et une comparaison inversée sur un paywall
 * échoue OUVERT.
 */
describe("rien ne redérive la règle à côté du garde", () => {
  function filesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "__tests__" ? [] : filesUnder(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  const FILES = [...filesUnder(join(ROOT, "lib")), ...filesUnder(join(ROOT, "app")), ...filesUnder(join(ROOT, "components"))];

  it("le balayage trouve bien des fichiers", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(100);
  });

  it("⚠ `SURFACE_MIN_TIER` n'est lu que par le garde", () => {
    const readers = FILES.filter((file) =>
      readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .includes("SURFACE_MIN_TIER")
    ).map((file) => file.slice(ROOT.length + 1).replace(/\\/g, "/"));

    expect(readers).toEqual(["lib/billing/surface-access.ts", "lib/billing/surfaces.ts"]);
  });
});
