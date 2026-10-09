import type { Db } from "@/db/client";
import type { ChainConfig } from "@/lib/chain/config";
import { getLatestReport, getLatestResultReport, type ScanReport } from "@/lib/scans/report";
import { ApiError } from "./errors";

const STALE_AFTER_MS = 60 * 60 * 1000;

/**
 * Latest completed/partial report for a token, or the ApiError that explains why there is none.
 * `stale` is true when the scan is older than an hour.
 */
export async function latestResultOrThrow(db: Db, cfg: ChainConfig, address: string): Promise<{ report: ScanReport; stale: boolean }> {
  const result = await getLatestResultReport(db, cfg, address);
  if (result) {
    const stale = result.finishedAt ? Date.now() - Date.parse(result.finishedAt) > STALE_AFTER_MS : true;
    return { report: result, stale };
  }
  const latest = await getLatestReport(db, cfg, address);
  if (!latest) throw new ApiError("DATA_UNAVAILABLE", "No scan exists for this token. Start one with POST /api/v1/scans.");
  if (latest.status === "queued" || latest.status === "running") {
    throw new ApiError("SCAN_IN_PROGRESS", "A scan for this token is in progress.", { retryAfterSeconds: 5, extra: { scanId: latest.id } });
  }
  if (latest.status === "unsupported") throw new ApiError("UNSUPPORTED_CONTRACT", latest.error?.message ?? "This contract is not supported.", { extra: { scanId: latest.id } });
  throw new ApiError(latest.error?.code === "PROVIDER_UNAVAILABLE" ? "PROVIDER_UNAVAILABLE" : "SCAN_FAILED", latest.error?.message || "The last scan failed.", { extra: { scanId: latest.id } });
}

/** Fields every token-slice response carries so callers can judge freshness. */
export const freshness = (r: ScanReport) => ({ scanId: r.id, status: r.status, methodologyVersion: r.methodologyVersion, analysis: r.analysis, finishedAt: r.finishedAt });
