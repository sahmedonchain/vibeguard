import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { analysisCache } from "@/db/schema";

/**
 * Returns a cached payload younger than `ttlSeconds`, otherwise computes and stores one.
 * Payloads that report the explorer as unavailable are not stored, so a provider outage is not cached.
 */
export async function cached<T extends { explorerAvailable: boolean }>(db: Db, chainId: number, kind: string, address: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const [row] = await db
    .select()
    .from(analysisCache)
    .where(and(eq(analysisCache.chainId, chainId), eq(analysisCache.kind, kind), eq(analysisCache.address, address), sql`${analysisCache.computedAt} > now() - make_interval(secs => ${ttlSeconds})`));
  if (row) return row.payload as T;
  const payload = await compute();
  if (payload.explorerAvailable) {
    await db
      .insert(analysisCache)
      .values({ chainId, kind, address, payload })
      .onConflictDoUpdate({ target: [analysisCache.chainId, analysisCache.kind, analysisCache.address], set: { payload, computedAt: sql`now()` } });
  }
  return payload;
}
