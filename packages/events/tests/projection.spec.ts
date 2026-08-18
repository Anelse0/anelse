import { describe, it, expect } from "vitest";
import { resolveRecipe, type Recipe } from "@anselse/recipe";
import {
  nextEvent,
  projectRecipeVersions,
  recipeAtVersion,
  reconstructRenderRequest,
  ProjectionError,
  type ProjectEvent,
  type ActorId,
} from "@anselse/events";
import { breakupDraft } from "../../recipe/tests/fixtures/breakup-ots.ts";

const actorId = "u_1" as ActorId;
const T0 = 1_755_500_000_000;
const META = { id: "r_1", projectId: "p_1" } as Parameters<typeof resolveRecipe>[1];

function buildLog(): { events: ProjectEvent[]; recipe: Recipe } {
  const recipe = resolveRecipe(breakupDraft, META);
  const events: ProjectEvent[] = [];
  const push = (e: ProjectEvent) => (events.push(e), e);
  push(nextEvent(events, { type: "project/created", data: { title: "分手戏" }, actorId, time: T0 }));
  push(nextEvent(events, { type: "recipe/created", data: { recipe }, actorId, time: T0 + 1 }));
  push(
    nextEvent(events, {
      type: "recipe/patched",
      data: {
        recipeId: recipe.meta.id,
        baseVersion: 1,
        ops: [{ op: "set", path: ["scene", "lighting"], value: "暖色台灯侧光" }],
      },
      actorId,
      time: T0 + 2,
    }),
  );
  return { events, recipe };
}

describe("projectRecipeVersions", () => {
  it("folds created + patched into an immutable version chain", () => {
    const { events, recipe } = buildLog();
    const versions = projectRecipeVersions(events);
    const chain = versions.get(recipe.meta.id)!;
    expect(chain).toHaveLength(2);
    expect(chain[0]!.meta.version).toBe(1);
    expect(chain[1]!.meta.version).toBe(2);
    expect(chain[1]!.scene.lighting).toBe("暖色台灯侧光");
    expect(chain[0]!.scene.lighting).not.toBe("暖色台灯侧光"); // v1 不被改写
  });

  it("fails loud on baseVersion mismatch (lost/out-of-order events)", () => {
    const { events, recipe } = buildLog();
    events.push(
      nextEvent(events, {
        type: "recipe/patched",
        data: {
          recipeId: recipe.meta.id,
          baseVersion: 1, // 链头已是 v2
          ops: [{ op: "set", path: ["scene", "setting"], value: "天台" }],
        },
        actorId,
        time: T0 + 3,
      }),
    );
    expect(() => projectRecipeVersions(events)).toThrow(ProjectionError);
  });

  it("fails loud on patch for an unknown recipe", () => {
    const events = [
      nextEvent([], {
        type: "recipe/patched",
        data: { recipeId: "r_ghost" as never, baseVersion: 1, ops: [{ op: "set", path: ["x"], value: 1 }] },
        actorId,
        time: T0,
      }),
    ];
    expect(() => projectRecipeVersions(events)).toThrow(/unknown recipe/);
  });
});

describe("reconstructRenderRequest (Provider-visible ⟺ Logged)", () => {
  it("reconstructs the exact request from the log alone", () => {
    const { events, recipe } = buildLog();
    const spec = { prompt: "…镜头 01…", model: "seedance-2.5" };
    const request = nextEvent(events, {
      type: "render/requested",
      data: { recipeId: recipe.meta.id, recipeVersion: 2, adapterId: "seedance-2.5" as never, resolvedSpec: spec },
      actorId,
      time: T0 + 3,
    });
    events.push(request);

    const rebuilt = reconstructRenderRequest(events, request.seq);
    expect(rebuilt.resolvedSpec).toEqual(spec);
    expect(rebuilt.recipe.meta.version).toBe(2);
    expect(rebuilt.recipe.scene.lighting).toBe("暖色台灯侧光");
  });

  it("refuses when the referenced recipe version is not derivable from the log", () => {
    const { events, recipe } = buildLog();
    const request = nextEvent(events, {
      type: "render/requested",
      data: { recipeId: recipe.meta.id, recipeVersion: 9, adapterId: "mock" as never, resolvedSpec: {} },
      actorId,
      time: T0 + 3,
    });
    events.push(request);
    expect(() => reconstructRenderRequest(events, request.seq)).toThrow(/not derivable/);
  });

  it("refuses a seq that is not a render/requested event", () => {
    const { events } = buildLog();
    expect(() => reconstructRenderRequest(events, 0)).toThrow(ProjectionError);
  });

  it("recipeAtVersion returns undefined for absent versions", () => {
    const { events, recipe } = buildLog();
    const versions = projectRecipeVersions(events);
    expect(recipeAtVersion(versions, recipe.meta.id, 9)).toBeUndefined();
  });
});
