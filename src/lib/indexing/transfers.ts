import { zeroAddress } from "viem";
import type { RawLog } from "./logs";

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as const;

export type Transfer = {
  blockNumber: number;
  blockHash: string;
  txHash: string;
  logIndex: number;
  from: string;
  to: string;
  value: bigint;
};

export type DecodeResult = { transfers: Transfer[]; skipped: number };

const topicToAddress = (t: string) => `0x${t.slice(26)}`.toLowerCase();

/**
 * Decodes ERC-20 Transfer logs. ERC-721 Transfer shares topic0 but has 4 topics and no
 * value in data; those and any malformed logs are skipped and counted, never guessed at.
 */
export function decodeTransferLogs(logs: RawLog[]): DecodeResult {
  const transfers: Transfer[] = [];
  let skipped = 0;
  for (const l of logs) {
    if (l.topics.length !== 3 || l.topics[0] !== TRANSFER_TOPIC || l.data.length !== 66) {
      skipped++;
      continue;
    }
    transfers.push({
      blockNumber: Number(l.blockNumber),
      blockHash: l.blockHash,
      txHash: l.transactionHash,
      logIndex: l.logIndex,
      from: topicToAddress(l.topics[1]),
      to: topicToAddress(l.topics[2]),
      value: BigInt(l.data),
    });
  }
  return { transfers, skipped };
}

/** Drops repeated (txHash, logIndex) events, keeping the first. */
export function dedupeTransfers(transfers: Transfer[]): Transfer[] {
  const seen = new Set<string>();
  return transfers.filter((t) => {
    const k = `${t.txHash}:${t.logIndex}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export type BalanceState = {
  /** Holder balances; the zero address is never a key. */
  balances: Map<string, bigint>;
  minted: bigint;
  /** Value sent to the zero address. */
  burnedToZero: bigint;
  /** Count of transfers that would have made a balance negative (index is incomplete or inconsistent). */
  negativeBalanceEvents: number;
};

/**
 * Derives balances from a complete, ordered transfer history.
 * Mint = from zero address; burn = to zero address. Supply = minted - burnedToZero.
 */
export function computeBalances(transfers: Iterable<Pick<Transfer, "from" | "to" | "value">>): BalanceState {
  const balances = new Map<string, bigint>();
  let minted = 0n;
  let burnedToZero = 0n;
  let negativeBalanceEvents = 0;
  for (const t of transfers) {
    if (t.value === 0n) continue;
    if (t.from === zeroAddress) minted += t.value;
    else {
      const next = (balances.get(t.from) ?? 0n) - t.value;
      if (next < 0n) negativeBalanceEvents++;
      if (next === 0n) balances.delete(t.from);
      else balances.set(t.from, next);
    }
    if (t.to === zeroAddress) burnedToZero += t.value;
    else balances.set(t.to, (balances.get(t.to) ?? 0n) + t.value);
  }
  return { balances, minted, burnedToZero, negativeBalanceEvents };
}
