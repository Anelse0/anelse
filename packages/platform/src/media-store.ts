/**
 * MediaStore 接缝：把 provider 产出的视频落到我们自有的对象存储（R2）并返回稳定 URL。
 * Fake Provider 用于开发/测试（确定性 URL）；R2 Provider 接线时替换。
 */
import type { ProjectId } from "@anselse/recipe";
import type { TakeId } from "@anselse/events";

export interface PersistMediaInput {
  projectId: ProjectId;
  takeId: TakeId;
  /** provider 返回的源视频 URL（临时/外部）。 */
  sourceUrl: string;
}

export interface PersistedMedia {
  videoUrl: string;
  thumbUrl?: string;
}

export interface MediaStore {
  persist(input: PersistMediaInput): Promise<PersistedMedia>;
}

/** 确定性 Fake：URL 仅由 (projectId, takeId) 派生，无网络无时钟。 */
export class FakeMediaStore implements MediaStore {
  persist(input: PersistMediaInput): Promise<PersistedMedia> {
    return Promise.resolve({
      videoUrl: `stored://${input.projectId}/${input.takeId}.mp4`,
      thumbUrl: `stored://${input.projectId}/${input.takeId}.jpg`,
    });
  }
}
