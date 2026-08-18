# Anselse · 完整技术方案

> 方针：**买思想，不买机器。** 从 DeepSeek Harness (dsh) 借四个经过验证的架构思想（意图接缝 / 事件日志真相源 / 结果溯源绑定 / 层叠 patch），不引入其插件运行时（论证见 §9）。
>
> **解耦原则（与内部方法论的关系）**：团队的导演方法论（内部 skill）是上游知识源与内容工厂——为词汇表/编译规则提供候选条目、为种子 Recipe 提供生产能力——但**产品 schema、词汇表与证据体系由产品自有并独立版本化**，收录裁判是红线测试与线上交付性数据，不是方法论文档。知识单向流入：skill 迭代不震动产品契约；其他导演的方法论同样能流入。

---

## 1. 架构总览

```
┌───────────────────────────────────────────────────────────────┐
│  Web App（Vite + React SPA）                                   │
│  ┌────────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ Recipe 编辑器    │ │ Take 工作台   │ │ 社区（浏览/fork/谱系）│  │
│  │ capability 感知  │ │ 对比/反馈     │ │ FTUE demo 墙        │  │
│  └───────┬────────┘ └──────┬───────┘ └──────────┬──────────┘  │
└──────────┼─────────────────┼────────────────────┼─────────────┘
           │ tRPC            │                    │
┌──────────▼─────────────────▼────────────────────▼─────────────┐
│  API 层（Node/TypeScript）                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 项目事件日志（append-only，唯一真相源）                     │  │
│  │ recipe/* · render/* · take/* · fork/* · feedback/*      │  │
│  └───────────────┬─────────────────────────────────────────┘  │
│       投影 ▼                        ▼ 入队                     │
│  ┌────────────┐  ┌──────────────────────────────────────────┐ │
│  │ 读模型      │  │ 渲染编排器（Queue Worker）                 │ │
│  │ (Recipe 版本│  │  resolve(recipe) → ProviderSpec → 轮询    │ │
│  │  Take 谱系) │  │  → Take 落库（绑定 spec 与 recipe 版本）    │ │
│  └────────────┘  └───────┬──────────────────────────────────┘ │
└──────────────────────────┼────────────────────────────────────┘
                           │ ModelAdapter 接口（编译期绑定，构造注入）
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  KlingAdapter      SeedanceAdapter     (未来 VeoAdapter…)
  capabilities()    capabilities()      ← adapter-contract
  resolve()         resolve()             (源自 skill)
  render()          render()
        │                  │
        ▼                  ▼
   Kling API         Seedance/火山 API
```

四条主数据流：
1. **创作流**：编辑器改 Recipe → `recipe/patched` 事件 → 投影出新 Recipe 版本
2. **渲染流**：`render/requested` → worker `resolve()` 编译 → 调 provider → `render/completed` → Take（携带完整溯源）
3. **社区流**：发布 = 引用（Take + Recipe 版本）；fork = 谱系边 + 新项目的事件日志起点
4. **数据流**：`feedback/axis-rated` 事件 → 聚合为 adapter 兑现率 → 修正 capability 声明与 UI

---

## 2. 核心域模型

### 2.1 Direction Recipe（原子单元）

Schema 用 Zod 定义（单一来源，同时生成 TS 类型、表单校验、API 校验）。**结构由产品自有**——四层划分（场景/表演/摄影/约束）源自导演实践的普遍结构，字段取"创作者能理解 + 模型能兑现"的交集；深层戏剧学字段（`want`/`tactic`/`displayPolicy`/`intensity` 等）标记为**高级可选**，普通用户不必填（由默认值或未来的助手代填），骨架如下：

