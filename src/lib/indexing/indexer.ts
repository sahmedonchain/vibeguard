import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import type { PublicClient } from "viem";
import type { Db } from "@/db/client";
import { indexedBlocks, indexerCheckpoints, indexerErrors, tokenTransfers } from "@/db/schema";
import { errorMessage, withRetry } from "@/lib/retry";
import { getLogsAdaptive } from "./logs";
import { TRANSFER_TOPIC, decodeTransferLogs } from "./transfers";

export type IndexResult = {
  /** True when indexing reached `toBlock`. False means the data is incomplete (budget or error). */
  complete: boolean;
  fromBlock: number;
  lastIndexedBlock: number | null;
  inserted: number;
  skippedLogs: number;
  rewoundTo: number | null;
  stoppedReason: "complete" | "budget" | "error" | "no_start_block";
  error?: string;
};

export type IndexParams = {
  chainId: number;
  tokenAddress: `0x${string}`;
  /** First block to index when there is no checkpoint (token creation block). */
  startBlock: number | null;
  toBlock: number;
  maxRange: number;
  budgetMs: number;
  now?: () => number;
};

export const streamName = (token: string) => `token_transfers:${token.toLowerCase()}`;

const INSERT_BATCH = 1000;

/**
 * Indexes ERC-20 Transfer events for one token up to `toBlock`.
 * - Resumes from the checkpoint, which is advanced atomically with the inserted rows.
 * - Idempotent: rows are unique on (chain, tx, log index).
 * - Detects reorgs by comparing the stored hash of the last indexed block and rewinds.
 * - Stops with complete=false when the time budget runs out or the provider keeps failing.
 */
export async function indexTokenTransfers(
  db: Db,
  client: Pick<PublicClient, "request" | "getBlock">,
  p: IndexParams,
): Promise<IndexResult> {
  const now = p.now ?? Date.now;
  const started = now();
  const stream = streamName(p.tokenAddress);
  const token = p.tokenAddress.toLowerCase();
  const result: IndexResult = { complete: false, fromBlock: 0, lastIndexedBlock: null, inserted: 0, skippedLogs: 0, rewoundTo: null, stoppedReason: "budget" };

  try {
    const rewound = await rewindIfReorged(db, client, p.chainId, stream, token);
    result.rewoundTo = rewound;

    const [cp] = await db
      .select()
      .from(indexerCheckpoints)
      .where(and(eq(indexerCheckpoints.chainId, p.chainId), eq(indexerCheckpoints.stream, stream)));
    const from = cp ? cp.lastBlock + 1 : p.startBlock;
    if (from == null) return { ...result, stoppedReason: "no_start_block" };
    result.fromBlock = from;
    result.lastIndexedBlock = cp?.lastBlock ?? null;

    let cursor = from;
    while (cursor <= p.toBlock) {
      if (now() - started > p.budgetMs) return { ...result, stoppedReason: "budget" };
      const chunkEnd = Math.min(p.toBlock, cursor + p.maxRange - 1);
      const logs = await getLogsAdaptive(client, {
        address: p.tokenAddress,
        topics: [TRANSFER_TOPIC],
        fromBlock: cursor,
        toBlock: chunkEnd,
        maxRange: p.maxRange,
      });
      const { transfers, skipped } = decodeTransferLogs(logs);
      const header = await withRetry(() => client.getBlock({ blockNumber: BigInt(chunkEnd) }));

      let inserted = 0;
      await db.transaction(async (tx) => {
        for (let i = 0; i < transfers.length; i += INSERT_BATCH) {
          const rows = transfers.slice(i, i + INSERT_BATCH).map((t) => ({
            chainId: p.chainId,
            tokenAddress: token,
            blockNumber: t.blockNumber,
            blockHash: t.blockHash,
            txHash: t.txHash,
            logIndex: t.logIndex,
            fromAddress: t.from,
            toAddress: t.to,
            value: t.value.toString(),
          }));
          const res = await tx.insert(tokenTransfers).values(rows).onConflictDoNothing().returning({ id: tokenTransfers.id });
          inserted += res.length;
        }
        await tx
          .insert(indexedBlocks)
          .values({ chainId: p.chainId, blockNumber: chunkEnd, blockHash: header.hash, parentHash: header.parentHash, blockTime: new Date(Number(header.timestamp) * 1000) })
          .onConflictDoUpdate({ target: [indexedBlocks.chainId, indexedBlocks.blockNumber], set: { blockHash: header.hash, parentHash: header.parentHash } });
        await tx
          .insert(indexerCheckpoints)
          .values({ chainId: p.chainId, stream, lastBlock: chunkEnd, lastBlockHash: header.hash })
          .onConflictDoUpdate({ target: [indexerCheckpoints.chainId, indexerCheckpoints.stream], set: { lastBlock: chunkEnd, lastBlockHash: header.hash, updatedAt: sql`now()` } });
      });
      result.inserted += inserted;
      result.skippedLogs += skipped;
      result.lastIndexedBlock = chunkEnd;
      cursor = chunkEnd + 1;
    }
    return { ...result, complete: true, stoppedReason: "complete" };
  } catch (err) {
    const message = errorMessage(err);
    await db.insert(indexerErrors).values({ chainId: p.chainId, stream, message: message.slice(0, 1000), details: { toBlock: p.toBlock } }).catch(() => undefined);
    return { ...result, stoppedReason: "error", error: message };
  }
}

