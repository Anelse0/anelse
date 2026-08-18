/**
 * RenderQueue 接缝：Service Definition + 内存 Provider（pg-boss Provider 随 M5 接入）。
 * job 载荷只带 (projectId, requestSeq)——worker 从日志重建请求，不信任队列载荷
 * （真相源只有日志）。
 */
import type { ProjectId } from "@anselse/recipe";

export interface RenderJob {
  projectId: ProjectId;
  requestSeq: number;
}

export interface RenderQueue {
  enqueue(job: RenderJob): Promise<void>;
}

/** 内存 Provider：入队即存列表；worker 测试直接消费 `jobs`。 */
export class MemoryRenderQueue implements RenderQueue {
  readonly jobs: RenderJob[] = [];

  enqueue(job: RenderJob): Promise<void> {
    this.jobs.push(job);
    return Promise.resolve();
  }
}
