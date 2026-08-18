import { describe, it, expect } from "vitest";
import {
  resolveRecipe,
  recipeSchema,
  type RecipeDraft,
} from "@anselse/recipe";
import { breakupDraft } from "./fixtures/breakup-ots.ts";

const META = { id: "r_1", projectId: "p_1" } as Parameters<typeof resolveRecipe>[1];

function draft(mutate: (d: RecipeDraft) => void): RecipeDraft {
  const d = structuredClone(breakupDraft);
  mutate(d);
  return d;
}

describe("recipe schema v0", () => {
  it("accepts the verified breakup golden fixture", () => {
    const recipe = resolveRecipe(breakupDraft, META);
    expect(recipe.meta.version).toBe(1);
    expect(recipe.shots).toHaveLength(4);
    expect(recipe.shots[0]!.beats[1]!.dialogue!.text).toContain("没办法再继续下去");
  });

  it("rejects a recipe with no shots", () => {
    expect(() => resolveRecipe(draft((d) => void (d.shots = [])), META)).toThrow();
  });

  it("rejects a shot with no beats", () => {
    expect(() =>
      resolveRecipe(draft((d) => void (d.shots[0]!.beats = [])), META),
    ).toThrow();
  });

  it("rejects an empty beat action", () => {
    expect(() =>
      resolveRecipe(draft((d) => void (d.shots[0]!.beats[0]!.action = "")), META),
    ).toThrow();
  });

  it("enforces motivated camera movement: non-static mainMove requires movementDriver", () => {
    expect(() =>
      resolveRecipe(draft((d) => void delete d.camera.movementDriver), META),
    ).toThrow(/movementDriver/);
    // static 无需动机
    expect(() =>
      resolveRecipe(
        draft((d) => {
          d.camera.mainMove = "static";
          delete d.camera.movementDriver;
        }),
        META,
      ),
    ).not.toThrow();
  });

  it("rejects unknown shot framing outside the controlled vocabulary", () => {
    expect(() =>
      resolveRecipe(
        draft((d) => void ((d.shots[0] as { framing: string }).framing = "dutch_angle")),
        META,
      ),
    ).toThrow();
  });

  it("rejects shot durations summing beyond total duration", () => {
    expect(() =>
      resolveRecipe(
        draft((d) => {
          d.shots[0]!.durationSec = 20;
          d.shots[1]!.durationSec = 20;
        }),
        META,
      ),
    ).toThrow(/exceeding total duration/);
  });

  it("rejects duration outside 1..30", () => {
    expect(() =>
      resolveRecipe(draft((d) => void (d.constraints.durationSec = 31)), META),
    ).toThrow();
  });

  it("full schema rejects a tampered version type", () => {
    const recipe = resolveRecipe(breakupDraft, META);
    expect(() =>
      recipeSchema.parse({ ...recipe, meta: { ...recipe.meta, version: 0 } }),
    ).toThrow();
  });
});
