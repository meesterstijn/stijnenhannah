import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Los van vite.config.ts zodat de PWA-plugin en asset-generatie niet
// meedraaien bij unit tests. Unit tests staan naast de code
// (src/**/*.test.ts); database- en synctests (PGlite) in tests/**/*.test.ts.
// Expliciete @-alias i.p.v. vite-tsconfig-paths: die werkt alleen voor
// bestanden binnen tsconfig's include (src/), niet voor tests/.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    environment: "node",
  },
});
