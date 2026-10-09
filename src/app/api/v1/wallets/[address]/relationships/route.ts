import { handle } from "@/lib/api/handler";
import { LIMITS } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/respond";
import { addressSchema, parseOrThrow } from "@/lib/api/schemas";
import { getWalletProfile } from "@/lib/analysis/wallet";
import { walletGraph } from "@/lib/analysis/graph";
import { createChainClient } from "@/lib/chain/client";

/** Observed interaction graph of a wallet: its counterparties and funding source. Edges are transactions, not ownership. */
export function GET(req: Request, { params }: RouteContext<"/api/v1/wallets/[address]/relationships">) {
  return handle(req, LIMITS.analyze, async ({ db, cfg, requestId, headers }) => {
    const address = parseOrThrow(addressSchema, (await params).address);
    const profile = await getWalletProfile(db, createChainClient(cfg), cfg.chainId, cfg.explorerUrl, address);
    return ok({ address: profile.address, explorerAvailable: profile.explorerAvailable, sample: profile.sample, graph: walletGraph(profile) }, requestId, { headers, meta: { computedAt: profile.computedAt } });
  });
}
