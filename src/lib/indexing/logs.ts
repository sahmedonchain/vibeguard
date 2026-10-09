import type { PublicClient } from "viem";
import { errorMessage, withRetry } from "@/lib/retry";

export type RawLog = {
  address: `0x${string}`;
  topics: readonly `0x${string}`[];
  data: `0x${string}`;
  blockNumber: bigint;
  blockHash: `0x${string}`;
  transactionHash: `0x${string}`;
  logIndex: number;
};

/** Provider errors that mean "ask for less", not "try again". */
export function isRangeLimitError(err: unknown): boolean {
  return /exceeds limit|query spans|only \d+ are allowed|narrow the block range|too many results|response size|range is too large|block range|limit exceeded|more than \d+ results/i.test(errorMessage(err));
}

export type GetLogsParams = {
  address: `0x${string}`;
  topics: (`0x${string}` | null)[];
  fromBlock: number;
  toBlock: number;
  /** Max span of one request (provider limit). */
  maxRange: number;
};

/**
 * Fetches logs over [fromBlock, toBlock], splitting the range when the provider rejects it
 * as too large or too dense. Transient errors are retried with bounded backoff.
 * Returned logs are sorted by (block, logIndex).
 */
export async function getLogsAdaptive(client: Pick<PublicClient, "request">, p: GetLogsParams): Promise<RawLog[]> {
  const out: RawLog[] = [];
  const stack: [number, number][] = [];
  for (let from = p.fromBlock; from <= p.toBlock; from += p.maxRange) {
    stack.push([from, Math.min(p.toBlock, from + p.maxRange - 1)]);
  }
  stack.reverse();
  while (stack.length) {
    const [from, to] = stack.pop()!;
    try {
      const logs = await withRetry(() =>
        client.request({
          method: "eth_getLogs",
          params: [{ address: p.address, topics: p.topics, fromBlock: toHex(from), toBlock: toHex(to) }],
        }),
      );
      for (const l of logs as unknown as WireLog[]) out.push(fromWire(l));
    } catch (err) {
      if (!isRangeLimitError(err) || from >= to) throw err;
      const mid = from + Math.floor((to - from) / 2);
      stack.push([mid + 1, to], [from, mid]);
    }
  }
  return out.sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
}

type WireLog = {
  address: `0x${string}`;
  topics: `0x${string}`[];
  data: `0x${string}`;
  blockNumber: `0x${string}`;
  blockHash: `0x${string}`;
  transactionHash: `0x${string}`;
  logIndex: `0x${string}`;
  removed?: boolean;
};

const toHex = (n: number) => `0x${n.toString(16)}` as `0x${string}`;

function fromWire(l: WireLog): RawLog {
  return {
    address: l.address,
    topics: l.topics,
    data: l.data,
    blockNumber: BigInt(l.blockNumber),
    blockHash: l.blockHash,
    transactionHash: l.transactionHash,
    logIndex: Number(BigInt(l.logIndex)),
  };
}
