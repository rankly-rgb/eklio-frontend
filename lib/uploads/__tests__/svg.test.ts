import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "@/lib/uploads/svg";

/*
 * ── UN SVG EST UN DOCUMENT, PAS UNE IMAGE ───────────────────────────────
 *
 * Il peut porter du script, chercher une ressource distante, embarquer un
 * sous-arbre HTML, ou demander à l'analyseur XML de développer une entité
 * jusqu'à saturer la mémoire. Un cabinet arrive avec son ancien logo dans un
 * SVG : on les accepte, donc on les nettoie.
 *
 * Chaque test ci-dessous porte un TÉMOIN : la chaîne dangereuse est d'abord
 * vérifiée PRÉSENTE dans l'entrée. Sans cela, un nettoyeur qui renverrait la
 * chaîne vide passerait tous ces tests.
 */

const wrap = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`;

function cleaned(source: string): string {
  const result = sanitizeSvg(source);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("refused");
  return result.svg;
}

describe("ce qui est retiré", () => {
  it("les scripts, en bloc et auto-fermés", () => {
    const source = wrap('<script>alert(1)</script><script src="x.js"/>');
    expect(source).toContain("<script"); // témoin
    const svg = cleaned(source);
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("alert(1)");
  });

  it("les gestionnaires d'événements, sur n'importe quel élément", () => {
    const source = wrap('<rect onload="alert(1)" ONCLICK=\'steal()\' width="10"/>');
    expect(source.toLowerCase()).toContain("onload"); // témoin
    const svg = cleaned(source);
    expect(svg.toLowerCase()).not.toContain("onload");
    expect(svg.toLowerCase()).not.toContain("onclick");
    // Ce qui n'était pas dangereux reste.
    expect(svg).toContain('width="10"');
  });

  it("le HTML embarqué", () => {
    const source = wrap(
      '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>x()</script></body></foreignObject>'
    );
    expect(source).toContain("foreignObject"); // témoin
    const svg = cleaned(source);
    expect(svg).not.toContain("foreignObject");
    expect(svg).not.toContain("<script");
  });

  it("les iframes et les objets", () => {
    const source = wrap('<iframe src="https://evil.test"></iframe><embed src="x"/>');
    expect(source).toContain("<iframe"); // témoin
    const svg = cleaned(source);
    expect(svg).not.toContain("<iframe");
    expect(svg).not.toContain("<embed");
  });

  it("les animations SMIL qui réécrivent un attribut après le chargement", () => {
    // La panne classique d'un nettoyeur qui ne regarde que les valeurs
    // initiales : l'animation repose un href interdit une seconde plus tard.
    const source = wrap(
      '<animate attributeName="href" to="javascript:alert(1)" begin="0s"/>'
    );
    expect(source).toContain("<animate"); // témoin
    const svg = cleaned(source);
    expect(svg).not.toContain("<animate");
    expect(svg).not.toContain("javascript:");
  });

  it("les liens vers d'autres fichiers, et pas les fragments internes", () => {
    const source = wrap(
      '<image href="https://tracker.test/pixel.png"/><use xlink:href="#glyph"/>' +
        '<image href="data:image/png;base64,iVBORw0KGgo="/>'
    );
    expect(source).toContain("tracker.test"); // témoin
    const svg = cleaned(source);
    expect(svg).not.toContain("tracker.test");
    // Un fragment interne et une image en ligne restent : ce sont des SVG
    // parfaitement ordinaires, et les casser rendrait son logo faux.
    expect(svg).toContain('xlink:href="#glyph"');
    expect(svg).toContain("data:image/png;base64,");
  });

  it("les feuilles de style distantes", () => {
    const source = wrap('<style>@import url("https://evil.test/x.css"); rect { fill: red; }</style>');
    expect(source).toContain("@import"); // témoin
    const svg = cleaned(source);
    expect(svg).not.toContain("@import");
    expect(svg).toContain("fill: red");
  });

  it("TOUTES les occurrences, pas seulement la première", () => {
    // Le bug qui rend un nettoyeur inutile : `RegExp.test` avec /g avance
    // `lastIndex`, et la deuxième occurrence passe.
    const source = wrap("<script>a()</script><rect/><script>b()</script>");
    const svg = cleaned(source);
    expect(svg).not.toContain("a()");
    expect(svg).not.toContain("b()");
  });

  it("dit ce qu'il a retiré", () => {
    const result = sanitizeSvg(wrap('<script>a()</script><rect onclick="b()"/>'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.removed).toContain("scripts");
    expect(result.removed).toContain("event handlers");
  });

  it("un SVG déjà propre traverse sans perdre son dessin", () => {
    const source = wrap('<path d="M0 0 L10 10" fill="#B4653F"/>');
    const result = sanitizeSvg(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svg).toBe(source);
    expect(result.removed).toEqual([]);
  });
});

describe("ce qui est REFUSÉ plutôt que nettoyé", () => {
  it("une déclaration d'entité", () => {
    /*
     * C'est une attaque contre l'ANALYSEUR, pas contre le document rendu :
     * « billion laughs » et XXE vivent là. Retirer la déclaration en gardant
     * les références produirait un fichier cassé dont nous serions
     * responsables.
     */
    const billion =
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]>' +
      '<svg xmlns="http://www.w3.org/2000/svg">&lol2;</svg>';
    const result = sanitizeSvg(billion);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("entities");
  });

  it("une entité externe, même sans DOCTYPE complet", () => {
    const xxe = '<!ENTITY xxe SYSTEM "file:///etc/passwd"><svg></svg>';
    const result = sanitizeSvg(xxe);
    expect(result.ok).toBe(false);
  });

  it("un fichier qui n'est pas un SVG du tout", () => {
    const result = sanitizeSvg("just some text");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_svg");
  });
});
