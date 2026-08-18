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

## 2026-08-18 · M3 完成 + M3.5 过半（51/51 全绿）——编译器首次闭环 🎬

**dsh 功课落地**
- 接缝三角色成形：`types.ts` = Definition；Mock/Seedance25 = Provider；Consumer 只 import 契约。
- 注册可逆：`registry.register()` 返回 disposer（过期 disposer 不误删后继注册，测试锁定）；重复注册 fails loud。
- **证据门禁类型化**：`AxisSupport` 联合类型强制 `verified` 级别必须携带 `evidenceRef`——没有证据编号的"已验证"编译不过。
- 编译期门禁：binding 不匹配/时长越界/未声明轴 → 结构化拒绝，不输出不可运行请求。
- **无密钥编译快照**：`toMatchFileSnapshot` 锁定编译产物（可读 txt，diff 一目了然，CI 零渲染费）。

**里程碑事实**：`resolve(分手戏 fixture)` 的输出与已验证真实 prompt **同构**——总纲（镜数/时长/画幅声明）、裸 `镜头 N` 标题、每句一行、`对白：`块 + delivery 独立行、表演指导逐句重述、restrain→"崩溃前结束"护栏句。快照文件：`packages/adapters/tests/__snapshots__/breakup.seedance25.prompt.txt`。

**已知观察（后续打磨）**
- beat 内"说完之后"类后置反应目前排在对白前（action 单字段的顺序局限）——若红线测试显示影响兑现，schema 加 `actionAfterDialogue` 或 beat 拆分。
- Seedance25 `render()` 显式未接线（M5 接 provider API）。

## 2026-08-18 · M3.5 关账（60/60 全绿）——双模型编译闭环 + 代码上 GitHub

**调研先行**（用户指定方式）：Kling 官方 API 文档调研留存于 [knowledge/kling-3-adapter-notes.md](knowledge/kling-3-adapter-notes.md)（官方 kling.ai 拦截无凭证抓取，经 API 镜像文档交叉验证：时长 3–15s、multi-shot ≤6镜/≤15s、prompt ≤2500 字符、v3 无独立 camera_control 字段、cfg_scale 默认 0.5）。

**完成**
- `Kling3Adapter`（kling-v3 / std）：已验证 `【start–end s｜状态】` 分段框架编译（时间无"约"、节奏参考声明、原地锁定措辞、单人约束尾行）；API 配置与 prompt 正文分离；官方 2500 字符上限编译期强制。
- **诚实能力的两条硬拒绝**（测试锁定）：30s 分手戏编译到 Kling → duration 拒绝（>15s 官方上限）+ shots 拒绝（v0 仅单镜 actor cut 有成片证据，multi_prompt 待红线测试解锁）；Kling 侧 dialogue → experimental 告警。
- Schema 演进：`beat.window?: [start, end]`（Kling 分段框架的真实需要；镜内有序 + 不越总时长校验）；缺省时 adapter 显式均分（`resolveBeatWindows`，确定性，末段收口于总时长）。
- Kling golden fixture = skill 已验证"久别重逢"样例（8s/4 beats/静止/原地锁定）；快照 `reunion.kling3.prompt.txt` 与已验证 prompt 同构。
- 代码托管：`github.com/Anelse0/anelse` main 分支（用户提供 remote）。

**核心卖点首次成立**：同一套 Recipe schema，两个 adapter 各自编译出与真实已验证 prompt 同构的产物——"一份调度，多模型编译"闭环。

**待办衔接**
- 下一步 M4（apps/server：Fastify + tRPC 四 router，写走 append、读走投影）。
- 外部依赖提醒：**Supabase 项目开通**（M4 接线前需要）；Kling 开发者凭证（接入时核对官方 API 细节）。
