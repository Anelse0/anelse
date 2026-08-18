/** 事件层新增的品牌化 id（Recipe 相关 id 在 @anselse/recipe）。 */
import { z } from "zod";

export const actorIdSchema = z.string().min(1).brand<"ActorId">();
export const takeIdSchema = z.string().min(1).brand<"TakeId">();

export type ActorId = z.infer<typeof actorIdSchema>;
export type TakeId = z.infer<typeof takeIdSchema>;
