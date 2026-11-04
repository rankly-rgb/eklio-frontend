import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contrastRatio } from "@/lib/brand/color";
import { render } from "@/lib/compose/engine";
import { cardPalette } from "@/lib/compose/palette";
import { grainedWorst, groundFor } from "@/lib/compose/grounds";
import { fitTitle } from "@/lib/compose/layout";
import { CANVAS, MARGIN } from "@/lib/compose/constants";
import { IDIOM_BOTTOM, IDIOM_TOP } from "@/lib/compose/idioms";
import { floorFor, textClass } from "@/lib/compose/text-class";
import {
  EMPHASIS_MAX_CHARS,
  PAYLOAD_SCHEMAS,
  payloadShape,
  schemaAccepts,
  STATEMENT_MAX_CHARS,
  STATEMENT_TARGET_CHARS,
} from "@/lib/compose/archetypes/schema";
import { copyEnvelopeFormat } from "@/lib/content/generate/provider";
import { validateCopy, validEmphasis } from "@/lib/content/generate/copy-batch";

/*
 * LE CHANTIER ÉCRITURE (2026-11-04) : ce que le rédacteur produit porte la mise
 * en page — la forme de la charge utile, la longueur de la phrase, l'emphase.
 */

describe("liste ou phrase : la forme se lit dans le schéma, pas dans une table", () => {
  it("huit archétypes à liste, trois à phrase (le carrousel par sa couverture)", () => {
    const keys = [...Object.keys(PAYLOAD_SCHEMAS), "carousel"];
    const phrase = keys.filter((k) => payloadShape(k) === "phrase").sort();
    expect(phrase).toEqual(["carousel", "practitioner_card", "single_statement"]);
    expect(keys.filter((k) => payloadShape(k) === "list")).toHaveLength(8);
  });
});

describe("la longueur de la phrase seule entre dans la mise en page la plus étroite", () => {
  const raw = JSON.parse(readFileSync("lib/content/__tests__/fixtures/november-2026-journal.json", "utf8"));
  const J = (raw.posts ?? raw) as Array<{ archetype: string; payload: { statement?: string } }>;
  const statements = J.filter((p) => p.archetype === "single_statement").map((p) => p.payload.statement!);
  /* Chaque phrase de novembre, coupée en fin de mot au plus près du plafond. */
  const cut = statements
    .map((s) => {
      let out = "";
      for (const w of s.split(/\s+/)) if ((out ? `${out} ${w}` : w).length <= STATEMENT_MAX_CHARS) out = out ? `${out} ${w}` : w;
      return out;
    })
    .filter((s) => s.split(" ").length >= 4);
  const inner = CANVAS.width - 2 * (MARGIN + 8);

  it("à 60 caractères, au moins neuf sur dix entrent dans la citation au script (4 lignes, ≥ 96 px)", () => {
    const ok = cut.filter((s) => fitTitle(s, "script", inner, IDIOM_BOTTOM - IDIOM_TOP, { min: 96, max: 168 }, 4, 1.0)).length;
    expect(ok / cut.length).toBeGreaterThanOrEqual(0.9);
  });

  it("et toutes dans le cercle et le grand dessin (serif ≥ 80 px)", () => {
    for (const s of cut) expect(fitTitle(s, "serif", inner, (IDIOM_BOTTOM - IDIOM_TOP) * 0.4, { min: 80, max: 96 }, 4, 1.02), s).not.toBeNull();
  });

  it("le schéma strict la borne, la consigne vise plus bas", () => {
    expect(schemaAccepts(PAYLOAD_SCHEMAS.single_statement, { statement: "x".repeat(STATEMENT_MAX_CHARS) })).toBe(true);
    expect(schemaAccepts(PAYLOAD_SCHEMAS.single_statement, { statement: "x".repeat(STATEMENT_MAX_CHARS + 1) })).toBe(false);
    expect(STATEMENT_TARGET_CHARS).toBeLessThan(STATEMENT_MAX_CHARS);
  });
});

const envelope = (payload: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ payload, card_line: "Rest is not earned", caption: "A caption.", alt_text: "Alt.", rationale: "Because.", emphasis: "", ...extra });

describe("validateCopy : la phrase coupée par le plafond est refusée", () => {
  it("au-delà du plafond", () => {
    expect(validateCopy("single_statement", envelope({ statement: `${"word ".repeat(13)}end.` })).reason).toBe("statement_too_long");
  });
  it("au plafond sans ponctuation, ou avec une écriture étrangère (le sondage du 2026-11-04)", () => {
    const at = "Rest is a skill your body relearns slowly and with care too";
    expect(at.length).toBe(STATEMENT_MAX_CHARS - 1);
    expect(validateCopy("single_statement", envelope({ statement: `${at}x` })).reason).toBe("statement_cut");
    expect(validateCopy("single_statement", envelope({ statement: "At dawn, the calm lake held a银" })).reason).toBe("statement_cut");
  });
});

