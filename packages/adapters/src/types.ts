/**
 * ModelAdapter 契约（能力接缝的 Service Definition 角色）。
 *
 * 三角色：本文件是 Definition；`mock.ts`/`seedance25.ts` 等是 Provider；
 * worker 与编辑器是 Consumer——Consumer 只 import 本文件的类型，
 * 永不 import 具体 Provider。
 *
 * 证据门禁（类型强制）：`verified` 级别的能力声明必须携带 `evidenceRef`
 * ——没有证据编号的"已验证"无法通过编译。
 */
import type { Recipe, AdapterId } from "@anselse/recipe";

/** 控制轴命名约定：`framing:<shotTypeId>` / `move:<cameraMoveId>` / 领域轴（如 `dialogue`）。 */
export type ControlAxis = string;

/** 单轴支持声明。verified 必须给证据引用（红线测试运行记录或已验证模板族标识）。 */
export type AxisSupport =
  | { level: "verified"; evidenceRef: string; honorRate?: number }
  | { level: "experimental"; evidenceRef?: string; honorRate?: number }
  | { level: "unsupported" };

export interface CapabilityMatrix {
  axes: Readonly<Record<ControlAxis, AxisSupport>>;
  durationRangeSec: readonly [number, number];
  aspects: readonly ("9:16" | "16:9" | "1:1")[];
}

/** 编译告警：可以渲，但该轴是设计级/降级兑现——UI 必须显式标注。 */
export interface AxisWarning {
  axis: ControlAxis;
  message: string;
}

/** 编译拒绝：不输出不可运行的请求，渲染费省在编译期。 */
export interface AxisRejection {
  axis: ControlAxis;
  message: string;
}

export type Resolved<Spec> =
  | { ok: true; spec: Spec; warnings: AxisWarning[] }
  | { ok: false; rejections: AxisRejection[] };

export interface RenderResult {
  videoUrl: string;
  providerJobId?: string;
  durationMs: number;
}

/**
 * 模型适配器 = 意图编译器 + 执行器。
 * `resolve` 必须是纯函数（同一 Recipe 永远编译出同一 Spec），
 * 这是无密钥快照测试的前提。
 */
export interface ModelAdapter<Spec = unknown> {
  readonly id: AdapterId;
  /** adapter 自身版本；进入 Take provenance。 */
  readonly version: string;
  capabilities(): CapabilityMatrix;
  resolve(recipe: Recipe): Resolved<Spec>;
  render(spec: Spec, signal: AbortSignal): Promise<RenderResult>;
}
