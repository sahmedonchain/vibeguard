import { z } from "zod";

/**
 * Chain configuration. Defaults are values verified against official docs
 * (docs.robinhood.com/chain/connecting) and live RPC probes; see docs/CHAIN_DISCOVERY.md.
 * Anything unverified has NO default and must come from env.
 */
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "invalid address");
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const envSchema = z.object({
  VIBEVIBE_CHAIN_ID: z.coerce.number().int().positive().default(46630),
  VIBEVIBE_NETWORK_NAME: z.string().min(1).default("Robinhood Chain Testnet"),
  VIBEVIBE_RPC_HTTP_URL: z.url().default("https://rpc.testnet.chain.robinhood.com"),
  VIBEVIBE_RPC_WS_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  VIBEVIBE_EXPLORER_URL: z.url().default("https://explorer.testnet.chain.robinhood.com"),
  /** Observed on the public RPC (error: "only 30000 are allowed"); not documented officially. */
  GETLOGS_MAX_BLOCK_RANGE: z.coerce.number().int().positive().default(30_000),
  /** Observed: with an address filter the public RPC accepted a 20M-block span. Indexer splits adaptively if a provider rejects it. */
  GETLOGS_ADDRESS_MAX_BLOCK_RANGE: z.coerce.number().int().positive().default(2_000_000),
  /** Optional and unverified: no official VibeVibe factory address is published. Not used for discovery yet. */
  VIBEVIBE_FACTORY_ADDRESS: z.preprocess(emptyToUndefined, addressSchema.optional()),
  VIBEVIBE_FACTORY_START_BLOCK: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().optional()),
});

export type ChainConfig = {
  chainId: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: 18 };
  rpcHttpUrl: string;
  rpcWsUrl: string | undefined;
  explorerUrl: string;
  getLogsMaxBlockRange: number;
  getLogsAddressMaxBlockRange: number;
  vibevibeFactory: { address: `0x${string}`; startBlock: number | undefined } | undefined;
};

export function parseChainConfig(env: Record<string, string | undefined>): ChainConfig {
  const e = envSchema.parse(env);
  return {
    chainId: e.VIBEVIBE_CHAIN_ID,
    name: e.VIBEVIBE_NETWORK_NAME,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcHttpUrl: e.VIBEVIBE_RPC_HTTP_URL,
    rpcWsUrl: e.VIBEVIBE_RPC_WS_URL,
    explorerUrl: e.VIBEVIBE_EXPLORER_URL.replace(/\/+$/, ""),
    getLogsMaxBlockRange: e.GETLOGS_MAX_BLOCK_RANGE,
    getLogsAddressMaxBlockRange: e.GETLOGS_ADDRESS_MAX_BLOCK_RANGE,
    vibevibeFactory: e.VIBEVIBE_FACTORY_ADDRESS
      ? { address: e.VIBEVIBE_FACTORY_ADDRESS as `0x${string}`, startBlock: e.VIBEVIBE_FACTORY_START_BLOCK }
      : undefined,
  };
}

let cached: ChainConfig | undefined;
export function getChainConfig(): ChainConfig {
  // Server-only: chain config is never read in client bundles (SRS 26.3).
  cached ??= parseChainConfig(process.env);
  return cached;
}
