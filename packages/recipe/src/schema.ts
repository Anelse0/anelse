/**
 * Direction Recipe schema v0（SCHEMA_VERSION = 0，预发布期不承诺兼容）。
 *
 * 结构决策（见 docs/05-dev-plan.md 决策记录）：
 * - Shot 是一等结构：`shots[].beats[]`，与已验证模板的"镜头 N"分块及编辑器
 *   shot-strip 交互同构（docs/06-editor-ux.md）。
 * - dialogue 内联于 Beat（一个事实一个家）。
 * - 运镜必须有动机：`mainMove` 非 static 时 `movementDriver` 必填。
 * - 深层戏剧学字段收进 `performanceAdvanced`（高级可选，普通用户不面对）。
 * - interaction 层延后（待红线测试证据）。
 */
import { z } from "zod";
import { SHOT_TYPES, CAMERA_MOVES, vocabIds } from "@anselse/vocab";
import { recipeIdSchema, projectIdSchema, adapterIdSchema, assetIdSchema } from "./ids.ts";

/** 结构版本。预发布期为 0：破坏性变更直接改结构并重置数据，不写迁移。 */
export const SCHEMA_VERSION = 0;

const shotTypeEnum = z.enum(vocabIds(SHOT_TYPES));
const cameraMoveEnum = z.enum(vocabIds(CAMERA_MOVES));

/** 一个 beat：一次可见、有限、有方向的表演变化。对白内联（可选）。 */
export const beatSchema = z.object({
  /** 状态标题（如"静立辨认"）；Kling 分段框架的段名来源。 */
  state: z.string().min(1),
  /**
   * 秒级时间窗 [start, end)（节奏参考，非帧级承诺）。Kling `【0–t｜状态】`
   * 分段框架的时间来源；缺省时由 adapter 显式均分。
   */
  window: z
    .tuple([z.number().nonnegative(), z.number().positive()])
    .refine(([start, end]) => end > start, { message: "window end must be after start" })
    .optional(),
  /** 可见动作，逐句描述；不允许空。 */
  action: z.string().min(1),
  /** 该 beat 承载的对白（一个 beat 至多一段）。 */
  dialogue: z
    .object({
      text: z.string().min(1),
      /** 说法说明（更轻/卡住/变哑），独立于台词文本。 */
      delivery: z.string().optional(),
    })
    .optional(),
  emotionNote: z.string().optional(),
});

/** 一个 shot（"镜头 N"）：编辑器 shot-strip 的单卡。 */
export const shotSchema = z.object({
  /** 本镜的目标景别（推进类运镜下逐镜收紧，如 MCU→CU）。 */
  framing: shotTypeEnum,
  /** 本镜时长（秒，整数）；缺省表示由模型分配节奏。 */
  durationSec: z.number().int().positive().optional(),
  beats: z.array(beatSchema).min(1),
});

/** 主体引用：角色锚点资产 + 文字描述（v0 资产层未建，assetId 可缺省）。 */
export const subjectRefSchema = z.object({
  assetId: assetIdSchema.optional(),
  description: z.string().min(1),
});

export const sceneSchema = z.object({
  /** 视觉风格契约。 */
  styleContract: z.string().min(1),
  /** 规定情境（发生了什么、此刻为何在此）。 */
  circumstances: z.string().min(1),
  subjects: z.array(subjectRefSchema).min(1),
  setting: z.string().min(1),
  lighting: z.string().min(1),
});

/** 摄影层（全局）：每条 Recipe 只有一个主要运动任务。 */
export const cameraSchema = z.object({
  /** 观看关系（观众坐在谁的位置上，如"对方视角越肩"）。 */
  viewerRelation: z.string().min(1),
  /** 主运镜；static 是正式设计结果。 */
  mainMove: cameraMoveEnum,
  /** 运镜动机；mainMove 非 static 时必填（schema 层强制）。 */
  movementDriver: z.string().min(1).optional(),
  startFrame: z.string().min(1),
  endFrame: z.string().min(1),
  executionSource: z.enum(["prompt", "ui_control", "start_end_frames", "motion_reference"]),
});

