/**
 * tRPC 路由：薄壳——输入校验复用领域 schema（recipe/events 包），逻辑全在 service。
 * 领域错误 → tRPC 错误码的映射集中在 wrap()。
 * 认证：v0 上下文携带 actorId（Supabase JWT 校验在集成阶段接入，见 README）。
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { recipeDraftSchema } from "@anselse/recipe";
import { patchOpSchema } from "@anselse/events";
import { AnselseService, NotFoundError, VersionConflictError } from "./service.ts";
import { StoreConflictError } from "@anselse/platform";
import type { ActorId } from "@anselse/events";

export interface RequestContext {
  actorId: ActorId;
  service: AnselseService;
}

const t = initTRPC.context<RequestContext>().create();

async function wrap<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new TRPCError({ code: "NOT_FOUND", message: error.message });
    }
    if (error instanceof VersionConflictError || error instanceof StoreConflictError) {
      throw new TRPCError({ code: "CONFLICT", message: error.message });
    }
    throw error;
  }
}

const projectIdInput = z.object({ projectId: z.string().min(1) });

export const appRouter = t.router({
  project: t.router({
    create: t.procedure
      .input(z.object({ title: z.string().min(1).max(120) }))
      .mutation(({ ctx, input }) =>
        wrap(() => ctx.service.createProject(ctx.actorId, input.title)),
      ),
  }),

  recipe: t.router({
    create: t.procedure
      .input(projectIdInput.extend({ draft: recipeDraftSchema }))
      .mutation(({ ctx, input }) =>
        wrap(() =>
          ctx.service.createRecipe(ctx.actorId, input.projectId as never, input.draft),
        ),
      ),
    patch: t.procedure
      .input(
        projectIdInput.extend({
          recipeId: z.string().min(1),
          baseVersion: z.number().int().positive(),
          ops: z.array(patchOpSchema).min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        wrap(() =>
          ctx.service.patchRecipe(
            ctx.actorId,
            input.projectId as never,
            input.recipeId as never,
            input.baseVersion,
            input.ops as never,
          ),
        ),
      ),
    fork: t.procedure
      .input(
        z.object({
          source: z.object({
            projectId: z.string().min(1),
            recipeId: z.string().min(1),
            version: z.number().int().positive(),
          }),
          targetProjectId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        wrap(() =>
          ctx.service.forkRecipe(
            ctx.actorId,
            input.source as never,
            input.targetProjectId as never,
          ),
        ),
      ),
    list: t.procedure.input(projectIdInput).query(({ ctx, input }) =>
      wrap(async () => {
        const versions = await ctx.service.listRecipes(input.projectId as never);
        // Map → 可序列化结构（wire 边界）
        return [...versions.entries()].map(([recipeId, chain]) => ({ recipeId, chain }));
      }),
    ),
  }),

  render: t.router({
    request: t.procedure
      .input(
        projectIdInput.extend({
          recipeId: z.string().min(1),
          recipeVersion: z.number().int().positive(),
          adapterId: z.string().min(1),
        }),
      )
      .mutation(({ ctx, input }) =>
        wrap(() =>
          ctx.service.requestRender(
            ctx.actorId,
            input.projectId as never,
            input.recipeId as never,
            input.recipeVersion,
            input.adapterId as never,
          ),
        ),
      ),
    list: t.procedure.input(projectIdInput).query(({ ctx, input }) =>
      wrap(() => ctx.service.listRenders(input.projectId as never)),
    ),
  }),

  take: t.router({
    setStatus: t.procedure
      .input(
        projectIdInput.extend({
          takeId: z.string().min(1),
          status: z.enum(["selected", "discarded"]),
        }),
      )
      .mutation(({ ctx, input }) =>
        wrap(() =>
          ctx.service.setTakeStatus(
            ctx.actorId,
            input.projectId as never,
            input.takeId as never,
            input.status,
          ),
        ),
      ),
    rateAxis: t.procedure
      .input(
        projectIdInput.extend({
          takeId: z.string().min(1),
          axis: z.string().min(1),
          verdict: z.enum(["honored", "partial", "ignored"]),
        }),
      )
      .mutation(({ ctx, input }) =>
        wrap(() =>
          ctx.service.rateTakeAxis(ctx.actorId, input.projectId as never, {
            takeId: input.takeId as never,
            axis: input.axis,
            verdict: input.verdict,
          }),
        ),
      ),
  }),
});

export type AppRouter = typeof appRouter;
export const createCallerFactory = t.createCallerFactory;
