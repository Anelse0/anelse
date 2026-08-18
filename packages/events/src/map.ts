/**
 * v1 事件类型注册表：类型与运行时 schema 同源（一个事实一个家）。
 *
 * `EVENT_SCHEMAS` 是唯一权威：`EventType` / `EventPayloadMap` 均由它派生，
 * 新增事件 = 在此加一行 schema。v1 是封闭集合；将来若需要插件扩展事件，
 * 再引入 dsh 式 declaration merging，不提前抽象。
 */
import { z } from "zod";
import {
  recipeSchema,
  recipeIdSchema,
  adapterIdSchema,
  assetIdSchema,
} from "@anselse/recipe";
import { takeIdSchema } from "./ids.ts";

const patchOpSchema = z.union([
  z.object({
    op: z.literal("set"),
    path: z.array(z.union([z.string(), z.number().int()])).min(1),
    value: z.unknown(),
  }),
  z.object({
    op: z.literal("unset"),
    path: z.array(z.union([z.string(), z.number().int()])).min(1),
  }),
]);

/** 渲染失败的结构化分类（UI 按类给出不同的用户动作）。 */
export const renderFailureKindSchema = z.enum([
  "compile_rejected",
  "provider_error",
  "timeout",
  "content_policy",
]);

export const EVENT_SCHEMAS = {
  /** 项目建立。 */
  "project/created": z.object({ title: z.string().min(1) }),

  /** 连续性锚点资产登记（角色/风格/参考帧）。mediaRef 为对象存储指针。 */
  "asset/registered": z.object({
    assetId: assetIdSchema,
    kind: z.enum(["character", "style", "frame"]),
    description: z.string().min(1),
    mediaRef: z.string().min(1).optional(),
  }),

  /** 完整初始 Recipe（version=1；fork 产生的也走这里，lineage 在 meta 内）。 */
  "recipe/created": z.object({ recipe: recipeSchema }),

  /** patch 而非全量：基于 baseVersion 应用 ops 产生 baseVersion+1。 */
  "recipe/patched": z.object({
    recipeId: recipeIdSchema,
    baseVersion: z.number().int().positive(),
    ops: z.array(patchOpSchema).min(1),
  }),

  /** 谱系边（社区 remix 图的数据源）；新 Recipe 本体走 recipe/created。 */
  "recipe/forked": z.object({
    sourceProjectId: z.string().min(1),
    sourceRecipeId: recipeIdSchema,
    sourceVersion: z.number().int().positive(),
    newRecipeId: recipeIdSchema,
  }),

  /**
   * 渲染请求。resolvedSpec 是 adapter 编译产物（此处不透明，adapter 自校验）。
   * Provider-visible ⟺ Logged：到达 provider 的请求必须能从本事件重建
   * （可执行不变式见 projection.ts 的 reconstructRenderRequest）。
   */
  "render/requested": z.object({
    recipeId: recipeIdSchema,
    recipeVersion: z.number().int().positive(),
    adapterId: adapterIdSchema,
    resolvedSpec: z.unknown(),
  }),

  /** requestSeq 指回对应的 render/requested 事件。 */
  "render/completed": z.object({
    requestSeq: z.number().int().nonnegative(),
    takeId: takeIdSchema,
    providerJobId: z.string().optional(),
    durationMs: z.number().int().nonnegative(),
    costCents: z.number().int().nonnegative().optional(),
  }),

  "render/failed": z.object({
    requestSeq: z.number().int().nonnegative(),
    kind: renderFailureKindSchema,
    detail: z.string(),
  }),

  "take/selected": z.object({ takeId: takeIdSchema }),
  "take/discarded": z.object({ takeId: takeIdSchema }),

  /** 逐轴兑现度反馈——交付性数据集的采集入口。 */
  "feedback/axis-rated": z.object({
    takeId: takeIdSchema,
    axis: z.string().min(1),
    verdict: z.enum(["honored", "partial", "ignored"]),
  }),

  /** 发布 = 引用（take + recipe 版本），不复制内容。 */
  "publish/created": z.object({
    takeId: takeIdSchema,
    recipeId: recipeIdSchema,
    recipeVersion: z.number().int().positive(),
  }),
} as const;

export type EventType = keyof typeof EVENT_SCHEMAS;

export type EventPayloadMap = {
  [K in EventType]: z.infer<(typeof EVENT_SCHEMAS)[K]>;
};

export const EVENT_TYPES = Object.keys(EVENT_SCHEMAS) as EventType[];

export type RenderFailureKind = z.infer<typeof renderFailureKindSchema>;
