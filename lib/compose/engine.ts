import { ARCHETYPES } from "@/lib/compose/archetypes/index";
import { BODY, EYEBROW, FOOTER } from "@/lib/compose/constants-bands";
import { CLEARANCE, SERIF_FROM, TITLE_MAX_LINES, TYPE, CANVAS, CONTENT_MIN_AT_CANVAS, FIGURE_SCALES, MIN_FIGURE_EXTENT, THUMB } from "@/lib/compose/constants";
import { BudgetExceededError, budgetErrors } from "@/lib/compose/budget";
import { centreLines, fitText, fitTitle, linesFrom, splitBody } from "@/lib/compose/layout";
import { round2 } from "@/lib/compose/measure";
import { gap } from "@/lib/compose/svg";
import { toSvg } from "@/lib/compose/svg";
import type { Box, Composition, Palette, Placed, RenderInput } from "@/lib/compose/types";
import { DRAWING_FOR } from "@/lib/compose/illustrations";
import { libraryDrawing } from "@/lib/compose/library";
import { accentDrawing, decorFor } from "@/lib/compose/decor";
import { composeIdiom, idiomFor, type Idiom } from "@/lib/compose/idioms";
import { SOFT_TARGET, softest } from "@/lib/compose/grounds";


/*
 * ── THE OVERFLOW RESOLVER, IN ORDER, AND ONLY IN THAT ORDER ─────────────
 *
 *   1. shrink the illustration
 *   2. cut words
 *   3. break to a carousel
 *
 * ⚠ SETTING THE BODY SMALLER IS NOT ON THE LIST and never becomes step 4. A
 * card that fits because the labels went to 24px has not solved the problem, it
 * has moved it onto a phone screen where nobody will report it — they will just
 * not read it. `fitText` refuses below the floor, so the resolver cannot take
 * that step even by accident.
 *
 * ── AND THE CLEARANCES ARE CHECKED HERE, NOT ONLY IN THE SUITE ──────────
 *
 * `violations()` runs on every render. A composition that breaks a clearance is
 * not emitted; the resolver moves to its next step, and if it runs out of
 * steps, `render` throws. A constraint that only a test enforces is a
 * constraint that holds until somebody renders something the test did not
 * think of.
 */

export class CompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompositionError";
  }
}

export type Violation = { kind: string; a: Box; b: Box; measured: number; required: number };

/**
 * One hundredth of a pixel.
 *
 * ⚠ THIS IS NOT A TOLERANCE ON THE CLEARANCE, it is the precision of the
 * document. Coordinates are emitted with two decimals, so two values closer
 * than 0.01 produce identical output — and a rounded row height added three
 * times lands 0.0000001 short of an exact 48. Judging that as a violation
 * would mean the engine refuses layouts that are, in the file it writes,
 * exactly right.
 */
const EPSILON = 0.01;

function short(measured: number, required: number): boolean {
  return measured < required - EPSILON;
}

/**
 * Every clearance this composition breaks.
 *
 * ⚠ GLYPHS INSIDE A FIELD ARE EXEMPT FROM THAT FIELD. They are 32px from its
 * edge by construction (`cell`), which is the `glyphToFieldEdge` rule, and
 * measuring them against their own background would report every cell on every
 * card as a collision.
 */
