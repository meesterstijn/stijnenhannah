import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Los van vite.config.ts zodat de PWA-plugin en asset-generatie niet
// meedraaien bij unit tests. Unit tests staan naast de code
// (src/**/*.test.ts); databasetests (PGlite) in tests/**/*.test.ts.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30000,
    environment: "node",
  },
});
