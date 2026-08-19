-- Anselse 初始表结构（对齐 packages/db/src/schema.ts）。幂等。
-- events 是 append-only 唯一真相源；(project_id, seq) 唯一背书 seq 单调。

CREATE TABLE IF NOT EXISTS projects (
  id          text PRIMARY KEY,
  owner_id    text NOT NULL,
  title       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  project_id  text   NOT NULL,
  seq         bigint NOT NULL,
  type        text   NOT NULL,
  time        bigint NOT NULL,
  actor_id    text   NOT NULL,
  data        jsonb  NOT NULL,
  ignorable   boolean
);
CREATE UNIQUE INDEX IF NOT EXISTS events_project_seq_unique ON events (project_id, seq);
CREATE INDEX IF NOT EXISTS events_project_type_idx ON events (project_id, type);

CREATE TABLE IF NOT EXISTS takes (
  id                text PRIMARY KEY,
  project_id        text   NOT NULL,
  recipe_id         text   NOT NULL,
  recipe_version    bigint NOT NULL,
  adapter_id        text   NOT NULL,
  adapter_version   text   NOT NULL,
  resolved_spec     jsonb  NOT NULL,
  request_event_seq bigint NOT NULL,
  video_url         text   NOT NULL,
  thumb_url         text,
  duration_sec      bigint NOT NULL,
  status            text   NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS takes_project_idx ON takes (project_id);

-- append-only 硬约束：收回 events 的 UPDATE/DELETE（应用永不改历史）。
-- 注：由 postgres 超级用户执行；Supabase 的 postgres 角色可运行。
REVOKE UPDATE, DELETE ON events FROM PUBLIC;
