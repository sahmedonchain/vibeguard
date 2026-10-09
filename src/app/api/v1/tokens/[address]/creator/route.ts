import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { addressSchema, parseOrThrow } from "@/lib/api/schemas";
import { freshness, latestResultOrThrow } from "@/lib/api/token-report";

/** Creator facts observed at scan time. The full profile is at /api/v1/creators/{address}. */
export function GET(req: Request, { params }: RouteContext<"/api/v1/tokens/[address]/creator">) {
  return handle(req, LIMITS.read, async ({ db, cfg, requestId, headers }) => {
    const address = parseOrThrow(addressSchema, (await params).address);
    const { report, stale } = await latestResultOrThrow(db, cfg, address);
    const findings = report.findings.filter((f) => f.category === "creator" || f.ruleId === "VG-HLD-003");
    return ok({ ...freshness(report), creator: report.token?.creator ?? null, immediateCreator: report.token?.immediateCreator ?? null, analysis: report.creator, findings }, requestId, { headers, meta: { stale } });
  });
}
