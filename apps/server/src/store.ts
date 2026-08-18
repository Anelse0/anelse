/**
 * EventStore 接缝：Service Definition + 内存 Provider。
 * Postgres Provider（Drizzle/Supabase）在连接串就绪后加入——Consumer（service 层）
 * 只依赖本接口，换 Provider 不改一行业务代码。
 */
import type { ProjectEvent } from "@anselse/events";
import type { ProjectId } from "@anselse/recipe";

/** 并发追加冲突（对应 Postgres 的 (project_id, seq) 唯一约束违反）。调用方重读重试。 */
export class StoreConflictError extends Error {
  readonly projectId: string;
  readonly seq: number;
  constructor(projectId: string, seq: number) {
    super(`event seq ${seq} already exists for project "${projectId}" (concurrent append)`);
    this.name = "StoreConflictError";
    this.projectId = projectId;
    this.seq = seq;
  }
}

export interface EventStore {
  /** 按 seq 升序读出整段日志（durable 边界的 parse 由 Provider 负责）。 */
  read(projectId: ProjectId): Promise<ProjectEvent[]>;
  /** 追加一条事件；seq 与现有日志不连续视为并发冲突。 */
  append(projectId: ProjectId, event: ProjectEvent): Promise<void>;
}

/** 内存 Provider：开发与测试用；语义与 Postgres 版一致（含冲突行为）。 */
export class MemoryEventStore implements EventStore {
  private readonly logs = new Map<string, ProjectEvent[]>();

  read(projectId: ProjectId): Promise<ProjectEvent[]> {
    return Promise.resolve([...(this.logs.get(projectId) ?? [])]);
  }

  append(projectId: ProjectId, event: ProjectEvent): Promise<void> {
    const log = this.logs.get(projectId) ?? [];
    if (event.seq !== log.length) {
      return Promise.reject(new StoreConflictError(projectId, event.seq));
    }
    log.push(event);
    this.logs.set(projectId, log);
    return Promise.resolve();
  }
}
