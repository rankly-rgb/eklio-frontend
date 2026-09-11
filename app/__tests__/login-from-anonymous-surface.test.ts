import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { reachableWithoutAccount } from "@/lib/supabase/middleware";

const ROOT = resolve(__dirname, "../..");
const LOGIN = readFileSync(join(ROOT, "app/login/page.tsx"), "utf8");

/*
 * ── LE SECOND APPAREIL A UNE SORTIE, ET IL FAUT LE DIRE ─────────────────
 *
 * Une visiteuse anonyme qui ouvre sa révélation sur son téléphone atterrit sur
 * `/login` : le jeton est un cookie, resté sur le portable. Elle lit « Sign
 * in » pour un travail fait vingt minutes plus tôt sur une machine où elle n'a
 * pas de compte.
 *
 * La session 4 avait laissé ça tel quel en disant qu'une phrase serait une
 * explication sans issue. C'était faux : l'offre « email me a link » lui a été
 * faite deux fois, à la fin du brief et sur la révélation, et le lien pose le
 * cookie sur l'appareil qui l'ouvre. Pour celles qui l'ont prise, la sortie
 * est déjà dans leur boîte — il suffisait de le dire.
 */

const ANY_UUID = "8f14e45f-ceea-467a-9f14-1e3e4a0f0000";

describe("⚠ la phrase du second appareil", () => {
  it("existe, et nomme le lien par e-mail", () => {
    expect(LOGIN).toMatch(/email you a link/i);
    // Et elle dit où le brief EST, pas seulement qu'il manque.
    expect(LOGIN).toMatch(/device you/i);
  });

  it("est conditionnée aux surfaces atteignables sans compte", () => {
    expect(LOGIN).toContain("reachableWithoutAccount(next)");
  });

  it("s'affiche pour les quatre surfaces anonymes", () => {
    /*
     * La condition est la MÊME fonction que le proxy utilise pour laisser
     * passer. Deux listes auraient divergé, et celle qui aurait gagné serait
     * celle que personne ne relit.
     */
    for (const path of [
      `/app/briefs/${ANY_UUID}`,
      `/app/briefs/${ANY_UUID}/review`,
      `/app/briefs/${ANY_UUID}/positioning`,
      `/app/brand-kits/${ANY_UUID}/reveal`,
    ]) {
      expect(reachableWithoutAccount(path), path).toBe(true);
    }
  });

  it("⚠ ne s'affiche PAS là où il n'y a pas de brief sans compte à retrouver", () => {
    // Sur le checkout ou les réglages, la phrase serait du bruit — et pire,
    // elle suggérerait une récupération qui n'existe pas pour ces écrans.
    for (const path of [
      "/app/checkout",
      "/app/settings",
      "/app",
      `/app/brand-kits/${ANY_UUID}/assets`,
    ]) {
      expect(reachableWithoutAccount(path), path).toBe(false);
    }
  });

  it("n'affiche rien du tout sans `next`", () => {
    // Une connexion ordinaire, depuis la page d'accueil : rien à expliquer.
    expect(LOGIN).toContain("next ? reachableWithoutAccount(next) : false");
  });
});
