/**
 * 投影：从事件日志纯折叠出读模型（借 dsh deriveMessages 的立场——
 * 日志是唯一真相源，一切读模型都是它的投影）。
 *
 * 折叠只关心 recipe/render 事件；其余事件类型按文档化 default 穿过
 * （merge-extensible 集合的落空策略，而非 assertNever——v1 集合虽封闭，
 * 但投影只拥有与它相关的事实）。
 */
import {
  applyRecipePatch,
  type Recipe,
  type RecipeId,
  type RecipePatchOp,
} from "@anselse/recipe";
import type { ProjectEvent } from "./envelope.ts";

export class ProjectionError extends Error {
  readonly seq: number;
  constructor(message: string, seq: number) {
    super(`${message} (at event seq ${seq})`);
    this.name = "ProjectionError";
    this.seq = seq;
  }
}

/** Recipe 全版本历史：recipeId → 按版本升序的不可变版本链。 */
export type RecipeVersions = ReadonlyMap<RecipeId, readonly Recipe[]>;

/**
 * 折叠出每个 Recipe 的版本链。
 * 校验（fails loud）：
 * - recipe/created 的 id 不得重复；
 * - recipe/patched 的 baseVersion 必须等于当前最新版本（乱序/丢事件即拒）。
 */
export function projectRecipeVersions(events: readonly ProjectEvent[]): RecipeVersions {
  const map = new Map<RecipeId, Recipe[]>();
  for (const event of events) {
    switch (event.type) {
      case "recipe/created": {
        const recipe = event.data.recipe;
        if (map.has(recipe.meta.id)) {
          throw new ProjectionError(
            `recipe/created for existing recipe "${recipe.meta.id}"`,
            event.seq,
          );
        }
        map.set(recipe.meta.id, [recipe]);
        break;
      }
      case "recipe/patched": {
        const chain = map.get(event.data.recipeId);
        const head = chain?.[chain.length - 1];
        if (!chain || !head) {
          throw new ProjectionError(
            `recipe/patched for unknown recipe "${event.data.recipeId}"`,
            event.seq,
          );
        }
        if (head.meta.version !== event.data.baseVersion) {
          throw new ProjectionError(
            `recipe/patched baseVersion ${event.data.baseVersion} does not match head version ${head.meta.version}`,
            event.seq,
          );
        }
        // zod 的 z.unknown() 将 value 推导为可选；在边界显式归一化为必需字段。
        const ops: RecipePatchOp[] = event.data.ops.map((op) =>
          op.op === "set"
            ? { op: "set", path: op.path, value: op.value }
            : { op: "unset", path: op.path },
        );
        chain.push(applyRecipePatch(head, ops));
        break;
      }
      default:
        // 与 Recipe 状态无关的事件（render/take/feedback/publish/...）合法穿过。
        break;
    }
  }
  return map;
}

/** 取某 Recipe 的指定版本；不存在返回 undefined（调用方决定失败策略）。 */
export function recipeAtVersion(
  versions: RecipeVersions,
  recipeId: RecipeId,
  version: number,
): Recipe | undefined {
  return versions.get(recipeId)?.find((r) => r.meta.version === version);
}

/** 重建出的渲染请求：与 worker 提交给 provider 的内容一一对应。 */
export interface ReconstructedRenderRequest {
  recipe: Recipe;
  adapterId: ProjectEvent<"render/requested">["data"]["adapterId"];
  adapterVersion: string;
  resolvedSpec: unknown;
}

/**
 * Provider-visible ⟺ Logged 的可执行不变式：
 * 任何到达 provider 的请求必须能仅凭日志重建。worker 提交前后各调用一次
 * 本函数即可断言（测试同样以此锁定）。
 * @throws ProjectionError seq 不是 render/requested，或引用的 Recipe 版本不在日志中。
 */
export function reconstructRenderRequest(
  events: readonly ProjectEvent[],
  requestSeq: number,
): ReconstructedRenderRequest {
  const event = events.find((e) => e.seq === requestSeq);
  if (!event || event.type !== "render/requested") {
    throw new ProjectionError(`seq ${requestSeq} is not a render/requested event`, requestSeq);
  }
  const upToRequest = events.filter((e) => e.seq <= requestSeq);
  const recipe = recipeAtVersion(
    projectRecipeVersions(upToRequest),
    event.data.recipeId,
    event.data.recipeVersion,
  );
  if (!recipe) {
    throw new ProjectionError(
      `render/requested references recipe "${event.data.recipeId}" v${event.data.recipeVersion} not derivable from the log`,
      requestSeq,
    );
  }
  return {
    recipe,
    adapterId: event.data.adapterId,
    adapterVersion: event.data.adapterVersion,
    resolvedSpec: event.data.resolvedSpec,
  };
}

/** Take 读模型：完全由 render/requested + render/completed + take/* 折叠而来。 */
export interface Take {
  id: ProjectEvent<"render/completed">["data"]["takeId"];
  /** provenance：任何视频永远能回放出它的配方版本与编译产物。 */
  provenance: {
    recipeId: RecipeId;
    recipeVersion: number;
    adapterId: ProjectEvent<"render/requested">["data"]["adapterId"];
    adapterVersion: string;
    resolvedSpec: unknown;
    requestEventSeq: number;
  };
  media: ProjectEvent<"render/completed">["data"]["media"];
  renderMs: number;
  costCents?: number;
  status: "unrated" | "selected" | "discarded";
}

/**
 * 折叠出项目内的全部 Take（read model）。
 * @throws ProjectionError render/completed 的 requestSeq 指向的不是 render/requested。
 */
export function projectTakes(events: readonly ProjectEvent[]): ReadonlyMap<Take["id"], Take> {
  const requests = new Map<number, ProjectEvent<"render/requested">>();
  const takes = new Map<Take["id"], Take>();
  const takeSeqById = new Map<Take["id"], number>();

  for (const event of events) {
    switch (event.type) {
      case "render/requested":
        requests.set(event.seq, event);
        break;
      case "render/completed": {
        const request = requests.get(event.data.requestSeq);
        if (!request) {
          throw new ProjectionError(
            `render/completed requestSeq ${event.data.requestSeq} does not point at a render/requested`,
            event.seq,
          );
        }
        takes.set(event.data.takeId, {
          id: event.data.takeId,
          provenance: {
            recipeId: request.data.recipeId,
            recipeVersion: request.data.recipeVersion,
            adapterId: request.data.adapterId,
            adapterVersion: request.data.adapterVersion,
            resolvedSpec: request.data.resolvedSpec,
            requestEventSeq: request.seq,
          },
          media: event.data.media,
          renderMs: event.data.durationMs,
          ...(event.data.costCents !== undefined ? { costCents: event.data.costCents } : {}),
          status: "unrated",
        });
        takeSeqById.set(event.data.takeId, event.seq);
        break;
      }
      case "take/selected":
      case "take/discarded": {
        const take = takes.get(event.data.takeId);
        // 未知/未完成的 take 状态事件安全忽略（读模型只反映已存在的 take）
        if (take) take.status = event.type === "take/selected" ? "selected" : "discarded";
        break;
      }
      default:
        break;
    }
  }
  return takes;
}
