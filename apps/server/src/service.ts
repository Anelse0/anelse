/**
 * 应用服务层：写路径全部走事件 append，读路径全部走投影。
 * 依赖显式注入（store/queue/adapters/ids/clock），纯逻辑可测。
 *
 * v0 范围决策：编译拒绝不落日志（没有任何内容到达 provider，返回结构化结果
 * 由 UI 即时展示）；只有编译成功才 append `render/requested`。若将来需要
 * "尝试分析"再补 durable 事件（决策记录于 PROGRESS）。
 */
import {
  resolveRecipe,
  applyRecipePatch,
  recipeSchema,
  type Recipe,
  type RecipeDraft,
  type RecipeId,
  type ProjectId,
  type AdapterId,
  type RecipePatchOp,
} from "@anselse/recipe";
import {
  nextEvent,
  projectRecipeVersions,
  recipeAtVersion,
  type ActorId,
  type EventType,
  type EventPayloadMap,
  type ProjectEvent,
  type RecipeVersions,
} from "@anselse/events";
import type { AdapterRegistry, AxisRejection, AxisWarning } from "@anselse/adapters";
import type { EventStore } from "./store.ts";
import type { RenderQueue } from "./queue.ts";

export interface IdGenerator {
  /** 生成带前缀的全局唯一 id（如 `p_…`/`r_…`）。 */
  newId(prefix: string): string;
}

export interface Clock {
  now(): number;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

/** baseVersion 过期（他人已改）：调用方取最新版本后重试。 */
export class VersionConflictError extends Error {
  readonly expected: number;
  readonly actual: number;
  constructor(expected: number, actual: number) {
    super(`recipe head is v${actual}, not v${expected}: refresh and retry`);
    this.name = "VersionConflictError";
    this.expected = expected;
    this.actual = actual;
  }
}

export type RenderRequestResult =
  | { ok: true; requestSeq: number; warnings: AxisWarning[] }
  | { ok: false; rejections: AxisRejection[] };

export interface ServiceDeps {
  store: EventStore;
  queue: RenderQueue;
  adapters: AdapterRegistry;
  ids: IdGenerator;
  clock: Clock;
}

export class AnselseService {
  private readonly deps: ServiceDeps;
  constructor(deps: ServiceDeps) {
    this.deps = deps;
  }

  private async append<T extends EventType>(
    projectId: ProjectId,
    actorId: ActorId,
    type: T,
    data: EventPayloadMap[T],
  ): Promise<ProjectEvent<T>> {
    const events = await this.deps.store.read(projectId);
    const event = nextEvent(events, { type, data, actorId, time: this.deps.clock.now() });
    await this.deps.store.append(projectId, event);
    return event;
  }

  async createProject(actorId: ActorId, title: string): Promise<{ projectId: ProjectId }> {
    const projectId = this.deps.ids.newId("p") as ProjectId;
    await this.append(projectId, actorId, "project/created", { title });
    return { projectId };
  }

  async createRecipe(
    actorId: ActorId,
    projectId: ProjectId,
    draft: RecipeDraft,
  ): Promise<Recipe> {
    const recipe = resolveRecipe(draft, {
      id: this.deps.ids.newId("r") as RecipeId,
      projectId,
    });
    await this.append(projectId, actorId, "recipe/created", { recipe });
    return recipe;
  }

  async patchRecipe(
    actorId: ActorId,
    projectId: ProjectId,
    recipeId: RecipeId,
    baseVersion: number,
    ops: RecipePatchOp[],
  ): Promise<Recipe> {
    const head = await this.recipeHead(projectId, recipeId);
    if (head.meta.version !== baseVersion) {
      throw new VersionConflictError(baseVersion, head.meta.version);
    }
    const patched = applyRecipePatch(head, ops); // 先验证（非法 patch 不进日志）
    await this.append(projectId, actorId, "recipe/patched", { recipeId, baseVersion, ops });
    return patched;
  }

  /** fork：目标项目获得 version=1 的新 Recipe（lineage 指向源）+ 一条谱系边事件。 */
  async forkRecipe(
    actorId: ActorId,
    source: { projectId: ProjectId; recipeId: RecipeId; version: number },
    targetProjectId: ProjectId,
  ): Promise<Recipe> {
    const sourceEvents = await this.deps.store.read(source.projectId);
    const sourceRecipe = recipeAtVersion(
      projectRecipeVersions(sourceEvents),
      source.recipeId,
      source.version,
    );
    if (!sourceRecipe) throw new NotFoundError(`recipe ${source.recipeId} v${source.version}`);

    const { meta: _sourceMeta, ...body } = sourceRecipe;
    const forked = recipeSchema.parse({
      meta: {
        id: this.deps.ids.newId("r") as RecipeId,
        projectId: targetProjectId,
        version: 1,
        lineage: { forkedFrom: { recipeId: source.recipeId, version: source.version } },
      },
      ...body,
    });
    await this.append(targetProjectId, actorId, "recipe/created", { recipe: forked });
    await this.append(targetProjectId, actorId, "recipe/forked", {
      sourceProjectId: source.projectId,
      sourceRecipeId: source.recipeId,
      sourceVersion: source.version,
      newRecipeId: forked.meta.id,
    });
    return forked;
  }

  /** 编译 + 入队。编译拒绝即时返回（不落日志，见文件头决策）。 */
  async requestRender(
    actorId: ActorId,
    projectId: ProjectId,
    recipeId: RecipeId,
    recipeVersion: number,
    adapterId: AdapterId,
  ): Promise<RenderRequestResult> {
    const events = await this.deps.store.read(projectId);
    const recipe = recipeAtVersion(projectRecipeVersions(events), recipeId, recipeVersion);
    if (!recipe) throw new NotFoundError(`recipe ${recipeId} v${recipeVersion}`);
    const adapter = this.deps.adapters.get(adapterId);
    if (!adapter) throw new NotFoundError(`adapter ${adapterId}`);

    const resolved = adapter.resolve(recipe);
    if (!resolved.ok) return { ok: false, rejections: resolved.rejections };

    const event = await this.append(projectId, actorId, "render/requested", {
      recipeId,
      recipeVersion,
      adapterId,
      resolvedSpec: resolved.spec,
    });
    await this.deps.queue.enqueue({ projectId, requestSeq: event.seq });
    return { ok: true, requestSeq: event.seq, warnings: resolved.warnings };
  }

  async rateTakeAxis(
    actorId: ActorId,
    projectId: ProjectId,
    data: EventPayloadMap["feedback/axis-rated"],
  ): Promise<void> {
    await this.append(projectId, actorId, "feedback/axis-rated", data);
  }

  async setTakeStatus(
    actorId: ActorId,
    projectId: ProjectId,
    takeId: EventPayloadMap["take/selected"]["takeId"],
    status: "selected" | "discarded",
  ): Promise<void> {
    await this.append(projectId, actorId, `take/${status}`, { takeId });
  }

  async listRecipes(projectId: ProjectId): Promise<RecipeVersions> {
    return projectRecipeVersions(await this.deps.store.read(projectId));
  }

  private async recipeHead(projectId: ProjectId, recipeId: RecipeId): Promise<Recipe> {
    const versions = await this.listRecipes(projectId);
    const chain = versions.get(recipeId);
    const head = chain?.[chain.length - 1];
    if (!head) throw new NotFoundError(`recipe ${recipeId}`);
    return head;
  }
}
