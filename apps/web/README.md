# @anselse/web

导演工作台前端（Vite + React SPA，单色黑白 design token + Figtree）。

## M6.1（当前）：零后端的编辑器 + 实时编译预览

核心洞察：`resolve()` 编译器是纯函数且浏览器安全（`@anselse/recipe/vocab/adapters` 无 node 依赖），所以编辑器 + capability 感知 + 编译预览**完全跑在浏览器内，不需要后端**。

- **三栏工作台**：分镜 shot-strip / 剧本卡编辑器 / 编译预览。
- **所见即编译所得**：改任一字段，右侧实时重编译出目标模型 prompt（Seedance 分镜格式 / Kling 时间分段框架）。
- **capability 感知**：目标模型不支持的控制轴置灰禁用、设计级标注；配方无法在当前模型渲染时**编译期即拒绝**（如 30s 配方切到 Kling → duration 超限 + 多镜拒绝），"不浪费渲染"直接呈现在界面。
- **单色系**：仅黑白灰（`tokens.css`），capability 三态靠排版/描边/透明度区分，不靠颜色。

## 运行

```bash
pnpm --filter @anselse/web dev      # http://127.0.0.1:5173
pnpm --filter @anselse/web build    # tsc 校验 + vite 构建
```

## 后续

- M6.2：tRPC 客户端 → 持久化/渲染请求 + Take 工作台。
- M6.3：Supabase Auth 登录 + 后端 JWT 校验（替换 x-actor-id 占位）。
- 部署：Vercel（静态 SPA + CDN）。
