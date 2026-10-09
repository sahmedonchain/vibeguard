import { keccak256, parseAbi, zeroAddress, type PublicClient } from "viem";
import { fetchContractInfo } from "@/lib/chain/explorer-api";
import { errorMessage, isTransientError, withRetry } from "@/lib/retry";
import { EIP1967_ADMIN_SLOT, EIP1967_BEACON_SLOT, EIP1967_IMPLEMENTATION_SLOT, addressFromSlot, parseMinimalProxy } from "./proxy";
import { SELECTOR_TABLE, abiFunctionSignatures, extractPush4Selectors, matchSelectors, type CapabilityKey } from "./selectors";

export type DetectedCapability = {
  capability: CapabilityKey;
  signature: string;
  selector: string;
  via: "abi" | "bytecode_selector";
  confidence: "high" | "medium";
};

export type ContractAnalysis = {
  analysisBlock: number;
  hasCode: boolean;
  codeSize: number;
  codeHash: string | null;
  erc20: {
    isErc20Like: boolean;
    name: string | null;
    symbol: string | null;
    decimals: number | null;
    totalSupply: string | null;
    /** Interface members that could not be read (revert or no data). */
    missing: string[];
  };
  owner: { state: "none" | "renounced" | "active" | "unknown"; address: string | null; isContract: boolean | null };
  proxy: {
    type: "none" | "minimal" | "eip1967" | "beacon";
    implementation: string | null;
    admin: string | null;
    /** minimal = immutable clone; eip1967 = admin may change logic; beacon = beacon owner may change logic. */
    upgradeable: boolean;
  };
  capabilities: DetectedCapability[];
  source: { checked: boolean; verified: boolean | null; name: string | null };
  bytecode: { analyzedAddress: string | null; analyzedFrom: "token" | "implementation" | "unavailable" };
  /** Reads that failed for transport/provider reasons (not reverts). Rules using them must report unknown. */
  failures: string[];
};

const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
]);

type CallOutcome<T> = { ok: true; value: T } | { ok: false; kind: "revert" | "error" };

async function safeRead<T>(fn: () => Promise<T>): Promise<CallOutcome<T>> {
  try {
    return { ok: true, value: await withRetry(fn) };
  } catch (err) {
    const msg = errorMessage(err);
    if (isTransientError(err) && !/revert|returned no data|zero data|not a function/i.test(msg)) return { ok: false, kind: "error" };
    return { ok: false, kind: /revert|returned no data|zero data|not a function|could not decode|position .* out of bounds/i.test(msg) ? "revert" : "error" };
  }
}

type Reader = Pick<PublicClient, "getCode" | "readContract" | "getStorageAt">;

