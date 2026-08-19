import { defineConfig } from "vitest/config";
import { workspaceAliases } from "./vitest.aliases.ts";

/** 集成测试：真实外部依赖（Supabase 等）。无凭证或不可达时自跳过。 */
export default defineConfig({
  resolve: { alias: workspaceAliases },
  test: {
    include: [
      "packages/*/tests/**/*.integration.spec.ts",
      "apps/*/tests/**/*.integration.spec.ts",
    ],
    exclude: ["**/node_modules/**"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
