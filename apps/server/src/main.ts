/**
 * 进程入口。store 按环境选择：有 PG* → PostgresEventStore（Supabase），否则内存。
 * queue/media 暂为内存/Fake（pg-boss/R2 Provider 接线时替换）。
 * 启动：node --env-file=.env --experimental-strip-types apps/server/src/main.ts
 */
import { randomUUID } from "node:crypto";
import { createAdapterRegistry, MockAdapter, Seedance25Adapter, Kling3Adapter } from "@anselse/adapters";
import {
  MemoryEventStore,
  MemoryRenderQueue,
  PostgresEventStore,
  type EventStore,
} from "@anselse/platform";
import { createDb, hasDbEnv } from "@anselse/db";
import { AnselseService } from "./service.ts";
import { createApp } from "./app.ts";

const adapters = createAdapterRegistry();
adapters.register(new MockAdapter());
adapters.register(new Seedance25Adapter());
adapters.register(new Kling3Adapter());

let store: EventStore;
if (hasDbEnv()) {
  store = new PostgresEventStore(createDb().sql);
  console.log("event store: Postgres (Supabase)");
} else {
  store = new MemoryEventStore();
  console.log("event store: in-memory (no PG* env)");
}

const service = new AnselseService({
  store,
  queue: new MemoryRenderQueue(),
  adapters,
  ids: { newId: (prefix) => `${prefix}_${randomUUID()}` },
  clock: { now: () => Date.now() },
});

const port = Number(process.env["PORT"] ?? 8787);
createApp(service)
  .listen({ port, host: "0.0.0.0" })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
