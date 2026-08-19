# @anselse/worker

渲染编排 worker：消费 `render/requested` job，执行 adapter，把结果落成 Take。

## 处理流程（`RenderWorker.processJob`）

```
job {projectId, requestSeq}
  → read log
  → 幂等检查：该 requestSeq 是否已有 completed/failed？是则 skip
  → reconstructRenderRequest(log, requestSeq)   // 不信任队列载荷，从日志重建
  → adapters.get(adapterId).render(resolvedSpec) // worker 不重编译
  → mediaStore.persist(providerVideo) → 自有 URL
  → append render/completed{ takeId, media, ... }   // Take 可从日志投影
     或 render/failed{ kind, detail }
```

## 可靠性立场（借 dsh defensive patterns）

- **不信任队列载荷**：请求内容一律从日志重建（真相源只有日志）。
- **幂等**：at-least-once 队列的必然前提——崩溃重启、重复投递安全。
- **失败结构化**：`provider_error` / `timeout`（后续 `content_policy` 等），UI 按类给出不同动作。

## 运行形态

- 库形态：`RenderWorker` + `drainQueue`（内存模式 / 测试）已可用并 E2E 覆盖。
- 独立进程入口（pg-boss 订阅循环）随队列 Provider 接线加入——见 [@anselse/platform](../../packages/platform/README.md)。
