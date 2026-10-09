import type { PublicClient } from "viem";
import { fetchAddressInfo } from "@/lib/chain/explorer-api";
import { withRetry } from "@/lib/retry";

export type Creation = {
  block: number;
  txHash: string | null;
  /** The account that sent the creation transaction (a fact from the chain). */
  txSender: string | null;
  /** Target and 4-byte selector of the creation transaction (a launchpad contract and its create method, for factory launches). */
  txTo: string | null;
  selector: string | null;
  /** The contract/account that executed the CREATE (from the explorer, if available). */
  immediateCreator: string | null;
  source: "explorer" | "bytecode_search";
};

/**
 * Locates a contract's creation block.
 * 1. Explorer gives the creation tx; the block and sender are then read from the RPC (not trusted from the explorer).
 * 2. Fallback: binary search for the first block with code (needs historical state; returns null if unsupported).
 */
export async function findCreation(
  client: Pick<PublicClient, "getTransactionReceipt" | "getTransaction" | "getCode">,
  explorerUrl: string,
  address: `0x${string}`,
  headBlock: number,
): Promise<Creation | null> {
  const info = await fetchAddressInfo(explorerUrl, address);
  if (info?.creationTxHash) {
    try {
      const hash = info.creationTxHash as `0x${string}`;
      const [receipt, tx] = await Promise.all([
        withRetry(() => client.getTransactionReceipt({ hash })),
        withRetry(() => client.getTransaction({ hash })),
      ]);
      return {
        block: Number(receipt.blockNumber),
        txHash: hash,
        txSender: tx.from.toLowerCase(),
        txTo: tx.to ? tx.to.toLowerCase() : null,
        selector: tx.input && tx.input.length >= 10 ? tx.input.slice(0, 10).toLowerCase() : null,
        immediateCreator: info.creator?.toLowerCase() ?? null,
        source: "explorer",
      };
    } catch {
      /* fall through to bytecode search */
    }
  }
  const block = await firstBlockWithCode(client, address, headBlock);
  return block == null ? null : { block, txHash: null, txSender: null, txTo: null, selector: null, immediateCreator: null, source: "bytecode_search" };
}

export async function firstBlockWithCode(
  client: Pick<PublicClient, "getCode">,
  address: `0x${string}`,
  headBlock: number,
): Promise<number | null> {
  const hasCodeAt = async (n: number) => {
    const code = await withRetry(() => client.getCode({ address, blockNumber: BigInt(n) }));
    return Boolean(code && code !== "0x");
  };
  try {
    if (!(await hasCodeAt(headBlock))) return null;
    let lo = 0;
    let hi = headBlock;
    while (lo < hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (await hasCodeAt(mid)) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  } catch {
    return null; // historical state unavailable
  }
}
