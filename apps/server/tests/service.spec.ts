import { describe, it, expect, beforeEach } from "vitest";
import {
  createAdapterRegistry,
  MockAdapter,
  Seedance25Adapter,
  Kling3Adapter,
} from "@anselse/adapters";
import { reconstructRenderRequest, type ActorId } from "@anselse/events";
import {
  AnselseService,
  MemoryEventStore,
  MemoryRenderQueue,
  NotFoundError,
  VersionConflictError,
} from "@anselse/server";
import { breakupDraft } from "../../../packages/recipe/tests/fixtures/breakup-ots.ts";

const actor = "u_1" as ActorId;

function makeService() {
  const store = new MemoryEventStore();
  const queue = new MemoryRenderQueue();
  const adapters = createAdapterRegistry();
  adapters.register(new MockAdapter());
  adapters.register(new Seedance25Adapter());
  adapters.register(new Kling3Adapter());
  let n = 0;
  const service = new AnselseService({
    store,
    queue,
    adapters,
    ids: { newId: (p) => `${p}_${++n}` },
    clock: { now: () => 1_755_500_000_000 + n },
  });
  return { service, store, queue };
}

let ctx: ReturnType<typeof makeService>;
beforeEach(() => {
  ctx = makeService();
});

describe("AnselseService", () => {
  it("create → patch → list: version chain derives from the log", async () => {
    const { projectId } = await ctx.service.createProject(actor, "分手戏");
    const recipe = await ctx.service.createRecipe(actor, projectId, breakupDraft);
    const patched = await ctx.service.patchRecipe(actor, projectId, recipe.meta.id, 1, [
      { op: "set", path: ["scene", "lighting"], value: "暖色台灯侧光" },
    ]);
    expect(patched.meta.version).toBe(2);

    const versions = await ctx.service.listRecipes(projectId);
    expect(versions.get(recipe.meta.id)).toHaveLength(2);
  });

  it("stale baseVersion → VersionConflictError (client refreshes and retries)", async () => {
    const { projectId } = await ctx.service.createProject(actor, "p");
    const recipe = await ctx.service.createRecipe(actor, projectId, breakupDraft);
    await ctx.service.patchRecipe(actor, projectId, recipe.meta.id, 1, [
      { op: "set", path: ["scene", "setting"], value: "天台" },
    ]);
    await expect(
      ctx.service.patchRecipe(actor, projectId, recipe.meta.id, 1, [
        { op: "set", path: ["scene", "setting"], value: "车站" },
      ]),
    ).rejects.toThrow(VersionConflictError);
  });

  it("fork carries lineage and appends the lineage edge in the target project", async () => {
    const { projectId: src } = await ctx.service.createProject(actor, "原作");
    const recipe = await ctx.service.createRecipe(actor, src, breakupDraft);
    const { projectId: dst } = await ctx.service.createProject(actor, "我的 remix");

    const forked = await ctx.service.forkRecipe(
      actor,
      { projectId: src, recipeId: recipe.meta.id, version: 1 },
      dst,
    );
    expect(forked.meta.version).toBe(1);
    expect(forked.meta.lineage?.forkedFrom).toEqual({ recipeId: recipe.meta.id, version: 1 });

    const dstEvents = await ctx.store.read(dst);
    expect(dstEvents.map((e) => e.type)).toEqual([
      "project/created",
      "recipe/created",
      "recipe/forked",
    ]);
  });

  it("requestRender (ok): appends render/requested, enqueues, and stays reconstructable", async () => {
    const { projectId } = await ctx.service.createProject(actor, "p");
    const recipe = await ctx.service.createRecipe(actor, projectId, breakupDraft);

    const result = await ctx.service.requestRender(
      actor,
      projectId,
      recipe.meta.id,
      1,
      "seedance-2.5" as never,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(ctx.queue.jobs).toEqual([{ projectId, requestSeq: result.requestSeq }]);

    // Provider-visible ⟺ Logged：请求可仅凭日志重建
    const events = await ctx.store.read(projectId);
    const rebuilt = reconstructRenderRequest(events, result.requestSeq);
    expect(rebuilt.recipe.meta.id).toBe(recipe.meta.id);
    expect((rebuilt.resolvedSpec as { kind: string }).kind).toBe("seedance-prompt");
  });

  it("requestRender (compile rejected): returns rejections, appends nothing, enqueues nothing", async () => {
    const { projectId } = await ctx.service.createProject(actor, "p");
    const recipe = await ctx.service.createRecipe(actor, projectId, breakupDraft);
    const before = (await ctx.store.read(projectId)).length;

    // 30s 的配方编译到 kling-v3 → duration/shots 拒绝
    const result = await ctx.service.requestRender(
      actor,
      projectId,
      recipe.meta.id,
      1,
      "kling-v3" as never,
    );
    expect(result.ok).toBe(false);
    expect((await ctx.store.read(projectId)).length).toBe(before);
    expect(ctx.queue.jobs).toEqual([]);
  });

  it("unknown recipe / adapter → NotFoundError", async () => {
    const { projectId } = await ctx.service.createProject(actor, "p");
    await expect(
      ctx.service.requestRender(actor, projectId, "r_ghost" as never, 1, "mock" as never),
    ).rejects.toThrow(NotFoundError);
  });
});
