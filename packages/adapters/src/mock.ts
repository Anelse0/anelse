/**
 * MockAdapter：确定性 Provider，用于管线端到端与快照测试（零外部依赖）。
 * 全轴 verified（证据引用指向自身——mock 的兑现是恒真命题）。
 */
import type { Recipe, AdapterId } from "@anselse/recipe";
import { SHOT_TYPES, CAMERA_MOVES } from "@anselse/vocab";
import type { AxisSupport, CapabilityMatrix, ModelAdapter, Resolved, RenderResult } from "./types.ts";
import { checkRecipeAgainstCapabilities } from "./check.ts";

export interface MockSpec {
  kind: "mock-spec";
  recipeId: string;
  recipeVersion: number;
  shotCount: number;
  beatCount: number;
  durationSec: number;
  aspect: string;
}

const MOCK_EVIDENCE = "mock:tautology";

function allVerified(prefix: string, ids: readonly string[]): Record<string, AxisSupport> {
  return Object.fromEntries(
    ids.map((id) => [`${prefix}:${id}`, { level: "verified", evidenceRef: MOCK_EVIDENCE }]),
  );
}

export class MockAdapter implements ModelAdapter<MockSpec> {
  readonly id = "mock" as AdapterId;
  readonly version = "0.0.0";

  capabilities(): CapabilityMatrix {
    return {
      axes: {
        ...allVerified("framing", SHOT_TYPES.map((s) => s.id)),
        ...allVerified("move", CAMERA_MOVES.map((m) => m.id)),
      },
      durationRangeSec: [1, 30],
      aspects: ["9:16", "16:9", "1:1"],
    };
  }

  resolve(recipe: Recipe): Resolved<MockSpec> {
    const check = checkRecipeAgainstCapabilities(recipe, this.id, this.capabilities());
    if (check.rejections.length > 0) return { ok: false, rejections: check.rejections };
    return {
      ok: true,
      warnings: check.warnings,
      spec: {
        kind: "mock-spec",
        recipeId: recipe.meta.id,
        recipeVersion: recipe.meta.version,
        shotCount: recipe.shots.length,
        beatCount: recipe.shots.reduce((n, s) => n + s.beats.length, 0),
        durationSec: recipe.constraints.durationSec,
        aspect: recipe.constraints.aspect,
      },
    };
  }

  render(spec: MockSpec, _signal: AbortSignal): Promise<RenderResult> {
    // 确定性：URL 仅由 spec 派生，无时钟无随机。
    return Promise.resolve({
      videoUrl: `mock://take/${spec.recipeId}/v${spec.recipeVersion}`,
      durationMs: 0,
    });
  }
}
