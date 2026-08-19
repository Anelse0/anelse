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

## 连接与迁移

连接参数从 `.env` 的 `PG*` 变量读取（离散参数，规避密码特殊字符编码）。`createDb()` 缺变量即 fail loud；`hasDbEnv()` 供集成测试自跳过判断。

```bash
pnpm migrate            # 建表（幂等，migrations/*.sql）
pnpm test:integration   # 真实 DB 往返测试；无 PG* 或不可达时自跳过
```

`PostgresEventStore`（在 `@anselse/platform`）用 postgres.js 原生 SQL 读写 `events`，read 出的行过 `parseEventLog`（durable 边界校验），append 命中唯一约束（23505）→ `StoreConflictError`。

## 集成状态

- [x] Supabase 连接工厂（`createDb`）+ 建表迁移（`0001_init.sql`，含 events 的 UPDATE/DELETE 收回）
- [x] `PostgresEventStore` + 集成测试（真往返，自跳过）
- [x] server 入口按 `hasDbEnv()` 选择 Postgres / 内存 store
- [ ] RenderQueue 的 pg-boss Provider（独立 schema，同实例）+ worker 独立进程入口
- [ ] MediaStore 的 R2 Provider（待 R2 凭证）
- [ ] Auth：Supabase JWT 校验替换 `x-actor-id` 占位
