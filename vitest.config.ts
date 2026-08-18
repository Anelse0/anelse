import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** 源码面测试：工作区包直指 src，无需构建（tsconfig paths 同映射）。 */
export default defineConfig({
  resolve: {
    alias: {
      "@anselse/vocab": fileURLToPath(new URL("./packages/vocab/src/index.ts", import.meta.url)),
      "@anselse/recipe": fileURLToPath(new URL("./packages/recipe/src/index.ts", import.meta.url)),
      "@anselse/events": fileURLToPath(new URL("./packages/events/src/index.ts", import.meta.url)),
      "@anselse/adapters": fileURLToPath(new URL("./packages/adapters/src/index.ts", import.meta.url)),
      "@anselse/server": fileURLToPath(new URL("./apps/server/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/*/tests/**/*.spec.ts", "apps/*/tests/**/*.spec.ts"],
  },
});
