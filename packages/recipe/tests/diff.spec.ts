import { describe, it, expect } from "vitest";
import { resolveRecipe, applyRecipePatch, diffRecipes } from "@anselse/recipe";
import { breakupDraft } from "./fixtures/breakup-ots.ts";

const META = { id: "r_1", projectId: "p_1" } as Parameters<typeof resolveRecipe>[1];
const base = resolveRecipe(breakupDraft, META);

describe("diffRecipes", () => {
  it("returns no ops for identical recipes", () => {
    expect(diffRecipes(base, base)).toEqual([]);
  });

  it("detects a scalar change with its path", () => {
    const forked = applyRecipePatch(base, [
      { op: "set", path: ["scene", "lighting"], value: "暖色台灯侧光" },
    ]);
    const ops = diffRecipes(base, forked);
    expect(ops).toContainEqual({
      op: "set",
      path: ["scene", "lighting"],
      value: "暖色台灯侧光",
    });
    expect(ops).toHaveLength(1);
  });

  it("never emits meta paths", () => {
    const forked = applyRecipePatch(base, [
      { op: "set", path: ["constraints", "durationSec"], value: 20 },
    ]);
    // forked.meta.version 已变化，但 diff 不产生 meta 操作
    expect(diffRecipes(base, forked).every((o) => o.path[0] !== "meta")).toBe(true);
  });

  it("roundtrip: apply(diff(a,b)) on a equals b (excluding meta)", () => {
    const forked = applyRecipePatch(base, [
      { op: "set", path: ["shots", 3, "beats", 1, "dialogue", "text"], value: "七夕快乐。" },
      { op: "set", path: ["scene", "setting"], value: "深夜的天台，城市灯光在远处失焦" },
      { op: "unset", path: ["performanceAdvanced"] },
    ]);
    const replayed = applyRecipePatch(base, diffRecipes(base, forked));
    const strip = (r: typeof base) => JSON.stringify({ ...r, meta: undefined });
    expect(strip(replayed)).toBe(strip(forked));
  });
});