describe("l'emphase : une sous-chaîne exacte du titre, ou rien", () => {
  const statement = "Something can be long over and still shape today.";
  it("exacte, sur des frontières de mot : gardée dans le payload", () => {
    const r = validateCopy("single_statement", envelope({ statement }, { emphasis: "still shape today" }));
    expect(r.ok).toBe(true);
    expect((r.payload as { emphasis?: string }).emphasis).toBe("still shape today");
    expect(r.emphasisIgnored).toBeUndefined();
  });
  it("approchée (casse, mot coupé, absente) : écartée, le post reste", () => {
    for (const e of ["Still shape today", "till shape", "shape tomorrow"]) {
      const r = validateCopy("single_statement", envelope({ statement }, { emphasis: e }));
      expect(r.ok).toBe(true);
      expect(r.emphasisIgnored).toBe(true);
      expect((r.payload as { emphasis?: string }).emphasis).toBeUndefined();
    }
  });
  it("sur les autres cartes, elle cite la card_line ; jamais le titre entier, jamais plus de quatre mots", () => {
    expect(validEmphasis("not earned", "Rest is not earned")).toBe(true);
    expect(validEmphasis("Rest is not earned", "Rest is not earned")).toBe(false);
    expect(validEmphasis("a b c d e", "x a b c d e y")).toBe(false);
  });
  it("le schéma strict exige le champ, borné", () => {
    const f = copyEnvelopeFormat("single_statement") as { schema: { required: string[]; properties: Record<string, { maxLength?: number }> } };
    expect(f.schema.required).toContain("emphasis");
    expect(f.schema.properties.emphasis.maxLength).toBe(EMPHASIS_MAX_CHARS);
  });
});

describe("le rendu : italique, et une encre de texte dédiée qui tient le plancher de sa classe", () => {
  const KITS = [
    { primary: "#B4674A", secondary: "#C08A3E", light: "#F4EEE3", dark: "#2B2A27", paper: "#FAF6EE" },
    { primary: "#6F8F7A", secondary: "#B9A27A", light: "#EEF0EA", dark: "#23302A", paper: "#F7F6F1" },
    { primary: "#8C6A9E", secondary: "#C7A27C", light: "#F2EEF4", dark: "#2A2430", paper: "#FAF7F9" },
  ];
  const payload = { statement: "Something can be long over and still shape today.", emphasis: "still shape today" };

  for (const [k, kit] of KITS.entries()) {
    for (const g of ["cream", "ochre", "terra", "deep", "photo"] as const) {
      it(`kit ${k}, fond ${g}`, () => {
        const ground = groundFor(kit, g)!;
        const r = render({ archetype: "single_statement", payload, headline: "Still shaping", eyebrow: "NOT THE ONLY ONE", footer: "Ember · LMFT 1", palette: cardPalette("c", kit, false), illustration: "grief-two-paths", ground });
        const lines = r.composition.placed.flatMap((p) => (p.role === "text" && p.band === "headline" ? p.lines : []));
        const em = lines.filter((l) => l.spans?.some((s) => s.emphasis));
        if (lines.every((l) => l.family === "script")) {
          expect(em).toEqual([]); /* la citation au script n'en prend pas */
          return;
        }
        expect(em.length).toBeGreaterThan(0);
        expect(em.map((l) => l.spans!.filter((s) => s.emphasis).map((s) => s.text).join(" ")).join(" ")).toBe("still shape today");
        expect(r.svg).toContain('font-style="italic"');
        for (const l of em) {
          if (g === "photo") {
            expect(l.emphasisFill).toBe(l.fill);
            continue;
          }
          const worst = grainedWorst(ground.background, g);
          expect(contrastRatio(l.emphasisFill!, worst)).toBeGreaterThanOrEqual(floorFor(textClass(l.size, l.weight, "headline")));
          expect(l.emphasisFill).not.toBe(l.fill);
        }
      });
    }
  }

  it("une emphase absente des lignes du titre ne produit rien", () => {
    const r = render({ archetype: "single_statement", payload: { ...payload, emphasis: "never written" }, headline: "x y", eyebrow: "E", footer: "F", palette: cardPalette("c", KITS[0], false), illustration: "grief-two-paths", ground: groundFor(KITS[0], "cream") });
    expect(r.svg).not.toContain("data-emphasis");
  });
});
