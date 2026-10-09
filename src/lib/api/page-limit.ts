import "server-only";
import { headers } from "next/headers";
import type { Db } from "@/db/client";
import { ApiError } from "./errors";
import { clientKey, enforceRateLimit, type Limit } from "./rate-limit";

/** Applies the same rate limit to a server-rendered page as to the API. Throws ApiError (RATE_LIMITED or, for fail-closed limits, PROVIDER_UNAVAILABLE). */
export async function enforcePageLimit(db: Db, limit: Limit): Promise<void> {
  const req = new Request("http://localhost", { headers: await headers() });
  await enforceRateLimit(db, clientKey(req), limit);
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
