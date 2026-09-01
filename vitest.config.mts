import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * Configuration minimale : la couche testée (lib/ethics) est du TypeScript pur,
 * sans JSX ni DOM — environnement Node, aucune dépendance de test supplémentaire.
 * L'alias "@/" reproduit celui de tsconfig.json (paths) sans plugin dédié.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
