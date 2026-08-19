import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createAdapterRegistry,
  MockAdapter,
  Seedance25Adapter,
  Kling3Adapter,
} from "@anselse/adapters";
import type { ActorId } from "@anselse/events";
import { MemoryEventStore, MemoryRenderQueue } from "@anselse/platform";
import { AnselseService, appRouter, createCallerFactory } from "@anselse/server";
import { breakupDraft } from "../../../packages/recipe/tests/fixtures/breakup-ots.ts";

function makeCaller() {
  const adapters = createAdapterRegistry();
  adapters.register(new MockAdapter());
  adapters.register(new Seedance25Adapter());
  adapters.register(new Kling3Adapter());
  let n = 0;
  const service = new AnselseService({
    store: new MemoryEventStore(),
    queue: new MemoryRenderQueue(),
    adapters,
    ids: { newId: (p) => `${p}_${++n}` },
    clock: { now: () => 1_755_500_000_000 + n },
  });
  return createCallerFactory(appRouter)({ actorId: "u_1" as ActorId, service });
}

describe("appRouter (via caller, no HTTP)", () => {
  it("full flow: project → recipe → patch → render request → recipe list", async () => {
    const caller = makeCaller();
    const { projectId } = await caller.project.create({ title: "分手戏" });
    const recipe = await caller.recipe.create({ projectId, draft: breakupDraft });
    const patched = await caller.recipe.patch({
      projectId,
      recipeId: recipe.meta.id,
      baseVersion: 1,
      ops: [{ op: "set", path: ["scene", "lighting"], value: "暖色台灯侧光" }],
    });
    expect(patched.meta.version).toBe(2);

    const render = await caller.render.request({
      projectId,
      recipeId: recipe.meta.id,
      recipeVersion: 2,
      adapterId: "seedance-2.5",
    });
    expect(render.ok).toBe(true);

    const list = await caller.recipe.list({ projectId });
    expect(list).toHaveLength(1);
    expect(list[0]!.chain).toHaveLength(2);
  });

  it("maps domain errors to tRPC codes (CONFLICT / NOT_FOUND)", async () => {
    const caller = makeCaller();
    const { projectId } = await caller.project.create({ title: "p" });
    const recipe = await caller.recipe.create({ projectId, draft: breakupDraft });
    await caller.recipe.patch({
      projectId,
      recipeId: recipe.meta.id,
      baseVersion: 1,
      ops: [{ op: "set", path: ["scene", "setting"], value: "天台" }],
    });

    await expect(
      caller.recipe.patch({
        projectId,
        recipeId: recipe.meta.id,
        baseVersion: 1,
        ops: [{ op: "set", path: ["scene", "setting"], value: "车站" }],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" } satisfies Partial<TRPCError>);

    await expect(
      caller.render.request({
        projectId,
        recipeId: "r_ghost",
        recipeVersion: 1,
        adapterId: "mock",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" } satisfies Partial<TRPCError>);
  });

  it("rejects malformed drafts at the wire boundary (zod input validation)", async () => {
    const caller = makeCaller();
    const { projectId } = await caller.project.create({ title: "p" });
    const bad = structuredClone(breakupDraft);
    (bad as { shots: unknown }).shots = [];
    await expect(caller.recipe.create({ projectId, draft: bad })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
