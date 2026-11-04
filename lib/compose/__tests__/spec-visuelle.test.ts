import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { render, renderCarousel, violations } from "@/lib/compose/engine";
import { cardPalette, type DirectionPalette } from "@/lib/compose/palette";
import { contrastRatio } from "@/lib/brand/color";
import { GROUNDS, groundFor, groundPalette, SOFT_TARGET, TEXT_FLOOR } from "@/lib/compose/grounds";
import { balancedLines, endsWithLoneWord, fitTitle } from "@/lib/compose/layout";
import { measure, wrap } from "@/lib/compose/measure";
import { composeIdiom, idiomFor } from "@/lib/compose/idioms";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { payloadFor } from "@/lib/compose/__tests__/fixtures";
import { DRAWABLE } from "@/lib/compose/decor";
import { groundRhythm, planGrounds } from "@/lib/content/month/grounds-plan";

/*
 * La spécification visuelle du 2026-11-02 (spec-visuelle-eklio.zip), contrôlée.
 * Chaque règle a un test qui échoue quand on la retire.
 */
const KIT: DirectionPalette = { primary: "#B4674A", secondary: "#C08A3E", light: "#F4EEE3", dark: "#2B2A27", paper: "#FAF6EE" };
function catalogue(): Array<{ id: string; direction: DirectionPalette }> {
  const out: Array<{ id: string; direction: DirectionPalette }> = [];
  for (const file of readdirSync("../eklio-backend/supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const ins = /insert into public\.palette_families[\s\S]*?;/i.exec(readFileSync(`../eklio-backend/supabase/migrations/${file}`, "utf8"));
    if (!ins) continue;
    for (const r of ins[0].matchAll(/\('([a-z_]+)',\s*\d+,\s*(?:true|false),\s*'[^']*',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})'/g)) {
      out.push({ id: r[1], direction: { primary: r[2], secondary: r[3], light: r[4], dark: r[5], paper: r[6] } });
    }
  }
  return out;
}
const base = { palette: cardPalette("k", KIT, false), eyebrow: "BEHIND THE PRACTICE", headline: "Old rules", footer: "Ember consulting · LMFT 123456", illustration: "anx-iceberg" };

describe("les cinq familles de fond existent pour toutes les palettes", () => {
  it.each(catalogue())("$id : cinq fonds, encre ≥ 4,5:1, texte secondaire ≥ 4,7:1", ({ direction }) => {
    for (const g of GROUNDS) {
      const p = groundPalette(direction, g);
      expect(p, g).not.toBeNull();
      expect(contrastRatio(p!.ink, p!.background), g).toBeGreaterThanOrEqual(TEXT_FLOOR);
      expect(contrastRatio(p!.soft, p!.background), g).toBeGreaterThanOrEqual(SOFT_TARGET);
    }
  });

  it("la crème du kit de test est celle de la spec (#F7F4EE)", () => {
    expect(groundPalette(KIT, "cream")!.background.toUpperCase()).toBe("#F7F4EE");
  });
});

describe("pas de mot seul en fin de titre", () => {
  const title = "Something can be long over and still shape today";
  it("provoqué : le découpage glouton laisse un mot seul, l'équilibrage non", () => {
    // Une largeur où le glouton orpheline « today ».
    let width = 0;
    for (let w = 600; w < 1200; w += 5) if (endsWithLoneWord(wrap(title, "serif", 96, w))) { width = w; break; }
    expect(width).toBeGreaterThan(0);
    const fit = fitTitle(title, "serif", width, 4000, { min: 96, max: 96 }, 8);
    expect(fit).not.toBeNull();
    expect(endsWithLoneWord(fit!.lines)).toBe(false);
    expect(balancedLines(title.split(" "), "serif", 96, width, fit!.lines.length)).toEqual(fit!.lines);
  });

  it("provoqué : un dernier mot long — l'équilibrage seul le laisserait seul, la garde le refuse", () => {
    const words = ["It", "is", "not", "a", "reward", "unquestionably"];
    const width = measure("reward unquestionably", "serif", 96) + 1;
    // La coupure la plus équilibrée serait « It is not a reward / unquestionably » : un mot seul.
    expect(Math.max(measure("It is not a reward", "serif", 96), measure("unquestionably", "serif", 96))).toBeLessThan(measure("reward unquestionably", "serif", 96));
    const lines = balancedLines(words, "serif", 96, width, 2);
    expect(lines).toEqual(["It is not a", "reward unquestionably"]);
    expect(endsWithLoneWord(lines!)).toBe(false);
  });

  it("aucun titre rendu ne se termine par un mot seul, sur chaque archétype et chaque longueur", () => {
    for (const archetype of ARCHETYPE_KEYS) {
      if (archetype === "carousel") continue;
      for (const length of ["short", "nominal", "ceiling"] as const) {
        let svg: string;
        try { svg = render({ ...base, archetype, payload: payloadFor(archetype, length), headline: "Something can be long over and still shape today" }).svg; } catch { continue; }
        const head = /<g data-role="text" data-band="headline"[^>]*>([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? "";
        const lines = [...head.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
        expect(endsWithLoneWord(lines), `${archetype}/${length}: ${lines.join(" / ")}`).toBe(false);
      }
    }
  });

  it("au plus n lignes, réduction jusqu'au plancher, puis refus", () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    expect(fitTitle(long, "script", 900, 2000, { min: 96, max: 168 }, 4)).toBeNull();
    expect(composeIdiom({ idiom: "quote_deep", statement: long, eyebrow: "E", illustration: "anx-iceberg", gp: groundFor(KIT, "deep")! })).toBeNull();
  });
});

describe("les idiomes 9, 10 et 13", () => {
  it("le fond décide l'idiome", () => {
    expect(idiomFor("single_statement", "ochre")).toBe("big_drawing");
    expect(idiomFor("single_statement", "terra")).toBe("big_drawing");
    expect(idiomFor("single_statement", "deep")).toBe("quote_deep");
    expect(idiomFor("carousel", "photo", 0)).toBe("carousel_cover");
    expect(idiomFor("numbered_strategies", "deep")).toBeNull();
  });

  it.each([
    ["ochre", "big_drawing"],
    ["terra", "big_drawing"],
    ["deep", "quote_deep"],
  ] as const)("phrase seule sur %s : l'idiome %s, sans violation, signature centrée", (g, idiom) => {
    const r = render({ ...base, archetype: "single_statement", payload: { statement: "Rest is not a reward." }, ground: groundFor(KIT, g) });
    expect(r.svg).toContain(`data-idiom="${idiom}"`);
    expect(violations(r.composition.placed)).toEqual([]);
    const sig = r.composition.placed.find((p) => p.band === "footer")!;
    expect(sig.role === "text" && sig.lines[0].anchor).toBe("middle");
    expect(sig.role === "text" && sig.lines[0].family).toBe("sans");
  });

  it("couverture de carrousel sur photo : la première diapositive seulement, les suivantes sur crème", () => {
    const slides = renderCarousel({
      ...base,
      archetype: "carousel",
      payload: { cards: [1, 2, 3].map((i) => ({ archetype_key: "single_statement", payload: { statement: `Idea number ${i} stays short.` } })) },
      ground: groundFor(KIT, "photo"),
      illustration: DRAWABLE[0],
    });
    expect(slides[0].svg).toContain('data-idiom="carousel_cover"');
    expect(slides[0].svg).toContain("data-photo=");
    expect(slides[1].svg).not.toContain("data-idiom");
    expect(slides[1].svg).not.toContain("data-photo=");
  });
});

describe("chaque texte posé vient d'une surface que les contrôles lisent", () => {
  /*
   * Dérivé du RENDU, pas d'une liste : chaque archétype du registre et chaque
   * idiome, sur chaque fond ; chaque `<text>` du SVG doit être tiré du surtitre,
   * du titre, du pied, ou d'une chaîne de la charge utile — les champs que
   * `asMonthPost` projette dans `checkMonth` et le socle déontologique.
   */
  const norm = (t: string) => t.toLowerCase().replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  const strings = (v: unknown): string[] =>
    typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

  it("aucune surface de texte non couverte", () => {
    const uncovered: string[] = [];
    for (const archetype of ARCHETYPE_KEYS) {
      for (const g of [undefined, ...GROUNDS]) {
        const payload = payloadFor(archetype, "nominal");
        const input = { ...base, archetype, payload, ground: g ? groundFor(KIT, g) : null, illustration: DRAWABLE[0] };
        let svgs: string[];
        try { svgs = archetype === "carousel" ? renderCarousel(input).map((s) => s.svg) : [render(input).svg]; } catch { continue; }
        const sources = norm([base.eyebrow, base.headline, base.footer, ...strings(payload)].join(" | "));
        for (const svg of svgs) {
          for (const m of svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) {
            const text = norm(m[1]).replace(/\s*\d+\/\d+$/, "");
            if (text && !sources.includes(text)) uncovered.push(`${archetype}/${g ?? "—"} : « ${m[1]} »`);
          }
        }
      }
    }
    expect(uncovered).toEqual([]);
  });
});

describe("le rythme du mois", () => {
  const december = ["numbered_strategies", "single_statement", "carousel", "comparison_pair", "comparison_pair", "numbered_strategies", "single_statement", "concentric_control", "surface_and_beneath", "quadrant_model", "comparison_pair", "single_statement", "single_statement", "surface_and_beneath", "quadrant_model", "cycle", "numbered_strategies", "numbered_strategies", "numbered_strategies", "single_statement", "quadrant_model", "cycle", "surface_and_beneath", "comparison_pair", "surface_and_beneath", "single_statement", "single_statement", "carousel", "single_statement", "single_statement"];

  it("décembre : les parts visées, aucun voisin identique hors crème, toutes les grilles de neuf tenues", () => {
    const r = groundRhythm(planGrounds(december));
    // Les parts visées (photo 30 % = 9) : pilules et bulles ne préfèrent plus la photo depuis qu'elles ne portent de dessin sur aucun fond (2026-11-04).
    expect(r.counts).toEqual({ cream: 12, photo: 9, deep: 3, ochre: 3, terra: 3 });
    expect(r.sameNeighbours).toBe(0);
    expect(r.windowsFailing).toBe(0);
  });

  it("provoqué : un mois tout crème échoue la mesure", () => {
    const r = groundRhythm(december.map(() => "cream" as const));
    expect(r.windowsFailing).toBe(r.windows);
  });
});

describe("rien ne laisse un tiers vide (remplissage vertical)", () => {
  it("provoqué : un titre seul en haut de carte couvre moins des deux tiers — le contrôle le voit", async () => {
    const { verticalFill, FILL_FLOOR } = await import("@/lib/compose/engine");
    const lone = [{ role: "text" as const, band: "headline" as const, box: { x: 72, y: 162, w: 600, h: 200 }, lines: [] }];
    expect(verticalFill(lone)).toBeLessThan(FILL_FLOOR);
  });

  it("toute carte du générateur rendue (dessin de la bibliothèque, idiome non exempté) couvre au moins les deux tiers", async () => {
    const { verticalFill, FILL_FLOOR } = await import("@/lib/compose/engine");
    for (const archetype of ARCHETYPE_KEYS) {
      if (archetype === "carousel") continue;
      for (const g of GROUNDS) for (const length of ["short", "nominal", "ceiling"] as const) {
        let r;
        try { r = render({ ...base, archetype, payload: payloadFor(archetype, length), ground: groundFor(KIT, g) }); } catch { continue; }
        if (r.composition.idiom === "quote_deep" || r.composition.idiom === "carousel_cover") continue;
        expect(verticalFill(r.composition.placed), `${archetype}/${g}/${length}`).toBeGreaterThanOrEqual(FILL_FLOOR);
      }
    }
  });
});

describe("idiomes 7 et 6 : pilules et bulles reliées", () => {
  const three = [{ label: "First days", gloss: "decisions need attention" }, { label: "Later", gloss: "feelings find some room" }, { label: "Months on", gloss: "the change feels more real" }];

  it("sur photo, numbered_strategies devient des pilules et cycle des bulles — sans violation", () => {
    for (const [archetype, payload, idiom] of [["numbered_strategies", { items: three }, "pills"], ["cycle", { nodes: three }, "bubbles"]] as const) {
      const r = render({ ...base, archetype, payload, headline: "Feelings can arrive later", ground: groundFor(KIT, "photo") });
      expect(r.composition.idiom, archetype).toBe(idiom);
      expect(r.svg).toContain(`data-idiom="${idiom}"`);
      expect(violations(r.composition.placed)).toEqual([]);
    }
  });

  it("chaque connecteur part du bord bas d'une bulle et arrive au bord haut de la suivante", async () => {
    const { bubbles } = await import("@/lib/compose/archetypes/idiom-content");
    const { libraryDrawing } = await import("@/lib/compose/library");
    const ctx = { payload: null, palette: base.palette, content: { x: 72, y: 470, w: 936, h: 634 }, figureScale: 1, secondaryMax: 48, draw: libraryDrawing("anx-iceberg"), illustrated: true, onPhoto: true };
    const out = bubbles(three, ctx as never)!;
    expect(out.connectors).toHaveLength(2);
    for (const c of out.connectors) {
      expect(c.start[1]).toBeCloseTo(c.from.y + c.from.h, 2);
      expect(c.start[0]).toBeGreaterThanOrEqual(c.from.x);
      expect(c.start[0]).toBeLessThanOrEqual(c.from.x + c.from.w);
      expect(c.end[1]).toBeCloseTo(c.to.y, 2);
      expect(c.end[0]).toBeGreaterThanOrEqual(c.to.x);
      expect(c.end[0]).toBeLessThanOrEqual(c.to.x + c.to.w);
      expect(c.d.startsWith(`M ${c.start[0]} ${c.start[1]}`)).toBe(true);
      expect(c.d.endsWith(`${c.end[0]} ${c.end[1]}`)).toBe(true);
    }
  });
});

describe("idiome 2 : photo en cercle", () => {
  it("une phrase seule sur crème : photo découpée en cercle, titre centré dessous, sans violation ni voile", () => {
    const r = render({ ...base, archetype: "single_statement", payload: { statement: "Something can be long over and still shape today." }, ground: groundFor(KIT, "cream") });
    expect(r.composition.idiom).toBe("circle");
    expect(r.svg).toMatch(/<clipPath id="eklio-clip-[a-z0-9]+"><circle /);
    expect(r.svg).toMatch(/<image data-photo="bg-[a-z-]+"[^>]*clip-path="url\(#eklio-clip-/);
    expect(r.svg).not.toContain('data-veil="local"');
    expect(violations(r.composition.placed)).toEqual([]);
  });

  it("dans un carrousel, les diapositives intérieures ne prennent pas le cercle", () => {
    expect(idiomFor("single_statement", "cream", 2)).toBeNull();
  });
});

describe("idiome 6 sur crème", () => {
  it("les bulles se posent sans dessin dessous, comme dans la spec (2026-11-04)", () => {
    const nodes = [{ label: "First thought", gloss: "the future feels decided" }, { label: "Small pause", gloss: "a prediction meets questions" }, { label: "New evidence", gloss: "the map can change" }];
    const r = render({ ...base, archetype: "cycle", payload: { nodes }, headline: "Predictions need a test", ground: groundFor(KIT, "cream") });
    expect(r.composition.idiom).toBe("bubbles");
    expect(r.svg).not.toContain("data-library");
    expect(violations(r.composition.placed)).toEqual([]);
  });
});

describe("idiome 7 sur crème", () => {
  it("pleine largeur, sans case ni dessin : une case affirmerait ce que le brief ne porte pas (2026-11-04)", () => {
    const items = [{ label: "First days", gloss: "decisions need attention" }, { label: "Later", gloss: "feelings find some room" }, { label: "Months on", gloss: "the change feels more real" }];
    const r = render({ ...base, archetype: "numbered_strategies", payload: { items }, headline: "Feelings can arrive later", ground: groundFor(KIT, "cream") });
    expect(r.composition.idiom).toBe("pills");
    expect(r.svg).not.toContain("data-library");
    expect(r.composition.placed.filter((p) => p.role === "figure" && p.band === "content")).toEqual([]);
    const fields = r.composition.placed.filter((p) => p.role === "field");
    expect(fields.length).toBe(3);
    for (const f of fields) expect(f.box.w).toBe(fields[0].box.w);
    expect(violations(r.composition.placed)).toEqual([]);
  });
});
