import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * Configuration minimale : environnement Node, aucune dépendance de test
 * supplémentaire. L'alias "@/" reproduit celui de tsconfig.json (paths) sans
 * plugin dédié.
 *
 * ── POURQUOI `.test.tsx` EST MAINTENANT COLLECTÉ ────────────────────────────
 *
 * Un module du brief a été écrit, testé, et jamais branché à un écran :
 * l'étape 1 EXIGEAIT une réponse de plateforme qu'aucun champ ne permettait de
 * donner. Tous les tests étaient verts — parce qu'ils testaient tous des
 * MODULES.
 *
 * Un test qui REND l'écran est le seul qui pouvait l'attraper. Il n'y a pour
 * autant ni jsdom ni testing-library ici, et il n'y en aura pas : les
 * dépendances nouvelles sont interdites dans ce chantier. `react-dom/server`,
 * déjà présent puisque c'est une application Next, suffit —
 * `renderToStaticMarkup` rend un composant en chaîne, sans DOM. Les effets ne
 * s'y exécutent pas, ce qui ne change rien à la question posée : le champ
 * est-il à l'écran.
 *
 * esbuild, que vitest utilise déjà, transpile le JSX d'un `.tsx` sans plugin.
 * La seule chose qui manquait était que ces fichiers soient ramassés.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
