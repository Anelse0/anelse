/**
 * 建表迁移执行器：按文件名顺序跑 migrations/*.sql。幂等（SQL 用 IF NOT EXISTS）。
 * 用法：node --experimental-strip-types packages/db/src/migrate.ts（需 .env 已加载）。
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createDb } from "./client.ts";

export async function runMigrations(): Promise<string[]> {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { sql, close } = createDb();
  const applied: string[] = [];
  try {
    for (const file of files) {
      await sql.unsafe(readFileSync(join(dir, file), "utf8"));
      applied.push(file);
    }
  } finally {
    await close();
  }
  return applied;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then((applied) => {
      console.log(`migrations applied: ${applied.join(", ") || "(none)"}`);
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