export function violations(placed: Placed[]): Violation[] {
  const out: Violation[] = [];
  const fields = placed.filter((p) => p.role === "field");
  const figures = placed.filter((p) => p.role === "figure");
  const texts = placed.filter((p) => p.role === "text");

  // 1. glyph box vs drawn stroke
  for (const t of texts) {
    for (const l of (t as Extract<Placed, { role: "text" }>).lines) {
      for (const f of figures) {
        for (const s of (f as Extract<Placed, { role: "figure" }>).strokes) {
          const d = gap(l.box, s.box);
          if (short(d, CLEARANCE.glyphToStroke)) {
            out.push({ kind: "glyphToStroke", a: l.box, b: s.box, measured: d, required: CLEARANCE.glyphToStroke });
          }
        }
      }
    }
  }

  // 2. two tinted fields
  for (let i = 0; i < fields.length; i += 1) {
    for (let j = i + 1; j < fields.length; j += 1) {
      const d = gap(fields[i].box, fields[j].box);
      if (short(d, CLEARANCE.fieldToField)) {
        out.push({ kind: "fieldToField", a: fields[i].box, b: fields[j].box, measured: d, required: CLEARANCE.fieldToField });
      }
    }
  }

  /*
   * 3. anything above the footer.
   *
   * ⚠ EVERY STROKE'S OWN BOX, NOT THE FIGURE'S. A figure's box is where the
   * drawing was allotted; a stroke's box is where its ink actually is, and a
   * 4px line drawn on the allotment's bottom edge sticks 2px past it. The
   * first version checked only the figure and passed a composition whose rule
   * ran 62px above the footer — which the suite caught, because the suite
   * reads the strokes.
   */
  for (const p of placed) {
    if (p.band === "footer") continue;
    const boxes: Box[] =
      p.role === "figure"
        ? (p as Extract<Placed, { role: "figure" }>).strokes.map((s) => s.box)
        : [p.box];
    for (const box of boxes) {
      const d = round2(FOOTER.y - (box.y + box.h));
      if (short(d, CLEARANCE.aboveFooter)) {
        out.push({ kind: "aboveFooter", a: box, b: FOOTER, measured: d, required: CLEARANCE.aboveFooter });
      }
    }
  }

  return out;
}

/** Strip every gloss, for the resolver's second step. Non-destructive. */
function withoutGlosses(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload.map(withoutGlosses);
  if (payload !== null && typeof payload === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      out[k] = k === "gloss" ? "" : withoutGlosses(v);
    }
    return out;
  }
  return payload;
}


function bandText(
  band: "eyebrow" | "footer",
  box: Box,
  text: string,
  palette: Palette,
  secondaryMax: number
): Placed | null {
  const range = {
    min: TYPE.mono.min,
    max: Math.min(TYPE.mono.max, secondaryMax),
    floor: TYPE.mono.floor,
  };
  if (range.max < range.floor) return null;
  const fit = fitText(text, "mono", box.w, box.h, range);
  if (!fit) return null;
  return {
    role: "text",
    band,
    box: { ...box, h: fit.height },
    lines: linesFrom(fit, box.x, box.y, box.w, "mono", 500, palette.ink, "start"),
  };
}


/*
 * ── LE PLUS PETIT TEXTE DU DIAGRAMME, ET SEULEMENT LUI ──────────────────
 *
 * ⚠ PAS `smallest()`. Celui-là prend toute la carte, bandeau et pied compris,
 * et ces deux-là sont du chrome : personne ne lit « ROWAN MERCIER THERAPY »
 * dans une vignette, et les exiger à 34px déformerait chaque carte pour rien.
 * Ce qui doit rester lisible à 350, c'est ce que la carte DIT — la bande de
 * contenu.
 *
 * Rend 0 quand la bande est vide, ce qui est le cas d'une carte à une phrase :
 * sa phrase vit dans le bandeau de titre, et le bandeau de titre est le plus
 * gros texte de la carte. Une règle de lisibilité n'a rien à lui dire.
 */
export function smallestInContent(placed: Placed[]): number {
  let min = Infinity;
  for (const p of placed) {
    if (p.role !== "text" || p.band !== "content") continue;
    for (const line of p.lines) min = Math.min(min, line.size);
  }
  return min === Infinity ? 0 : min;
}

/** Lisible dans une vignette de 350px ? Vide compte comme lisible. */
/**
 * La part de la bande de contenu que le TRACÉ occupe réellement.
 *
 * ── ⚠ LA BOÎTE DÉCLARÉE N'EST PAS CE QU'ON VOIT ────────────────────────
 *
 * `FIGURE_COVERAGE` borne la boîte qu'un archétype RÉSERVE à son dessin, et
 * elle est respectée partout. Mais un dessin ne remplit pas sa boîte : le
 * profil du `quadrant_model` occupait 4,9 % de la bande là où sa boîte en
 * réservait bien davantage, et une notation indépendante l'a mesuré carte par
 * carte — « 2,4 à 6,3 % contre 9,2 à 9,4 % dans les références ».
 *
 * Cette fonction mesure l'ÉTENDUE DES TRACÉS, boîtes de traits réunies. C'est
 * la grandeur que l'œil juge, et celle sur laquelle le plancher porte.
 */