```typescript
interface Recipe {
  meta: {
    id: RecipeId                    // branded type（借 dsh：跨边界 id 一律品牌化）
    projectId: ProjectId
    version: number                 // 不可变版本，每次 patch 递增
    lineage?: { forkedFrom: { recipeId: RecipeId; version: number } }
  }

  // —— 场景层（skill: style_contract / given_circumstances）——
  scene: {
    styleContract: string           // 视觉风格契约
    circumstances: string           // 规定情境
    subjects: SubjectRef[]          // 引用项目内角色锚点（参考图 + 描述）
    setting: string; lighting: string
  }

  // —— 表演层 ——
  performance?: {
    beats: Beat[]                   // 核心：beat 时序（普通用户只填这个）
    dialogue?: DialogueLine[]
    advanced?: {                    // 高级可选：行动逻辑（Director 手填或助手生成）
      target?: string; want?: string; tactic?: string
      turningTrigger?: string
      displayPolicy?: 'reveal' | 'restrain' | 'deny' | 'redirect'
      intensity?: 'L1' | 'L2' | 'L3'
    }
  }

  // —— 摄影层 ——
  camera: {
    shotType: ShotType              // 受控枚举（词汇表白名单）
    viewerRelation: string
    movementDriver?: string         // 运镜动机——静止是正式设计结果
    mainMove?: CameraMove           // 每镜只有一个主要运动任务
    startFrame: string; endFrame: string   // 起幅/落幅
    executionSource: 'prompt' | 'ui_control' | 'start_end_frames' | 'motion_reference'
  }

  // —— 交互契约（可选，高级）——
  interaction?: {
    class: InteractionClass
    entityContract?: EntityContract // 实体归属/硬排除/首帧门禁
  }

  // —— 约束层 ——
  constraints: { durationSec: number; aspect: '16:9' | '9:16' | '1:1'; referenceFrames?: FrameRef[] }

  // —— 绑定层 ——
  binding: {
    targetAdapter: AdapterId
    overrides?: Partial<Record<AdapterId, AdapterOverride>>  // 每 adapter 可选覆盖
  }
}

interface Beat {
  window?: [number, number]         // 秒级时间窗（节奏参考，非承诺帧级）
  state: string                     // 状态标题
  action: string                    // 可见、有限、有方向的动作
  emotionNote?: string
}
```

设计决策：
- **Recipe 版本不可变**。编辑产生 patch 事件，投影出新版本——旧版本永远可引用（Take 溯源依赖此）。
- **受控词汇表**：`shotType`、`CameraMove` 等枚举只收录证据账本 verified 的条目；experimental 条目带标记进入（UI 显示"设计级"）。词汇表本身是数据（DB 表），随交付性测试更新，不用发版。
- **借 dsh"显式 > 隐式"**：所有默认值在 `resolveRecipe(input): Recipe` 一步显式补齐，绝不散落 `?? default`。

### 2.2 事件日志（唯一真相源，借 dsh "Model-visible ⟺ Logged"）

每个项目一条 append-only 事件流。**规则：凡是到达 provider 请求的内容，必须能从日志重建**——这是 remix 谱系、Take 溯源、审计的地基。

```typescript
interface ProjectEvent<T extends EventType> {
  type: T                           // 判别式 tag
  seq: number                       // 项目内单调递增
  time: number                      // epoch ms
  actorId: UserId
  data: EventPayloadMap[T]          // JSON 可序列化，append 时校验
}
```

**v1 事件类型清单**（对齐 dsh 的域分组习惯）：

| 域 | 事件 | 载荷要点 |
|---|---|---|
| project | `project/created` | 项目元信息 |
| asset | `asset/registered` `asset/updated` | 角色/风格/场景锚点（参考图指针 + 描述） |
| recipe | `recipe/created` | 完整初始 Recipe |
| | `recipe/patched` | **patch 而非全量**：`{ baseVersion, patch: JsonPatch }` |
| | `recipe/forked` | `{ sourceRecipeId, sourceVersion, sourceProjectId }` 谱系边 |
| render | `render/requested` | `{ recipeVersion, adapterId, resolvedSpec }` ← **编译产物入日志** |
| | `render/completed` | `{ takeId, providerJobId, durationMs, cost }` |
| | `render/failed` | 结构化失败（provider 错误 / 编译拒绝 / 门禁拦截） |
| take | `take/selected` `take/discarded` | A/B 决策 |
| feedback | `feedback/axis-rated` | `{ takeId, axis, verdict: 'honored' | 'ignored' | 'partial' }` ← 交付性数据 |
| publish | `publish/created` | `{ takeId, recipeVersion }`（发布 = 引用，不复制） |

- **`resolvedSpec` 写入日志**是关键决策：Take 的溯源（§2.3）、"编译预览"、失败归因（是编译错还是模型不听话）全靠它。
- 借 dsh 的 `ignorable` 思想简化版：读端遇到未知事件类型即拒绝重建（v1 不做兼容标记，schema 版本号整体迁移）。

