# Anselse · 开发计划与进度（Dev Plan）

> 本文档随开发滚动更新。逐日/逐次改动的细节记录在仓库根 [PROGRESS.md](../PROGRESS.md)；本文只维护里程碑级状态。

## 先做服务端还是前端：结论

**服务端先行（领域核心包 → 服务端 → 前端）。** 理由：

1. `packages/recipe` 是前后端共享地基（Zod 单一来源出类型/校验/契约），先写厚测厚，前端开工时契约已稳，避免对着 mock 返工。
2. 事件日志是唯一真相源，必须先于消费它的 UI 存在。
3. `resolve()` 编译器是技术灵魂，且**不需要 UI 即可开发**——无密钥快照测试独立迭代。
4. 前端的真风险在 beat 编辑器交互，用低保真原型（B3）并行解决，不靠写码。
5. tRPC 端到端类型：server 定 router → web 照类型消费，顺序天然成立。

## 里程碑与状态

> 截至 2026-08-19：后端骨架（M0–M5）+ Supabase EventStore 接线（M4.5 部分）完成，**74 单测 + 集成往返全绿**。代码托管 [github.com/Anelse0/anelse](https://github.com/Anelse0/anelse)。

| # | 里程碑 | 内容 | 依赖 | 状态 |
|---|---|---|---|---|
| ENV | Node 22 + pnpm | brew 装 node@22（keg-only，PATH 需指定）+ corepack pnpm | — | ✅ |
| M0 | 工程骨架 | pnpm workspace、tsconfig strict/ESM、vitest、git init | — | ✅ |
| M1 | `packages/recipe` | schema v0（shots-first）、resolveRecipe、patch/diff、单测 + golden fixture | M0 | ✅ |
| M1.5 | `packages/vocab` | 受控词汇表种子（仅已验证条目） | M0 | ✅ |
| M2 | `packages/events` + `db` | 事件信封、v1 事件映射、Recipe 版本投影、Drizzle schema | M1 | ✅ |
| M3 | `packages/adapters` | ModelAdapter 接缝、CapabilityMatrix（证据门禁类型化）、Mock、无密钥快照 | M1, M1.5 | ✅ |
| M3.5 | Seedance 2.5 + Kling 3 resolve() | 已验证模板族编译规则代码化，快照对齐两条已验证 prompt | M3 | ✅ |
| M4 | `apps/server` | Fastify + tRPC 四 router，写走 append、读走投影；HTTP 冒烟 | M2 | ✅ |
| M5 | `apps/worker` + `platform` | 渲染闭环（幂等、日志重建、Take 投影）；抽出共享接缝包 | M3, M4 | ✅ |
| M4.5 | Supabase 接线 | PostgresEventStore + 建表迁移 + 集成 gate；server 按环境选 store | M2, M4 | 🟡 部分 |
| M6 | `apps/web` | Vite + tokens + 编辑器 MVP + Take 工作台 | M4 | ⬜ 未启动 |

### M4.5 剩余（未阻塞 M6）
- RenderQueue 的 **pg-boss** Provider + worker 独立进程入口（当前内存队列 + `drainQueue`）
- MediaStore 的 **R2** Provider（待 R2 凭证；当前 `FakeMediaStore`）
- **Supabase JWT** 校验替换 `x-actor-id` 占位认证

### 架构增量（开发中确立，超出初版计划）
- 新增 `packages/platform`：EventStore / RenderQueue / MediaStore / IdGenerator / Clock 接缝——server 与 worker 的**共享消费层**，避免 worker 反向依赖 HTTP app。
- 测试分层落地为两条 gate：`pnpm test`（默认，零网络）/ `pnpm test:integration`（真实 DB，自跳过），alias 抽 `vitest.aliases.ts` 共享。

## v0 范围决策记录（偏离 03-tech 处在此登记）

- **Shot 升为一等结构**（`recipe.shots[].beats[]`，替代拍平 beats）——与已验证模板"镜头 N"分块及编辑器 shot-strip 交互同构（[06-editor-ux](06-editor-ux.md)）。
- **dialogue 内联于 Beat**（`beat.dialogue?: {text, delivery?}`），不再单独 `performance.dialogue` 数组——对齐已验证模板"每镜带对白块"，一个事实一个家。
- **`beat.window?: [start, end]`**（M3.5 因 Kling `【0–t｜状态】`分段框架的真实需要加入）：镜内起点非降序、终点不越总时长，schema 校验；缺省时 adapter 显式均分（`resolveBeatWindows`）。
- **深层戏剧学字段降为 `performanceAdvanced?`**（want/tactic/displayPolicy/intensity）：普通用户只填 beats，高级字段由 Director 或未来助手代填——产品与内部方法论解耦的落地。
- **interaction 层延后**：需红线测试证据支撑，v0 schema 不含。
- **词汇表即数据**：`packages/vocab` 数据包，红线测试后更新数据不改 schema；`verified` 级 capability 声明类型强制带 `evidenceRef`。
- **meta 不可被 patch**：版本、谱系由系统写入，patch 路径以 `meta` 开头即拒绝。
- **运镜必须有动机**：`mainMove` 非 static 时必须有 `movementDriver`，schema 层强制。
- **编译拒绝不落日志**：`requestRender` 编译失败即时返回结构化 rejections（无内容到达 provider），只有编译成功才 append `render/requested` + 入队。
- **render 事件承载完整 provenance**：`render/requested` 带 `adapterVersion`、`render/completed` 带 `media`，使 Take 读模型可完全从日志投影（`projectTakes`）。

## 工程约定（继承 03-tech §5-7）

- TS strict + ESM；所有跨边界 id 用 Branded 类型；显式 resolve 补默认，禁散落 `?? default`。
- **仅用可擦除 TS 语法**（no parameter properties / enum / namespace）：源码需能被 Node `--experimental-strip-types` 直接运行（dsh source-launch 契约的同款约束；M4 冒烟实测踩坑后立此规矩）。
- 测试三层：单元（vitest）→ 编译快照（无密钥）→ 真实 DB/渲染集成（`test:integration`，无凭证自跳过）。
- 依赖方向单向：`apps → platform/adapters/db → events → recipe/vocab`（recipe/vocab 零工作区依赖）；worker 与 server 同级、经 platform 共享接缝，不互相依赖。dependency-cruiser 守（待接入）。
