import "server-only";
import { getDb, isDatabaseConfigured, type Db } from "@/db/client";
import { getChainConfig, type ChainConfig } from "@/lib/chain/config";
import { ApiError } from "./errors";
import { enforceRateLimit, clientKey, rateHeaders, type Limit } from "./rate-limit";
import { fail, newRequestId } from "./respond";

export type Ctx = { db: Db; cfg: ChainConfig; requestId: string; headers: Record<string, string> };

/** Common pipeline: request ID, DB availability, rate limit, error mapping. */
export async function handle(req: Request, limit: Limit, fn: (ctx: Ctx) => Promise<Response>): Promise<Response> {
  const requestId = newRequestId();
  let headers: Record<string, string> = {};
  try {
    if (!isDatabaseConfigured()) throw new ApiError("PROVIDER_UNAVAILABLE", "The database is not configured on this deployment.");
    const db = getDb();
    headers = rateHeaders(await enforceRateLimit(db, clientKey(req), limit));
    return await fn({ db, cfg: getChainConfig(), requestId, headers });
  } catch (err) {
    // Errors after the limiter ran still report the caller's rate-limit state.
    return fail(err, requestId, headers);
  }
}
