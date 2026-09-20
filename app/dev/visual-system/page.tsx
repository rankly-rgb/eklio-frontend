import { ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { render, renderCarousel, CompositionError } from "@/lib/compose/engine";
import { cardPalette, type DirectionPalette } from "@/lib/compose/palette";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * ── LA PAGE DE RÉFÉRENCE DU SYSTÈME VISUEL ──────────────────────────────
 *
 * Tous les archétypes dans une palette, plus un archétype dans trois. C'est le
 * CONTRAT que le moteur implémente, et c'est aussi la seule surface où on le
 * voit en entier.
 *
 * ⚠ ELLE REND LE VRAI MOTEUR, PAS DES CAPTURES. Une page de référence faite
 * d'images exportées cesse d'être vraie au premier changement de clearance, et
 * rien ne le dit. Ici, si le moteur casse, la page casse.
 *
 * ⚠ ET ELLE AFFICHE LES REFUS. Un archétype qui ne compose pas à une longueur
 * donnée n'est pas caché : la carte est remplacée par ce que le résolveur a
 * dit. « Ne tient pas sur une carte aux planchers typographiques — passer en
 * carrousel » est une réponse du système, pas une erreur à masquer.
 *
 * Page de développement : liée depuis nulle part, ne lit aucune donnée, et
 * `lib/compose/` ne touche aucun paquet natif — donc elle se rend sans police
 * et sans réseau, comme les suites.
 */

export const dynamic = "force-static";

const DIRECTIONS: Array<[string, DirectionPalette, boolean]> = [
  ["sage", { primary: "#6B7F6E", secondary: "#B4674A", light: "#E7E2D6", dark: "#2B2724", paper: "#FAF7F2" }, false],
  ["slate", { primary: "#4A5361", secondary: "#8C93A0", light: "#F1F0EE", dark: "#23262B", paper: "#F7F7F6" }, false],
  ["clay", { primary: "#C08A6A", secondary: "#8A5F48", light: "#EFE3D9", dark: "#221C18", paper: "#F6EFE8" }, true],
];

const PALETTES = DIRECTIONS.map(([key, direction, dark]) => cardPalette(key, direction, dark));

const CARD = {
  eyebrow: "A CALMER WAY",
  headline: "Where it lands",
  footer: "@apracticename",
} as const;

const ITEM = (label: string) => ({ label, gloss: "a gloss of six words here" });

function payloadFor(archetype: string): unknown {
  switch (archetype) {
    case "single_statement":
      return { statement: "Rest is not a reward you earn after everything else is done" };
    case "quadrant_model":
      return {
        axis_x: "Effort here",
        axis_y: "Relief here",
        items: [ITEM("Push through"), ITEM("Step back"), ITEM("Ask once"), ITEM("Wait it out")],
      };
    case "cycle":
      return { nodes: [ITEM("Notice"), ITEM("Name it"), ITEM("Let it pass")] };
    case "surface_and_beneath":
      return { surface: ITEM("Said aloud"), beneath: ITEM("Meant instead") };
    case "comparison_pair":
      return { left: [ITEM("Advice"), ITEM("Fixing")], right: [ITEM("Witness"), ITEM("Holding")] };
    case "numbered_strategies":
      return { items: [ITEM("Name it"), ITEM("Slow down"), ITEM("Ask once")] };
    case "lettered_technique":
      return {
        acronym: "RAI",
        items: [ITEM("Recognise"), ITEM("Allow"), ITEM("Investigate")],
      };
    case "concentric_control":
      return { rings: [ITEM("Out there"), ITEM("Right here")] };
    case "annotated_curve":
      return { axis_x: "Weeks here", axis_y: "Steady here", points: [ITEM("The dip"), ITEM("Steady")] };
    case "practitioner_card":
      return { lines: ["Evenings and early mornings", "Telehealth across two states"] };
    case "carousel":
      return {
        cards: [
          { archetype_key: "single_statement", payload: { statement: "The first card says one thing only" } },
          { archetype_key: "cycle", payload: { nodes: [ITEM("Notice"), ITEM("Name it"), ITEM("Let go")] } },
          { archetype_key: "single_statement", payload: { statement: "And the last one closes the door" } },
        ],
      };
    default:
      return {};
  }
}

type Rendered = { svgs: string[]; note: string };

function safeRender(archetype: string, palette: (typeof PALETTES)[number]): Rendered {
  const input = { ...CARD, archetype, palette, payload: payloadFor(archetype) };
  try {
    const results = archetype === "carousel" ? renderCarousel(input) : [render(input)];
    const resolution = results.flatMap((r) => r.composition.resolution);
    return {
      svgs: results.map((r) => r.svg),
      note: resolution.length > 0 ? resolution.join(" · ") : "composed as specified",
    };
  } catch (error) {
    // ⚠ MONTRÉ, PAS AVALÉ. Voir l'en-tête.
    return {
      svgs: [],
      note: error instanceof CompositionError ? error.message : String(error),
    };
  }
}

function Card({ svg }: { svg: string }) {
  return (
    <div
      className="w-full overflow-hidden rounded-card border border-line"
      // The engine's own output, inlined. It is generated from a closed set of
      // fixtures in this file — no user text reaches this page at all.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function Panel({ title, note, svgs }: { title: string; note: string; svgs: string[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <MonoLabel tracking="16">{title}</MonoLabel>
        <p className="text-helper leading-prose text-ink-2">{note}</p>
      </div>
      {svgs.length === 0 ? (
        <div className="rounded-card border border-dashed border-line p-6">
          <p className="text-helper text-ink-2">
            No card. The resolver ran out of steps, and the message above is what it said.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {svgs.map((svg, i) => (
            <Card key={i} svg={svg} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function VisualSystemPage() {
  const one = PALETTES[0];
  const reference = "cycle";

  return (
    <main className="flex-1 px-[var(--gutter)] pb-20 pt-8 max-md:px-[var(--gutter-sm)]">
      <header className="mb-10 flex max-w-[720px] flex-col gap-3">
        <MonoLabel tracking="16">Visual system</MonoLabel>
        <h1 className="font-display text-h1 font-medium leading-tight tracking-h1 text-ink">
          The contract the engine implements
        </h1>
        <p className="text-body leading-prose text-ink-2">
          Every archetype in one palette, then one archetype in three. These are rendered by{" "}
          <code>lib/compose/</code> on this request — not exported images. If a clearance changes,
          this page changes with it, and if the engine refuses a card it says so here rather than
          showing nothing.
        </p>
        <p className="text-helper leading-prose text-ink-2">
          1080 × 1350 · 40px glyph-to-stroke · 32px glyph-to-field · 48px field-to-field · 64px
          above the footer · display 64–110 · labels 30–44 (floor 28) · mono 22–28 (floor 20) ·
          display ≥ 3× the smallest thing on the card.
        </p>
      </header>

      <div className="mb-12">
        <MonoLabel tracking="16">Eleven archetypes · {one.key}</MonoLabel>
        <div className="mt-4 grid grid-cols-3 gap-8 max-lg:grid-cols-2 max-md:grid-cols-1">
          {ARCHETYPE_KEYS.map((archetype) => {
            const { svgs, note } = safeRender(archetype, one);
            return <Panel key={archetype} title={archetype} note={note} svgs={svgs} />;
          })}
        </div>
      </div>

      <div>
        <MonoLabel tracking="16">One archetype · three palettes</MonoLabel>
        <p className="mt-2 max-w-[640px] text-helper leading-prose text-ink-2">
          The same <code>{reference}</code> payload, in three brand directions. The third is a
          dark ground — at most three cards in twelve carry one.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-8 max-lg:grid-cols-2 max-md:grid-cols-1">
          {PALETTES.map((palette) => {
            const { svgs, note } = safeRender(reference, palette);
            return <Panel key={palette.key} title={palette.key} note={note} svgs={svgs} />;
          })}
        </div>
      </div>
    </main>
  );
}
