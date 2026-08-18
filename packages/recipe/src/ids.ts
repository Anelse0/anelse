/**
 * 跨边界 id 的品牌化类型（不透明 id 一律 branded，不用裸 string）。
 * zod `.brand()` 在 schema 层给出同名品牌，二者通过 `z.infer` 保持一致。
 */
import { z } from "zod";

export const recipeIdSchema = z.string().min(1).brand<"RecipeId">();
export const projectIdSchema = z.string().min(1).brand<"ProjectId">();
export const adapterIdSchema = z.string().min(1).brand<"AdapterId">();
export const assetIdSchema = z.string().min(1).brand<"AssetId">();

export type RecipeId = z.infer<typeof recipeIdSchema>;
export type ProjectId = z.infer<typeof projectIdSchema>;
export type AdapterId = z.infer<typeof adapterIdSchema>;
export type AssetId = z.infer<typeof assetIdSchema>;
