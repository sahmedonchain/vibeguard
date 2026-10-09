import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { addressSchema, parseOrThrow } from "@/lib/api/schemas";
import { latestResultOrThrow } from "@/lib/api/token-report";

export function GET(req: Request, { params }: RouteContext<"/api/v1/tokens/[address]/risk">) {
  return handle(req, LIMITS.read, async ({ db, cfg, requestId, headers }) => {
    const address = parseOrThrow(addressSchema, (await params).address);
    const { report, stale } = await latestResultOrThrow(db, cfg, address);
    return ok(report, requestId, { headers, meta: { stale } });
  });
}
