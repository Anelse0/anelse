# Anselse · 开发日志（滚动）

> 里程碑级状态看 [docs/05-dev-plan.md](docs/05-dev-plan.md)；本文件记录逐次改动与待办衔接。

## 2026-08-18 · 开发启动（M0 + M1 代码完成，待环境验证）

**决策**
- 服务端先行（领域核心包 → 服务端 → 前端），理由见 05-dev-plan。
- 编辑器交互方向定稿：Canva 式 shot-strip 骨架保留，shot 内部用剧本卡（非画布），Remix 槽位视图为第一入口——见 [docs/06-editor-ux.md](docs/06-editor-ux.md)。
- **Schema 结构修正**：Shot 升为一等结构（`recipe.shots[].beats[]`），与已验证模板"镜头 N"分块及 shot-strip UI 同构。

**完成**
- M0 骨架：pnpm workspace、tsconfig（strict/ESM/bundler resolution）、vitest 根配置（tsconfig paths + alias 直指 src，无构建步）、git 仓库初始化。
- `packages/vocab`：受控词汇表种子（景别 6 条 / 运镜 4 条，verified 仅收已验证模板族条目）。
- `packages/recipe`：
  - `schema.ts`——Recipe v0（meta/scene/shots/performanceAdvanced/camera/constraints/binding），branded ids，跨层 refine（运镜必须有动机；shot 时长和 ≤ 总时长）。
  - `resolve.ts`——RecipeDraft → Recipe v1，默认值全部集中显式（aspect 9:16 / executionSource prompt）。
  - `patch.ts`——set/unset ops，meta 不可 patch，应用后整体重校验，版本 +1 不可变。
  - `diff.ts`——对象递归、数组整体替换；roundtrip 不变式。
  - 测试 4 套 + golden fixture（来自已验证分手戏 30s 模板）。

**验证关账（同日）**
- 环境：brew 安装 node@22（22.23.2，keg-only：需 `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"`），corepack 启用 pnpm 10.12.1。
- `pnpm install` ✅ · `pnpm test` ✅ **23/23** · `pnpm typecheck` ✅（修复：tsconfig.base 补 `allowImportingTsExtensions` + `noEmit`）。
- **M0 / M1 / M1.5 关账。**

## 2026-08-18 · M2 完成（事件日志层，37/37 全绿）

**dsh 功课的落地清单**（本里程碑的设计出处）
- 信封 = 判别式联合（mapped union over `type`，switch 免 cast 窄化）。
- **未知必需事件拒绝重建**：`parseEvent` 在持久化边界执行；仅 `ignorable: true` 可跳过（宁过度拒绝，不静默阉割）。
- append 强制 JSON 可序列化：结构遍历（Date/class 实例/bigint/undefined 槽位/NaN 全拒），比 roundtrip 字符串对比诚实。
- 投影 = 纯折叠：`projectRecipeVersions` 校验 baseVersion 连续（乱序/丢事件 fails loud）；无关事件按文档化 default 穿过。
- **Provider-visible ⟺ Logged 的可执行不变式**：`reconstructRenderRequest(events, seq)`——渲染请求仅凭日志可重建，测试锁死。
- 边界原则：进程内 typed 信任 TS；durable 边界必过 parseEvent。
- 文档随代码：events/db 各配 README 契约。

**完成**
- `packages/events`：ids/map（13 个 v1 事件类型，schema 与类型同源）/envelope/append/projection + 14 个测试。
- `packages/db`：Drizzle schema（events append-only + `(project_id,seq)` 唯一；takes 读模型带完整 provenance）+ 集成待办清单（Supabase 开通后接线，无连接串测试自跳过）。
- 修复：zod `z.unknown()` 可选性在投影边界显式归一化；序列化检查改结构遍历。

**待办衔接**
- 下一步 M3（adapters 接口层 + MockAdapter + 编译快照测试框架）。
- M3.5 快照基准：resolve(breakup fixture) 的编译产物应与已验证 prompt 同构。
- 外部依赖提醒：Supabase 项目开通（M4 前需要）。
