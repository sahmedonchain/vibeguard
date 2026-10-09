import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { addressSchema, parseOrThrow } from "@/lib/api/schemas";
import { getLatestReport, getLatestResultReport } from "@/lib/scans/report";

const STALE_AFTER_MS = 60 * 60 * 1000;

export function GET(req: Request, { params }: RouteContext<"/api/v1/tokens/[address]/risk">) {
  return handle(req, LIMITS.read, async ({ db, cfg, requestId, headers }) => {
    const address = parseOrThrow(addressSchema, (await params).address);
    const result = await getLatestResultReport(db, cfg, address);
    if (result) {
      const stale = result.finishedAt ? Date.now() - Date.parse(result.finishedAt) > STALE_AFTER_MS : true;
      return ok(result, requestId, { headers, meta: { stale } });
    }
    const latest = await getLatestReport(db, cfg, address);
    if (!latest) throw new ApiError("DATA_UNAVAILABLE", "No scan exists for this token. Start one with POST /api/v1/scans.");
    if (latest.status === "queued" || latest.status === "running") {
      throw new ApiError("SCAN_IN_PROGRESS", "A scan for this token is in progress.", { retryAfterSeconds: 5, extra: { scanId: latest.id } });
    }
    if (latest.status === "unsupported") throw new ApiError("UNSUPPORTED_CONTRACT", latest.error?.message ?? "This contract is not supported.", { extra: { scanId: latest.id } });
    throw new ApiError(latest.error?.code === "PROVIDER_UNAVAILABLE" ? "PROVIDER_UNAVAILABLE" : "SCAN_FAILED", latest.error?.message || "The last scan failed.", { extra: { scanId: latest.id } });
  });
}
