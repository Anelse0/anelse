/**
 * Adapter 注册表。借 dsh 两条：
 * - 注册是可逆的：register() 返回 disposer；
 * - 重复注册 fails loud（一个组合恰好一个同名 provider）。
 */
import type { ModelAdapter } from "./types.ts";

export class DuplicateAdapterError extends Error {
  constructor(readonly adapterId: string) {
    super(`adapter "${adapterId}" is already registered (exactly one provider per id)`);
    this.name = "DuplicateAdapterError";
  }
}

export interface AdapterRegistry {
  /** 注册一个 adapter；返回注销函数。重复 id 抛 {@link DuplicateAdapterError}。 */
  register(adapter: ModelAdapter): () => void;
  get(id: string): ModelAdapter | undefined;
  list(): readonly ModelAdapter[];
}

export function createAdapterRegistry(): AdapterRegistry {
  const adapters = new Map<string, ModelAdapter>();
  return {
    register(adapter) {
      if (adapters.has(adapter.id)) throw new DuplicateAdapterError(adapter.id);
      adapters.set(adapter.id, adapter);
      return () => {
        // 仅当仍指向同一实例时移除（disposer 幂等且不误删后继注册）
        if (adapters.get(adapter.id) === adapter) adapters.delete(adapter.id);
      };
    },
    get(id) {
      return adapters.get(id);
    },
    list() {
      return [...adapters.values()];
    },
  };
}
