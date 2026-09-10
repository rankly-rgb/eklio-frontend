import { describe, expect, it } from "vitest";
import { reachableWithoutAccount } from "@/lib/supabase/middleware";

/*
 * ── CE QU'UNE INCONNUE PEUT ATTEINDRE SANS COMPTE ───────────────────────
 *
 * Le brief, sa relecture, son écran de positionnement, et la révélation. Rien
 * d'autre.
 *
 * ⚠ CE FICHIER GARDE UNE LISTE D'AUTORISATIONS, donc il doit surtout prouver
 * ce qu'elle N'AUTORISE PAS. Une expression trop large ici n'ouvre pas un
 * écran : elle laisse passer la requête jusqu'à des pages qui, elles, lisent
 * des données payées.
 */

describe("ce qui passe", () => {
  it.each([
    "/app/briefs/8f14e45f-ceea-467a-9f14-1e3e4a0f0000",
    "/app/briefs/8f14e45f-ceea-467a-9f14-1e3e4a0f0000/review",
    "/app/briefs/8f14e45f-ceea-467a-9f14-1e3e4a0f0000/positioning",
    "/app/briefs/8f14e45f-ceea-467a-9f14-1e3e4a0f0000/",
    "/app/brand-kits/8f14e45f-ceea-467a-9f14-1e3e4a0f0000/reveal",
  ])("%s", (path) => {
    expect(reachableWithoutAccount(path)).toBe(true);
  });
});

describe("⚠ ce qui ne passe pas", () => {
  it.each([
    // Le tableau de bord, le contenu, Check, les réglages, le paiement.
    "/app",
    "/app/content",
    "/app/content/plan",
    "/app/check",
    "/app/settings",
    "/app/checkout",
    "/app/launch",
    // Les sections PAYÉES du kit. La révélation est gratuite ; ce qui est
    // dessous ne l'est pas, et un compte est le seul endroit où un achat
    // peut se rattacher.
    "/app/brand-kits/8f14e45f-ceea-467a-9f14-1e3e4a0f0000",
    "/app/brand-kits/8f14e45f-ceea-467a-9f14-1e3e4a0f0000/assets",
    "/app/brand-kits/8f14e45f-ceea-467a-9f14-1e3e4a0f0000/site-editor",
    "/app/brand-kits/8f14e45f-ceea-467a-9f14-1e3e4a0f0000/handoff",
    "/app/brand-kits/8f14e45f-ceea-467a-9f14-1e3e4a0f0000/delivered",
    // Et rien qui ressemble à un chemin autorisé sans en être un.
    "/app/briefs",
    "/app/briefs/abc/review/extra",
    "/app/brand-kits/abc/reveal/download",
    "/app/briefsx/abc",
  ])("%s", (path) => {
    expect(reachableWithoutAccount(path)).toBe(false);
  });
});
