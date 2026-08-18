# @anselse/events

项目事件日志层：**append-only 的唯一真相源**。一切读模型（Recipe 版本链、谱系、Take 状态）与一切 provider 请求都从这条日志派生。

## 契约

- **信封**：`{ type, seq, time, actorId, data, ignorable? }`，判别式联合（`switch (event.type)` 直接窄化）。`EVENT_FORMAT_VERSION = 0`，预发布期无兼容承诺。
- **`ignorable` 缺省即必需**：读端（`parseEvent`）遇到不认识的必需事件类型**拒绝重建**（`UnknownRequiredEventError`），只有 `ignorable: true` 的未知事件可跳过。忘写标记的代价是过度拒绝，而非静默恢复出残缺项目。
- **append 校验**（`nextEvent`）：载荷按类型 schema 校验 + JSON roundtrip 恒等检查（Date/bigint/函数/有损序列化直接拒）。seq 单调递增，持久层以 `(project_id, seq)` 唯一约束背书。
- **边界原则**：进程内类型化调用信任 TypeScript；持久化边界（DB 读出）必须过 `parseEvent`。
- **Provider-visible ⟺ Logged**：到达 provider 的请求必须能仅凭日志重建——`reconstructRenderRequest(events, requestSeq)` 是这条不变式的可执行形态，worker 与测试都以它断言。

## 事件类型（v1，封闭集合）

| 域 | 类型 | 要点 |
|---|---|---|
| project | `project/created` | |
| asset | `asset/registered` | 连续性锚点（character/style/frame） |
| recipe | `recipe/created` | 完整 v1（fork 的 lineage 在 meta 内） |
| | `recipe/patched` | baseVersion + ops；投影校验版本连续 |
| | `recipe/forked` | 谱系边（remix 图数据源） |
| render | `render/requested` | 含 adapter 的 resolvedSpec（编译产物入日志） |
| | `render/completed` / `render/failed` | requestSeq 回指；失败结构化分类 |
| take | `take/selected` / `take/discarded` | |
| feedback | `feedback/axis-rated` | 逐轴兑现度——交付性数据集入口 |
| publish | `publish/created` | 发布 = 引用，不复制 |

新增事件类型 = 在 `map.ts` 的 `EVENT_SCHEMAS` 加一行（类型与 schema 同源）。v1 不做插件级 declaration merging，出现真实第三方扩展需求再引入。

## 投影

`projectRecipeVersions` 折叠出每个 Recipe 的不可变版本链；`recipe/patched` 的 `baseVersion` 与链头不符即抛 `ProjectionError`（乱序/丢事件 fails loud）。与 Recipe 无关的事件按文档化 default 穿过。
