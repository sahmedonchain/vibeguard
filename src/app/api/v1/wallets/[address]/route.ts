import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { addressSchema, parseOrThrow } from "@/lib/api/schemas";
import { getWalletProfile } from "@/lib/analysis/wallet";
import { createChainClient } from "@/lib/chain/client";

export function GET(req: Request, { params }: RouteContext<"/api/v1/wallets/[address]">) {
  return handle(req, LIMITS.analyze, async ({ db, cfg, requestId, headers }) => {
    const address = parseOrThrow(addressSchema, (await params).address);
    const profile = await getWalletProfile(db, createChainClient(cfg), cfg.chainId, cfg.explorerUrl, address);
    return ok(profile, requestId, { headers, meta: { computedAt: profile.computedAt, explorerAvailable: profile.explorerAvailable } });
  });
}
