/**
 * 内存队列驱动：轮询 MemoryRenderQueue 的 jobs 并逐个处理。
 * pg-boss Provider 接线后替换为其订阅回调；worker.processJob 复用不变。
 */
import type { MemoryRenderQueue } from "@anselse/platform";
import type { RenderWorker, ProcessOutcome } from "./worker.ts";

/**
 * 排空当前队列中的所有 job（测试与内存模式用）。
 * @returns 每个 job 的处理结果，按处理顺序。
 */
export async function drainQueue(
  queue: MemoryRenderQueue,
  worker: RenderWorker,
): Promise<ProcessOutcome[]> {
  const outcomes: ProcessOutcome[] = [];
  let job = queue.jobs.shift();
  while (job !== undefined) {
    outcomes.push(await worker.processJob(job));
    job = queue.jobs.shift();
  }
  return outcomes;
}
