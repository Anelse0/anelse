/**
 * 客户端编译：把编辑器草稿实时编译成目标模型 prompt（纯函数，浏览器内运行）。
 * 这是产品核心「所见即编译所得」的落地——无需后端。
 */
import {
  resolveRecipe,
  type RecipeDraft,
  type RecipeId,
  type ProjectId,
} from "@anselse/recipe";
import {
  MockAdapter,
  Seedance25Adapter,
  Kling3Adapter,
  compileSeedancePrompt,
  compileKlingPrompt,
  type ModelAdapter,
  type CapabilityMatrix,
  type Resolved,
} from "@anselse/adapters";

export type AdapterId = "seedance-2.5" | "kling-v3" | "mock";

const ADAPTERS: Record<AdapterId, ModelAdapter> = {
  "seedance-2.5": new Seedance25Adapter(),
  "kling-v3": new Kling3Adapter(),
  mock: new MockAdapter(),
};

export const ADAPTER_LABELS: Record<AdapterId, string> = {
  "seedance-2.5": "Seedance 2.5",
  "kling-v3": "Kling 3.0",
  mock: "Mock（测试）",
};

const PREVIEW_META = { id: "r_preview" as RecipeId, projectId: "p_preview" as ProjectId };

export interface CompileOutput {
  /** 编译文本（成功时）。 */
  prompt?: string;
  resolved?: Resolved<unknown>;
  /** schema 校验错误（草稿本身非法，如运镜缺动机）。 */
  schemaError?: string;
}

export function capabilitiesOf(adapterId: AdapterId): CapabilityMatrix {
  return ADAPTERS[adapterId].capabilities();
}

/** 把草稿绑定到目标 adapter → resolveRecipe → adapter.resolve → 取可读 prompt。 */
export function compileDraft(draft: RecipeDraft, adapterId: AdapterId): CompileOutput {
  const bound: RecipeDraft = {
    ...draft,
    binding: { ...draft.binding, targetAdapter: adapterId as RecipeDraft["binding"]["targetAdapter"] },
  };
  let recipe;
  try {
    recipe = resolveRecipe(bound, PREVIEW_META);
  } catch (error) {
    return { schemaError: error instanceof Error ? error.message : String(error) };
  }
  const resolved = ADAPTERS[adapterId].resolve(recipe);
  if (!resolved.ok) return { resolved };
  // 取每个 adapter 的可读 prompt 文本
  const prompt =
    adapterId === "kling-v3"
      ? compileKlingPrompt(recipe)
      : adapterId === "seedance-2.5"
        ? compileSeedancePrompt(recipe)
        : JSON.stringify(resolved.spec, null, 2);
  return { prompt, resolved };
}
