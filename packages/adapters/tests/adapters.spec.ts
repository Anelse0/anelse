import { describe, it, expect } from "vitest";
import { resolveRecipe, applyRecipePatch } from "@anselse/recipe";
import {
  MockAdapter,
  createAdapterRegistry,
  DuplicateAdapterError,
  checkRecipeAgainstCapabilities,
  type CapabilityMatrix,
} from "@anselse/adapters";
import { breakupDraft } from "../../recipe/tests/fixtures/breakup-ots.ts";

const META = { id: "r_1", projectId: "p_1" } as Parameters<typeof resolveRecipe>[1];

function mockBound() {
  const draft = structuredClone(breakupDraft);
  draft.binding.targetAdapter = "mock" as typeof draft.binding.targetAdapter;
  return resolveRecipe(draft, META);
}

describe("adapter registry", () => {
  it("registers, resolves, and disposes reversibly", () => {
    const registry = createAdapterRegistry();
    const dispose = registry.register(new MockAdapter());
    expect(registry.get("mock")).toBeDefined();
    dispose();
    expect(registry.get("mock")).toBeUndefined();
    dispose(); // 幂等
  });

  it("fails loud on duplicate registration", () => {
    const registry = createAdapterRegistry();
    registry.register(new MockAdapter());
    expect(() => registry.register(new MockAdapter())).toThrow(DuplicateAdapterError);
  });

  it("disposer does not remove a successor registration", () => {
    const registry = createAdapterRegistry();
    const first = new MockAdapter();
    const disposeFirst = registry.register(first);
    disposeFirst();
    const second = new MockAdapter();
    registry.register(second);
    disposeFirst(); // 过期 disposer 不得误删后继
    expect(registry.get("mock")).toBe(second);
  });
});

describe("MockAdapter", () => {
  it("resolves the golden fixture deterministically", () => {
    const recipe = mockBound();
    const a = new MockAdapter().resolve(recipe);
    const b = new MockAdapter().resolve(recipe);
    expect(a).toEqual(b);
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.spec.shotCount).toBe(4);
      expect(a.spec.beatCount).toBe(8);
      expect(a.warnings).toEqual([]);
    }
  });

  it("rejects a recipe bound to another adapter (compile guard)", () => {
    const recipe = resolveRecipe(breakupDraft, META); // binding: seedance-2.5
    const resolved = new MockAdapter().resolve(recipe);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.rejections[0]!.axis).toBe("binding");
  });

  it("renders deterministically from spec alone", async () => {
    const resolved = new MockAdapter().resolve(mockBound());
    if (!resolved.ok) throw new Error("unexpected rejection");
    const result = await new MockAdapter().render(resolved.spec, new AbortController().signal);
    expect(result.videoUrl).toBe("mock://take/r_1/v1");
  });
});

describe("checkRecipeAgainstCapabilities", () => {
  const caps: CapabilityMatrix = {
    axes: {
      "framing:medium_close_up": { level: "verified", evidenceRef: "probe:x" },
      "framing:close_up": { level: "experimental" },
      "move:slow_push_in": { level: "verified", evidenceRef: "probe:y" },
      "move:static": { level: "unsupported" },
    },
    durationRangeSec: [4, 10],
    aspects: ["16:9"],
  };

  it("rejects out-of-range duration, unsupported aspect and undeclared axes", () => {
    const recipe = mockBound(); // 30s · 9:16 · OTS/MCU/CU/ECU
    const check = checkRecipeAgainstCapabilities(recipe, "mock" as never, caps);
    const axes = check.rejections.map((r) => r.axis);
    expect(axes).toContain("duration");
    expect(axes).toContain("aspect");
    expect(axes).toContain("framing:extreme_close_up"); // 未声明 = 不支持
  });

  it("warns on experimental axes without rejecting", () => {
    const base = mockBound();
    const short = applyRecipePatch(base, [
      { op: "set", path: ["constraints", "durationSec"], value: 8 },
      { op: "set", path: ["constraints", "aspect"], value: "16:9" },
      {
        op: "set",
        path: ["shots"],
        value: [
          { framing: "medium_close_up", beats: [{ state: "s", action: "看向镜头" }] },
          { framing: "close_up", beats: [{ state: "s", action: "闭眼" }] },
        ],
      },
    ]);
    const check = checkRecipeAgainstCapabilities(short, "mock" as never, caps);
    expect(check.rejections).toEqual([]);
    expect(check.warnings.map((w) => w.axis)).toEqual(["framing:close_up"]);
  });
});