export async function analyzeContract(
  client: Reader,
  explorerUrl: string | null,
  address: `0x${string}`,
  blockNumber: number,
): Promise<ContractAnalysis> {
  const bn = BigInt(blockNumber);
  const failures: string[] = [];
  const code = await safeRead(() => client.getCode({ address, blockNumber: bn }));
  if (!code.ok) throw new Error(`Could not read contract code at block ${blockNumber}`);
  const bytecode = code.value && code.value !== "0x" ? code.value : null;
  const base: ContractAnalysis = {
    analysisBlock: blockNumber,
    hasCode: Boolean(bytecode),
    codeSize: bytecode ? (bytecode.length - 2) / 2 : 0,
    codeHash: bytecode ? keccak256(bytecode) : null,
    erc20: { isErc20Like: false, name: null, symbol: null, decimals: null, totalSupply: null, missing: [] },
    owner: { state: "unknown", address: null, isContract: null },
    proxy: { type: "none", implementation: null, admin: null, upgradeable: false },
    capabilities: [],
    source: { checked: false, verified: null, name: null },
    bytecode: { analyzedAddress: null, analyzedFrom: "unavailable" },
    failures,
  };
  if (!bytecode) return base;

  const read = <T>(functionName: string, args?: readonly unknown[]) =>
    safeRead(() => client.readContract({ address, abi: ERC20_ABI, functionName: functionName as never, args: args as never, blockNumber: bn }) as Promise<T>);

  const [name, symbol, decimals, totalSupply, balanceOf, owner] = await Promise.all([
    read<string>("name"),
    read<string>("symbol"),
    read<number>("decimals"),
    read<bigint>("totalSupply"),
    read<bigint>("balanceOf", [zeroAddress]),
    read<string>("owner"),
  ]);
  const used = { name, symbol, decimals, totalSupply, balanceOf, owner } as const;
  for (const [k, v] of Object.entries(used)) {
    if (!v.ok) {
      base.erc20.missing.push(k);
      if (v.kind === "error") failures.push(k);
    }
  }
  base.erc20.name = name.ok ? name.value : null;
  base.erc20.symbol = symbol.ok ? symbol.value : null;
  base.erc20.decimals = decimals.ok ? Number(decimals.value) : null;
  base.erc20.totalSupply = totalSupply.ok ? totalSupply.value.toString() : null;
  base.erc20.isErc20Like = totalSupply.ok && balanceOf.ok;

  // Owner
  if (owner.ok) {
    const ownerAddr = owner.value.toLowerCase();
    if (ownerAddr === zeroAddress) base.owner = { state: "renounced", address: ownerAddr, isContract: null };
    else {
      const ownerCode = await safeRead(() => client.getCode({ address: ownerAddr as `0x${string}`, blockNumber: bn }));
      base.owner = { state: "active", address: ownerAddr, isContract: ownerCode.ok ? Boolean(ownerCode.value && ownerCode.value !== "0x") : null };
    }
  } else if (owner.kind === "revert") base.owner = { state: "none", address: null, isContract: null };

  // Proxy detection and the bytecode whose selectors we scan.
  let scanAddress = address;
  let scanCode: string | null = bytecode;
  let analyzedFrom: ContractAnalysis["bytecode"]["analyzedFrom"] = "token";
  const minimal = parseMinimalProxy(bytecode);
  if (minimal) {
    base.proxy = { type: "minimal", implementation: minimal, admin: null, upgradeable: false };
  } else {
    const [implSlot, adminSlot, beaconSlot] = await Promise.all([
      safeRead(() => client.getStorageAt({ address, slot: EIP1967_IMPLEMENTATION_SLOT, blockNumber: bn })),
      safeRead(() => client.getStorageAt({ address, slot: EIP1967_ADMIN_SLOT, blockNumber: bn })),
      safeRead(() => client.getStorageAt({ address, slot: EIP1967_BEACON_SLOT, blockNumber: bn })),
    ]);
    if (!implSlot.ok || !adminSlot.ok || !beaconSlot.ok) failures.push("proxy_slots");
    const impl = implSlot.ok ? addressFromSlot(implSlot.value) : null;
    const beacon = beaconSlot.ok ? addressFromSlot(beaconSlot.value) : null;
    const admin = adminSlot.ok ? addressFromSlot(adminSlot.value) : null;
    if (impl) base.proxy = { type: "eip1967", implementation: impl, admin, upgradeable: true };
    else if (beacon) base.proxy = { type: "beacon", implementation: null, admin, upgradeable: true };
  }
  if (base.proxy.implementation) {
    const implCode = await safeRead(() => client.getCode({ address: base.proxy.implementation as `0x${string}`, blockNumber: bn }));
    if (implCode.ok && implCode.value && implCode.value !== "0x") {
      scanAddress = base.proxy.implementation as `0x${string}`;
      scanCode = implCode.value;
      analyzedFrom = "implementation";
    } else {
      scanCode = null;
      analyzedFrom = "unavailable";
      failures.push("implementation_code");
    }
  } else if (base.proxy.type === "beacon") {
    scanCode = null;
    analyzedFrom = "unavailable";
  }
  base.bytecode = { analyzedAddress: scanCode ? scanAddress.toLowerCase() : null, analyzedFrom };

  // Verified source (optional explorer adapter) and capability detection.
  const caps = new Map<string, DetectedCapability>();
  if (scanCode) {
    for (const m of matchSelectors(extractPush4Selectors(scanCode))) {
      caps.set(m.signature, { capability: m.capability, signature: m.signature, selector: m.selector, via: "bytecode_selector", confidence: "medium" });
    }
    if (explorerUrl) {
      const info = await fetchContractInfo(explorerUrl, scanAddress);
      base.source = { checked: info !== null, verified: info ? info.verified : null, name: info?.name ?? null };
      if (info?.verified && info.abi) {
        const abiSigs = new Set(abiFunctionSignatures(info.abi));
        for (const e of SELECTOR_TABLE) {
          if (abiSigs.has(e.signature)) caps.set(e.signature, { capability: e.capability, signature: e.signature, selector: e.selector, via: "abi", confidence: "high" });
        }
        // With a verified ABI, a selector in bytecode that is absent from the ABI is not a callable function.
        for (const [sig, c] of caps) if (c.via === "bytecode_selector" && !abiSigs.has(sig)) caps.delete(sig);
      }
    }
  }
  base.capabilities = [...caps.values()].sort((a, b) => a.signature.localeCompare(b.signature));
  return base;
}