export function figureExtentShare(placed: Placed[]): number {
  const strokes = placed
    .filter((p) => p.role === "figure" && p.band === "content")
    .flatMap((p) => (p as Extract<Placed, { role: "figure" }>).strokes);
  if (strokes.length === 0) return 0;

  const content = placed.filter((p) => p.band === "content");
  if (content.length === 0) return 0;

  const extent = (boxes: Array<{ x: number; y: number; w: number; h: number }>) => {
    const x0 = Math.min(...boxes.map((b) => b.x));
    const y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + b.w));
    const y1 = Math.max(...boxes.map((b) => b.y + b.h));
    return (x1 - x0) * (y1 - y0);
  };

  const band = extent(content.map((p) => p.box));
  return band > 0 ? extent(strokes.map((s) => s.box)) / band : 0;
}

export function legibleAtThumb(placed: Placed[]): boolean {
  const px = smallestInContent(placed);
  return px === 0 || px >= CONTENT_MIN_AT_CANVAS;
}

export type RenderResult = { svg: string; composition: Composition; smallestSize: number };

/*
 * ── LA SIGNATURE : UNE LIGNE, CENTRÉE, EN KARLA (spec visuelle 2026-11-02) ──
 *
 * Nom du cabinet, point médian, numéro de licence — le contenu légal ne change
 * pas. Elle sort du mono (« ça faisait placeholder »). 25px (spec), jusqu'à 22
 * si la ligne est longue ; au pied de la bande, centrée ; dans la teinte
 * secondaire résolue à 4,5:1 sur le fond. Sur une photo, le voile local la
 * protège comme toute ligne.
 */
function signature(text: string, fill: string): Placed | null {
  const fit = fitText(text, "sans", FOOTER.w, FOOTER.h, { min: 22, max: 25, floor: 22 });
  if (!fit || fit.lines.length > 1) return null;
  const y = round2(FOOTER.y + FOOTER.h - fit.height);
  const lines = centreLines(linesFrom(fit, FOOTER.x, y, FOOTER.w, "sans", 400, fill, "middle"), FOOTER);
  return { role: "text", band: "footer", box: { x: FOOTER.x, y, w: FOOTER.w, h: fit.height }, lines };
}

function renderIdiom(input: RenderInput, idiom: Idiom, parsed: unknown, soft: string): RenderResult {
  const g = input.ground!;
  const statement =
    (parsed as { statement?: string }).statement ?? input.headline;
  const content = composeIdiom({ idiom, statement, eyebrow: input.eyebrow, illustration: input.illustration!, gp: { ...g, soft } });
  if (!content) throw new CompositionError(`${input.archetype}: idiome ${idiom} — le texte ne tient pas au-dessus de son plancher`);
  const footer = signature(input.footer, soft);
  if (!footer) throw new CompositionError(`${input.archetype}: la signature ne tient pas sur une ligne`);
  const placed = [...content, footer];
  const broken = violations(placed);
  if (broken.length > 0) throw new CompositionError(`${input.archetype}: idiome ${idiom} — ${broken[0].kind}`);
  const decor = decorFor(input.archetype, input.illustration!, input.palette, placed, g.ground);
  const composition: Composition = {
    archetype: input.archetype,
    paletteKey: input.palette.key,
    placed,
    overflowedToCarousel: false,
    resolution: [`idiom: ${idiom}`],
    idiom,
    ground: g.ground,
    decor,
  };
  return { svg: toSvg(composition, input.palette.paper), composition, smallestSize: smallest(placed) };
}

