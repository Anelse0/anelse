# @anselse/platform

server 与 worker **共享的基础设施接缝**（Service Definition + 开发/测试用 Provider）。真实 Provider（Postgres/pg-boss/R2）接线时替换，两侧业务代码不动。

| 接缝 | Definition | 现役 Provider | 待接 Provider |
|---|---|---|---|
| `EventStore` | 唯一真相源持久化：read/append | `MemoryEventStore` | Postgres（Drizzle/Supabase），`(project_id,seq)` 唯一约束承接 `StoreConflictError` |
| `RenderQueue` | 渲染 job 入队；载荷仅 (projectId, requestSeq) | `MemoryRenderQueue` | pg-boss |
| `MediaStore` | provider 视频 → 自有对象存储 URL | `FakeMediaStore`（确定性 URL） | Cloudflare R2 |
| `IdGenerator` / `Clock` | 通用运行时依赖，显式注入以便测试确定化 | — | — |

**为什么独立成包**：`EventStore`/`RenderQueue` 是 server（生产者）与 worker（消费者）的共同契约。放在此处而非 `apps/server`，避免 worker 反向依赖 HTTP app——两个 app 是同级消费者。
