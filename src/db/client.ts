import net from "node:net";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Node's 250ms default per-address attempt is too short for some managed Postgres hosts
// (observed: Neon from a dual-stack host fails with ETIMEDOUT/ENETUNREACH).
net.setDefaultAutoSelectFamilyAttemptTimeout(3000);

export type Db = ReturnType<typeof createDb>;

function createDb(url: string) {
  const pool = new Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 10_000 });
  return Object.assign(drizzle(pool, { schema }), { pool });
}

let db: Db | undefined;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Lazy so builds and pages that never touch the DB do not need DATABASE_URL. */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return (db ??= createDb(url));
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.pool.end();
    db = undefined;
  }
}
