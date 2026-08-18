/**
 * Recipe patch：`recipe/patched` 事件的载荷格式与应用逻辑。
 * fork/remix 的谱系与 diff 可视化都建立在这套 op 之上。
 *
 * 规则：
 * - Recipe 版本不可变：apply 产出新对象（version+1），原版本不动。
 * - `meta` 不可被 patch（版本/谱系由系统写入）。
 * - 应用结果必须重新通过完整 schema 校验，非法即抛错（misconfiguration fails loud）。
 */
import { recipeSchema, type Recipe } from "./schema.ts";

/** 单个 patch 操作：set 覆盖（必要时逐层创建对象），unset 删除可选字段。 */
export type RecipePatchOp =
  | { op: "set"; path: (string | number)[]; value: unknown }
  | { op: "unset"; path: (string | number)[] };

/** apply 前的静态检查失败（路径非法）。 */
export class RecipePatchError extends Error {
  readonly patchOp: RecipePatchOp;
  constructor(message: string, patchOp: RecipePatchOp) {
    super(message);
    this.name = "RecipePatchError";
    this.patchOp = patchOp;
  }
}

function assertPathAllowed(op: RecipePatchOp): void {
  if (op.path.length === 0) {
    throw new RecipePatchError("empty patch path", op);
  }
  if (op.path[0] === "meta") {
    throw new RecipePatchError("meta is system-owned and cannot be patched", op);
  }
}

function applyOp(root: Record<string, unknown>, op: RecipePatchOp): void {
  const parents = op.path.slice(0, -1);
  const leaf = op.path[op.path.length - 1]!;
  let node: unknown = root;
  for (const seg of parents) {
    if (typeof node !== "object" || node === null) {
      throw new RecipePatchError(`path segment "${String(seg)}" is not addressable`, op);
    }
    const container = node as Record<string | number, unknown>;
    if (container[seg] === undefined && op.op === "set") {
      container[seg] = typeof op.path[op.path.indexOf(seg) + 1] === "number" ? [] : {};
    }
    node = container[seg];
  }
  if (typeof node !== "object" || node === null) {
    throw new RecipePatchError("patch target parent is not an object", op);
  }
  const target = node as Record<string | number, unknown>;
  if (op.op === "set") {
    target[leaf] = op.value;
  } else if (Array.isArray(target) && typeof leaf === "number") {
    target.splice(leaf, 1);
  } else {
    delete target[leaf];
  }
}

/**
 * 应用一组 patch，产出下一个版本的 Recipe。
 * @param base - 基础版本（不被修改）。
 * @param ops - patch 操作序列，按序应用。
 * @returns version = base.version + 1 的新 Recipe。
 * @throws RecipePatchError 路径非法；ZodError 应用结果不合法。
 */
export function applyRecipePatch(base: Recipe, ops: RecipePatchOp[]): Recipe {
  for (const op of ops) assertPathAllowed(op);
  const draft = structuredClone(base) as unknown as Record<string, unknown>;
  for (const op of ops) applyOp(draft, op);
  draft["meta"] = { ...base.meta, version: base.meta.version + 1 };
  return recipeSchema.parse(draft);
}
