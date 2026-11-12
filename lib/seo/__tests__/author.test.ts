import { describe, expect, it } from "vitest";
import { authorCredentials, authorName, isDoctorate } from "@/lib/seo/context";
import type { SeoClient } from "@/lib/seo/db";

/*
 * La signature d'une pièce SEO (session 3) : le « Dr. » ne vient que d'un doctorat
 * STRUCTURÉ dans le brief, jamais du texte libre du nom ; le titre vient de la licence.
 * Les lignes du catalogue sont celles de la base locale (`degrees`, `license_types`).
 */
const DEGREES: Record<string, string> = {
  ma: "Master of Arts",
  msw: "Master of Social Work",
  psyd: "Doctor of Psychology",
  phd: "Doctor of Philosophy",
};
const LICENSES: Record<string, string> = {
  lmft: "Licensed Marriage and Family Therapist",
  lcsw: "Licensed Clinical Social Worker",
  licensed_psychologist: "Licensed Psychologist",
};

function catalogDb(): SeoClient {
  const from = (table: string) => {
    let id = "";
    const q = {
      select: () => q,
      eq: (_c: string, v: string) => ((id = v), q),
      maybeSingle: async () => {
        if (table === "degrees") return { data: DEGREES[id] ? { full_name: DEGREES[id] } : null, error: null };
        if (table === "license_types") return { data: LICENSES[id] ? { description: LICENSES[id] } : null, error: null };
        throw new Error(`unexpected table ${table}`);
      },
    };
    return q;
  };
  return { from } as unknown as SeoClient;
}

async function signature(rawName: string, licence: string, degree: string | null) {
  const c = await authorCredentials(catalogDb(), licence, degree);
  return { name: authorName(rawName, c.doctorate), ...c };
}

describe("le « Dr. » et le titre professionnel", () => {
  it("le profil A : « Dr. » sans doctorat au brief → retiré ; titre « Licensed Psychologist »", async () => {
    expect(await signature("Dr. Ines Alvarez", "licensed_psychologist", null)).toEqual({
      name: "Ines Alvarez",
      title: "Licensed Psychologist",
      doctorate: false,
    });
  });
  it("une LMFT ou une LCSW avec un master ne peut pas obtenir « Dr. », ni « PhD » derrière", async () => {
    expect((await signature("Dr Priya Natarajan", "lmft", "ma")).name).toBe("Priya Natarajan");
    expect((await signature("Doctor Marcus Reed", "lcsw", "msw")).name).toBe("Marcus Reed");
    expect((await signature("Marcus Reed, PhD", "lcsw", "msw")).name).toBe("Marcus Reed");
    expect((await signature("Jordan Ellis", "lmft", null)).title).toBe("Licensed Marriage and Family Therapist");
  });
  it("avec un doctorat au brief, le nom reste tel qu'elle l'a écrit — on n'ajoute jamais un titre", async () => {
    expect(await signature("Dr. Ines Alvarez", "licensed_psychologist", "psyd")).toEqual({
      name: "Dr. Ines Alvarez",
      title: "Licensed Psychologist",
      doctorate: true,
    });
    expect((await signature("Ines Alvarez", "licensed_psychologist", "phd")).name).toBe("Ines Alvarez");
  });
  it("un nom qui commence par « Dre… » n'est pas un titre", () => {
    expect(authorName("Drew Carter", false)).toBe("Drew Carter");
    expect(authorName("Dr.Drew Carter", false)).toBe("Drew Carter");
  });
  it("le doctorat se lit dans `degrees.full_name`", () => {
    expect(isDoctorate("Doctor of Education")).toBe(true);
    expect(isDoctorate("Master of Science")).toBe(false);
    expect(isDoctorate(null)).toBe(false);
  });
});
