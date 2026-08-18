import { describe, it, expect } from "vitest";
import { resolveRecipe, RECIPE_DEFAULTS, type RecipeDraft } from "@anselse/recipe";
import { breakupDraft } from "./fixtures/breakup-ots.ts";

const META = { id: "r_1", projectId: "p_1" } as Parameters<typeof resolveRecipe>[1];

describe("resolveRecipe", () => {
  it("fills defaults explicitly (executionSource, aspect)", () => {
    const noOptional = structuredClone(breakupDraft) as RecipeDraft;
    delete (noOptional.camera as { executionSource?: string }).executionSource;
    delete (noOptional.constraints as { aspect?: string }).aspect;

    const recipe = resolveRecipe(noOptional, META);
    expect(recipe.camera.executionSource).toBe(RECIPE_DEFAULTS.executionSource);
    expect(recipe.constraints.aspect).toBe(RECIPE_DEFAULTS.aspect);
  });

  it("does not mutate the input draft", () => {
    const input = structuredClone(breakupDraft);
    const before = JSON.stringify(input);
    resolveRecipe(input, META);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("is deterministic for identical input", () => {
    const a = resolveRecipe(breakupDraft, META);
    const b = resolveRecipe(breakupDraft, META);
    expect(a).toEqual(b);
  });

  it("stamps version 1 and carries lineage through", () => {
    const meta = {
      ...META,
      lineage: { forkedFrom: { recipeId: "r_0", version: 3 } },
    } as Parameters<typeof resolveRecipe>[1];
    const recipe = resolveRecipe(breakupDraft, meta);
    expect(recipe.meta.version).toBe(1);
    expect(recipe.meta.lineage?.forkedFrom.version).toBe(3);
  });
});
