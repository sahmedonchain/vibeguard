import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { rateLimitCounters } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { ApiError } from "./errors";

export type Limit = { name: string; max: number; windowSeconds: number };

export const LIMITS = {
  createScan: { name: "create-scan", max: 10, windowSeconds: 60 },
  read: { name: "read", max: 120, windowSeconds: 60 },
} as const satisfies Record<string, Limit>;

/** Identifies a client without storing its IP: HMAC with a server secret. */
export function clientKey(req: Request, secret = getEnv().RATE_LIMIT_SECRET): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  return createHmac("sha256", secret).update(fwd).digest("hex").slice(0, 32);
}

export type RateLimitState = { limit: number; remaining: number; resetSeconds: number };

/**
 * Fixed-window limiter backed by Postgres, so it holds across serverless instances.
 * Throws RATE_LIMITED when exceeded. If the DB is unreachable the request is allowed
 * (fail-open) because blocking all reads on a limiter outage is worse; scans are still bounded by the queue.
 */
export async function enforceRateLimit(db: Db, key: string, limit: Limit, now = Date.now()): Promise<RateLimitState> {
  const windowMs = limit.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const resetSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
  let count: number;
  try {
    const [row] = await db
      .insert(rateLimitCounters)
      .values({ key: `${limit.name}:${key}`, windowStart, count: 1 })
      .onConflictDoUpdate({ target: [rateLimitCounters.key, rateLimitCounters.windowStart], set: { count: sql`${rateLimitCounters.count} + 1` } })
      .returning({ count: rateLimitCounters.count });
    count = row.count;
    // Opportunistic cleanup keeps the table small.
    if (Math.random() < 0.01) await db.delete(rateLimitCounters).where(sql`${rateLimitCounters.windowStart} < now() - interval '1 hour'`).catch(() => undefined);
  } catch (err) {
    console.error("rate limiter unavailable", err instanceof Error ? err.message : err);
    return { limit: limit.max, remaining: limit.max, resetSeconds };
  }
  const state = { limit: limit.max, remaining: Math.max(0, limit.max - count), resetSeconds };
  if (count > limit.max) throw new ApiError("RATE_LIMITED", "Too many requests. Slow down and retry later.", { retryAfterSeconds: resetSeconds });
  return state;
}

export const rateHeaders = (s: RateLimitState): Record<string, string> => ({
  "x-ratelimit-limit": String(s.limit),
  "x-ratelimit-remaining": String(s.remaining),
  "x-ratelimit-reset": String(s.resetSeconds),
});
