/**
 * 显式默认值解析：所有 defaulting 集中在这一步（禁止散落 `?? default`）。
 * 输入是"创作草稿"（用户/编辑器产物，可缺省字段），输出是完整合法 Recipe v1。
 */
import { z } from "zod";
import {
  recipeSchema,
  sceneSchema,
  shotSchema,
  cameraSchema,
  performanceAdvancedSchema,
  bindingSchema,
  type Recipe,
  type RecipeMeta,
} from "./schema.ts";

/** 创作草稿：camera 的执行方式与 constraints 可缺省，由 resolve 显式补齐。 */
export const recipeDraftSchema = z.object({
  scene: sceneSchema,
  shots: z.array(shotSchema).min(1),
  performanceAdvanced: performanceAdvancedSchema.optional(),
  camera: cameraSchema.omit({ executionSource: true }).extend({
    executionSource: cameraSchema.shape.executionSource.optional(),
  }),
  constraints: z.object({
    durationSec: z.number().int().min(1).max(30),
    aspect: z.enum(["9:16", "16:9", "1:1"]).optional(),
    referenceFrames: z.array(z.string().min(1)).optional(),
  }),
  binding: bindingSchema,
});

export type RecipeDraft = z.infer<typeof recipeDraftSchema>;

/** v0 显式默认值（目标用户为竖屏系列内容，画幅默认 9:16）。 */
export const RECIPE_DEFAULTS = {
  aspect: "9:16",
  executionSource: "prompt",
} as const;

/**
 * 将创作草稿解析为完整 Recipe（version=1）。
 * @param draft - 创作草稿（未补默认）。
 * @param meta - 系统签发的 meta（id/projectId/lineage）。
 * @returns 通过完整 schema 校验的 Recipe；草稿或结果非法时抛 ZodError。
 */
export function resolveRecipe(
  draft: RecipeDraft,
  meta: Omit<RecipeMeta, "version">,
): Recipe {
  const parsed = recipeDraftSchema.parse(draft);
  return recipeSchema.parse({
    meta: { ...meta, version: 1 },
    scene: parsed.scene,
    shots: parsed.shots,
    ...(parsed.performanceAdvanced ? { performanceAdvanced: parsed.performanceAdvanced } : {}),
    camera: {
      ...parsed.camera,
      executionSource: parsed.camera.executionSource ?? RECIPE_DEFAULTS.executionSource,
    },
    constraints: {
      durationSec: parsed.constraints.durationSec,
      aspect: parsed.constraints.aspect ?? RECIPE_DEFAULTS.aspect,
      ...(parsed.constraints.referenceFrames
        ? { referenceFrames: parsed.constraints.referenceFrames }
        : {}),
    },
    binding: parsed.binding,
  });
}
