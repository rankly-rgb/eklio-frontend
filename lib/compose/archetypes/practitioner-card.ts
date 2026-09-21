import { CLEARANCE, TYPE } from "@/lib/compose/constants";
import { fitText, linesFrom, FIELD_RADIUS } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import { door } from "@/lib/compose/illustrations";
import { tintFor } from "@/lib/compose/palette";
import type { Line, Placed } from "@/lib/compose/types";
import type { ArchetypeModule } from "@/lib/compose/archetypes/types";

export type PractitionerCard = { lines: string[] };

/**
 * Two to four plain facts about how she works.
 *
 * ⚠ NO TITLE, NO CREDENTIAL, AND NO FIELD FOR ONE. Which practice title a
 * licensee may print is decided state by state (`license_type_states`), and a
 * second source for it inside a card payload is exactly how "psychologist"
 * ends up on the card of somebody who may not write it. The lines are free
 * text because they are facts she already gave — hours, telehealth, a waitlist
 * — and none of them is a claim about her licence.
 */
export const practitionerCard: ArchetypeModule<PractitionerCard> = {
  key: "practitioner_card",
  illustrationZone: "none",
  tintCount: 1,

  parse(payload) {
    const p = payload as Record<string, unknown> | null;
    if (!p || !Array.isArray(p.lines)) return null;
    if (p.lines.length < 2 || p.lines.length > 4) return null;
    if (!p.lines.every((l) => typeof l === "string")) return null;
    return { lines: p.lines as string[] };
  },

  compose({ payload, palette, content, secondaryMax }) {
    const pad = CLEARANCE.glyphToFieldEdge;
    const innerW = content.w - pad * 2;
    const gapBetween = 20;

    const labelRange = { ...TYPE.label, max: Math.min(TYPE.label.max, secondaryMax) };
    if (labelRange.max < labelRange.floor) return null;
    const fits = payload.lines.map((text) =>
      fitText(text, "sans", innerW, labelRange.max * 2.4, labelRange)
    );
    if (fits.some((f) => f === null)) return null;

    const total = fits.reduce((sum, f) => sum + f!.height, 0) + gapBetween * (payload.lines.length - 1);
    const fieldH = round2(total + pad * 2);
    if (fieldH > content.h) return null;

    const box = { x: content.x, y: content.y, w: content.w, h: fieldH };
    const lines: Line[] = [];
    let y = round2(content.y + pad);
    for (let i = 0; i < fits.length; i += 1) {
      lines.push(...linesFrom(fits[i]!, round2(content.x + pad), y, innerW, "sans", i === 0 ? 600 : 400, palette.inkOnTint, "start"));
      y = round2(y + fits[i]!.height + gapBetween);
    }

    /*
     * ⚠ UN BLOC DE TROIS LIGNES N'EST PAS UNE CARTE, C'EST UNE ADRESSE. La
     * porte entrouverte est ce que cette carte propose : entrer. Elle est
     * posée SOUS le bloc, dans la place qui reste, et seulement s'il en reste
     * assez — une porte écrasée serait pire que pas de porte.
     */
    const placed: Placed[] = [
      { role: "field", band: "content", box, fill: tintFor(palette, 0), radius: FIELD_RADIUS },
      { role: "text", band: "content", box, lines },
    ];

    const left = round2(content.h - fieldH - CLEARANCE.fieldToField);
    if (left >= 150) {
      const size = round2(Math.min(left, content.w * 0.3));
      const draw = {
        x: round2(content.x + (content.w - size) / 2),
        y: round2(box.y + fieldH + CLEARANCE.fieldToField),
        w: size,
        h: size,
      };
      placed.push({ role: "figure", band: "content", box: draw, strokes: door(draw, palette.ink) });
    }

    return placed;
  },
};
