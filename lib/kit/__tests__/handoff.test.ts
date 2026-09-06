import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { handoffBrief, type HandoffModel } from "@/lib/kit/handoff";

const NOW = new Date("2026-09-06T12:00:00Z");

const MODEL: HandoffModel = {
  practiceName: "Elm & Ember Therapy",
  practitionerLine: "Dana Whitfield, LCSW",
  direction: {
    id: "d1",
    name: "Quiet Room",
    rationale:
      "A calm, unhurried identity for a practice that wants to read as steady rather than clinical.",
    about_excerpt: "About copy.",
    palette: {
      primary: "#B4653F",
      secondary: "#2E4E8A",
      light: "#E8E2D9",
      dark: "#2B2724",
      paper: "#FAF7F2",
    },
    hero: { overline: "Therapy in Austin", headline: "Room to think it through" },
    typography: {
      heading_font: "Fraunces",
      body_font: "Inter",
      google_fonts_url:
        "https://fonts.googleapis.com/css2?family=Fraunces&family=Inter&display=swap",
    },
    tone_keywords: ["calm", "plain", "warm"],
  } as HandoffModel["direction"],
  voice: {
    sounds_like: ["Plain sentences", "A person, not a brochure", "Specific about the work"],
    never_write: ["Guarantees", "Clinical jargon", "Anything about a client"],
  },
  rules: [
    { label: "No testimonials", description: "Client testimonials are prohibited for licensed therapists." },
  ],
  assets: { currentCount: 34, lastUpdated: "2026-09-05T09:00:00Z", staleKeys: ["og_image"] },
  bookingUrl: "https://cal.com/dana",
};

describe("le brief de passation", () => {
  it("est déterministe : deux rendus identiques pour la même entrée", () => {
    // Deux personnes qui le lisent lisent le même document, et un diff sur
    // deux exports ne montre que ce qui a vraiment changé.
    expect(handoffBrief(MODEL, NOW)).toBe(handoffBrief(MODEL, NOW));
  });

  it("porte les cinq hexadécimaux, en majuscules", () => {
    const brief = handoffBrief(MODEL, NOW);
    for (const hex of ["#B4653F", "#2E4E8A", "#E8E2D9", "#2B2724", "#FAF7F2"]) {
      expect(brief).toContain(hex);
    }
  });

  it("porte la typographie et l'URL des polices web", () => {
    const brief = handoffBrief(MODEL, NOW);
    expect(brief).toContain("Fraunces");
    expect(brief).toContain("Inter");
    expect(brief).toContain("https://fonts.googleapis.com/css2?family=Fraunces");
  });

  it("porte les règles déontologiques TELLES QUELLES, pas paraphrasées", () => {
    // C'est la partie qu'un prestataire casse sans le savoir, et c'est celle
    // qui a un ordre professionnel derrière elle. Une reformulation ici serait
    // une seconde copie d'une règle qu'on ne relira pas.
    const brief = handoffBrief(MODEL, NOW);
    expect(brief).toContain("No testimonials");
    expect(brief).toContain("Client testimonials are prohibited for licensed therapists.");
  });

  it("ne donne que des nombres mesurés", () => {
    const brief = handoffBrief(MODEL, NOW);
    expect(brief).toContain("34 files are current");
    expect(brief).toContain("1 were made before the brand last changed");

    // Aucun fichier : on le dit, on n'invente pas un compte.
    const empty = handoffBrief(
      { ...MODEL, assets: { currentCount: 0, lastUpdated: null, staleKeys: [] } },
      NOW
    );
    expect(empty).toContain("No files have been generated yet.");
    expect(empty).not.toContain("files are current");
  });

  it("survit à un kit incomplet sans inventer de sections", () => {
    const bare = handoffBrief(
      {
        practiceName: "This practice",
        practitionerLine: null,
        direction: null,
        voice: null,
        rules: [],
        assets: { currentCount: 0, lastUpdated: null, staleKeys: [] },
        bookingUrl: null,
      },
      NOW
    );
    expect(bare).not.toContain("COLOR");
    expect(bare).not.toContain("VOICE");
    expect(bare).not.toContain("BOOKING LINK");
    // Ce qui reste vrai quoi qu'il arrive reste là.
    expect(bare).toContain("Eklio does not host, publish or deploy anything.");
  });

  it("respecte la voix du produit : ni point d'exclamation, ni emoji", () => {
    const brief = handoffBrief(MODEL, NOW);
    expect(brief).not.toContain("!");
    expect(brief).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("⚠ la passation n'est PAS un partage", () => {
  /*
   * Eklio n'héberge pas, ne publie pas, ne partage pas. Cette page est
   * exactement l'endroit où cette règle s'érode en premier : « il suffirait
   * d'un lien à envoyer au prestataire ». Elle ne s'érode pas ici.
   */
  const ROOT = resolve(__dirname, "../../..");
  const SURFACES = [
    "app/app/brand-kits/[id]/handoff/page.tsx",
    "components/kit/handoff-view.tsx",
    "lib/kit/handoff.ts",
  ];

  const SHARING = [
    "navigator.share",
    "Copy link",
    "copy link",
    "Share link",
    "shareUrl",
    "share_url",
    "createShareLink",
    "publicUrl",
    "getPublicUrl",
  ];

  function code(path: string): string {
    return readFileSync(resolve(ROOT, path), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  }

  it("les trois surfaces existent", () => {
    // Sinon les assertions suivantes seraient vraies pour rien.
    expect(SURFACES.length).toBe(3);
    for (const path of SURFACES) expect(code(path).length).toBeGreaterThan(200);
  });

  it.each(SURFACES)("%s n'offre aucun mécanisme de partage", (path) => {
    const body = code(path);
    const found = SHARING.filter((needle) => body.includes(needle));
    expect(
      found,
      `${path} introduit un partage : ${found.join(", ")}.\n` +
        "Eklio n'héberge, ne publie et ne partage rien. Une passation se télécharge\n" +
        "et se transfère par elle — c'est aussi pourquoi le destinataire n'a besoin\n" +
        "d'aucun compte."
    ).toEqual([]);
  });

  it("la règle est appliquée, pas vacuously vraie", () => {
    const canary = 'const url = supabase.storage.from("brand-assets").getPublicUrl(path);';
    expect(SHARING.filter((needle) => canary.includes(needle))).toEqual(["getPublicUrl"]);
  });

  it("et la page le dit à voix haute", () => {
    const view = readFileSync(resolve(ROOT, "components/kit/handoff-view.tsx"), "utf8");
    expect(view).toContain("There is no share URL on this page");
  });
});
