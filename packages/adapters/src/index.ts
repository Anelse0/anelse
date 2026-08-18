/**
 * @anselse/adapters — 能力接缝：ModelAdapter 契约（Definition）+ Providers。
 * Consumer（worker/编辑器）只依赖 types.ts 的契约，不 import 具体 Provider。
 */
export * from "./types.ts";
export * from "./check.ts";
export * from "./registry.ts";
export * from "./mock.ts";
export * from "./seedance25.ts";
