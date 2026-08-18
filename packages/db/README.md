# @anselse/db

Drizzle 表结构（Supabase Postgres）。

## 表

| 表 | 角色 | 关键约束 |
|---|---|---|
| `events` | **唯一真相源**，append-only | `(project_id, seq)` 唯一（背书 seq 单调）；应用层永不 UPDATE/DELETE |
| `projects` | 项目元信息 | |
| `takes` | 读模型：渲染产物 + provenance 冗余 | 真相仍在日志；provenance 支撑"视频→配方"回放查询 |

## 边界规则

- 事件写入走 `@anselse/events` 的 `nextEvent`（类型校验 + JSON 可序列化检查）后落库。
- 事件读出**必须**过 `parseEvent` / `parseEventLog`（durable 边界必校验；未知必需事件拒绝重建）。

## 集成状态（pending）

- [ ] Supabase 项目开通 → 连接串入 server/worker 环境变量
- [ ] drizzle-kit 迁移脚本 + `events` 表的 UPDATE/DELETE 权限收回（RLS/grant 层面强制 append-only）
- [ ] pg-boss 初始化（独立 schema，跑在同一实例）
- [ ] 集成测试（真连接，无连接串自跳过——借 dsh e2e 自跳过机制）
