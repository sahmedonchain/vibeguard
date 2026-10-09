import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { addressSchema, parseOrThrow } from "@/lib/api/schemas";
import { freshness, latestResultOrThrow } from "@/lib/api/token-report";

/** Possible-coordination clusters among the token's largest wallet holders. Behavioral similarity only, never identity. */
export function GET(req: Request, { params }: RouteContext<"/api/v1/tokens/[address]/relationships">) {
  return handle(req, LIMITS.read, async ({ db, cfg, requestId, headers }) => {
    const address = parseOrThrow(addressSchema, (await params).address);
    const { report, stale } = await latestResultOrThrow(db, cfg, address);
    const findings = report.findings.filter((f) => f.category === "suspicious");
    return ok({ ...freshness(report), sybil: report.sybil, findings }, requestId, { headers, meta: { stale } });
  });
}
