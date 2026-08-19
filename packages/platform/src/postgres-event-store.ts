/**
 * PostgresEventStore：EventStore 接缝的 Supabase Provider。
 * 用 postgres.js 原生参数化 SQL（事件存储只有两条 trivial 查询，避开 drizzle
 * 类型构建器与 exactOptionalPropertyTypes 的摩擦）。drizzle schema 仍是建表来源。
 *
 * read 出的行一律过 parseEventLog（durable 边界必校验）；
 * append 命中 (project_id, seq) 唯一约束（Postgres 23505）→ StoreConflictError。
 */
import type { Sql } from "postgres";
import { parseEventLog, type ProjectEvent } from "@anselse/events";
import type { ProjectId } from "@anselse/recipe";
import { StoreConflictError } from "./event-store.ts";
import type { EventStore } from "./event-store.ts";

interface EventRow {
  type: string;
  seq: string; // int8 由 postgres.js 以字符串返回
  time: string;
  actor_id: string;
  data: unknown;
  ignorable: boolean | null;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

export class PostgresEventStore implements EventStore {
  private readonly sql: Sql;
  constructor(sql: Sql) {
    this.sql = sql;
  }

  async read(projectId: ProjectId): Promise<ProjectEvent[]> {
    const rows = await this.sql<EventRow[]>`
      select type, seq, time, actor_id, data, ignorable
      from events
      where project_id = ${projectId}
      order by seq asc
    `;
    // seq/time 为 bigint（epoch ms < 2^53，Number 安全）；durable 边界统一 parse。
    return parseEventLog(
      rows.map((r) => ({
        type: r.type,
        seq: Number(r.seq),
        time: Number(r.time),
        actorId: r.actor_id,
        data: r.data,
        ...(r.ignorable ? { ignorable: true as const } : {}),
      })),
    );
  }

  async append(projectId: ProjectId, event: ProjectEvent): Promise<void> {
    try {
      await this.sql`
        insert into events (project_id, seq, type, time, actor_id, data, ignorable)
        values (
          ${projectId}, ${event.seq}, ${event.type}, ${event.time},
          ${event.actorId}, ${this.sql.json(event.data as never)}, ${event.ignorable ?? null}
        )
      `;
    } catch (error) {
      if (isUniqueViolation(error)) throw new StoreConflictError(projectId, event.seq);
      throw error;
    }
  }
}
