import { fileURLToPath } from "node:url";

/** 工作区包 → src 入口（源码面测试，无需构建）。两个 vitest 配置共用。 */
export const workspaceAliases: Record<string, string> = {
  "@anselse/vocab": fileURLToPath(new URL("./packages/vocab/src/index.ts", import.meta.url)),
  "@anselse/recipe": fileURLToPath(new URL("./packages/recipe/src/index.ts", import.meta.url)),
  "@anselse/events": fileURLToPath(new URL("./packages/events/src/index.ts", import.meta.url)),
  "@anselse/db": fileURLToPath(new URL("./packages/db/src/index.ts", import.meta.url)),
  "@anselse/adapters": fileURLToPath(new URL("./packages/adapters/src/index.ts", import.meta.url)),
  "@anselse/platform": fileURLToPath(new URL("./packages/platform/src/index.ts", import.meta.url)),
  "@anselse/server": fileURLToPath(new URL("./apps/server/src/index.ts", import.meta.url)),
  "@anselse/worker": fileURLToPath(new URL("./apps/worker/src/index.ts", import.meta.url)),
};