export function render(input: RenderInput): RenderResult {
  const archetype = ARCHETYPES[input.archetype];
  if (!archetype) throw new CompositionError(`unknown archetype: ${input.archetype}`);

  // ── STEP 0: the word budget, before anything is measured ────────────────
  const errors = budgetErrors(input.archetype, input.payload);
  if (errors.length > 0) throw new BudgetExceededError(input.archetype, errors);

  const parsed = archetype.parse(input.payload);
  if (parsed === null) throw new CompositionError(`${input.archetype}: payload does not parse`);

  /*
   * ⚠ LE FOND DU MOIS DÉCIDE DU PAPIER ET DE L'ENCRE (2026-11-02). Les aplats
   * restent ceux de la palette ; le papier devient le fond, l'encre celle qui y
   * tient, et le texte secondaire la teinte résolue au plancher.
   */
  if (input.ground) {
    const g = input.ground;
    input = { ...input, palette: { ...input.palette, paper: g.ground === "photo" ? g.veil : g.background, ink: g.ink } };
  }
  const soft = input.ground?.soft ?? softest(input.palette.ink, input.palette.paper, input.palette.paper, SOFT_TARGET) ?? input.palette.ink;

  const idiom = input.illustration && input.ground ? idiomFor(input.archetype, input.ground.ground, input.slide) : null;
  /*
   * ⚠ UN IDIOME QUI REFUSE LAISSE LA PLACE À LA MISE EN PAGE ORDINAIRE, SUR LE
   * MÊME FOND. La citation au script n'accepte que trois lignes au-dessus de
   * 110px : une phrase plus longue n'y est pas rapetissée sans fin, elle est
   * composée comme une phrase seule sur fond profond. Rien ne passe sous un
   * plancher ; la planche compte les idiomes réellement rendus.
   */
  if (idiom) {
    try {
      return renderIdiom(input, idiom, parsed, soft);
    } catch (error) {
      if (!(error instanceof CompositionError)) throw error;
    }
  }

  const display = archetype.displayText ? archetype.displayText(parsed) : input.headline;
  const resolution: string[] = [];
  /** La meilleure taille de contenu vue, quand c'est la vignette qui a refusé. */
  let illegible = 0;
  /** La part couverte par le tracé au dernier essai refusé pour cette raison. */
  let tooSmall = 0;

  /*
   * ⚠ A THIRD OF THE BODY, NOT A HALF.
   *
   * `fitText` takes the LARGEST size that fits, so the bound handed to it is
   * what decides the headline's size — and through it, everything the diagram
   * has left. At 55% a three-line headline at 110px was legal, it ate 389px,
   * and every archetype with three rows of cells then failed to reach its own
   * label floor. The failure surfaced as "does not fit, break to a carousel",
   * which is a true sentence about a card whose real problem was upstream.
   *
   * A third leaves the content band about 700px, which is three cells with
   * their glosses, or five without. That is the shape of this product's cards.
   */
  /*
   * ⚠ ÉQUILIBRÉ, SANS VEUVE, AU PLUS `TITLE_MAX_LINES` LIGNES (2026-11-02). En
   * Cormorant Garamond à partir de `SERIF_FROM`, en Fraunces en dessous.
   */
  const serifFit = fitTitle(display, "serif", BODY.w, BODY.h * 0.34, { min: SERIF_FROM, max: TYPE.display.max }, TITLE_MAX_LINES);
  const displayFit = serifFit ?? fitTitle(display, "display", BODY.w, BODY.h * 0.34, { min: TYPE.display.min, max: SERIF_FROM - 1 }, TITLE_MAX_LINES);
  const displayFamily = serifFit ? "serif" : "display";
  if (!displayFit) {
    throw new CompositionError(`${input.archetype}: the display line will not set above ${TYPE.display.min}px`);
  }

  /*
   * ⚠ LE TITRE EST POSÉ D'ABORD, ET LA HIÉRARCHIE EN DÉCOULE. La règle est
   * « le titre fait au moins deux fois le libellé », et c'est le seul ordre
   * dans lequel elle s'impose au lieu de se vérifier après coup.
   *
   * ⚠ DEUX, PAS TROIS, et le plancher absolu passe devant. À 3, un titre posé
   * à 64px plafonnait les libellés à 21px — sous leur propre plancher — et la
   * carte était refusée. Le moteur a répondu en ne portant plus rien.
   */
  const secondaryMax = Math.floor(displayFit.size / TYPE.minTitleToLabelRatio);

  const eyebrow = bandText("eyebrow", EYEBROW, input.eyebrow, { ...input.palette, ink: soft }, secondaryMax);
  const footer = signature(input.footer, soft);
  if (!eyebrow || !footer) {
    throw new CompositionError(
      `${input.archetype}: eyebrow or footer will not set between its floor and ${secondaryMax}px`
    );
  }

  const split = splitBody(BODY, displayFit.height);
  const displayBlock: Placed = {
    role: "text",
    band: "headline",
    box: { ...split.headline, h: displayFit.height },
    lines: linesFrom(displayFit, BODY.x, BODY.y, BODY.w, displayFamily, 500, input.palette.ink, "start"),
  };

  /*
   * ⚠ LE DESSIN EST CELUI DU POST, PAS CELUI DE L'ARCHÉTYPE (2026-11-01).
   * Jusqu'ici chaque archétype importait son dessin attitré — la plante pour
   * `numbered_strategies`, quel que soit le sujet. Le dessin choisi par le sens
   * (`input.illustration`) passe maintenant par `draw` ; le dessin fait main ne
   * reste que pour un post qui n'en porte pas (écrit avant la bibliothèque).
   */
  const handDrawn = DRAWING_FOR[input.archetype];
  const draw = input.illustration
    ? libraryDrawing(input.illustration)
    : (box: Box, colour: string, width?: number) => (handDrawn ? handDrawn(box, colour, width) : []);

  const accent = input.illustration ? accentDrawing(input.illustration) : undefined;

  // ── STEPS 1 AND 2, in order ─────────────────────────────────────────────
  for (const [pass, payload] of [
    ["full", parsed] as const,
    ["glossless", archetype.parse(withoutGlosses(input.payload))] as const,
  ]) {
    if (payload === null) continue;
    if (pass === "glossless") resolution.push("cut words: glosses dropped");

    for (const figureScale of FIGURE_SCALES) {
      const content = archetype.compose({
        payload,
        palette: input.palette,
        content: split.content,
        figureScale,
        secondaryMax,
        draw,
        illustrated: !!input.illustration,
        accent,
      });
      if (content === null) continue;

      const placed = [eyebrow, displayBlock, ...content, footer];
      if (violations(placed).length > 0) continue;

      /*
       * ⚠ LA VIGNETTE EST UNE CONDITION D'ACCEPTATION, PAS UN AVERTISSEMENT.
       * Placée ici, elle laisse le résolveur continuer : l'essai suivant
       * réduit l'illustration, puis la passe sans glosses redonne aux
       * libellés la place qu'elles prenaient. C'est l'échelle existante qui
       * répare, et elle n'a jamais eu de raison de se déclencher pour ça.
       */
      if (!legibleAtThumb(placed)) {
        illegible = smallestInContent(placed);
        continue;
      }

      /*
       * ⚠ ET LE DESSIN DOIT OCCUPER SA PLACE, PAS SEULEMENT L'AVOIR RÉSERVÉE.
       *
       * Comme la vignette, ce refus laisse l'échelle continuer — mais dans
       * l'autre sens : c'est au cran le plus GÉNÉREUX que le tracé a le plus
       * de place, donc un refus ici ne se répare pas en rétrécissant. Il sert
       * au repli, qui cherchera une forme dont l'objet tient sa place.
       *
       * `single_statement` en est exempt : sa marque est spécifiée comme
       * petite, et lui imposer 9 % ferait d'une respiration un objet.
       */
      if (archetype.illustrationZone !== "none" && input.archetype !== "single_statement") {
        const share = figureExtentShare(placed);
        if (share > 0 && share < MIN_FIGURE_EXTENT) {
          tooSmall = share;
          continue;
        }
      }

      if (figureScale < 1) resolution.push(`illustration shrunk to ${figureScale}`);

      /*
       * ⚠ LE DÉCOR SUIT LE DESSIN, ET IL EST POSÉ APRÈS LA COMPOSITION : la
       * protection d'un fond photo se résout ligne par ligne, et la forme se
       * pose sous le dessin — il faut savoir où ils sont. Sans dessin de la
       * bibliothèque, aucune couche : la carte d'avant reste ce qu'elle était.
       */
      const decor = input.illustration ? decorFor(input.archetype, input.illustration, input.palette, placed, input.ground?.ground) : undefined;

      const composition: Composition = {
        archetype: input.archetype,
        paletteKey: input.palette.key,
        placed,
        overflowedToCarousel: false,
        resolution,
        ...(decor ? { decor } : {}),
        ...(input.ground ? { ground: input.ground.ground } : {}),
      };
      return {
        svg: toSvg(composition, input.palette.paper),
        composition,
        smallestSize: smallest(placed),
      };
    }
  }

  // ── STEP 3 ──────────────────────────────────────────────────────────────
  // Nothing was set below a floor to get here, and nothing will be. The caller
  // is told to break to a carousel, which is the last step and the only one
  // left.
  /*
   * ⚠ DEUX REFUS DIFFÉRENTS, DEUX PHRASES DIFFÉRENTES. « Ça ne tient pas » et
   * « ça tient mais personne ne le lira dans un fil » appellent des replis
   * différents, et un appelant qui ne peut pas les distinguer les traite
   * pareil. Le second cite la mesure.
   */
  /*
   * ⚠ NOMMÉ AVANT L'ILLISIBILITÉ, parce qu'un dessin trop petit se corrige en
   * changeant de forme et non en rétrécissant le texte : c'est le repli qui
   * doit l'entendre, et le message doit lui dire quoi chercher.
   */
  if (tooSmall > 0) {
    throw new CompositionError(
      `${input.archetype}: the drawing covers ${(tooSmall * 100).toFixed(1)}% of the content band, ` +
        `under the ${(MIN_FIGURE_EXTENT * 100).toFixed(0)}% floor — fall back to a form whose object fills its place`
    );
  }

  if (illegible > 0) {
    throw new CompositionError(
      `${input.archetype}: sets at ${illegible}px, which is ` +
        `${((illegible * THUMB.width) / CANVAS.width).toFixed(1)}px in a ${THUMB.width}px thumbnail ` +
        `— under the ${THUMB.minPx}px floor`
    );
  }

  throw new CompositionError(
    `${input.archetype}: does not fit one card at the typographic floors — break to a carousel`
  );
}

/** The smallest type size on the card. The display/smallest ratio is checked against it. */
export function smallest(placed: Placed[]): number {
  let min = Infinity;
  for (const p of placed) {
    if (p.role !== "text") continue;
    for (const l of p.lines) min = Math.min(min, l.size);
  }
  return min === Infinity ? 0 : min;
}

/**
 * A carousel, card by card.
 *
 * Each card goes through `render` on its own archetype, which means each card
 * gets the same floors, the same clearances and the same resolver. A carousel
 * is more cards, not weaker cards.
 */
export function renderCarousel(input: RenderInput): RenderResult[] {
  const archetype = ARCHETYPES.carousel;
  const parsed = archetype.parse(input.payload) as { cards: Array<{ archetype_key: string; payload: unknown }> } | null;
  if (!parsed) throw new CompositionError("carousel: payload does not parse");

  return parsed.cards.map((card, i) =>
    render({
      ...input,
      archetype: card.archetype_key,
      payload: card.payload,
      eyebrow: `${input.eyebrow} ${i + 1}/${parsed.cards.length}`,
      slide: i,
      ground: i === 0 || !input.ground || input.ground.ground !== "photo" ? input.ground : (input.ground.rest ?? null),
    })
  );
}
