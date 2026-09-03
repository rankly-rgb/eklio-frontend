import { describe, expect, it } from "vitest";
import {
  FIELD_SOURCE_KEYS,
  fieldSourceSchema,
  fieldSourcesSchema,
  isLocked,
} from "@/lib/tenancy/field-sources";
import type { FieldSource } from "@/types/supabase";

/*
 * eklio-frontend et eklio-backend sont deux repos GitHub séparés (CI, clone,
 * déploiement distincts) — pas un monorepo. Lire la migration depuis un test
 * de ce repo supposerait un layout de checkout que la CI de ce repo seul ne
 * garantit pas. On fige donc la liste ici, en dur, à vérifier à la main contre
 * `supabase/migrations/20260903102000_brand_field_sources.sql` côté backend
 * si l'une des deux bouge.
 */
const KEYS_PER_MIGRATION = [
  "primary_hex",
  "secondary_hex",
  "accent_hex",
  "light_neutral_hex",
  "dark_neutral_hex",
  "paper_hex",
  "heading_font",
  "body_font",
  "logo",
] as const;

describe("FIELD_SOURCE_KEYS — synchronisation avec la migration", () => {
  it("correspond exactement à validate_field_sources()", () => {
    expect([...FIELD_SOURCE_KEYS].sort()).toEqual(
      [...KEYS_PER_MIGRATION].sort()
    );
  });
});

describe("isLocked", () => {
  it("verrouille imported et inherited", () => {
    expect(isLocked("imported")).toBe(true);
    expect(isLocked("inherited")).toBe(true);
  });

  it("laisse generated et derived modifiables", () => {
    expect(isLocked("generated")).toBe(false);
    expect(isLocked("derived")).toBe(false);
  });
});

describe("fieldSourceSchema", () => {
  const values: FieldSource[] = [
    "generated",
    "imported",
    "derived",
    "inherited",
  ];

  it.each(values)("accepte %s", (value) => {
    expect(fieldSourceSchema.safeParse(value).success).toBe(true);
  });

  it("refuse une valeur hors des quatre sources", () => {
    expect(fieldSourceSchema.safeParse("guessed").success).toBe(false);
  });
});

describe("fieldSourcesSchema", () => {
  it("accepte un objet vide — aucun champ n'a encore de source enregistrée", () => {
    expect(fieldSourcesSchema.safeParse({}).success).toBe(true);
  });

  it.each(FIELD_SOURCE_KEYS)("accepte la clé %s avec une source valide", (key) => {
    const result = fieldSourcesSchema.safeParse({ [key]: "imported" });
    expect(result.success).toBe(true);
  });

  it("accepte un objet partiel, plusieurs clés à la fois", () => {
    const result = fieldSourcesSchema.safeParse({
      primary_hex: "generated",
      logo: "inherited",
    });
    expect(result.success).toBe(true);
  });

  it("refuse une clé inconnue — même règle que le CHECK SQL", () => {
    const result = fieldSourcesSchema.safeParse({ tone: "generated" });
    expect(result.success).toBe(false);
  });

  it("refuse une valeur qui n'est pas une des quatre sources", () => {
    const result = fieldSourcesSchema.safeParse({ primary_hex: "guessed" });
    expect(result.success).toBe(false);
  });
});
