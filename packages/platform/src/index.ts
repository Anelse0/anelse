/**
 * @anselse/platform — server 与 worker 共享的基础设施接缝：
 * EventStore（唯一真相源持久化）、RenderQueue、MediaStore。
 * 均为 Definition + 内存/Fake Provider；真实 Provider（Postgres/pg-boss/R2）接线时替换。
 */
// 主出口保持浏览器安全（前端经此拿到接缝类型）。
// 带 node 依赖的 PostgresEventStore 走子路径 @anselse/platform/postgres。
export * from "./runtime.ts";
export * from "./event-store.ts";
export * from "./render-queue.ts";
export * from "./media-store.ts";
