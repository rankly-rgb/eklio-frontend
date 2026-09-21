import { CLEARANCE, TYPE } from "@/lib/compose/constants";
import { FOOTER } from "@/lib/compose/constants-bands";
import { gap, parseBoxes } from "@/lib/compose/svg";

/*
 * ── LES CONTRÔLES, EN TANT QUE FONCTIONS ────────────────────────────────
 *
 * Ces quatre règles vivaient à l'intérieur des `expect` des suites. Ça
 * marchait, et ça avait un angle mort exact : un contrôle qui n'existe que
 * dans une assertion ne peut pas être mis en échec volontairement. On ne peut
 * donc PAS prouver qu'il attraperait la régression qu'il est censé attraper —
 * un contrôle qui ne regarde rien passe exactement comme un contrôle qui
 * regarde tout.
 *
 * C'est arrivé : le ratio 3:1 était vert pendant qu'une carte mesurait 2.89.
 *
 * Chaque fonction ici prend un DOCUMENT SVG et rend la liste de ce qui ne va
 * pas, en toutes lettres. Les suites de conformité les appellent sur les
 * cartes que le moteur produit ; `negatives.test.ts` les appelle sur des
 * documents fabriqués pour violer la règle, et exige qu'elles trouvent. Les
 * deux moitiés sont nécessaires, et aucune ne remplace l'autre.
 *
 * ⚠ ELLES LISENT LE SVG ÉMIS, jamais l'objet de composition dont il est issu.
 * Un bug de `toSvg` qui perdrait une boîte, ou l'écrirait dans le mauvais
 * repère, est invisible pour un contrôle qui lit l'objet — et c'est ce bug-là
 * qui publie une carte cassée en laissant la suite verte.
 */

export type Finding = string;

/** Le plancher absolu : rien, dans aucune bande, en dessous de ça. */
export const ABSOLUTE_FLOOR = Math.min(TYPE.label.floor, TYPE.gloss.floor, TYPE.mono.floor);

/**
 * Les planchers typographiques, et les bornes de la ligne d'affichage.
 *
 * Trois règles distinctes plutôt qu'une, parce que les trois cassent
 * différemment : un glyphe sous le plancher absolu est illisible à 1080px ;
 * une ligne d'affichage sous son minimum n'est plus la ligne d'affichage ; au
 * dessus de son maximum elle déborde de sa bande.
 */
export function absoluteFloorFindings(svg: string): Finding[] {
  const texts = parseBoxes(svg).filter((b) => b.role === "text");
  if (texts.length === 0) return ["the document carries no glyph box at all"];

  return texts
    .filter((t) => (t.size ?? 0) < ABSOLUTE_FLOOR)
    .map((t) => `a glyph in ${t.band} is set at ${t.size ?? 0}px, under the ${ABSOLUTE_FLOOR}px floor`);
}

/** La ligne d'affichage reste dans sa propre plage, des deux côtés. */
export function displayRangeFindings(svg: string): Finding[] {
  const display = parseBoxes(svg).filter((b) => b.role === "text" && b.band === "headline");
  if (display.length === 0) return ["the document carries no display line"];

  const out: Finding[] = [];
  for (const d of display) {
    const size = d.size ?? 0;
    if (size < TYPE.display.min) out.push(`the display is ${size}px, under ${TYPE.display.min}px`);
    if (size > TYPE.display.max) out.push(`the display is ${size}px, over ${TYPE.display.max}px`);
  }
  return out;
}

/** Les deux règles de plancher, en un appel. */
export function floorFindings(svg: string): Finding[] {
  return [...absoluteFloorFindings(svg), ...displayRangeFindings(svg)];
}

