import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let db: ReturnType<typeof createDb> | undefined;

function createDb(url: string) {
  return drizzle(new Pool({ connectionString: url, max: 10 }), { schema });
}

/** Lazy so builds and pages without DB access never need DATABASE_URL. */
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return (db ??= createDb(url));
}
