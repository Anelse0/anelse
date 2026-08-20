import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/** 工作区域名包直指 src（浏览器安全的纯函数域），无需预构建。 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@anselse/vocab": fileURLToPath(new URL("../../packages/vocab/src/index.ts", import.meta.url)),
      "@anselse/recipe": fileURLToPath(new URL("../../packages/recipe/src/index.ts", import.meta.url)),
      "@anselse/adapters": fileURLToPath(new URL("../../packages/adapters/src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5173 },
});
