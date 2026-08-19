import { defineConfig } from "vitest/config";
import { workspaceAliases } from "./vitest.aliases.ts";

/** 默认套件：零网络。集成测试（真实 DB）单独走 test:integration。 */
export default defineConfig({
  resolve: { alias: workspaceAliases },
  test: {
    include: ["packages/*/tests/**/*.spec.ts", "apps/*/tests/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.spec.ts"],
  },
});
