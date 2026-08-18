/**
 * 共享的编译期能力检查：所有 Provider 的 resolve() 第一步。
 * 规则：binding 不匹配 / 时长越界 / 画幅不支持 / 轴 unsupported → 拒绝；
 * 轴 experimental → 告警（可渲但 UI 标注）。
 */
import type { Recipe, AdapterId } from "@anselse/recipe";
import type { AxisRejection, AxisWarning, CapabilityMatrix, ControlAxis } from "./types.ts";

export interface CapabilityCheck {
  rejections: AxisRejection[];
  warnings: AxisWarning[];
}

function checkAxis(
  caps: CapabilityMatrix,
  axis: ControlAxis,
  out: CapabilityCheck,
): void {
  const support = caps.axes[axis];
  if (!support || support.level === "unsupported") {
    out.rejections.push({ axis, message: `axis "${axis}" is not supported by this adapter` });
    return;
  }
  if (support.level === "experimental") {
    out.warnings.push({
      axis,
      message: `axis "${axis}" is experimental (design-level, not verified by footage)`,
    });
  }
}

/**
 * 对照能力矩阵检查一份 Recipe。
 * @param adapterId - 执行检查的 adapter 自身 id（binding 守卫）。
 */
export function checkRecipeAgainstCapabilities(
  recipe: Recipe,
  adapterId: AdapterId,
  caps: CapabilityMatrix,
): CapabilityCheck {
  const out: CapabilityCheck = { rejections: [], warnings: [] };

  if (recipe.binding.targetAdapter !== adapterId) {
    out.rejections.push({
      axis: "binding",
      message: `recipe targets adapter "${recipe.binding.targetAdapter}", not "${adapterId}"`,
    });
    return out; // 目标不对，后续检查无意义
  }

  const [minSec, maxSec] = caps.durationRangeSec;
  if (recipe.constraints.durationSec < minSec || recipe.constraints.durationSec > maxSec) {
    out.rejections.push({
      axis: "duration",
      message: `duration ${recipe.constraints.durationSec}s outside adapter range [${minSec}, ${maxSec}]s`,
    });
  }

  if (!caps.aspects.includes(recipe.constraints.aspect)) {
    out.rejections.push({
      axis: "aspect",
      message: `aspect ${recipe.constraints.aspect} not supported`,
    });
  }

  for (const framing of new Set(recipe.shots.map((s) => s.framing))) {
    checkAxis(caps, `framing:${framing}`, out);
  }
  checkAxis(caps, `move:${recipe.camera.mainMove}`, out);

  return out;
}