/**
 * If the chain's block at the checkpoint no longer has the stored hash, the checkpoint was
 * reorged. Walk back through stored chunk-end blocks to the newest one that still matches,
 * delete everything after it, and reset the checkpoint. Returns the block rewound to, or null.
 */
export async function rewindIfReorged(
  db: Db,
  client: Pick<PublicClient, "getBlock">,
  chainId: number,
  stream: string,
  token: string,
): Promise<number | null> {
  const [cp] = await db
    .select()
    .from(indexerCheckpoints)
    .where(and(eq(indexerCheckpoints.chainId, chainId), eq(indexerCheckpoints.stream, stream)));
  if (!cp) return null;
  const canonical = async (n: number) => (await withRetry(() => client.getBlock({ blockNumber: BigInt(n) }))).hash;
  if ((await canonical(cp.lastBlock)) === cp.lastBlockHash) return null;

  const stored = await db
    .select()
    .from(indexedBlocks)
    .where(and(eq(indexedBlocks.chainId, chainId), sql`${indexedBlocks.blockNumber} < ${cp.lastBlock}`))
    .orderBy(desc(indexedBlocks.blockNumber))
    .limit(200);

  let safe: { blockNumber: number; blockHash: string } | null = null;
  for (const b of stored) {
    if ((await canonical(b.blockNumber)) === b.blockHash) {
      safe = b;
      break;
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(tokenTransfers).where(and(eq(tokenTransfers.chainId, chainId), eq(tokenTransfers.tokenAddress, token), gt(tokenTransfers.blockNumber, safe?.blockNumber ?? -1)));
    if (safe) {
      await tx.update(indexerCheckpoints).set({ lastBlock: safe.blockNumber, lastBlockHash: safe.blockHash, updatedAt: sql`now()` }).where(and(eq(indexerCheckpoints.chainId, chainId), eq(indexerCheckpoints.stream, stream)));
    } else {
      await tx.delete(indexerCheckpoints).where(and(eq(indexerCheckpoints.chainId, chainId), eq(indexerCheckpoints.stream, stream)));
    }
    await tx.delete(indexedBlocks).where(and(eq(indexedBlocks.chainId, chainId), gt(indexedBlocks.blockNumber, safe?.blockNumber ?? -1)));
  });
  return safe?.blockNumber ?? -1;
}

/** Loads all indexed transfers for a token up to `toBlock`, ordered, as a stream of chunks. */
export async function* loadTransfers(db: Db, chainId: number, token: string, toBlock: number, pageSize = 5000) {
  let lastId = 0;
  for (;;) {
    const rows = await db
      .select({ id: tokenTransfers.id, from: tokenTransfers.fromAddress, to: tokenTransfers.toAddress, value: tokenTransfers.value })
      .from(tokenTransfers)
      .where(and(eq(tokenTransfers.chainId, chainId), eq(tokenTransfers.tokenAddress, token.toLowerCase()), sql`${tokenTransfers.blockNumber} <= ${toBlock}`, gt(tokenTransfers.id, lastId)))
      .orderBy(asc(tokenTransfers.id))
      .limit(pageSize);
    if (!rows.length) return;
    lastId = rows[rows.length - 1].id;
    yield rows.map((r) => ({ from: r.from, to: r.to, value: BigInt(r.value) }));
  }
}
