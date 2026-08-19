/**
 * 进程入口：默认组合（内存 store/queue + Mock/Seedance/Kling adapters）。
 * Supabase/pg-boss Provider 就绪后仅替换此处的组装，业务代码不动。
 */
import { randomUUID } from "node:crypto";
import { createAdapterRegistry, MockAdapter, Seedance25Adapter, Kling3Adapter } from "@anselse/adapters";
import { MemoryEventStore, MemoryRenderQueue } from "@anselse/platform";
import { AnselseService } from "./service.ts";
import { createApp } from "./app.ts";

const adapters = createAdapterRegistry();
adapters.register(new MockAdapter());
adapters.register(new Seedance25Adapter());
adapters.register(new Kling3Adapter());

const service = new AnselseService({
  store: new MemoryEventStore(),
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