/**
 * Le ratio 3:1 entre la ligne d'affichage et le plus petit corps de la carte.
 *
 * ⚠ C'EST LA RÈGLE QUI ÉTAIT VÉRIFIABLE SANS ÊTRE APPLIQUÉE. Le moteur la
 * respecte depuis que `secondaryMax = floor(display / minTitleToLabelRatio)` borne
 * les bandes secondaires ; avant, une carte pouvait sortir à 2.89 et la suite
 * ne l'avait pas vue. `negatives.test.ts` prouve maintenant que cette
 * fonction-ci l'aurait vue.
 */
export function ratioFindings(svg: string): Finding[] {
  const texts = parseBoxes(svg).filter((b) => b.role === "text");
  if (texts.length === 0) return ["the document carries no glyph box at all"];

  const display = texts.filter((t) => t.band === "headline").map((t) => t.size ?? 0);
  if (display.length === 0) return ["the document carries no display line"];

  const biggest = Math.max(...display);
  const smallest = Math.min(...texts.map((t) => t.size ?? 0));
  if (smallest <= 0) return ["a glyph box carries no size"];

  const ratio = biggest / smallest;
  return ratio >= TYPE.minTitleToLabelRatio
    ? []
    : [
        `the display is ${biggest}px against a smallest of ${smallest}px — ` +
          `a ratio of ${ratio.toFixed(2)}, under ${TYPE.minTitleToLabelRatio}`,
      ];
}

/**
 * Les trois clearances mesurées entre BOÎTES.
 *
 * Jamais entre les choses qui les ont dessinées : une boîte de glyphe est la
 * boîte em d'une ligne composée, pas son encre, parce que les bornes de
 * l'encre bougent avec la chaîne — et une mise en page qui dépend des lettres
 * tapées casse à la légende suivante.
 */
export function glyphToStrokeFindings(svg: string): Finding[] {
  const boxes = parseBoxes(svg);
  if (boxes.length === 0) return ["the document carries no box at all"];

  const out: Finding[] = [];
  const texts = boxes.filter((b) => b.role === "text");
  const strokes = boxes.filter((b) => b.role === "stroke");
  for (const t of texts) {
    for (const stroke of strokes) {
      const d = gap(t.box, stroke.box);
      if (d < CLEARANCE.glyphToStroke) {
        out.push(`a glyph in ${t.band} is ${d}px from a stroke (floor ${CLEARANCE.glyphToStroke})`);
      }
    }
  }
  return out;
}

/** Deux champs teintés ne se rapprochent pas à moins de `fieldToField`. */
export function fieldToFieldFindings(svg: string): Finding[] {
  const fields = parseBoxes(svg).filter((b) => b.role === "field");
  const out: Finding[] = [];
  for (let i = 0; i < fields.length; i += 1) {
    for (let j = i + 1; j < fields.length; j += 1) {
      const d = gap(fields[i].box, fields[j].box);
      if (d < CLEARANCE.fieldToField) {
        out.push(`two tinted fields are ${d}px apart (floor ${CLEARANCE.fieldToField})`);
      }
    }
  }
  return out;
}

/** Rien ne descend à moins de `aboveFooter` du pied de carte. */
export function aboveFooterFindings(svg: string): Finding[] {
  const boxes = parseBoxes(svg);
  if (boxes.length === 0) return ["the document carries no box at all"];

  const out: Finding[] = [];
  for (const b of boxes) {
    if (b.band === "footer") continue;
    const clear = FOOTER.y - (b.box.y + b.box.h);
    if (clear < CLEARANCE.aboveFooter) {
      out.push(
        `a ${b.role} in ${b.band} is ${clear}px above the footer (floor ${CLEARANCE.aboveFooter})`
      );
    }
  }
  return out;
}

/** Les trois clearances, en un appel. */
export function clearanceFindings(svg: string): Finding[] {
  return [
    ...glyphToStrokeFindings(svg),
    ...fieldToFieldFindings(svg),
    ...aboveFooterFindings(svg),
  ];
}

/** Tout, en un appel, pour un document. */
export function auditFindings(svg: string): Finding[] {
  return [...floorFindings(svg), ...ratioFindings(svg), ...clearanceFindings(svg)];
}

