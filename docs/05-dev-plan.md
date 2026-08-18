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

| # | 里程碑 | 内容 | 依赖 | 状态 |
|---|---|---|---|---|
| ENV | Node 22 + pnpm | 本机无 Node 运行时，装法待定（brew/官方包/fnm） | — | ⏸ 待用户确认 |
| M0 | 工程骨架 | pnpm workspace、tsconfig strict/ESM、vitest、git init | — | 🔨 进行中 |
| M1 | `packages/recipe` | schema v0、resolveRecipe、patch/diff、单测 + golden fixture | M0 | ⬜ |
| M1.5 | `packages/vocab` | 受控词汇表种子（仅已验证条目） | M0 | ⬜ |
| M2 | `packages/events` + `db` | 事件信封、v1 事件映射、Recipe 版本投影、Drizzle/Supabase、pg-boss | M1 | ⬜ |
| M3 | `packages/adapters` | ModelAdapter 接口、CapabilityMatrix、MockAdapter、快照测试框架 | M1, M1.5 | ⬜ |
| M3.5 | Seedance/Kling resolve() v0 | 已验证模板族编译规则代码化，快照对齐两条已验证 prompt | M3 | ⬜ |
| M4 | `apps/server` | Fastify + tRPC 四 router，写走 append、读走投影 | M2 | ⬜ |
| M5 | `apps/worker` | pg-boss 渲染编排，Mock 端到端 → 真 adapter（无 key 自跳过） | M3, M4 | ⬜ |
| M6 | `apps/web` | Vite + tokens + 编辑器 MVP + Take 工作台 | M4 | ⬜ |

## v0 范围决策记录（偏离 03-tech 处在此登记）

- **dialogue 内联于 Beat**（`beat.dialogue?: {text, delivery?}`），不再单独 `performance.dialogue` 数组——对齐已验证模板"每镜带对白块"的结构，一个事实一个家。
- **interaction 层延后**：需 A2 证据支撑，v0 schema 不含，留 TODO 标记。
- **词汇表即数据**：`packages/vocab` 是数据包，红线测试后更新数据不改 schema。
- **meta 不可被 patch**：版本、谱系由系统写入，patch 路径以 `meta` 开头即拒绝。
- **运镜必须有动机**（源自方法论并代码化）：`mainMove` 非 static 时必须有 `movementDriver`，schema 层强制。

## 工程约定（继承 03-tech §5-7）

- TS strict + ESM；所有跨边界 id 用 Branded 类型；显式 resolve 补默认，禁散落 `?? default`。
- **仅用可擦除 TS 语法**（no parameter properties / enum / namespace）：源码需能被 Node `--experimental-strip-types` 直接运行（dsh source-launch 契约的同款约束；M4 冒烟实测踩坑后立此规矩）。
- 测试三层：单元（vitest）→ 编译快照（无密钥）→ 真实渲染 e2e（无 key 自跳过）。
- 依赖方向单向：`apps → adapters/db/events → recipe/vocab`（recipe/vocab 零工作区依赖），dependency-cruiser 守。
