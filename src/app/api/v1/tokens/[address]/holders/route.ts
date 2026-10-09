import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { addressSchema, parseOrThrow } from "@/lib/api/schemas";
import { freshness, latestResultOrThrow } from "@/lib/api/token-report";

/** Holder metrics, classification, concentration over time and recent large changes from the latest scan. */
export function GET(req: Request, { params }: RouteContext<"/api/v1/tokens/[address]/holders">) {
  return handle(req, LIMITS.read, async ({ db, cfg, requestId, headers }) => {
    const address = parseOrThrow(addressSchema, (await params).address);
    const { report, stale } = await latestResultOrThrow(db, cfg, address);
    return ok({ ...freshness(report), token: report.token, holders: report.holders, history: report.holderHistory, indexing: report.indexing }, requestId, { headers, meta: { stale } });
  });
}
