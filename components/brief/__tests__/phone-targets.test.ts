import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stepIssue, type StepDraft } from "@/lib/brief/flow";
import { FIXTURE_DRAFT } from "@/lib/brief/fixtures/catalog";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * CE QU'UNE PROSPECT TOUCHE, SUR UN TÉLÉPHONE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Mesuré à 390px sur `/dev/brief-phone` (`ACQUISITION_WALK.md` §9) : toutes
 * les puces du brief faisaient 34px de haut, dix sous le minimum tactile, et
 * l'étape 1 en pose vingt-deux devant CHAQUE visiteur. « Write it for me »
 * faisait 91×22 — et c'est l'issue de secours de celle qui bloque devant un
 * champ vide.
 *
 * Tenu sur les CLASSES, pas sur un rendu : ce qui a dérivé est une chaîne
 * Tailwind, et c'est une chaîne Tailwind qu'on garde. Un test de rendu
 * mesurerait 0px en jsdom et passerait au vert quoi qu'il arrive.
 */

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Les fichiers qui portent un contrôle tapable du brief. */
const TOUCHABLE = [
  "components/brief/chip-group.tsx",
  "components/brief/step-bodies.tsx",
  "components/ui/segmented-control.tsx",
  "components/ui/button.tsx",
];

describe("plus aucune cible à 34px", () => {
  it.each(TOUCHABLE)("%s", (path) => {
    const source = read(path);
    // ⚠ LE CANARI : la classe exacte qui était en production.
    expect(source).not.toContain("h-[34px]");
  });

  it("et l'énumération n'est pas vide", () => {
    expect(TOUCHABLE.length).toBeGreaterThanOrEqual(4);
    // Elle couvre bien les fichiers où la mesure avait trouvé le défaut.
    expect(TOUCHABLE).toContain("components/brief/chip-group.tsx");
  });

  it("les puces montent à 44 et peuvent grandir si le libellé passe à la ligne", () => {
    const chips = read("components/brief/chip-group.tsx");
    expect(chips).toContain("min-h-[44px]");
    // `min-h` et pas `h` : à 390px un libellé de 44 caractères passe à la ligne.
    // Le `(?<!min-)` est le point du test : `min-h-[44px]` doit passer, une
    // hauteur figée `h-[44px]` doit être refusée.
    expect(chips).not.toMatch(/(?<!min-)h-\[4\dpx\]/);
  });

  it("le bouton tertiaire a enfin une boîte de clic", () => {
    const button = read("components/ui/button.tsx");
    const tertiary = button.slice(button.indexOf("tertiary:"));
    expect(tertiary).toContain("min-h-[44px]");
    expect(tertiary).toContain("px-3");
  });
});

describe("le nom de palette est lisible", () => {
  it("n'est plus un MonoLabel de 11px", () => {
    const cards = read("components/preview/cards.tsx");
    // ⚠ LA LIGNE EXACTE qui rendait le nom de famille en 11px.
    expect(cards).not.toMatch(/<MonoLabel tracking="14" tone=\{selected \? "ink" : "ink-2"\}/);
    // Remplacée par un span à la taille du texte courant, capitales et
    // tracking conservés : il reste du système, il est simplement lisible.
    expect(cards).toMatch(/font-mono text-ui uppercase tracking-mono-14/);
  });
});

describe("l'étape 6 ne casse plus sans aperçu", () => {
  it("le modèle nul est admis par le type ET par le code", () => {
    const cards = read("components/preview/cards.tsx");
    expect(cards).toContain("model: PreviewModel | null");
    // ⚠ LA LIGNE EXACTE qui levait `Cannot read properties of null`.
    expect(cards).not.toContain("...model.tokens");
    expect(cards).toContain("model ?? SAMPLE_PREVIEW");
  });
});

describe("la longue traîne est repliée", () => {
  it("les deux grilles de l'étape 4 se replient", () => {
    const bodies = read("components/brief/step-bodies.tsx");
    // Quatorze modalités pour une question à deux ou trois réponses.
    expect(bodies).toContain("collapseAfter={6}");
    expect(bodies).toContain("collapseAfter={4}");
    // Et la liste « pas pour moi », rendue à la main, suit la même règle.
    expect(bodies).toContain("notAFitShown");
  });

  it("⚠ un choix déjà fait reste visible sous le repli", () => {
    // Replier par-dessus une carte cochée la ferait disparaître sans la
    // désélectionner — un état que rien à l'écran n'expliquerait.
    const chips = read("components/brief/chip-group.tsx");
    expect(chips).toMatch(/index < collapseAfter \|\| selected\.includes/);
    const bodies = read("components/brief/step-bodies.tsx");
    expect(bodies).toMatch(/index < NOT_A_FIT_SHOWN \|\|\s*draft\.not_a_fit_ids\.includes/);
  });
});

describe("l'étape 4 ne bloque plus sur du texte libre", () => {
  const withStyle: StepDraft = { ...FIXTURE_DRAFT, session_style_ids: ["style_0"] };

  it("une carte de style suffit à passer", () => {
    expect(stepIssue("how_you_work", withStyle)).toBeNull();
  });

  it("et la citation vide, courte ou absente ne bloque rien", () => {
    for (const quote of [null, "", "   ", "short"]) {
      expect(stepIssue("how_you_work", { ...withStyle, referral_quote: quote })).toBeNull();
    }
  });

  it("mais la seule condition qui reste, elle, bloque toujours", () => {
    // Anti-vacuité : sans elle, `stepIssue` pourrait rendre null pour tout.
    expect(stepIssue("how_you_work", FIXTURE_DRAFT)).toMatch(/Choose at least one/);
  });

  it("l'écran dit qu'elle est facultative", () => {
    const bodies = read("components/brief/step-bodies.tsx");
    const block = bodies.slice(bodies.indexOf("If a colleague referred someone"));
    expect(block.slice(0, 600)).toMatch(/Optional/);
    expect(block.slice(0, 600)).toMatch(/Skip it/);
  });

  it("et la génération s'en passait déjà", () => {
    // Rien en aval n'échoue sans elle : le contexte la lit sous condition.
    const context = read("lib/generation/how-you-work-context.ts");
    expect(context).toMatch(/brief\.referral_quote\s*\n?\s*\?/);
  });
});
