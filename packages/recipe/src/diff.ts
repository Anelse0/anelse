/**
 * Recipe diff：产出从 a 到 b 的 patch 操作序列（remix diff 可视化与谱系展示的数据源）。
 *
 * 策略（v0）：对象逐键递归；数组整体替换（beats/shots 的逐项 diff 交给 UI 层
 * 按需展开，数据层保持简单可靠）。meta 永不参与 diff。
 * 不变式：applyRecipePatch(a, diffRecipes(a, b)) 与 b 除 meta 外结构相等。
 */
import type { Recipe } from "./schema.ts";
import type { RecipePatchOp } from "./patch.ts";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffValue(
  path: (string | number)[],
  a: unknown,
  b: unknown,
  out: RecipePatchOp[],
): void {
  if (jsonEqual(a, b)) return;
  if (b === undefined) {
    out.push({ op: "unset", path });
    return;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      diffValue([...path, key], a[key], b[key], out);
    }
    return;
  }
  // 数组或标量：整体替换。
  out.push({ op: "set", path, value: b });
}

/**
 * 计算 a → b 的 patch 序列（不含 meta）。
 * @returns 按路径深度优先顺序的最小 set/unset 操作。
 */
export function diffRecipes(a: Recipe, b: Recipe): RecipePatchOp[] {
  const out: RecipePatchOp[] = [];
  const { meta: _ma, ...bodyA } = a;
  const { meta: _mb, ...bodyB } = b;
  diffValue([], bodyA as unknown, bodyB as unknown, out);
  return out;
}
