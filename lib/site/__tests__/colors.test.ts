import { describe, expect, it } from "vitest";
import {
  COLOR_ROLES,
  COLOR_ROLE_KEYS,
  DERIVED_TOKEN_KEYS,
  colorPatch,
  isColorRole,
  isDerivedToken,
  promoteToPrimaryPatch,
  swapRolesPatch,
} from "@/lib/site/colors";
import { patchAreas, sanitizePatch } from "@/lib/site/patch";
import { CLAY_AND_SAND } from "@/lib/site/__tests__/envelope.fixture";

/*
 * L'éditeur à six rôles écrit les bonnes clés, et n'envoie JAMAIS une variante.
 */

const SPEC = CLAY_AND_SAND.spec;

describe("les six rôles", () => {
  it("sont six, dans l'ordre du contrat", () => {
    expect(COLOR_ROLE_KEYS).toEqual([
      "primary",
      "secondary",
      "accent",
      "paper",
      "light_neutral",
      "dark_neutral",
    ]);
  });

  it("portent les libellés du contrat, mot pour mot", () => {
    expect(COLOR_ROLES.map((role) => role.label)).toEqual([
      "Primary",
      "Secondary",
      "Accent",
      "Page background",
      "Section background",
      "Body text",
    ]);
  });

  it("`paper` et `light_neutral` sont DEUX rôles distincts", () => {
    // Proches en valeur (#FAF6EE et #F4EEE3), complètement différents de
    // métier. Un seul contrôle « la couleur claire » retirerait à la
    // praticienne le réglage de son fond de page.
    expect(SPEC.paper).not.toBe(SPEC.light_neutral);
    expect(isColorRole("paper")).toBe(true);
    expect(isColorRole("light_neutral")).toBe(true);
  });

  it("aucune surface n'est déplaçable par un correctif", () => {
    const fixable = COLOR_ROLES.filter((role) => role.fixable).map((role) => role.key);
    expect(fixable).toEqual(["primary", "secondary", "accent", "dark_neutral"]);
    // `paper` porte cinq paires, `light_neutral` une : les assombrir pour
    // réparer UNE paire changerait toutes les autres dessinées dessus.
    expect(fixable).not.toContain("paper");
    expect(fixable).not.toContain("light_neutral");
  });
});

describe("les quatre variantes ne sont pas des contrôles", () => {
  it("ne sont dans aucun rôle éditable", () => {
    for (const key of DERIVED_TOKEN_KEYS) {
      expect(COLOR_ROLE_KEYS).not.toContain(key as string);
      expect(isDerivedToken(key)).toBe(true);
    }
  });

  it("ne sont pas dans `spec` — seulement dans `preview.tokens`", () => {
    for (const key of DERIVED_TOKEN_KEYS) {
      expect(Object.keys(SPEC)).not.toContain(key as string);
      expect(Object.keys(CLAY_AND_SAND.preview.tokens)).toContain(key as string);
    }
  });

  it("sont retirées d'un patch, même si un composant les y met", () => {
    // Le cas réel : un formulaire qui renverrait `preview.tokens` en bloc.
    // Sans la garde, la base répondrait `unknown_field` sur un contrôle qui
    // n'existe pas, et l'erreur n'aurait aucun endroit où s'afficher.
    const patch = sanitizePatch({ ...CLAY_AND_SAND.preview.tokens });

    for (const key of DERIVED_TOKEN_KEYS) {
      expect(patch).not.toHaveProperty(key);
    }
    expect(patch).toHaveProperty("primary");
  });

  it("une variante identique à sa couleur de marque reste une variante", () => {
    // `accent_text` vaut `accent` ici : cet accent lit déjà comme texte. Dix
    // des dix-huit couleurs livrées sont dans ce cas — traiter la variante
    // comme « toujours différente » est faux.
    expect(CLAY_AND_SAND.preview.tokens.accent_text).toBe(SPEC.accent);
    expect(isDerivedToken("accent_text")).toBe(true);
  });
});

describe("le patch d'une couleur", () => {
  it("porte une clé, et cette clé est le rôle", () => {
    expect(colorPatch("light_neutral", "#f0e9dd")).toEqual({
      light_neutral: "#F0E9DD",
    });
  });

  it("est rangé dans la zone `colors` pour l'analytique", () => {
    expect(patchAreas(colorPatch("paper", "#FFFFFF"))).toEqual(["colors"]);
  });
});

describe("l'échange de deux rôles", () => {
  it("part en UN seul patch", () => {
    // Deux écritures successives feraient passer le spec par un état où les
    // deux rôles portent le même hex, et le trigger recalculerait les
    // variantes sur cet état intermédiaire.
    const patch = swapRolesPatch(SPEC, "secondary", "accent");
    expect(patch).toEqual({ secondary: SPEC.accent, accent: SPEC.secondary });
  });

  it("« Use as primary » est le même échange", () => {
    expect(promoteToPrimaryPatch(SPEC, "accent")).toEqual({
      accent: SPEC.primary,
      primary: SPEC.accent,
    });
  });

  it("échanger un rôle avec lui-même n'écrit rien", () => {
    expect(swapRolesPatch(SPEC, "primary", "primary")).toEqual({});
  });

  it("n'envoie jamais de variante, quel que soit l'échange", () => {
    for (const from of COLOR_ROLE_KEYS) {
      for (const to of COLOR_ROLE_KEYS) {
        const keys = Object.keys(swapRolesPatch(SPEC, from, to));
        for (const key of keys) expect(isDerivedToken(key)).toBe(false);
      }
    }
  });
});

describe("ce qu'un patch ne peut pas porter", () => {
  it("ni le compteur de version, ni la date, ni la cible", () => {
    // La cible passe par `site_spec_set_target`, pas par un patch : elle
    // regénère la sortie dans le même appel.
    const patch = sanitizePatch({
      primary: "#000000",
      spec_version: 99,
      updated_at: "2026-01-01",
      last_copied_spec_version: 1,
      target: "wix",
      seed_clamped: null,
      brand_kit_id: "someone-else",
    });

    expect(patch).toEqual({ primary: "#000000" });
  });
});
