import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { scans, tokens } from "@/db/schema";
import type { ChainConfig } from "@/lib/chain/config";
import { ensureReferenceData } from "./setup";

export type ScanRow = typeof scans.$inferSelect;
export type CreateScanOutcome = { scan: ScanRow; disposition: "created" | "active" | "recent" };

/** A completed or unsupported scan this young is returned instead of starting a new one. Partial scans are always retried. */
export const RECENT_SCAN_SECONDS = 120;
/** A running scan with no progress for this long is returned to the queue. */
export const STALE_RUNNING_SECONDS = 600;

/**
 * Registers a user-submitted token and enqueues a scan, or returns the active/recent one.
 * Race-safe: a partial unique index allows one active scan per token.
 */
export async function createScan(db: Db, cfg: ChainConfig, address: string): Promise<CreateScanOutcome> {
  const token = address.toLowerCase();
  await ensureReferenceData(db, cfg);
  await db.insert(tokens).values({ chainId: cfg.chainId, address: token, discoverySource: "user_submitted" }).onConflictDoNothing();

  const find = async (): Promise<CreateScanOutcome | null> => {
    const [active] = await db
      .select()
      .from(scans)
      .where(and(eq(scans.chainId, cfg.chainId), eq(scans.tokenAddress, token), inArray(scans.status, ["queued", "running"])));
    if (active) return { scan: active, disposition: "active" };
    const [recent] = await db
      .select()
      .from(scans)
      .where(and(eq(scans.chainId, cfg.chainId), eq(scans.tokenAddress, token), inArray(scans.status, ["completed", "unsupported"]), sql`${scans.finishedAt} > now() - make_interval(secs => ${RECENT_SCAN_SECONDS})`))
      .orderBy(desc(scans.requestedAt))
      .limit(1);
    return recent ? { scan: recent, disposition: "recent" } : null;
  };

  const existing = await find();
  if (existing) return existing;
  const inserted = await db.insert(scans).values({ chainId: cfg.chainId, tokenAddress: token, status: "queued" }).onConflictDoNothing().returning();
  if (inserted[0]) return { scan: inserted[0], disposition: "created" };
  const raced = await find();
  if (raced) return raced;
  throw new Error("Could not create or find a scan");
}

/** Atomically moves the oldest queued scan to running. Safe with multiple workers. */
export async function claimNextScan(db: Db): Promise<ScanRow | null> {
  await db.execute(
    sql`UPDATE scans SET status = 'queued', started_at = NULL WHERE status = 'running' AND started_at < now() - make_interval(secs => ${STALE_RUNNING_SECONDS})`,
  ).catch(() => undefined);
  const res = await db.execute<{ id: string }>(
    sql`UPDATE scans SET status = 'running', started_at = now()
        WHERE id = (SELECT id FROM scans WHERE status = 'queued' ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING id`,
  );
  const id = res.rows[0]?.id;
  if (!id) return null;
  const [row] = await db.select().from(scans).where(eq(scans.id, id));
  return row ?? null;
}
