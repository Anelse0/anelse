import { describe, it, expect } from "vitest";
import { resolveRecipe, applyRecipePatch } from "@anselse/recipe";
import { Kling3Adapter, resolveBeatWindows } from "@anselse/adapters";
import { reunionDraft } from "./fixtures/reunion-kling.ts";
import { breakupDraft } from "../../recipe/tests/fixtures/breakup-ots.ts";

const META = { id: "r_k1", projectId: "p_1" } as Parameters<typeof resolveRecipe>[1];
const reunion = resolveRecipe(reunionDraft, META);
const adapter = new Kling3Adapter();

describe("Kling3Adapter.resolve", () => {
  it("compiles the verified reunion fixture with no warnings (verified narrow domain)", () => {
    const resolved = adapter.resolve(reunion);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.warnings).toEqual([]);
      expect(resolved.spec.config).toEqual({
        modelName: "kling-v3",
        mode: "std",
        durationSec: 8,
        aspect: "9:16",
        cfgScale: 0.5,
        multiShot: false,
      });
    }
  });

  it("keyless compile snapshot: verified time-segment framework", async () => {
    const resolved = adapter.resolve(reunion);
    if (!resolved.ok) throw new Error("unexpected rejection");
    await expect(resolved.spec.prompt).toMatchFileSnapshot(
      "./__snapshots__/reunion.kling3.prompt.txt",
    );
  });

  it("microformat: segment headers without '约', pacing disclaimer, stationary constraints", () => {
    const resolved = adapter.resolve(reunion);
    if (!resolved.ok) throw new Error("unexpected rejection");
    const prompt = resolved.spec.prompt;
    expect(prompt).toContain("【0–1.3s｜静立辨认】");
    expect(prompt).toContain("【1.3–2.8s｜认出的冲击】");
    expect(prompt).toContain("【5.7–8s｜敞开等待】");
    expect(prompt).not.toContain("约");
    expect(prompt).toContain("时间范围仅作节奏参考");
    expect(prompt).toContain("人物自始至终站定，双脚持续承重");
    expect(prompt).toContain("单人；画面只有该角色");
    expect(prompt.split("\n")[0]).toContain("8 秒稳定单镜中近景，无台词");
  });

  it("rejects the 30s breakup recipe: duration over the official 15s ceiling", () => {
    const bound = structuredClone(breakupDraft);
    bound.binding.targetAdapter = "kling-v3" as typeof bound.binding.targetAdapter;
    const resolved = adapter.resolve(resolveRecipe(bound, META));
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      const axes = resolved.rejections.map((r) => r.axis);
      expect(axes).toContain("duration"); // 30s > 15s
      expect(axes).toContain("shots"); // 4 镜 > v0 单镜证据域
    }
  });

  it("warns on dialogue (experimental on kling, no verified footage)", () => {
    const withLine = applyRecipePatch(reunion, [
      {
        op: "set",
        path: ["shots", 0, "beats", 3, "dialogue"],
        value: { text: "你回来了。", delivery: "很轻" },
      },
    ]);
    const resolved = adapter.resolve(withLine);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.warnings.map((w) => w.axis)).toEqual(["dialogue"]);
      expect(resolved.spec.prompt).toContain("“你回来了。”");
    }
  });

  it("resolve is pure (identical output for identical input)", () => {
    expect(adapter.resolve(reunion)).toEqual(adapter.resolve(reunion));
  });
});

describe("resolveBeatWindows", () => {
  it("uses explicit windows when present", () => {
    const windows = resolveBeatWindows(reunion.shots[0]!.beats, 8);
    expect(windows).toEqual([
      [0, 1.3],
      [1.3, 2.8],
      [2.8, 5.7],
      [5.7, 8],
    ]);
  });

  it("distributes evenly and deterministically when windows are absent", () => {
    const beats = reunion.shots[0]!.beats.map(({ window: _w, ...rest }) => rest);
    const windows = resolveBeatWindows(beats, 8);
    expect(windows).toEqual([
      [0, 2],
      [2, 4],
      [4, 6],
      [6, 8],
    ]);
  });

  it("last segment always closes exactly at total duration", () => {
    const beats = [{ state: "a", action: "x" }, { state: "b", action: "y" }, { state: "c", action: "z" }];
    const windows = resolveBeatWindows(beats, 10);
    expect(windows[2]![1]).toBe(10);
  });
});
