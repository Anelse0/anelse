/**
 * 进程入口（dev 一体化）。
 * store 按环境选择：有 PG* → PostgresEventStore（Supabase），否则内存。
 * 渲染：内存队列 + 进程内 RenderWorker 轮询（pg-boss + 独立 worker 进程接线时替换）。
 * media：FakeMediaStore（R2 接线时替换）。
 * 启动：node --env-file=.env --experimental-strip-types apps/server/src/main.ts
 */
import { randomUUID } from "node:crypto";
import { createAdapterRegistry, MockAdapter, Seedance25Adapter, Kling3Adapter } from "@anselse/adapters";
import {
  MemoryEventStore,
  MemoryRenderQueue,
  FakeMediaStore,
  type EventStore,
} from "@anselse/platform";
import { PostgresEventStore } from "@anselse/platform/postgres";
import { RenderWorker, drainQueue } from "@anselse/worker";
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

const queue = new MemoryRenderQueue();
const ids = { newId: (prefix: string) => `${prefix}_${randomUUID()}` };
const clock = { now: () => Date.now() };

const service = new AnselseService({ store, queue, adapters, ids, clock });
const worker = new RenderWorker({ store, adapters, mediaStore: new FakeMediaStore(), ids, clock });

// 进程内渲染轮询（dev）：mirrors pg-boss 订阅。
const DRAIN_MS = 400;
setInterval(() => {
  void drainQueue(queue, worker).catch((error: unknown) => console.error("drain error:", error));
}, DRAIN_MS);

const port = Number(process.env["PORT"] ?? 8787);
createApp(service)
  .listen({ port, host: "0.0.0.0" })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
