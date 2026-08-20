/**
 * tRPC 客户端（type-only 引 AppRouter，端到端类型安全）。
 * 认证 v0：x-actor-id 头占位（M6.3 换 Supabase JWT）。
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@anselse/server/api-types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8787";

/** 占位身份（登录接入前）。 */
export const ACTOR_ID = "web-anon";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers: () => ({ "x-actor-id": ACTOR_ID }),
    }),
  ],
});

export type { RenderRow } from "@anselse/server/api-types";
