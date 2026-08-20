/**
 * 纯类型出口：给前端 tRPC 客户端用。
 * 只从 router.ts 取 AppRouter 类型（不经 app.ts / node / fastify），
 * 使 web 的浏览器 tsc 程序不被服务端运行时依赖污染。
 */
export type { AppRouter } from "./router.ts";
export type { RenderRow } from "./service.ts";
