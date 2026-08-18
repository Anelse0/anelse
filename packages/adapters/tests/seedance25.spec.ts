import { describe, it, expect } from "vitest";
import { resolveRecipe, applyRecipePatch } from "@anselse/recipe";
import { Seedance25Adapter } from "@anselse/adapters";
import { breakupDraft } from "../../recipe/tests/fixtures/breakup-ots.ts";

const META = { id: "r_1", projectId: "p_1" } as Parameters<typeof resolveRecipe>[1];
const recipe = resolveRecipe(breakupDraft, META);
const adapter = new Seedance25Adapter();

describe("Seedance25Adapter.resolve", () => {
  it("compiles the golden fixture with no warnings (all axes verified)", () => {
    const resolved = adapter.resolve(recipe);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.warnings).toEqual([]);
  });

  it("keyless compile snapshot: golden fixture → verified-template-isomorphic prompt", async () => {
    const resolved = adapter.resolve(recipe);
    if (!resolved.ok) throw new Error("unexpected rejection");
    await expect(resolved.spec.prompt).toMatchFileSnapshot(
      "./__snapshots__/breakup.seedance25.prompt.txt",
    );
  });

  it("microformat: bare shot titles, per-line sentences, dialogue blocks", () => {
    const resolved = adapter.resolve(recipe);
    if (!resolved.ok) throw new Error("unexpected rejection");
    const lines = resolved.spec.prompt.split("\n");
    expect(lines).toContain("镜头 01");
    expect(lines).toContain("镜头 04");
    expect(lines).toContain("对白：");
    expect(lines).toContain("“我觉得……我们该放彼此走了。”");
    // 顶部声明镜数/时长/画幅
    expect(lines[0]).toContain("30 秒");
    expect(lines[0]).toContain("4 个镜头");
    expect(lines[0]).toContain("9:16");
    // 表演指导重述段存在
    expect(lines).toContain("表演指导");
    // restrain 显示策略被编译为护栏句
    expect(resolved.spec.prompt).toContain("在真正崩溃之前结束");
  });

  it("warns when the recipe uses an experimental axis (pan)", () => {
    const panned = applyRecipePatch(recipe, [
      { op: "set", path: ["camera", "mainMove"], value: "pan" },
      { op: "set", path: ["camera", "movementDriver"], value: "横摇跟随她转身离开的方向" },
    ]);
    const resolved = adapter.resolve(panned);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.warnings.map((w) => w.axis)).toEqual(["move:pan"]);
  });

  it("rejects a recipe bound to another adapter", () => {
    const other = applyRecipePatch(recipe, [
      { op: "set", path: ["binding", "targetAdapter"], value: "kling-3" },
    ]);
    const resolved = adapter.resolve(other);
    expect(resolved.ok).toBe(false);
  });

  it("resolve is a pure function (identical output for identical input)", () => {
    expect(adapter.resolve(recipe)).toEqual(adapter.resolve(recipe));
  });
});
