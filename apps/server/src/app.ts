/**
 * Fastify 装配：HTTP 壳。认证 v0 读 `x-actor-id` 头（占位），
 * Supabase JWT 校验在集成阶段替换此处的 createContext——路由与 service 不动。
 */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  fastifyTRPCPlugin,
  type CreateFastifyContextOptions,
} from "@trpc/server/adapters/fastify";
import { appRouter } from "./router.ts";
import type { RequestContext } from "./router.ts";
import type { AnselseService } from "./service.ts";
import type { ActorId } from "@anselse/events";

export function createApp(service: AnselseService): FastifyInstance {
  const app = Fastify({ logger: true });
  // 开发期 CORS：允许 Vite 源（5173）跨源调用；生产按部署域收紧。
  app.register(cors, { origin: true, methods: ["GET", "POST", "OPTIONS"] });
  app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: ({ req }: CreateFastifyContextOptions): RequestContext => {
        const actor = req.headers["x-actor-id"];
        const actorId = (typeof actor === "string" && actor.length > 0 ? actor : "anonymous") as ActorId;
        return { actorId, service };
      },
    },
  });
  app.get("/healthz", () => ({ ok: true }));
  return app;
}