### 2.3 Take 与溯源（借 dsh `sourceEventSeqs`）

```typescript
interface Take {
  id: TakeId
  projectId: ProjectId
  provenance: {                     // 永久绑定，不可变
    recipeId: RecipeId; recipeVersion: number
    adapterId: AdapterId; adapterVersion: string
    resolvedSpec: ProviderSpec      // 编译后的完整原生请求
    requestEventSeq: number         // 指回日志中的 render/requested
  }
  media: { videoUrl: string; thumbUrl: string; durationSec: number }
  status: 'selected' | 'discarded' | 'unrated'
}
```

**任何视频永远能回放出它的配方与编译产物**——这是"demo + recipe"发布形态的技术保证，也是社区信任的基础（demo 不可能造假配方）。

### 2.4 Fork 与层叠（借 dsh Profile/Bundle/Patch，数据版）

fork 不复制 Recipe 全文，而是：**新项目 + `recipe/forked` 谱系边 + 源版本引用 + 后续 patch 层**。

- remix diff 可视化 = 对比 fork 点版本与当前版本的 patch 链（改了哪些轴一目了然）。
- 谱系图 = `recipe/forked` 边的全局图（Postgres 递归 CTE 足够 v1 规模）。
- 抄截图带不走的技术根源：**Recipe 的价值在版本链 + 谱系 + 可重放**，纯文本导出丢失全部三者。

---

## 3. Adapter 层（编译器，产品化 skill 的 `adapters/` + `adapter-contract`）

### 3.1 接口（普通 TS interface + 构造注入，不是插件）

```typescript
interface ModelAdapter {
  readonly id: AdapterId
  readonly version: string                    // adapter 自身版本，入 Take 溯源

  /** 静态声明 + 动态修正的能力矩阵。UI 据此只亮可兑现的轴 */
  capabilities(): CapabilityMatrix

  /** 编译：Recipe → 该模型原生请求。纯函数、可快照测试、失败显式 */
  resolve(recipe: Recipe, assets: AssetBundle): Resolved<ProviderSpec>

  /** 执行：提交 + 轮询 + 拉取产物 */
  render(spec: ProviderSpec, signal: AbortSignal): Promise<RenderResult>
}

type Resolved<T> =
  | { ok: true; spec: T; warnings: AxisWarning[] }       // 某轴降级兑现 → 显式警告
  | { ok: false; rejections: AxisRejection[] }           // 门禁拦截（如首帧门禁）→ 拒绝渲染

interface CapabilityMatrix {
  axes: Record<ControlAxis, {
    support: 'verified' | 'experimental' | 'unsupported'  // 证据分级：官方文档/实测验证/设计级
    evidenceRef?: ProbeRunId        // 指向产品自有的红线测试运行记录
    honorRate?: number              // 动态：来自 feedback/axis-rated 聚合
  }>
  durationRange: [number, number]
  workflows: Workflow[]             // 如 kling: single | multi_shot | motion_control
}
```

设计要点：
- **`capabilities()` 的三级置信度**遵循证据门禁原则（官方来源 / 同条件实测成立 / 设计级待验证）——**能力声明必须指向一次红线测试运行记录**，不许拍脑袋。
- **`resolve()` 是纯函数**：同一 (Recipe, assets) 永远编译出同一 spec → 可做无密钥快照测试（§7）。逐模型编译规则（如 Seedance 的结构化分镜格式、Kling 的时间分段框架与 UI 控件不冲突原则、每条 prompt 自足无上下文记忆…）实现在这里——规则的候选来源是内部方法论积累，收录以红线测试结论为准（见文首解耦原则）。
- **门禁在编译期**：素材前置检查不通过、渲染模式冲突等对应 `ok: false` ——**不输出不可运行的请求**，把渲染费省在编译期。
- 新增模型 = 新增一个类 + 一份 capability 声明 + 跑一遍红线测试。**不需要插件加载器**。

### 3.2 交付性红线测试（E3，工程化 skill 的验证方法）

```
probes/                        每个控制轴 × 每档强度的标准探针 Recipe（首批可从内部方法论的 benchmark 提炼）
  camera/dolly-in.probe.yml
  performance/L2-restrain.probe.yml
  ...
runner:  批量 resolve → render → 存 Take → 人工逐轴评分（honored/partial/ignored）
output:  该 adapter 的 CapabilityMatrix 初始值 + 词汇表白名单
```

