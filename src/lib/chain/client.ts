import { createPublicClient, defineChain, http, webSocket, type PublicClient } from "viem";
import { getChainConfig, type ChainConfig } from "./config";

export function buildChain(cfg: ChainConfig) {
  return defineChain({
    id: cfg.chainId,
    name: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    rpcUrls: {
      default: { http: [cfg.rpcHttpUrl], ...(cfg.rpcWsUrl ? { webSocket: [cfg.rpcWsUrl] } : {}) },
    },
    blockExplorers: { default: { name: "Blockscout", url: cfg.explorerUrl } },
  });
}

export function createChainClient(cfg: ChainConfig = getChainConfig()): PublicClient {
  return createPublicClient({
    chain: buildChain(cfg),
    transport: http(cfg.rpcHttpUrl, { retryCount: 3, retryDelay: 500, timeout: 15_000 }),
  });
}

export function createChainWsClient(cfg: ChainConfig = getChainConfig()): PublicClient | undefined {
  if (!cfg.rpcWsUrl) return undefined;
  return createPublicClient({ chain: buildChain(cfg), transport: webSocket(cfg.rpcWsUrl) });
}

/** Verifies the configured RPC serves the configured chain ID. Throws on mismatch. */
export async function assertChainId(client: PublicClient, expected: number): Promise<void> {
  const actual = await client.getChainId();
  if (actual !== expected) throw new Error(`RPC chain ID ${actual} does not match configured ${expected}`);
}
