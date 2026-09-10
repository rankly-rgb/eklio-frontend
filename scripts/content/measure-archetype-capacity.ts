/*
 * ── HOW MUCH TEXT EACH LAYOUT PHYSICALLY HOLDS ──────────────────────────
 *
 * Step 4 of the Content generator picks the archetype — the satori layout —
 * from what the caption's LENGTH allows. That decision needs a number, and the
 * chantier's instruction was explicit: measure against real captions rather
 * than assuming, and record what you measure.
 *
 * So this measures. It renders real sentences, in the real typefaces from
 * `type_pairings`, at the real geometry in `lib/kit/render/social-posts.ts`,
 * and finds the longest caption that still fits inside the text box.
 *
 * ── WHY IT IS A SCRIPT AND NOT A TEST ───────────────────────────────────
 *
 * It reaches fonts.googleapis.com, so it cannot run in the suite. Its OUTPUT
 * is what belongs in the repo: a table of measured capacities that the
 * generator reads as data. Re-run it whenever the layouts or the pairings
 * change; the numbers are facts about a rendering, not constants someone
 * chose.
 *
 * ── HOW "FITS" IS DECIDED ───────────────────────────────────────────────
 *
 * satori lays out the text and returns SVG. A caption that overflows its box
 * does not error — it just spills, which is exactly the failure that would
 * ship silently. So the measurement renders the text block on its own, with
 * the real width and font, reads back the laid-out HEIGHT from the SVG, and
 * compares it with the height the layout actually reserves.
 *
 *   npx tsx scripts/content/measure-archetype-capacity.ts
 */

import satori from "satori";
import { createElement } from "react";

/* ── The real geometry, read from lib/kit/render/social-posts.ts ─────────── */

const POST_SIZE = 1080;
const STORY_HEIGHT = 1920;

/**
 * One row per archetype, mirroring the renderer.
 *
 * `reserved` is the height the text may occupy: the canvas minus the padding
 * on both sides, minus whatever else the layout puts in the same column (a
 * practice name under a signature, a label above notes). Those subtractions
 * are the honest part — a capacity measured against the whole canvas would
 * promise room that the layout has already spent.
 */
type Layout = {
  archetype: string;
  fontSize: number;
  lineHeight: number;
  /** Horizontal padding, both sides. */
  padX: number;
  /** Vertical padding, both sides. */
  padY: number;
  canvasHeight: number;
  /** Height already committed to other elements in the text column. */
  reservedByOthers: number;
  /** Which face: the display/heading face, or the body face. */
  face: "heading" | "body";
};

const LAYOUTS: Layout[] = [
  { archetype: "statement", fontSize: 96, lineHeight: 1.14, padX: 96, padY: 96,
    canvasHeight: POST_SIZE, reservedByOthers: 0, face: "heading" },
  { archetype: "question", fontSize: 84, lineHeight: 1.14, padX: 96, padY: 96,
    canvasHeight: POST_SIZE, reservedByOthers: 0, face: "heading" },
  { archetype: "notes", fontSize: 44, lineHeight: 1.4, padX: 96, padY: 104,
    canvasHeight: POST_SIZE, reservedByOthers: 96, face: "body" },
  { archetype: "signature", fontSize: 72, lineHeight: 1.2, padX: 96, padY: 96,
    canvasHeight: POST_SIZE, reservedByOthers: 120, face: "heading" },
  { archetype: "story", fontSize: 72, lineHeight: 1.2, padX: 96, padY: 96,
    canvasHeight: STORY_HEIGHT, reservedByOthers: 160, face: "heading" },
];

/* ── The pairings, as they are in `type_pairings` ────────────────────────── */

const PAIRINGS: { id: string; heading: string; body: string }[] = [
  { id: "fraunces_nunito",   heading: "Fraunces",           body: "Nunito Sans" },
  { id: "cormorant_source",  heading: "Cormorant Garamond", body: "Source Sans 3" },
  { id: "newsreader_work",   heading: "Newsreader",         body: "Work Sans" },
  { id: "lora_source3",      heading: "Lora",               body: "Source Sans 3" },
  { id: "caslon_inter",      heading: "Libre Caslon Text",  body: "Inter" },
  { id: "sourceserif_inter", heading: "Source Serif 4",     body: "Inter" },
];

/*
 * The same three user agents `lib/kit/render/font-cache.ts` uses, for the same
 * undocumented reason: Google's CSS2 API branches its `src` format on UA, and
 * only some of them yield a `format('truetype')`. Copied rather than imported
 * because that module reaches Supabase storage, which this script does not
 * need and cannot reach.
 */
