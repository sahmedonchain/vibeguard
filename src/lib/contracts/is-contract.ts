import type { PublicClient } from "viem";
import { withRetry } from "@/lib/retry";

/** True for deployed contract code. EIP-7702 delegated accounts (0xef0100 + address) are externally owned. */
export function isContractCode(code: string | undefined): boolean {
  return Boolean(code && code !== "0x" && !(code.length === 48 && code.toLowerCase().startsWith("0xef0100")));
}

export async function isContractAt(client: Pick<PublicClient, "getCode">, address: string, blockNumber?: number): Promise<boolean> {
  const code = await withRetry(() => client.getCode({ address: address as `0x${string}`, ...(blockNumber !== undefined ? { blockNumber: BigInt(blockNumber) } : {}) }));
  return isContractCode(code);
}

const ERC20_PROBE_ABI = [
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/** ERC-20-like: answers totalSupply() and balanceOf(address). Same test the scanner uses; false on any read failure. */
export async function isErc20Like(client: Pick<PublicClient, "readContract">, address: string): Promise<boolean> {
  const to = address as `0x${string}`;
  try {
    await client.readContract({ address: to, abi: ERC20_PROBE_ABI, functionName: "totalSupply" });
    await client.readContract({ address: to, abi: ERC20_PROBE_ABI, functionName: "balanceOf", args: ["0x0000000000000000000000000000000000000000"] });
    return true;
  } catch {
    return false;
  }
}