/**
 * Réécrit le corps d'un glyphe dans le document émis, pour fabriquer une
 * violation.
 *
 * ⚠ EXPORTÉ DEPUIS LE CODE ET NON DEPUIS UN FICHIER DE TEST, à dessein. Un
 * mutateur qui vit dans la suite peut diverger du format que `toSvg` écrit
 * sans que rien ne le dise, et un mutateur qui ne mute plus rend tous les cas
 * négatifs verts — c'est-à-dire exactement le mode de panne qu'ils existent
 * pour couvrir. Ici, il partage le fichier des lecteurs, et
 * `negatives.test.ts` vérifie d'abord qu'il a bien changé le document.
 */
export function withGlyphSize(svg: string, band: string, size: number): string {
  let touched = false;
  const out = svg.replace(
    new RegExp(`(<g data-role="text" data-band="${band}"[^>]*>)([\\s\\S]*?)(</g>)`),
    (_all, head: string, inner: string, tail: string) => {
      touched = true;
      return head + inner.replace(/font-size="[0-9.]+"/g, `font-size="${size}"`) + tail;
    }
  );
  if (!touched) {
    throw new Error(`withGlyphSize: no text group in band "${band}" — the mutation would be a no-op`);
  }
  return out;
}

/**
 * Pose le même corps sur TOUTES les bandes de texte sauf la ligne
 * d'affichage.
 *
 * ⚠ C'EST LA SEULE FAÇON HONNÊTE DE FABRIQUER UN RATIO DONNÉ. Grossir une
 * seule bande ne change pas le plus petit corps de la carte tant qu'une autre
 * bande reste en dessous — et le cas négatif passe alors en ne mesurant rien.
 * Le ratio est une propriété du document entier, donc la mutation l'est aussi.
 */
export function withSecondarySizes(svg: string, size: number): string {
  let touched = false;
  const out = svg.replace(
    /<g data-role="text" data-band="([a-z]+)"[^>]*>[\s\S]*?<\/g>/g,
    (group, band: string) => {
      if (band === "headline") return group;
      touched = true;
      return group.replace(/font-size="[0-9.]+"/g, `font-size="${size}"`);
    }
  );
  if (!touched) {
    throw new Error("withSecondarySizes: no secondary text band — the mutation would be a no-op");
  }
  return out;
}

/**
 * Déplace de `dy` pixels toutes les boîtes des groupes portant ce `data-role`,
 * pour fabriquer une collision.
 *
 * ⚠ LES BOÎTES DU GROUPE *ET* CELLES DE SON CONTENU. `parseBoxes` lit la boîte
 * du groupe pour un champ, mais celles des éléments internes pour un texte et
 * pour un tracé. Un mutateur qui n'aurait touché que l'attribut du groupe
 * aurait donc produit un document inchangé aux yeux du lecteur — et des cas
 * négatifs verts pour la pire des raisons.
 *
 * Le rôle est celui du GROUPE : `text`, `figure`, `field`. Le lecteur, lui,
 * appelle `stroke` ce qui sort d'un groupe `figure`.
 */
export function shiftBoxes(svg: string, groupRole: "text" | "figure" | "field", dy: number): string {
  let touched = false;
  const shift = (box: string) => {
    const [x, y, w, h] = box.split(",").map(Number);
    return `${x},${y + dy},${w},${h}`;
  };

  const out = svg.replace(
    new RegExp(`<g data-role="${groupRole}" data-band="[a-z]+" data-box="[^"]+">[\\s\\S]*?</g>`, "g"),
    (group) => {
      touched = true;
      return group.replace(/data-box="([^"]+)"/g, (_all, box: string) => `data-box="${shift(box)}"`);
    }
  );

  if (!touched) {
    throw new Error(`shiftBoxes: no group with role "${groupRole}" — the mutation would be a no-op`);
  }
  return out;
}
