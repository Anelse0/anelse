/**
 * Postgres 连接工厂（Supabase）。用离散参数而非 URL，规避密码特殊字符编码问题。
 * ssl: 'require' —— Supabase 强制 TLS。
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.ts";

export interface DbEnv {
  PGHOST?: string;
  PGPORT?: string;
  PGUSER?: string;
  PGPASSWORD?: string;
  PGDATABASE?: string;
}

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface DbHandle {
  sql: postgres.Sql;
  db: Db;
  close(): Promise<void>;
}

/** 从环境变量建连接。缺任一必需变量即 fail loud。 */
export function createDb(env: DbEnv = process.env): DbHandle {
  const { PGHOST, PGUSER, PGPASSWORD, PGDATABASE } = env;
  if (!PGHOST || !PGUSER || !PGPASSWORD || !PGDATABASE) {
    throw new Error("createDb: missing PGHOST/PGUSER/PGPASSWORD/PGDATABASE");
  }
  const sql = postgres({
    host: PGHOST,
    port: Number(env.PGPORT ?? 5432),
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE,
    ssl: "require",
    max: 5,
  });
  return { sql, db: drizzle(sql, { schema }), close: () => sql.end({ timeout: 5 }) };
}

/** 是否配置了数据库连接（集成测试据此自跳过——借 dsh e2e 无 key 自跳过）。 */
export function hasDbEnv(env: DbEnv = process.env): boolean {
  return Boolean(env.PGHOST && env.PGUSER && env.PGPASSWORD && env.PGDATABASE);
}
