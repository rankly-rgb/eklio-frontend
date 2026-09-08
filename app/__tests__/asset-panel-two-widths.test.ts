import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/*
 * Le panneau de détail d'un asset est DEUX choses à deux largeurs, et
 * l'arbre d'accessibilité doit dire laquelle.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────
 *
 * Au-dessus de 900px, c'est un rail de 520px À CÔTÉ de la grille : la grille
 * est toujours là, lisible et cliquable. Annoncer `role="dialog"` dirait à un
 * lecteur d'écran que le reste de la page a disparu — c'est faux.
 *
 * En dessous de 900px, c'est une feuille PAR-DESSUS la grille, derrière un
 * voile. Celle-là est modale pour de bon, et une modale sans `aria-modal` et
 * sans piège de focus emmène un utilisateur au clavier droit dans la grille
 * en dessous : invisible, inatteignable, sans retour.
 *
 * Une seule réponse pour les deux largeurs est forcément fausse d'un côté.
 * Ce fichier tient les deux.
 */

const ROOT = resolve(__dirname, "../..");
const PANEL = join(ROOT, "components/kit/asset-detail-panel.tsx");

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const source = stripComments(readFileSync(PANEL, "utf8"));

describe("le rôle est mesuré, pas supposé", () => {
  it("le rôle dépend de la largeur", () => {
    expect(source).toContain('role={isSheet ? "dialog" : "region"}');
  });

  it("`aria-modal` n'est posé QUE sur la feuille", () => {
    expect(source).toContain("aria-modal={isSheet ? true : undefined}");
  });

  it("⚠ le rôle n'est jamais figé sur `dialog`", () => {
    // C'est l'état qu'on quitte : un panneau non modal qui se réclamait
    // d'une boîte de dialogue à toutes les largeurs.
    expect(source).not.toContain('role="dialog"');
  });

  it("les deux rôles portent un nom", () => {
    // Une `region` sans nom accessible n'est pas un point de repère ; un
    // `dialog` sans nom s'annonce « boîte de dialogue » et rien d'autre.
    expect(source).toContain("aria-label={entry.label}");
  });
});

describe("la feuille est vraiment modale", () => {
  it("elle porte un voile, et il ferme", () => {
    expect(source).toMatch(/\{isSheet \? \([\s\S]{0,400}?aria-label="Close"/);
    expect(source).toContain("fixed inset-0 z-40 bg-ink/25");
  });

  it("elle piège le focus", () => {
    expect(source).toContain('if (event.key !== "Tab") return;');
    expect(source).toContain("event.preventDefault()");
  });

  it("⚠ et le piège NE s'arme QUE pour la feuille", () => {
    /*
     * Piéger le focus dans le rail de bureau serait le défaut miroir : elle
     * tabule dans le panneau et ne peut plus revenir à la grille à laquelle
     * il appartient.
     */
    const trap = source.slice(source.indexOf('if (event.key !== "Tab")'));
    expect(source).toMatch(/useEffect\(\(\) => \{\s*if \(!isSheet\) return;/);
    expect(trap.length).toBeGreaterThan(0);
  });

  it("Échap et le retour du focus valent pour les deux largeurs", () => {
    const escape = source.indexOf('event.key === "Escape"');
    const trapAt = source.indexOf("if (!isSheet) return;");
    expect(escape).toBeGreaterThan(-1);
    // Échap est câblé AVANT la garde de largeur, donc inconditionnel.
    expect(escape).toBeLessThan(trapAt);
    expect(source).toContain("triggerRef.current.focus()");
  });
});

describe("les deux moitiés du point de rupture sont d'accord", () => {
  /*
   * Le seuil est écrit deux fois — Tailwind compile ses classes et ne peut
   * pas lire une constante. Une feuille qui a l'air modale sans s'annoncer
   * comme telle est pire que l'une ou l'autre des deux erreurs seules.
   */
  const declared = source.match(/const SHEET_MAX_WIDTH = (\d+);/)?.[1];

  it("la constante existe", () => {
    expect(declared).toBe("900");
  });

  it("la requête média utilise la constante, pas un nombre recopié", () => {
    expect(source).toContain("`(max-width: ${SHEET_MAX_WIDTH}px)`");
  });

  it("et les classes de mise en page basculent au même endroit", () => {
    const breakpoints = new Set(
      [...source.matchAll(/max-\[(\d+)px\]:/g)].map((match) => match[1])
    );
    expect([...breakpoints]).toEqual([declared]);
  });
});