- 新模型接入、模型版本升级时重跑 → capability 声明有数据背书。
- 线上 `feedback/axis-rated` 持续修正 `honorRate` → **平台独占的交付性数据集**（数据回路的技术落点）。

---

## 4. 渲染编排器

- **队列**：BullMQ（Redis）。job = `{ projectId, requestEventSeq }`——worker 从事件日志重建请求（不信任队列载荷，真相源只有日志）。
- **生命周期**：领取 → 读日志投影 Recipe 版本 → `resolve()` →（拒绝则写 `render/failed` 并携带 rejections）→ 提交 provider → 轮询/webhook → 拉媒体上传对象存储 → 写 `render/completed` + Take。
- **失败分类显式化**（借 dsh"结构化失败"习惯）：`compile_rejected` / `provider_error` / `timeout` / `content_policy` ——UI 分别给不同的用户动作（改配方 / 重试 / 换模型）。
- **幂等**：以 `requestEventSeq` 为幂等键；worker 崩溃重启后重放安全。
- **成本护栏**：额度检查在入队前；单项目并发渲染上限（配置项，不硬编码——借 dsh"无硬编码可调项"）。

---

## 5. 技术栈选型

| 层 | 选型 | 理由 |
|---|---|---|
| 语言 | **TypeScript 端到端**，`strict: true`，ESM | 单一语言全栈；Recipe schema 一份 Zod 定义贯穿前后端；借 dsh 的严格模式纪律 |
| Monorepo | **pnpm workspaces**（≤8 个包，见 §6） | 借 dsh 工程形态但控制规模；不引入 Nx/Turbo（v1 不需要） |
| 前端 | **Vite + React（SPA）** | 编辑器是重客户端应用，Vite 的开发体验与构建速度更合适；landing/社区页的 SEO 用预渲染（vite prerender / SSG）解决，不为此绑定全栈框架 |
| UI 基础 | **Figtree** 字体（`@fontsource/figtree` 自托管）+ **全局 design token**（CSS 变量单一来源，开发时先于组件建立） | 字体不走第三方 CDN（国内加载 + 隐私）；所有组件只消费 token，不出现裸色值/裸字号 |
| 编辑器状态 | **Zustand** + Recipe 本地草稿 → 显式保存为 patch 事件 | 简单可控；避免把编辑器每击键写日志 |
| API | **Fastify + tRPC**（独立 Node 服务） | 前端 SPA 化后 API 独立成服务；端到端类型安全，schema 即契约 |
| 数据库 | **PostgreSQL — Supabase 免费档起步**（Drizzle ORM 直连） | 事件日志表（append-only，`(project_id, seq)` 唯一）+ 读模型表 + JSONB 存 Recipe/spec；递归 CTE 查谱系；免费档托管省运维，v1 不需要事件存储中间件 |
| 队列 | **pg-boss**（跑在同一 Postgres 上）→ 量大后迁 Redis+BullMQ | 渲染量在内测期不需要独立 Redis；省一个付费组件，迁移路径已知 |
| 对象存储 | **Cloudflare R2**（10GB 免费 + 出口流量免费） | 视频/参考帧；出口免费是视频社区的带宽成本命门 |
| 视频处理 | **ffmpeg（worker 内）** | 缩略图/转码/水印（含 D1 预留的内容标识位） |
| 认证 | **Supabase Auth** | 与数据库同平台，免费档覆盖内测；不自研 |
| 部署 | **web → Vercel**（Vite 静态产物 + CDN，免费档）；**API + worker → Fly/Railway 免费档**；db/auth → Supabase | web 是纯静态 SPA，Vercel 免费档 + 全球 CDN 最合适；worker 是长驻进程（渲染轮询/pg-boss 消费），不适合 serverless，独立部署；内测期月固定成本 ≈ 0 |
| 可观测 | **OpenTelemetry + Sentry** | 渲染链路 trace（编译→提交→轮询→落库）从第一天埋 |

**明确不用**：微服务（单体 + worker 足够）、GraphQL、事件溯源专用存储、K8s、自研 UI 框架、**任何插件运行时**。

---

## 6. Monorepo 布局

