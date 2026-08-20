import { create } from "zustand";
import type { RecipeDraft } from "@anselse/recipe";
import { seedDraft } from "./seed.ts";
import type { AdapterId } from "./compile.ts";

interface EditorState {
  draft: RecipeDraft;
  adapterId: AdapterId;
  selectedShot: number;
  setAdapter: (id: AdapterId) => void;
  selectShot: (i: number) => void;
  /** 以不可变方式修改草稿：在克隆上跑 mutator。 */
  patch: (mutator: (draft: RecipeDraft) => void) => void;
}

export const useEditor = create<EditorState>((set) => ({
  draft: seedDraft,
  adapterId: "seedance-2.5",
  selectedShot: 0,
  setAdapter: (id) => set({ adapterId: id }),
  selectShot: (i) => set({ selectedShot: i }),
  patch: (mutator) =>
    set((s) => {
      const draft = structuredClone(s.draft);
      mutator(draft);
      return { draft };
    }),
}));
