import type { ChainConfig } from "./config";

export type CapabilityStatus = "verified" | "observed" | "unresolved";

export type Capability = { key: string; label: string; status: CapabilityStatus; detail: string };

/**
 * What VibeGuard may rely on. "verified" = official docs or deterministic live probe;
 * "observed" = seen in practice, not documented; "unresolved" = unknown, feature must degrade.
 * Source of truth for evidence: docs/CHAIN_DISCOVERY.md.
 */
export function getCapabilities(cfg: ChainConfig): Capability[] {
  return [
    { key: "evm", label: "EVM compatible", status: "verified", detail: "Arbitrum Nitro L2; eth_* JSON-RPC and viem work." },
    { key: "logs", label: "eth_getLogs", status: "observed", detail: `Public RPC caps address-less queries at ${cfg.getLogsMaxBlockRange} blocks and any query at 10000 results. Address-filtered spans of 20M blocks were accepted.` },
    { key: "ws", label: "WebSocket RPC", status: cfg.rpcWsUrl ? "observed" : "unresolved", detail: cfg.rpcWsUrl ? "Configured via env." : "Public WS endpoint not documented; Alchemy WS needs an API key. Polling is used." },
    { key: "explorer-api", label: "Explorer API (Blockscout v2)", status: "observed", detail: "/api/v2 responds; no published rate limit." },
    { key: "factory", label: "VibeVibe token factory", status: cfg.vibevibeFactory ? "observed" : "unresolved", detail: cfg.vibevibeFactory ? "Configured via env; not officially confirmed." : "No official address published. Token discovery uses user-submitted addresses." },
    { key: "rate-limits", label: "RPC rate limits", status: "unresolved", detail: "Public endpoints are rate-limited with no numeric limits documented." },
  ];
}
