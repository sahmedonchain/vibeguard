import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { addressSchema, parseOrThrow } from "@/lib/api/schemas";
import { getCreatorProfile } from "@/lib/analysis/creator-profile";
import { createChainClient } from "@/lib/chain/client";

export function GET(req: Request, { params }: RouteContext<"/api/v1/creators/[address]">) {
  return handle(req, LIMITS.analyze, async ({ db, cfg, requestId, headers }) => {
    const address = parseOrThrow(addressSchema, (await params).address);
    const profile = await getCreatorProfile(db, createChainClient(cfg), cfg.chainId, cfg.explorerUrl, address);
    return ok(profile, requestId, { headers, meta: { computedAt: profile.computedAt, explorerAvailable: profile.explorerAvailable } });
  });
}
