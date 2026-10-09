import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { createScanBody, parseOrThrow, readJsonBody } from "@/lib/api/schemas";
import { createScan } from "@/lib/scans/queue";
import { buildReport } from "@/lib/scans/report";

export function POST(req: Request) {
  return handle(req, LIMITS.createScan, async ({ db, cfg, requestId, headers }) => {
    const body = parseOrThrow(createScanBody, await readJsonBody(req));
    if (body.chainId !== undefined && body.chainId !== cfg.chainId) {
      throw new ApiError("UNSUPPORTED_NETWORK", `Only chain ${cfg.chainId} (${cfg.name}) is supported.`);
    }
    const { scan, disposition } = await createScan(db, cfg, body.address);
    const report = await buildReport(db, cfg, scan.id);
    return ok(report, requestId, {
      status: disposition === "recent" ? 200 : 202,
      headers: { ...headers, location: `/api/v1/scans/${scan.id}` },
      meta: { disposition },
    });
  });
}
