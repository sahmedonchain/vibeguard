import { toFunctionSelector } from "viem";

export type CapabilityKey =
  | "owner"
  | "ownership_transfer"
  | "mint"
  | "pause"
  | "blacklist"
  | "whitelist"
  | "fee_control"
  | "trading_control"
  | "limit_control"
  | "upgrade"
  | "role_admin";

/**
 * Function signatures whose presence in bytecode indicates a capability.
 * Selectors are computed from signatures (never hand-typed hex).
 * Presence of a selector shows the dispatcher references it; it does not prove who may call it.
 */
export const CAPABILITY_SIGNATURES: { capability: CapabilityKey; signature: string }[] = [
  { capability: "owner", signature: "owner()" },
  { capability: "ownership_transfer", signature: "transferOwnership(address)" },
  { capability: "mint", signature: "mint(address,uint256)" },
  { capability: "mint", signature: "mint(uint256)" },
  { capability: "mint", signature: "mint(address,uint256,bytes)" },
  { capability: "pause", signature: "pause()" },
  { capability: "pause", signature: "unpause()" },
  { capability: "pause", signature: "setPaused(bool)" },
  { capability: "blacklist", signature: "blacklist(address)" },
  { capability: "blacklist", signature: "unBlacklist(address)" },
  { capability: "blacklist", signature: "addToBlacklist(address)" },
  { capability: "blacklist", signature: "removeFromBlacklist(address)" },
  { capability: "blacklist", signature: "addBlacklist(address)" },
  { capability: "blacklist", signature: "setBlacklist(address,bool)" },
  { capability: "blacklist", signature: "blacklistAddress(address)" },
  { capability: "blacklist", signature: "isBlacklisted(address)" },
  { capability: "blacklist", signature: "setBots(address[])" },
  { capability: "whitelist", signature: "addToWhitelist(address)" },
  { capability: "whitelist", signature: "setWhitelist(address,bool)" },
  { capability: "whitelist", signature: "whitelist(address)" },
  { capability: "fee_control", signature: "setFee(uint256)" },
  { capability: "fee_control", signature: "setFees(uint256,uint256)" },
  { capability: "fee_control", signature: "setTax(uint256)" },
  { capability: "fee_control", signature: "setTaxFee(uint256)" },
  { capability: "fee_control", signature: "setBuyFee(uint256)" },
  { capability: "fee_control", signature: "setSellFee(uint256)" },
  { capability: "fee_control", signature: "setBuyTax(uint256)" },
  { capability: "fee_control", signature: "setSellTax(uint256)" },
  { capability: "fee_control", signature: "updateFees(uint256,uint256)" },
  { capability: "trading_control", signature: "enableTrading()" },
  { capability: "trading_control", signature: "setTradingEnabled(bool)" },
  { capability: "trading_control", signature: "openTrading()" },
  { capability: "trading_control", signature: "setTradingOpen(bool)" },
  { capability: "limit_control", signature: "setMaxTxAmount(uint256)" },
  { capability: "limit_control", signature: "setMaxWalletAmount(uint256)" },
  { capability: "limit_control", signature: "setMaxTransactionAmount(uint256)" },
  { capability: "limit_control", signature: "setMaxWallet(uint256)" },
  { capability: "upgrade", signature: "upgradeTo(address)" },
  { capability: "upgrade", signature: "upgradeToAndCall(address,bytes)" },
  { capability: "upgrade", signature: "proxiableUUID()" },
  { capability: "role_admin", signature: "grantRole(bytes32,address)" },
  { capability: "role_admin", signature: "hasRole(bytes32,address)" },
  { capability: "role_admin", signature: "DEFAULT_ADMIN_ROLE()" },
];

export type SelectorEntry = { capability: CapabilityKey; signature: string; selector: string };

export const SELECTOR_TABLE: SelectorEntry[] = CAPABILITY_SIGNATURES.map((e) => ({ ...e, selector: toFunctionSelector(e.signature) }));

/**
 * Extracts 4-byte values pushed by PUSH4 (0x63) from EVM bytecode, skipping the immediate
 * data of all other PUSH instructions so embedded constants are not misread as opcodes.
 */
export function extractPush4Selectors(bytecode: string): Set<string> {
  const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const out = new Set<string>();
  const len = hex.length / 2;
  for (let i = 0; i < len; ) {
    const op = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (op === 0x63) {
      if (i + 5 <= len) out.add(`0x${hex.slice((i + 1) * 2, (i + 5) * 2)}`);
      i += 5;
    } else if (op >= 0x60 && op <= 0x7f) {
      i += 1 + (op - 0x5f);
    } else {
      i += 1;
    }
  }
  return out;
}

export function matchSelectors(selectors: Set<string>): SelectorEntry[] {
  return SELECTOR_TABLE.filter((e) => selectors.has(e.selector));
}

/** Selectors for functions in a verified ABI. */
export function abiFunctionSignatures(abi: unknown[]): string[] {
  const sigs: string[] = [];
  for (const item of abi) {
    const it = item as { type?: string; name?: string; inputs?: { type: string; components?: unknown[] }[] };
    if (it.type !== "function" || !it.name || !Array.isArray(it.inputs)) continue;
    const t = (i: { type: string; components?: unknown[] }): string =>
      i.type.startsWith("tuple") ? `(${((i.components ?? []) as { type: string; components?: unknown[] }[]).map(t).join(",")})${i.type.slice(5)}` : i.type;
    sigs.push(`${it.name}(${it.inputs.map(t).join(",")})`);
  }
  return sigs;
}
