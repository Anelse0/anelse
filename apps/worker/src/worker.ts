/**
 * RenderWorker：消费 render/requested job → 从日志重建请求 → adapter.render
 * → 媒体落库 → 追加 render/completed（+ Take 可投影）或 render/failed。
 *
 * 可靠性立场（借 dsh defensive patterns）：
 * - **不信任队列载荷**：job 只有 (projectId, requestSeq)，请求内容一律从日志重建。
 * - **幂等**：处理前扫描日志，若该 requestSeq 已有 completed/failed 则跳过——
 *   崩溃重启、重复投递安全（at-least-once 队列的必然前提）。
 * - 编译已在请求时完成并入日志（resolvedSpec）；worker 不重编译，直接执行 spec。
 */
import {
  reconstructRenderRequest,
  nextEvent,
  type ProjectEvent,
  type ActorId,
  type TakeId,
  type RenderFailureKind,
} from "@anselse/events";
import type { AdapterRegistry } from "@anselse/adapters";
import type {
  EventStore,
  MediaStore,
  RenderJob,
  IdGenerator,
  Clock,
} from "@anselse/platform";

/** worker 以系统身份 append 完成/失败事件。 */
const WORKER_ACTOR = "system:worker" as ActorId;

export interface RenderWorkerDeps {
  store: EventStore;
  adapters: AdapterRegistry;
  mediaStore: MediaStore;
  ids: IdGenerator;
  clock: Clock;
}

export type ProcessOutcome =
  | { status: "completed"; takeId: TakeId }
  | { status: "failed"; kind: RenderFailureKind; detail: string }
  | { status: "skipped-already-settled" };

export class RenderWorker {
  private readonly deps: RenderWorkerDeps;
  constructor(deps: RenderWorkerDeps) {
    this.deps = deps;
  }

  private async appendSettled(
    projectId: RenderJob["projectId"],
    make: (events: readonly ProjectEvent[]) => ProjectEvent,
  ): Promise<void> {
    const events = await this.deps.store.read(projectId);
    await this.deps.store.append(projectId, make(events));
  }

  /** 处理一个渲染 job（幂等）。 */
  async processJob(job: RenderJob, signal?: AbortSignal): Promise<ProcessOutcome> {
    const events = await this.deps.store.read(job.projectId);

    // 幂等：该请求是否已 settle（completed 或 failed）
    const settled = events.some(
      (e) =>
        (e.type === "render/completed" || e.type === "render/failed") &&
        e.data.requestSeq === job.requestSeq,
    );
    if (settled) return { status: "skipped-already-settled" };

    // 从日志重建请求（不信任队列载荷）
    const request = reconstructRenderRequest(events, job.requestSeq);
    const adapter = this.deps.adapters.get(request.adapterId);
    if (!adapter) {
      return this.fail(job, "provider_error", `adapter "${request.adapterId}" not registered`);
    }

    const takeId = this.deps.ids.newId("t") as TakeId;
    try {
      const result = await adapter.render(request.resolvedSpec, signal ?? new AbortController().signal);
      const media = await this.deps.mediaStore.persist({
        projectId: job.projectId,
        takeId,
        sourceUrl: result.videoUrl,
      });
      await this.appendSettled(job.projectId, (evs) =>
        nextEvent(evs, {
          type: "render/completed",
          data: {
            requestSeq: job.requestSeq,
            takeId,
            media: {
              videoUrl: media.videoUrl,
              ...(media.thumbUrl ? { thumbUrl: media.thumbUrl } : {}),
              durationSec: request.recipe.constraints.durationSec,
            },
            ...(result.providerJobId ? { providerJobId: result.providerJobId } : {}),
            durationMs: result.durationMs,
          },
          actorId: WORKER_ACTOR,
          time: this.deps.clock.now(),
        }),
      );
      return { status: "completed", takeId };
    } catch (error) {
      const kind: RenderFailureKind = signal?.aborted ? "timeout" : "provider_error";
      return this.fail(job, kind, error instanceof Error ? error.message : String(error));
    }
  }

  private async fail(
    job: RenderJob,
    kind: RenderFailureKind,
    detail: string,
  ): Promise<ProcessOutcome> {
    await this.appendSettled(job.projectId, (evs) =>
      nextEvent(evs, {
        type: "render/failed",
        data: { requestSeq: job.requestSeq, kind, detail },
        actorId: WORKER_ACTOR,
        time: this.deps.clock.now(),
      }),
    );
    return { status: "failed", kind, detail };
  }
}
