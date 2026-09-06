import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { LAUNCH_STEP_KEYS } from "@/lib/data/checklist";

/*
 * ── LE FLUX GUIDÉ N'EST PAS UNE SECONDE LISTE ───────────────────────────
 *
 * LOT 8 donne un écran par étape. Le risque n'est pas le rendu : c'est qu'un
 * second modèle apparaisse à côté du premier — une autre table, un autre
 * point d'écriture, un autre compteur — et que cocher une étape à un endroit
 * ne se voie pas à l'autre. Le dépôt a déjà payé ce prix une fois avec
 * `launch_steps` / `launch_checklist_items`.
 *
 * Ces tests tiennent trois choses : une seule source de vérité pour les clés,
 * un seul chemin d'écriture, et AUCUNE étape sans écran.
 */

const ROOT = resolve(__dirname, "../../..");

function source(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

/** Le code seul : un commentaire qui nomme une table n'en lit aucune. */
function code(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const FLOW_FILES = [
  "app/app/launch/page.tsx",
  "app/app/launch/[stepKey]/page.tsx",
  "components/launch/step-actions.tsx",
  "lib/data/launch-flow.ts",
];

describe("l'énumération elle-même", () => {
  it("les fichiers du flux existent tous", () => {
    // Sans ça, renommer un fichier rendrait les tests suivants vacuously true.
    for (const path of FLOW_FILES) {
      expect(existsSync(resolve(ROOT, path)), `${path} manque`).toBe(true);
    }
    expect(LAUNCH_STEP_KEYS.length).toBe(7);
  });
});

describe("une seule liste, une seule écriture", () => {
  it.each(FLOW_FILES)("%s ne lit aucune table de checklist directement", (path) => {
    const body = code(path);
    // Les RPC passent par `lib/data/checklist.ts` ; personne d'autre ne
    // touche la table ni ne réinvente le tri-état.
    expect(body).not.toContain("launch_checklist_items");
    expect(body).not.toContain("launch_steps");
    expect(body).not.toContain("set_launch_step");
  });

  it("l'écriture passe par la route existante, pas par une nouvelle", () => {
    const actions = code("components/launch/step-actions.tsx");
    expect(actions).toContain("/api/checklist/");
    // Pas de route parallèle inventée pour le flux guidé.
    expect(actions).not.toContain("/api/launch");
  });

  it("les clés viennent de `lib/data/checklist`, pas d'une seconde liste", () => {
    const page = code("app/app/launch/[stepKey]/page.tsx");
    expect(page).toContain("LAUNCH_STEP_KEYS");
    expect(page).toContain('from "@/lib/data/checklist"');
  });
});

describe("aucune étape n'est sans écran", () => {
  /*
   * La garde qui compte. `LaunchStepDetail` est un switch avec un `default:
   * return null` — une étape oubliée n'explose donc pas, elle rend un écran
   * VIDE avec un bouton « Mark done » en dessous. C'est exactement le genre
   * de trou qui survit à une revue.
   */
  const detail = code("components/checklist/launch-checklist.tsx");

  it.each(LAUNCH_STEP_KEYS)("« %s » a sa branche", (key) => {
    expect(
      detail.includes(`case "${key}"`),
      `Aucune branche pour « ${key} » : son écran rendrait vide.`
    ).toBe(true);
  });

  it("la règle est bien appliquée, pas vacuously vraie", () => {
    // Témoin : une clé qui n'existe pas ne doit PAS être trouvée.
    expect(detail.includes('case "a_step_nobody_wrote"')).toBe(false);
  });
});

describe("le flux guidé est atteignable", () => {
  it("l'accordéon de l'accueil y mène", () => {
    // Un écran qu'aucun lien n'atteint est un écran qui n'existe pas — c'est
    // exactement ce qui est arrivé à <PhotoSlot> au lot 3.
    expect(code("components/home/checklist-card.tsx")).toContain('guidedHref="/app/launch"');
  });
});