```
anselse/
├─ apps/
│  ├─ web/                 Vite + React SPA（编辑器/社区/FTUE；landing 预渲染）
│  ├─ server/              Fastify + tRPC API 服务
│  └─ worker/              渲染编排 worker（BullMQ 消费者）
├─ packages/
│  ├─ recipe/              Recipe Zod schema + resolveRecipe + patch/diff 工具（零依赖核心）
│  ├─ events/              事件类型 + append/投影原语
│  ├─ adapters/            ModelAdapter 接口 + kling/ + seedance/ + capability 类型
│  ├─ vocab/               受控词汇表（数据 + 类型），随红线测试更新
│  ├─ db/                  Drizzle schema + 读模型投影
│  └─ probes/              红线测试探针 + runner（内部工具）
├─ docs/                   本文档系
└─ knowledge/              编译规则内部知识库（来源：团队方法论 + 红线测试结论；产品自有、独立演进）
```

依赖方向强制单向：`apps → adapters/db/events → recipe/vocab`（`recipe` 零依赖）。用 `dependency-cruiser` 一条 CI 规则守住——这是 dsh 六十个门禁里唯一现在就值得抄的。

---

## 7. 测试策略（借 dsh 分层，砍到三层）

| 层 | 做法 | 借自 |
|---|---|---|
| **单元** | vitest；`recipe`（schema/patch/投影）与各 adapter `resolve()` 的规则覆盖 | — |
| **编译快照（无密钥）** ⭐ | 固定探针 Recipe → `resolve()` → 快照编译产物（Seedance 分镜文本 / Kling 配置+prompt）。**改编译规则时 diff 一目了然，跑 CI 不花一分渲染钱** | dsh 的 keyless snapshot 测试——它最值得抄的测试思想 |
| **真实渲染 e2e（有密钥）** | 探针子集真打 provider API；无密钥自动跳过；红线测试 runner 复用此层 | dsh 的 `test:e2e` 自跳过机制 |

不做：per-file 100% 覆盖率门禁（dsh 的纪律，v1 的枷锁）。

---

## 8. 安全与合规要点

- Provider API key 只存服务端（KMS/env），worker 出网白名单；用户自带 key（P2）加密落库、仅 worker 解密。
- 参考图上传：内容审核钩子预留（国内合规刚性）；生成内容留存溯源（Take↔spec 绑定天然满足"可追溯"要求）。
- Recipe 为用户资产：导出自己的数据可以（JSON），但导出不含谱系与可重放上下文——资产粘性来自结构而非封锁。

---

## 9. 与 dsh 的对照（决策记录）

| dsh 思想 | Anselse 落点 | 引入否 |
|---|---|---|
| Capability Seam（意图层） | Recipe = 意图规格；Adapter = 编译器 + capability 声明 | ✅ 核心 |
| Model-visible ⟺ Logged | 事件日志唯一真相源；resolvedSpec 入日志 | ✅ 核心 |
| `sourceEventSeqs` 溯源 | Take.provenance 永久绑定配方版本与编译产物 | ✅ 核心 |
| Profile/Patch 层叠 | fork = 谱系边 + patch 链；remix diff 可视化 | ✅ 数据版 |
| 显式 resolve() 补默认 | `resolveRecipe` / adapter `resolve()` 单点显式 | ✅ |
| keyless snapshot 测试 | 编译快照层 | ✅ |
| 结构化失败 / 无硬编码可调项 / branded id | 渲染失败分类 / 配置项 / RecipeId 等 | ✅ 习惯级 |
| **Cordis 插件运行时**（6.5k 行框架 + 8.9k 行 typert + 30k 行门禁） | 组件集合编译期已知，interface + 构造注入达成同等解耦，成本≈0 | ❌ v1 不引入 |
| 一切皆插件 / HMR / 自我修改 | 无运行时挂载未知代码的需求 | ❌ |
| 219 包 monorepo + 60 门禁 | 8 包 + 1 条依赖方向规则 | ❌ 规模不匹配 |

**重新评估插件化的触发条件**（写下来，防止将来吵架）：当且仅当出现"第三方开发者向平台提交 adapter/扩展代码、需要运行时加载与隔离"的真实需求（adapter 市场），才引入插件加载层——且届时接缝已被 `ModelAdapter` 接口预先划好，迁移是机械工作。
