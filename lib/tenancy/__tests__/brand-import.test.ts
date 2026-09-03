import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  brandImportPayloadSchema,
  importBrandIdentity,
} from "@/lib/tenancy/brand-import";

function stub(response: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: response, error });
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}

function lastCall(rpc: ReturnType<typeof stub>["rpc"]) {
  return rpc.mock.calls[rpc.mock.calls.length - 1];
}

const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const ORG_ID_IN_PATH = "11111111-1111-1111-1111-111111111111";

describe("brandImportPayloadSchema", () => {
  it("accepte un payload à deux champs — le cas courant", () => {
    const result = brandImportPayloadSchema.safeParse({
      primary_hex: "#AA3311",
      logo_svg_path: `org/${ORG_ID_IN_PATH}/logo.svg`,
    });
    expect(result.success).toBe(true);
  });

  it("accepte un payload complet", () => {
    const result = brandImportPayloadSchema.safeParse({
      primary_hex: "#000000",
      secondary_hex: "#111111",
      accent_hex: "#222222",
      light_neutral_hex: "#FFFFFF",
      dark_neutral_hex: "#333333",
      paper_hex: "#FAFAFA",
      heading_font: "Playfair Display",
      body_font: "Source Sans 3",
      font_display_fallback: "Georgia",
      logo_svg_path: `org/${ORG_ID_IN_PATH}/logo.svg`,
      logo_png_light_path: `org/${ORG_ID_IN_PATH}/logo-light.png`,
      logo_png_dark_path: `org/${ORG_ID_IN_PATH}/logo-dark.png`,
      monogram_svg_path: `org/${ORG_ID_IN_PATH}/monogram.svg`,
    });
    expect(result.success).toBe(true);
  });

  it("refuse un objet vide — au moins un champ est requis", () => {
    expect(brandImportPayloadSchema.safeParse({}).success).toBe(false);
  });

  it("refuse un hex mal formé", () => {
    expect(
      brandImportPayloadSchema.safeParse({ primary_hex: "AA3311" }).success
    ).toBe(false);
    expect(
      brandImportPayloadSchema.safeParse({ primary_hex: "#GGGGGG" }).success
    ).toBe(false);
  });

  it("refuse un chemin de logo hors de org/", () => {
    expect(
      brandImportPayloadSchema.safeParse({ logo_svg_path: "public/logo.svg" }).success
    ).toBe(false);
  });

  it("refuse tone — site_specs n'a pas cette colonne", () => {
    const result = brandImportPayloadSchema.safeParse({
      primary_hex: "#000000",
      tone: "warm",
    });
    // tone est simplement ignoré par un schéma zod par défaut (clés
    // inconnues silencieusement absentes du résultat) — ce test fige ce
    // choix : tone ne doit JAMAIS apparaître dans la sortie parsée.
    expect(result.success).toBe(true);
    expect(result.success && "tone" in result.data).toBe(false);
  });
});

describe("importBrandIdentity", () => {
  it("envoie p_project_id et p_payload", async () => {
    const { rpc, client } = stub(null);
    await importBrandIdentity(client, {
      projectId: PROJECT_ID,
      payload: { primary_hex: "#AA3311" },
    });

    expect(lastCall(rpc)).toEqual([
      "import_brand_identity",
      { p_project_id: PROJECT_ID, p_payload: { primary_hex: "#AA3311" } },
    ]);
  });

  it("rend data: null au succès", async () => {
    const { client } = stub(null);
    const result = await importBrandIdentity(client, {
      projectId: PROJECT_ID,
      payload: { primary_hex: "#AA3311" },
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });

  it("rejette un payload invalide avant l'appel réseau", async () => {
    const { rpc, client } = stub(null);
    await expect(
      importBrandIdentity(client, {
        projectId: PROJECT_ID,
        payload: { primary_hex: "not-a-hex" },
      })
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("remonte le refus (stranger, mauvais org) tel quel", async () => {
    const { client } = stub(null, {
      message: "import_brand_identity: may not import a brand identity into project",
    });
    const result = await importBrandIdentity(client, {
      projectId: PROJECT_ID,
      payload: { primary_hex: "#AA3311" },
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain("may not import");
  });
});
