import { describe, it, expect } from "vitest";
import { resolveRecipe, applyRecipePatch, RecipePatchError } from "@anselse/recipe";
import { breakupDraft } from "./fixtures/breakup-ots.ts";

const META = { id: "r_1", projectId: "p_1" } as Parameters<typeof resolveRecipe>[1];
const base = resolveRecipe(breakupDraft, META);

describe("applyRecipePatch", () => {
  it("sets a nested field and bumps version, leaving the base untouched", () => {
    const baseJson = JSON.stringify(base);
    const next = applyRecipePatch(base, [
      { op: "set", path: ["shots", 0, "beats", 1, "dialogue", "text"], value: "我们谈谈吧。" },
    ]);
    expect(next.meta.version).toBe(2);
    expect(next.shots[0]!.beats[1]!.dialogue!.text).toBe("我们谈谈吧。");
    expect(JSON.stringify(base)).toBe(baseJson); // 不可变
  });

  it("unsets an optional field", () => {
    const next = applyRecipePatch(base, [{ op: "unset", path: ["performanceAdvanced"] }]);
    expect(next.performanceAdvanced).toBeUndefined();
  });

  it("rejects any patch targeting meta", () => {
    expect(() =>
      applyRecipePatch(base, [{ op: "set", path: ["meta", "version"], value: 99 }]),
    ).toThrow(RecipePatchError);
  });

  it("rejects an empty path", () => {
    expect(() => applyRecipePatch(base, [{ op: "set", path: [], value: 1 }])).toThrow(
      RecipePatchError,
    );
  });

  it("fails loud when the patched result violates the schema", () => {
    // 删除运镜动机而主运镜仍为 slow_push_in → 违反"运镜必须有动机"
    expect(() =>
      applyRecipePatch(base, [{ op: "unset", path: ["camera", "movementDriver"] }]),
    ).toThrow(/movementDriver/);
  });

  it("applies multiple ops in order", () => {
    const next = applyRecipePatch(base, [
      { op: "set", path: ["scene", "lighting"], value: "暖色台灯侧光，明暗对比更强" },
      { op: "set", path: ["constraints", "durationSec"], value: 24 },
    ]);
    expect(next.scene.lighting).toContain("暖色");
    expect(next.constraints.durationSec).toBe(24);
  });
});
