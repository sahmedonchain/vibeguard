import { keccak256, stringToBytes } from "viem";

const slot = (label: string) => `0x${(BigInt(keccak256(stringToBytes(label))) - 1n).toString(16).padStart(64, "0")}` as `0x${string}`;

/** EIP-1967 storage slots, derived from their specified labels. */
export const EIP1967_IMPLEMENTATION_SLOT = slot("eip1967.proxy.implementation");
export const EIP1967_ADMIN_SLOT = slot("eip1967.proxy.admin");
export const EIP1967_BEACON_SLOT = slot("eip1967.proxy.beacon");

const EIP1167_PREFIX = "363d3d373d3d3d363d73";
const EIP1167_SUFFIX = "5af43d82803e903d91602b57fd5bf3";

/** Returns the implementation of an EIP-1167 minimal proxy (immutable clone), else null. */
export function parseMinimalProxy(bytecode: string): `0x${string}` | null {
  const hex = (bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode).toLowerCase();
  if (!hex.startsWith(EIP1167_PREFIX)) return null;
  const impl = hex.slice(EIP1167_PREFIX.length, EIP1167_PREFIX.length + 40);
  if (impl.length !== 40 || !hex.slice(EIP1167_PREFIX.length + 40).startsWith(EIP1167_SUFFIX)) return null;
  return `0x${impl}`;
}

/** Reads an address from a 32-byte storage word; null for zero/invalid. */
export function addressFromSlot(word: string | undefined | null): `0x${string}` | null {
  if (!word) return null;
  const hex = word.replace(/^0x/, "").padStart(64, "0");
  const addr = hex.slice(24);
  return /^0+$/.test(addr) ? null : (`0x${addr}` as `0x${string}`);
}
