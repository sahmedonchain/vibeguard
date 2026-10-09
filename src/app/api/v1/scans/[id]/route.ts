import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { uuidSchema } from "@/lib/api/schemas";
import { buildReport } from "@/lib/scans/report";

export function GET(req: Request, { params }: RouteContext<"/api/v1/scans/[id]">) {
  return handle(req, LIMITS.read, async ({ db, cfg, requestId, headers }) => {
    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) throw new ApiError("DATA_UNAVAILABLE", "No scan exists with this ID.");
    const report = await buildReport(db, cfg, id);
    if (!report) throw new ApiError("DATA_UNAVAILABLE", "No scan exists with this ID.");
    return ok(report, requestId, { headers });
  });
}
