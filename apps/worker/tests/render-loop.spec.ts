import { describe, it, expect, beforeEach } from "vitest";
import {
  createAdapterRegistry,
  MockAdapter,
  Seedance25Adapter,
} from "@anselse/adapters";
import { projectTakes, reconstructRenderRequest, type ActorId } from "@anselse/events";
import {
  MemoryEventStore,
  MemoryRenderQueue,
  FakeMediaStore,
} from "@anselse/platform";
import { AnselseService } from "@anselse/server";
import { RenderWorker, drainQueue } from "@anselse/worker";
import { breakupDraft } from "../../../packages/recipe/tests/fixtures/breakup-ots.ts";

const actor = "u_1" as ActorId;

function harness() {
  const store = new MemoryEventStore();
  const queue = new MemoryRenderQueue();
  const adapters = createAdapterRegistry();
  adapters.register(new MockAdapter());
  adapters.register(new Seedance25Adapter());
  let n = 0;
  const deps = {
    store,
    adapters,
    ids: { newId: (p: string) => `${p}_${++n}` },
    clock: { now: () => 1_755_500_000_000 + n },
  };
  const service = new AnselseService({ ...deps, queue });
  const worker = new RenderWorker({ ...deps, mediaStore: new FakeMediaStore() });
  return { store, queue, service, worker };
}

let h: ReturnType<typeof harness>;
beforeEach(() => {
  h = harness();
});

async function mockProject() {
  const { projectId } = await h.service.createProject(actor, "p");
  const draft = structuredClone(breakupDraft);
  draft.binding.targetAdapter = "mock" as typeof draft.binding.targetAdapter;
  const recipe = await h.service.createRecipe(actor, projectId, draft);
  const req = await h.service.requestRender(actor, projectId, recipe.meta.id, 1, "mock" as never);
  if (!req.ok) throw new Error("compile unexpectedly rejected");
  return { projectId, recipe };
}

describe("render loop (server → queue → worker → Take)", () => {
  it("completes a mock render end-to-end and projects a Take with full provenance", async () => {
    const { projectId, recipe } = await mockProject();

    const outcomes = await drainQueue(h.queue, h.worker);
    expect(outcomes).toEqual([{ status: "completed", takeId: "t_3" }]);

    const events = await h.store.read(projectId);
    const takes = projectTakes(events);
    expect(takes.size).toBe(1);
    const take = takes.get("t_3" as never)!;

    // provenance 完整、可回放
    expect(take.provenance).toMatchObject({
      recipeId: recipe.meta.id,
      recipeVersion: 1,
      adapterId: "mock",
      adapterVersion: "0.0.0",
    });
    expect(take.media.videoUrl).toBe(`stored://${projectId}/t_3.mp4`);
    expect(take.media.durationSec).toBe(30);
    expect(take.status).toBe("unrated");

    // 视频永远能回放出它的配方与编译产物
    const rebuilt = reconstructRenderRequest(events, take.provenance.requestEventSeq);
    expect(rebuilt.recipe.meta.id).toBe(recipe.meta.id);
    expect((rebuilt.resolvedSpec as { kind: string }).kind).toBe("mock-spec");
  });

  it("take status folds into the projection", async () => {
    const { projectId } = await mockProject();
    await drainQueue(h.queue, h.worker);
    await h.service.setTakeStatus(actor, projectId, "t_3" as never, "selected");

    const takes = projectTakes(await h.store.read(projectId));
    expect(takes.get("t_3" as never)!.status).toBe("selected");
  });

  it("is idempotent: reprocessing the same job appends nothing new", async () => {
    const { projectId } = await mockProject();
    const job = { projectId, requestSeq: 2 };

    const first = await h.worker.processJob(job);
    expect(first.status).toBe("completed");
    const after = (await h.store.read(projectId)).length;

    const second = await h.worker.processJob(job);
    expect(second.status).toBe("skipped-already-settled");
    expect((await h.store.read(projectId)).length).toBe(after);
  });

  it("records render/failed when the adapter render throws (seedance not wired yet)", async () => {
    const { projectId } = await h.service.createProject(actor, "p");
    const recipe = await h.service.createRecipe(actor, projectId, breakupDraft); // seedance-2.5
    const req = await h.service.requestRender(actor, projectId, recipe.meta.id, 1, "seedance-2.5" as never);
    expect(req.ok).toBe(true); // 编译成功

    const outcomes = await drainQueue(h.queue, h.worker);
    expect(outcomes[0]!.status).toBe("failed");

    const events = await h.store.read(projectId);
    const failed = events.find((e) => e.type === "render/failed");
    expect(failed?.type).toBe("render/failed");
    if (failed?.type === "render/failed") {
      expect(failed.data.kind).toBe("provider_error");
      expect(failed.data.detail).toContain("not wired");
    }
    // 失败不产生 Take
    expect(projectTakes(events).size).toBe(0);
  });

  it("fails a job whose adapter is no longer registered", async () => {
    const { projectId } = await mockProject();
    // 模拟 adapter 下线：新 worker 的 registry 不含 mock
    const emptyAdapters = createAdapterRegistry();
    const worker = new RenderWorker({
      store: h.store,
      adapters: emptyAdapters,
      mediaStore: new FakeMediaStore(),
      ids: { newId: (p) => `${p}_x` },
      clock: { now: () => 1 },
    });
    const outcome = await worker.processJob({ projectId, requestSeq: 2 });
    expect(outcome).toMatchObject({ status: "failed", kind: "provider_error" });
  });
});
