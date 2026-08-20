/**
 * PostgresEventStore 集成测试（真实 Supabase）。
 * 自跳过：未配置 PG* 环境变量，或数据库不可达（如本机 fake-ip 代理拦截）。
 * 前置：先跑 `pnpm migrate` 建表。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDb, hasDbEnv, type DbHandle } from "@anselse/db";
import { StoreConflictError } from "@anselse/platform";
import { PostgresEventStore } from "@anselse/platform/postgres";
import { nextEvent, projectRecipeVersions, type ActorId } from "@anselse/events";
import { resolveRecipe, type ProjectId } from "@anselse/recipe";
import { breakupDraft } from "../../recipe/tests/fixtures/breakup-ots.ts";

const actor = "u_it" as ActorId;

let handle: DbHandle | undefined;
let reachable = false;

async function probe(h: DbHandle): Promise<boolean> {
  try {
    await Promise.race([
      h.sql`select 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error("probe timeout")), 6000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  if (!hasDbEnv()) return;
  handle = createDb();
  reachable = await probe(handle);
});

afterAll(async () => {
  await handle?.close();
});

describe("PostgresEventStore (real Supabase)", () => {
  it("persists an event log and projects the recipe version chain from real Postgres", async (ctx) => {
    if (!reachable) ctx.skip();
    const store = new PostgresEventStore(handle!.sql);
    // 唯一项目 id，避免与既有数据冲突（无 Date.now：用高分辨率计数不可用，改用随机段）
    const projectId = `p_it_${Math.floor(performance.now() * 1000)}` as ProjectId;

    const recipe = resolveRecipe(breakupDraft, {
      id: `r_it_1` as never,
      projectId,
    });
    const time = 1_755_500_000_000;

    let log = await store.read(projectId);
    const e0 = nextEvent(log, { type: "project/created", data: { title: "集成测试" }, actorId: actor, time });
    await store.append(projectId, e0);

    log = await store.read(projectId);
    const e1 = nextEvent(log, { type: "recipe/created", data: { recipe }, actorId: actor, time: time + 1 });
    await store.append(projectId, e1);

    log = await store.read(projectId);
    const e2 = nextEvent(log, {
      type: "recipe/patched",
      data: { recipeId: recipe.meta.id, baseVersion: 1, ops: [{ op: "set", path: ["scene", "lighting"], value: "暖色台灯侧光" }] },
      actorId: actor,
      time: time + 2,
    });
    await store.append(projectId, e2);

    // 从真实 DB 读回并投影
    const persisted = await store.read(projectId);
    expect(persisted.map((e) => e.type)).toEqual(["project/created", "recipe/created", "recipe/patched"]);
    const chain = projectRecipeVersions(persisted).get(recipe.meta.id)!;
    expect(chain).toHaveLength(2);
    expect(chain[1]!.scene.lighting).toBe("暖色台灯侧光");
  });

  it("enforces append-only monotonicity: duplicate seq → StoreConflictError", async (ctx) => {
    if (!reachable) ctx.skip();
    const store = new PostgresEventStore(handle!.sql);
    const projectId = `p_it_${Math.floor(performance.now() * 1000)}_c` as ProjectId;
    const e0 = nextEvent([], { type: "project/created", data: { title: "c" }, actorId: actor, time: 1 });
    await store.append(projectId, e0);
    // 再次 append seq=0（伪造并发冲突）→ 唯一约束
    await expect(store.append(projectId, e0)).rejects.toThrow(StoreConflictError);
  });
});
