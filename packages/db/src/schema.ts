/**
 * Drizzle 表结构（Supabase Postgres）。
 *
 * 原则：
 * - `events` 是唯一真相源，append-only：应用层永不 UPDATE/DELETE；
 *   `(project_id, seq)` 唯一约束背书 seq 单调性（并发写冲突即失败重试）。
 * - `takes` 是读模型（从事件派生），provenance 字段冗余存储以支撑
 *   "任何视频永远能回放出它的配方"的查询路径；真相仍在日志。
 * - 事件载荷 jsonb 存储；读出必须过 @anselse/events 的 parseEvent
 *   （durable 边界必校验）。
 */
import {
  pgTable,
  text,
  bigint,
  jsonb,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  "events",
  {
    projectId: text("project_id").notNull(),
    seq: bigint("seq", { mode: "number" }).notNull(),
    type: text("type").notNull(),
    /** Unix epoch 毫秒（与信封一致，避免时区歧义）。 */
    time: bigint("time", { mode: "number" }).notNull(),
    actorId: text("actor_id").notNull(),
    data: jsonb("data").notNull(),
    ignorable: boolean("ignorable"),
  },
  (t) => [
    uniqueIndex("events_project_seq_unique").on(t.projectId, t.seq),
    index("events_project_type_idx").on(t.projectId, t.type),
  ],
);

export const takes = pgTable(
  "takes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    /** provenance：产生本 take 的配方版本与编译产物（冗余读模型；真相在日志）。 */
    recipeId: text("recipe_id").notNull(),
    recipeVersion: bigint("recipe_version", { mode: "number" }).notNull(),
    adapterId: text("adapter_id").notNull(),
    adapterVersion: text("adapter_version").notNull(),
    resolvedSpec: jsonb("resolved_spec").notNull(),
    requestEventSeq: bigint("request_event_seq", { mode: "number" }).notNull(),
    videoUrl: text("video_url").notNull(),
    thumbUrl: text("thumb_url"),
    durationSec: bigint("duration_sec", { mode: "number" }).notNull(),
    status: text("status", { enum: ["unrated", "selected", "discarded"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("takes_project_idx").on(t.projectId)],
);
