import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_FLOOR,
  clearanceFindings,
  floorFindings,
  ratioFindings,
  shiftBoxes,
  withGlyphSize,
  withSecondarySizes,
} from "@/lib/compose/audit";
import { BudgetExceededError, budgetErrors } from "@/lib/compose/budget";
import { TYPE } from "@/lib/compose/constants";
import { render } from "@/lib/compose/engine";
import { parseBoxes } from "@/lib/compose/svg";
import { CARD, PALETTES, payloadFor } from "@/lib/compose/__tests__/fixtures";

/*
 * ── LES CAS NÉGATIFS ────────────────────────────────────────────────────
 *
 * Les quatre autres suites prouvent que les cartes que le moteur produit
 * respectent les règles. Elles ne prouvent PAS que les contrôles attraperaient
 * une carte qui ne les respecte pas — et c'est une distinction dont ce projet
 * a déjà payé le prix : le contrôle de ratio 3:1 est resté vert pendant qu'une
 * carte mesurait 2.89.
 *
 * Un contrôle qui ne regarde rien passe exactement comme un contrôle qui
 * regarde tout. Ce fichier est la différence.
 *
 * ⚠ CHAQUE CAS COMMENCE PAR UN DOCUMENT RÉEL. On rend une vraie carte, on
 * vérifie qu'elle est propre, on la CASSE d'une façon précise, et on exige que
 * le contrôle trouve. Partir d'un SVG écrit à la main prouverait que le
 * contrôle sait lire un SVG écrit à la main.
 */

function clean(archetype: string) {
  return render({
    ...CARD,
    archetype,
    palette: PALETTES[0],
    payload: payloadFor(archetype, "nominal"),
  }).svg;
}

describe("⚠ contrôle 1 — la hiérarchie titre/libellé : la régression exacte qui est passée", () => {
  /*
   * ⚠ CE TEST AURAIT ÉCHOUÉ AVANT LA CORRECTION, et c'est toute sa raison
   * d'être. `secondaryMax = floor(display / minTitleToLabelRatio)` borne les bandes
   * secondaires dans `engine.ts` ; sans cette ligne, l'eyebrow et le footer
   * pouvaient monter jusqu'à `TYPE.mono.max` indépendamment de la ligne
   * d'affichage, et une carte sortait à 2.89.
   *
   * La valeur reproduite ici n'est pas choisie pour être jolie : c'est
   * exactement ce rapport-là.
   */
  it("une carte à 1.89 est refusée, chiffre pour chiffre", () => {
    const svg = clean("cycle");
    expect(ratioFindings(svg)).toEqual([]);

    const display = Math.max(
      ...parseBoxes(svg)
        .filter((b) => b.role === "text" && b.band === "headline")
        .map((b) => b.size ?? 0)
    );

    /*
     * Le plus petit corps qui produit exactement 1.89 sous cette ligne-là,
     * posé sur TOUTES les bandes secondaires. N'en changer qu'une laisserait
     * une autre bande plus basse décider du minimum, et le document muté
     * garderait son ratio d'origine — un cas négatif vert qui ne mesure rien.
     */
    const smallest = Math.round((display / 1.89) * 100) / 100;
    const broken = withSecondarySizes(svg, smallest);

    const findings = ratioFindings(broken);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("1.89");
    expect(findings[0]).toContain(`under ${TYPE.minTitleToLabelRatio}`);
  });

  it("un cheveu sous le seuil est refusé aussi, pas seulement l'évident", () => {
    /*
     * Une borne qui ne refuse que le franchement mauvais est une borne dont on
     * ne peut rien conclure. 1.99 doit échouer.
     */
    const svg = clean("cycle");
    const display = Math.max(
      ...parseBoxes(svg)
        .filter((b) => b.role === "text" && b.band === "headline")
        .map((b) => b.size ?? 0)
    );
    const broken = withSecondarySizes(svg, Math.round((display / 1.99) * 100) / 100);
    expect(ratioFindings(broken).length).toBeGreaterThan(0);
  });

  it("et le moteur, lui, ne produit plus jamais ce document", () => {
    /*
     * L'autre moitié de la preuve : le contrôle attrape, ET la chose attrapée
     * n'arrive plus. Sans cette ligne, on aurait prouvé qu'un détecteur marche
     * sur une panne qui pourrait encore se produire partout.
     */
    const svg = clean("cycle");
    const texts = parseBoxes(svg).filter((b) => b.role === "text");
    const display = Math.max(...texts.filter((t) => t.band === "headline").map((t) => t.size ?? 0));
    const smallest = Math.min(...texts.map((t) => t.size ?? 0));
    expect(display / smallest).toBeGreaterThanOrEqual(TYPE.minTitleToLabelRatio);
  });
});