/** 高级可选：行动逻辑（Director 手填或将来由助手生成；普通用户不面对）。 */
export const performanceAdvancedSchema = z.object({
  target: z.string().optional(),
  want: z.string().optional(),
  tactic: z.string().optional(),
  turningTrigger: z.string().optional(),
  displayPolicy: z.enum(["reveal", "restrain", "deny", "redirect"]).optional(),
  intensity: z.enum(["L1", "L2", "L3"]).optional(),
});

export const constraintsSchema = z.object({
  durationSec: z.number().int().min(1).max(30),
  aspect: z.enum(["9:16", "16:9", "1:1"]),
  /** 参考帧资产（首/尾帧等），v0 仅引用。 */
  referenceFrames: z.array(assetIdSchema).optional(),
});

export const bindingSchema = z.object({
  targetAdapter: adapterIdSchema,
  /** 每 adapter 覆盖项；内容由各 adapter 自行校验，schema 层不透明。 */
  overrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export const lineageSchema = z.object({
  forkedFrom: z.object({
    recipeId: recipeIdSchema,
    version: z.number().int().positive(),
  }),
});

export const metaSchema = z.object({
  id: recipeIdSchema,
  projectId: projectIdSchema,
  /** 不可变版本号；patch 产生新版本（+1），由系统写入，不可被 patch。 */
  version: z.number().int().positive(),
  lineage: lineageSchema.optional(),
});

/** 完整 Recipe（含系统 meta）。跨层约束在此统一 refine。 */
export const recipeSchema = z
  .object({
    meta: metaSchema,
    scene: sceneSchema,
    shots: z.array(shotSchema).min(1),
    performanceAdvanced: performanceAdvancedSchema.optional(),
    camera: cameraSchema,
    constraints: constraintsSchema,
    binding: bindingSchema,
  })
  .superRefine((recipe, ctx) => {
    // 运镜必须有动机：非 static 的主运镜缺 movementDriver 即拒绝。
    if (recipe.camera.mainMove !== "static" && !recipe.camera.movementDriver) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["camera", "movementDriver"],
        message: `mainMove "${recipe.camera.mainMove}" requires a movementDriver (motivated camera movement only)`,
      });
    }
    // 各镜时长之和不得超过总时长。
    const declared = recipe.shots
      .map((s) => s.durationSec)
      .filter((d): d is number => d !== undefined);
    const sum = declared.reduce((a, b) => a + b, 0);
    if (sum > recipe.constraints.durationSec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shots"],
        message: `shot durations sum to ${sum}s, exceeding total duration ${recipe.constraints.durationSec}s`,
      });
    }
    // beat 时间窗：镜内起点非降序，终点不越过总时长。
    recipe.shots.forEach((shot, shotIdx) => {
      let prevStart = -1;
      shot.beats.forEach((beat, beatIdx) => {
        if (!beat.window) return;
        const [start, end] = beat.window;
        if (start < prevStart) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["shots", shotIdx, "beats", beatIdx, "window"],
            message: "beat windows must be in non-decreasing start order within a shot",
          });
        }
        if (end > recipe.constraints.durationSec) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["shots", shotIdx, "beats", beatIdx, "window"],
            message: `beat window end ${end}s exceeds total duration ${recipe.constraints.durationSec}s`,
          });
        }
        prevStart = start;
      });
    });
  });

export type Beat = z.infer<typeof beatSchema>;
export type Shot = z.infer<typeof shotSchema>;
export type SubjectRef = z.infer<typeof subjectRefSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Camera = z.infer<typeof cameraSchema>;
export type PerformanceAdvanced = z.infer<typeof performanceAdvancedSchema>;
export type Constraints = z.infer<typeof constraintsSchema>;
export type Binding = z.infer<typeof bindingSchema>;
export type RecipeMeta = z.infer<typeof metaSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
