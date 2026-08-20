import { create } from "zustand";
import { trpc, type RenderRow } from "./api.ts";
import { useEditor } from "./store.ts";
import type { RecipeDraft } from "@anselse/recipe";

/**
 * 后端会话：保存配方 → 请求渲染 → 轮询渲染工作台。
 * M6.2 MVP：每次"保存并渲染"创建一个配方快照（绑当前模型），跑通
 * 浏览器→事件日志→渲染闭环；编辑→patch→版本演进留待后续。
 */
interface SessionState {
  projectId: string | undefined;
  busy: boolean;
  message: string | undefined;
  renders: RenderRow[];
  saveAndRender: () => Promise<void>;
  refresh: () => Promise<void>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useSession = create<SessionState>((set, get) => ({
  projectId: undefined,
  busy: false,
  message: undefined,
  renders: [],

  async saveAndRender() {
    const { draft, adapterId } = useEditor.getState();
    set({ busy: true, message: undefined });
    try {
      let projectId = get().projectId;
      if (!projectId) {
        const p = await trpc.project.create.mutate({ title: "我的镜头" });
        projectId = p.projectId;
        set({ projectId });
      }
      const bound: RecipeDraft = {
        ...draft,
        binding: { ...draft.binding, targetAdapter: adapterId as RecipeDraft["binding"]["targetAdapter"] },
      };
      const recipe = await trpc.recipe.create.mutate({ projectId, draft: bound });
      const res = await trpc.render.request.mutate({
        projectId,
        recipeId: recipe.meta.id,
        recipeVersion: recipe.meta.version,
        adapterId,
      });
      if (!res.ok) {
        set({ message: `渲染被拒绝：${res.rejections.map((r) => r.message).join("；")}` });
        await get().refresh();
        return;
      }
      // 轮询等待进程内 worker 处理「本次」请求（盯 requestSeq，避免旧行提前中断）
      const targetSeq = res.requestSeq;
      for (let i = 0; i < 12; i++) {
        await get().refresh();
        const row = get().renders.find((r) => r.requestSeq === targetSeq);
        if (row && row.status !== "pending") break;
        await sleep(400);
      }
    } catch (error) {
      set({ message: error instanceof Error ? error.message : String(error) });
    } finally {
      set({ busy: false });
    }
  },

  async refresh() {
    const projectId = get().projectId;
    if (!projectId) return;
    const renders = await trpc.render.list.query({ projectId });
    set({ renders });
  },
}));