describe("⚠ contrôle 2 — les planchers typographiques", () => {
  it("un glyphe un pixel sous le plancher absolu est refusé", () => {
    const svg = clean("numbered_strategies");
    expect(floorFindings(svg)).toEqual([]);

    const broken = withGlyphSize(svg, "footer", ABSOLUTE_FLOOR - 1);
    const findings = floorFindings(broken);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]).toContain(`${ABSOLUTE_FLOOR - 1}px`);
  });

  it("une ligne d'affichage sous son minimum est refusée", () => {
    const svg = clean("single_statement");
    const broken = withGlyphSize(svg, "headline", TYPE.display.min - 1);
    expect(floorFindings(broken).some((f) => f.includes(`under ${TYPE.display.min}px`))).toBe(true);
  });

  it("une ligne d'affichage au dessus de son maximum est refusée aussi", () => {
    // Le débordement est une panne dans les deux sens, et un contrôle qui ne
    // regarde qu'un côté laisse passer la moitié des cas.
    const svg = clean("single_statement");
    const broken = withGlyphSize(svg, "headline", TYPE.display.max + 1);
    expect(floorFindings(broken).some((f) => f.includes(`over ${TYPE.display.max}px`))).toBe(true);
  });
});

describe("⚠ contrôle 3 — les clearances", () => {
  it("un texte poussé dans le dessin est refusé", () => {
    const svg = clean("cycle");
    expect(clearanceFindings(svg)).toEqual([]);

    /*
     * Assez pour traverser les 40px de garde et entrer dans le tracé. On
     * déplace le TEXTE plutôt que le dessin : c'est le sens dans lequel la
     * panne s'est réellement produite (un libellé à 38px du bout d'un bras).
     */
    const broken = shiftBoxes(svg, "text", 220);
    expect(clearanceFindings(broken).some((f) => f.includes("from a stroke"))).toBe(true);
  });

  it("quelque chose poussé dans le pied de carte est refusé", () => {
    const svg = clean("numbered_strategies");
    const broken = shiftBoxes(svg, "text", 900);
    expect(clearanceFindings(broken).some((f) => f.includes("above the footer"))).toBe(true);
  });

  it("deux champs teintés trop proches sont refusés", () => {
    /*
     * ⚠ LA MUTATION POSE UN CHAMP SUR L'AUTRE. Les décaler TOUS de la même
     * distance ne changerait aucun écart — et le cas négatif passerait en ne
     * mesurant rien, ce qui est précisément le mode de panne que ce fichier
     * existe pour couvrir.
     */
    const svg = clean("comparison_pair");
    expect(clearanceFindings(svg)).toEqual([]);

    const groups: string[] = svg.match(/<g data-role="field"[\s\S]*?<\/g>/g) ?? [];
    expect(groups.length).toBeGreaterThanOrEqual(2);

    const [first, second] = groups;
    const firstBox = /data-box="([^"]+)"/.exec(first)![1];
    const onTop = svg.replace(
      second,
      second.replace(/data-box="[^"]+"/, `data-box="${firstBox}"`)
    );
    expect(onTop).not.toBe(svg);

    expect(clearanceFindings(onTop).some((f) => f.includes("tinted fields"))).toBe(true);
  });
});

describe("⚠ contrôle 4 — le budget de mots", () => {
  /*
   * Celui-ci avait déjà ses cas négatifs dans `budget.test.ts` (« one word
   * over, and it is refused »). Ce qui manquait est la preuve que le refus
   * remonte jusqu'au MOTEUR : un budget qui refuse pendant que `render`
   * compose quand même n'est pas un budget.
   */
  it("une carte hors budget ne se compose pas du tout", () => {
    const payload = {
      nodes: [
        { label: "one two three four", gloss: "a b" },
        { label: "Name", gloss: "a b" },
        { label: "Allow", gloss: "a b" },
      ],
    };
    expect(budgetErrors("cycle", payload).length).toBeGreaterThan(0);
    expect(() =>
      render({ ...CARD, archetype: "cycle", palette: PALETTES[0], payload })
    ).toThrow(BudgetExceededError);
  });
});

describe("⚠ anti-vacuité des mutateurs", () => {
  /*
   * Un mutateur qui ne mute plus rend TOUS les cas ci-dessus verts. C'est le
   * mode de panne le plus silencieux de ce fichier, donc il est testé en
   * premier lieu ici plutôt que supposé.
   */
  it("withGlyphSize change bien le document", () => {
    const svg = clean("cycle");
    expect(withGlyphSize(svg, "footer", 21)).not.toBe(svg);
  });

  it("shiftBoxes change bien le document, y compris les boîtes internes", () => {
    const svg = clean("cycle");
    const moved = shiftBoxes(svg, "text", 17);
    expect(moved).not.toBe(svg);

    const before = parseBoxes(svg).filter((b) => b.role === "text");
    const after = parseBoxes(moved).filter((b) => b.role === "text");
    expect(after.length).toBe(before.length);
    expect(after[0].box.y).toBe(before[0].box.y + 17);
  });

  it("un rôle absent fait échouer la mutation plutôt que de ne rien faire", () => {
    const svg = clean("single_statement");
    /*
     * ⚠ `single_statement` PORTE DÉSORMAIS UNE MARQUE, donc un groupe
     * `figure`. Ce qu'il n'a toujours pas, c'est un APLAT : sa phrase est
     * posée sur le papier. C'est ce rôle-là qui sert de rôle absent.
     */
    expect(() => shiftBoxes(svg, "field", 10)).toThrow(/no-op/);
    expect(() => withGlyphSize(svg, "nosuchband", 20)).toThrow(/no-op/);
  });
});
