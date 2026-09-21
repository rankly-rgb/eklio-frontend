import { describe, expect, it } from "vitest";
import { composeWithFallback } from "@/lib/compose/fallback";
import { renderCarousel } from "@/lib/compose/engine";
import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { BODY, EYEBROW, FOOTER } from "@/lib/compose/constants-bands";
import { CANVAS, CLEARANCE, MARGIN } from "@/lib/compose/constants";
import { CARD, LENGTHS, PALETTES, payloadFor } from "@/lib/compose/__tests__/fixtures";
import type { Composition, Placed } from "@/lib/compose/types";

/*
 * ── RIEN NE SORT DE SA BANDE ────────────────────────────────────────────
 *
 * ⚠ LA SUITE DE DÉGAGEMENT NE POUVAIT PAS VOIR CE DÉFAUT-LÀ, ET C'EST TOUT
 * L'INTÉRÊT DE CE FICHIER.
 *
 * `violations()` mesure des distances ENTRE éléments : un glyphe à 40px d'un
 * trait, un champ à 48px d'un champ. Elle ne demande jamais si un élément est
 * encore DANS la bande qui le contient — et un élément sorti de sa bande est
 * à une distance parfaitement réglementaire de tout ce qui reste dedans.
 *
 * Mesuré le 2026-09-21 sur un vrai mois : `annotated_curve` posait le nom de
 * son axe vertical à `content.y − dégagement − sa hauteur`, donc au-dessus du
 * haut de la bande de contenu, dans l'écart de 48px qui la sépare du titre.
 * Sur la carte 25 du mois de wren.ashcombe, « what you carry » heurtait la
 * jambe du « p » de « break ». Toutes les suites étaient vertes.
 *
 * La géométrie est vérifiée sur ce que le produit LIVRE — `composeWithFallback`
 * — et non sur la première forme essayée.
 */

/**
 * Les bandes RÉELLES de cette composition-ci.
 *
 * ⚠ `headline` ET `content` NE PEUVENT PAS PARTAGER `BODY` DANS CE CONTRÔLE.
 * Les deux se partagent la bande du corps, et la frontière est décidée à la
 * composition — pas dans une constante. Les mapper toutes deux sur `BODY`
 * rendait le contrôle aveugle exactement là où le défaut s'était produit : un
 * nom d'axe posé au-dessus du haut de la bande de contenu tombe dans la moitié
 * TITRE du corps, donc reste « dans BODY », donc passe.
 *
 * La frontière se relit sur la composition : c'est le bas de la boîte du
 * titre, plus l'écart champ-à-champ — la définition de `splitBody`.
 */
function bandsOf(composition: Composition) {
  const headline = composition.placed.find((p) => p.band === "headline");
  const contentTop = headline
    ? headline.box.y + headline.box.h + CLEARANCE.fieldToField
    : BODY.y;
  return {
    eyebrow: EYEBROW,
    headline: { ...BODY, h: (headline?.box.y ?? BODY.y) + (headline?.box.h ?? 0) - BODY.y },
    content: { x: BODY.x, y: contentTop, w: BODY.w, h: BODY.y + BODY.h - contentTop },
    footer: FOOTER,
  } as const;
}

type Bands = ReturnType<typeof bandsOf>;

/** De combien `p` dépasse la bande qu'il déclare, par côté. */
function escapes(p: Placed, BANDS: Bands): string[] {
  const band = BANDS[p.band];
  const out: string[] = [];
  // Un dixième de pixel : `round2` arrondit des deux côtés d'une soustraction.
  const slack = 0.1;
  if (p.box.x < band.x - slack) out.push(`gauche de ${(band.x - p.box.x).toFixed(2)}px`);
  if (p.box.y < band.y - slack) out.push(`haut de ${(band.y - p.box.y).toFixed(2)}px`);
  if (p.box.x + p.box.w > band.x + band.w + slack) {
    out.push(`droite de ${(p.box.x + p.box.w - band.x - band.w).toFixed(2)}px`);
  }
  if (p.box.y + p.box.h > band.y + band.h + slack) {
    out.push(`bas de ${(p.box.y + p.box.h - band.y - band.h).toFixed(2)}px`);
  }
  return out;
}

/**
 * Les LIGNES aussi, pas seulement les boîtes qui les portent.
 *
 * ⚠ UNE BOÎTE DE TEXTE CONFORME PEUT PORTER UNE LIGNE QUI NE L'EST PAS : la
 * boîte est calculée par l'archétype, les lignes par `linesFrom`, et c'est la
 * seconde qu'un lecteur voit. C'est précisément le cas de l'axe vertical —
 * dont la boîte englobait le débordement et le déclarait donc « à l'intérieur ».
 */
function lineEscapes(p: Placed, BANDS: Bands): string[] {
  if (p.role !== "text") return [];
  const band = BANDS[p.band];
  const out: string[] = [];
  for (const l of p.lines) {
    if (l.box.y < band.y - 0.1) out.push(`« ${l.text} » sort de ${p.band} par le haut`);
    if (l.box.y + l.box.h > band.y + band.h + 0.1) out.push(`« ${l.text} » sort de ${p.band} par le bas`);
  }
  return out;
}

function offCanvas(p: Placed): string[] {
  const out: string[] = [];
  if (p.box.x < MARGIN - 0.1) out.push("passe la marge gauche");
  if (p.box.x + p.box.w > CANVAS.width - MARGIN + 0.1) out.push("passe la marge droite");
  if (p.box.y < 0 || p.box.y + p.box.h > CANVAS.height) out.push("sort de la toile");
  return out;
}

function auditAll(composition: Composition): string[] {
  const bands = bandsOf(composition);
  return composition.placed.flatMap((p) =>
    [...escapes(p, bands), ...lineEscapes(p, bands), ...offCanvas(p)].map(
      (why) => `${p.role}/${p.band}: ${why}`
    )
  );
}

describe("chaque élément reste dans sa bande", () => {
  const cases = ARCHETYPE_KEYS.flatMap((a) => LENGTHS.map((l) => [a, l] as const));

  it.each(cases)("%s / %s", (archetype, length) => {
    const input = { ...CARD, archetype, palette: PALETTES[0], payload: payloadFor(archetype, length) };
    const compositions =
      archetype === "carousel"
        ? renderCarousel(input).map((r) => r.composition)
        : (() => {
            const c = composeWithFallback(input);
            return c.kind === "carousel" ? c.slides.map((r) => r.composition) : [c.result.composition];
          })();

    for (const composition of compositions) expect(auditAll(composition)).toEqual([]);
  });

  it("sur les quatre palettes, y compris les fonds sombres", () => {
    for (const palette of PALETTES) {
      for (const archetype of ARCHETYPE_KEYS) {
        if (archetype === "carousel") continue;
        const composed = composeWithFallback({
          ...CARD,
          archetype,
          palette,
          payload: payloadFor(archetype, "nominal"),
        });
        const compositions =
          composed.kind === "carousel"
            ? composed.slides.map((r) => r.composition)
            : [composed.result.composition];
        for (const composition of compositions) {
          expect(auditAll(composition), `${archetype} / ${palette.key}`).toEqual([]);
        }
      }
    }
  });
});
