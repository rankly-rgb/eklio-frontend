import { describe, expect, it, vi } from "vitest";
import { buildImagePrompt } from "@/lib/images/prompt";

/*
 * ── LA COULEUR ENVOYÉE EST LA SIENNE, PAS UNE CONSTANTE ─────────────────
 *
 * Pourquoi ce fichier existe. Un rapport de session a montré un prompt portant
 * #B4653F / #2E4E8A / #FAF7F2 / #E8E2D9 / #2B2724 pour un kit dont la palette
 * réelle est #B4674A / #C08A3E / #6E3320 / #FAF6EE / #F4EEE3 / #2B2A27. La
 * pipeline lisait bien la base -- c'était le harnais d'impression, jeté, qui
 * portait une FIXTURE écrite à la main. Mais la peur était juste :
 *
 *   une photographie dans les mauvaises couleurs reste chaude et plausible.
 *   Personne ne la rattraperait à l'œil. C'est la même forme de défaillance
 *   permissive qu'une table sans policy : ça ne casse pas, ça ment.
 *
 * Un test qui vérifie « le prompt contient six chaînes hexadécimales » aurait
 * été vert sur la fixture ET sur la vraie palette. Celui-ci vérifie que ce
 * sont EXACTEMENT les valeurs du kit, rôle par rôle, et qu'AUCUN autre hex ne
 * figure dans la chaîne -- c'est cette seconde clause qui attrape une
 * constante glissée dans le chemin.
 */

/**
 * Les six rôles de `site_specs` pour le kit 45de0dac-958f-4096-b83e-1559a89437e6,
 * relevés dans la base le 2026-09-06. Re-dériver avec :
 *
 *   select primary_hex, secondary_hex, accent_hex, paper_hex,
 *          light_neutral_hex, dark_neutral_hex
 *     from public.site_specs
 *    where brand_kit_id = '45de0dac-958f-4096-b83e-1559a89437e6';
 *
 * Ce ne sont pas des valeurs inventées : ce sont celles que la PREMIÈRE
 * génération réelle a effectivement portées, ce qui est la preuve que le
 * chemin de production lit bien le kit.
 */
const REAL_KIT = {
  primary: "#B4674A",
  secondary: "#C08A3E",
  accent: "#6E3320",
  paper: "#FAF6EE",
  light_neutral: "#F4EEE3",
  dark_neutral: "#2B2A27",
};

const REAL_TONE_KEYWORDS = ["steady", "plainspoken", "warm"];

/** Toutes les chaînes hexadécimales présentes dans une chaîne quelconque. */
function hexesIn(text: string): string[] {
  return (text.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((hex) => hex.toUpperCase());
}

describe("le prompt porte la palette du kit, et rien d'autre", () => {
  const prompt = buildImagePrompt("hero", {
    toneKeywords: REAL_TONE_KEYWORDS,
    palette: REAL_KIT,
    specialty: "self_esteem",
  });

  it("chaque rôle du kit est présent", () => {
    for (const hex of Object.values(REAL_KIT)) {
      expect(prompt).toContain(hex);
    }
  });

  it("AUCUN autre hex n'apparaît -- c'est la clause qui attrape une constante", () => {
    const expected = Object.values(REAL_KIT).map((hex) => hex.toUpperCase()).sort();
    expect(hexesIn(prompt).sort()).toEqual(expected);
  });

  it.each([
    ["#B4653F", "la fixture de test de ce dépôt"],
    ["#2E4E8A", "le bleu de la même fixture, dans un kit qui n'a aucun bleu"],
    ["#FAF7F2", "le papier de la fixture"],
    ["#E8E2D9", "le neutre clair de la fixture"],
    ["#2B2724", "l'ombre de la fixture"],
  ])("« %s » (%s) n'apparaît jamais", (hex) => {
    expect(prompt).not.toContain(hex);
  });

  it("secondary et accent ne demandent PAS la même chose", () => {
    /*
     * La correction que le premier libellé ratait : « {secondary} as one small
     * accent » mettait secondary et accent en concurrence sur le même rôle,
     * pendant que le vrai travail de secondary -- une seconde présence
     * matérielle -- restait non dit. Dans le système à six rôles, secondary
     * est « titres et surfaces de soutien » et accent « petites marques
     * seulement » : photographiquement, une MATIÈRE contre UN petit objet.
     */
    expect(prompt).toContain("as a supporting material presence");
    expect(prompt).toContain("never the dominant surface");
    expect(prompt).toContain("on one small detail only");
    expect(prompt).toContain("never a surface");
    // Aucun des deux ne demande « one small accent » : ce libellé est parti.
    expect(prompt).not.toContain("as one small accent");
  });

  it("chaque rôle est placé à SA place, pas à celle d'un autre", () => {
    /*
     * Une inversion de rôles -- secondary reçoit accent, par exemple -- rend
     * six hex corrects dans un prompt faux. Chaque valeur est donc vérifiée
     * contre la phrase qui la gouverne.
     */
    expect(prompt).toContain(`${REAL_KIT.primary} once, on a single soft furnishing or ceramic`);
    expect(prompt).toContain(`${REAL_KIT.secondary} as a supporting material presence`);
    expect(prompt).toContain(`${REAL_KIT.accent} on one small detail only`);
    expect(prompt).toContain(
      `${REAL_KIT.paper} and ${REAL_KIT.light_neutral} are the wall and the daylight`
    );
    expect(prompt).toContain(`${REAL_KIT.dark_neutral} only in shadow`);
  });
});

describe("loadImageContext transporte la palette de site_specs telle quelle", () => {
  /*
   * L'autre moitié : `buildImagePrompt` place ce qu'on lui donne, mais c'est
   * `loadImageContext` qui décide QUOI lui donner. Ici on lui rend le vrai
   * `site_specs` du kit et on exige que la palette ressorte identique.
   */
  it("les six rôles ressortent inchangés, et le prompt les porte", async () => {
    vi.resetModules();
    vi.doMock("@/lib/site/rpc", () => ({
      siteSpecGet: async () => ({
        ok: true,
        data: {
          preview: { tokens: { ...REAL_KIT, heading_font: "Fraunces", body_font: "Inter" } },
          spec: { target: "squarespace", practice_details: null },
        },
      }),
    }));

    const { loadImageContext } = await import("@/lib/images/context");

    // Le minimum que le chargeur touche : la spécialité passe par deux
    // requêtes catalogue, stubées ici pour ne rien inventer d'autre.
    const supabase = {
      from: (table: string) =>
        table === "project_briefs"
          ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { specialty_ids: ["self_esteem"] } }) }) }) }
          : { select: () => ({ in: () => ({ order: async () => ({ data: [{ id: "self_esteem", sort_order: 10 }] }) }) }) },
    };

    const kit = {
      row: { id: "45de0dac-958f-4096-b83e-1559a89437e6" },
      projectId: "project-1",
      selectedDirection: { tone_keywords: REAL_TONE_KEYWORDS },
    };

    const context = await loadImageContext(supabase as never, kit as never);
    expect(context.ok).toBe(true);
    if (!context.ok) return;

    expect(context.input.palette).toEqual(REAL_KIT);
    expect(context.input.specialty).toBe("self_esteem");
    expect(context.input.toneKeywords).toEqual(REAL_TONE_KEYWORDS);

    // Et de bout en bout : le prompt bâti depuis ce contexte ne porte que ses
    // hex à elle.
    expect(hexesIn(buildImagePrompt("hero", context.input)).sort()).toEqual(
      Object.values(REAL_KIT).map((hex) => hex.toUpperCase()).sort()
    );
    vi.doUnmock("@/lib/site/rpc");
  });
});
