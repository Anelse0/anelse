/** 通用运行时依赖（server 与 worker 共享），显式注入以便测试确定化。 */

export interface IdGenerator {
  /** 生成带前缀的全局唯一 id（如 `p_…`/`r_…`/`t_…`）。 */
  newId(prefix: string): string;
}

export interface Clock {
  now(): number;
}
