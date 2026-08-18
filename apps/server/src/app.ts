/**
 * Fastify 装配：HTTP 壳。认证 v0 读 `x-actor-id` 头（占位），
 * Supabase JWT 校验在集成阶段替换此处的 createContext——路由与 service 不动。
 */
import Fastify, { type FastifyInstance } from "fastify";
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