const TTF_FORCING_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.34 (KHTML, like Gecko) UnrealSourceEngine UnrealEngine3",
  "Mozilla/5.0 (Linux; U; Android 2.3.6; en-us; Nexus S Build/GRK39F) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
  "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/525.13 (KHTML, like Gecko) Version/3.1 Safari/525.13",
];

async function fetchTtf(family: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
  for (const ua of TTF_FORCING_USER_AGENTS) {
    const css = await fetch(url, { headers: { "user-agent": ua } }).then((r) => r.text());
    const match = css.match(/src:\s*url\((https:[^)]+\.ttf)\)/);
    if (!match) continue;
    const bytes = await fetch(match[1]).then((r) => r.arrayBuffer());
    if (bytes.byteLength > 0) return bytes;
  }
  throw new Error(`No truetype src for ${family} from any of the three user agents.`);
}

/*
 * ── REAL SENTENCES, NOT LOREM ───────────────────────────────────────────
 *
 * Capacity depends on where the words break, and lorem breaks differently
 * from English. These are written in the six registers' own shapes, so the
 * number that comes out is a number about captions this product will actually
 * produce.
 */
const CORPUS = [
  "Some weeks the hardest part is just getting to the appointment.",
  "What would it mean to stop apologising for needing time?",
  "We start where you are, not where you think you should be.",
  "You are allowed to find this harder than it looks from outside.",
  "Evening sessions are open again, and telehealth covers the whole state.",
  "September asks a lot of people who spent August holding it together.",
  "Rest is not a reward for finishing. It is part of the work.",
  "The first session is mostly listening. There is nothing to prepare.",
];

/** A caption of roughly `chars` characters, built from real sentences. */
function captionOf(chars: number): string {
  let out = "";
  let i = 0;
  while (out.length < chars) {
    out += (out ? " " : "") + CORPUS[i % CORPUS.length];
    i += 1;
  }
  return out.slice(0, chars).replace(/\s+\S*$/, "");
}

/** The laid-out height of `text`, in px, as satori actually renders it. */
async function measuredHeight(
  text: string,
  layout: Layout,
  font: { name: string; data: ArrayBuffer }
): Promise<number> {
  const width = POST_SIZE - layout.padX * 2;

  const svg = await satori(
    createElement(
      "div",
      {
        style: {
          display: "flex",
          width,
          fontFamily: font.name,
          fontSize: layout.fontSize,
          lineHeight: layout.lineHeight,
        },
      },
      text
    ),
    /*
     * ⚠ WIDTH ONLY. Passing a `height` makes satori ECHO it back on the root
     * svg regardless of what it laid out — a first version of this script did,
     * and every capacity measured as zero because 4000 > every budget. With
     * width alone satori auto-sizes, and the height it reports is the height
     * the text actually took.
     */
    { width, fonts: [{ name: font.name, data: font.data, weight: 400, style: "normal" }] }
  );

  /*
   * satori writes the laid-out box height into the root svg's `height`. Read
   * it back rather than estimating from character counts: estimation is what
   * this script exists to replace.
   */
  const match = svg.match(/<svg[^>]*height="(\d+(?:\.\d+)?)"/);
  if (!match) throw new Error("satori returned an svg with no height");
  return Number(match[1]);
}

async function main() {
  const families = new Map<string, ArrayBuffer>();
  for (const p of PAIRINGS) {
    for (const family of [p.heading, p.body]) {
      if (families.has(family)) continue;
      process.stderr.write(`fetching ${family}…\n`);
      families.set(family, await fetchTtf(family));
    }
  }

  const rows: string[] = [];
  rows.push("| Archetype | Font size | Box | " + PAIRINGS.map((p) => p.id).join(" | ") + " | Floor |");
  rows.push("|---|---|---|" + PAIRINGS.map(() => "---").join("|") + "|---|");

  for (const layout of LAYOUTS) {
    const budget = layout.canvasHeight - layout.padY * 2 - layout.reservedByOthers;
    const perPairing: number[] = [];

    for (const pairing of PAIRINGS) {
      const family = layout.face === "heading" ? pairing.heading : pairing.body;
      const data = families.get(family)!;

      // Binary search the longest caption whose laid-out height still fits.
      let lo = 0;
      let hi = 1200;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const h = await measuredHeight(captionOf(mid), layout, { name: family, data });
        if (h <= budget) lo = mid;
        else hi = mid - 1;
      }
      perPairing.push(lo);
    }

    const floor = Math.min(...perPairing);
    rows.push(
      `| \`${layout.archetype}\` | ${layout.fontSize}px | ${POST_SIZE - layout.padX * 2}×${budget} | ` +
        perPairing.join(" | ") +
        ` | **${floor}** |`
    );
  }

  console.log(rows.join("\n"));
  console.log(
    "\nFloor = the smallest capacity across all six pairings. That is the number the\n" +
      "generator must respect, because it does not get to choose her typeface."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
