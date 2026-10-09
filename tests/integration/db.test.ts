import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getDb, isDatabaseConfigured } from "@/db/client";
import { indexedBlocks, indexerCheckpoints, scans, tokenTransfers, tokens } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { getChainConfig } from "@/lib/chain/config";
import { indexTokenTransfers, streamName } from "@/lib/indexing/indexer";
import { TRANSFER_TOPIC } from "@/lib/indexing/transfers";
import { createScan } from "@/lib/scans/queue";

const run = isDatabaseConfigured() ? describe : describe.skip;

// Synthetic chain ID: never collides with real data; cleaned up afterwards.
const FAKE_CHAIN = 987_654_321;
const TOKEN = "0x" + "ab".repeat(20);
const ZERO = "0x" + "0".repeat(40);
const pad = (a: string) => "0x" + "0".repeat(24) + a.slice(2);
const word = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");

/** Fake chain with controllable block hashes and logs. */
function fakeChain(epoch: { v: number }, events: () => { block: number; tx: string; from: string; to: string; value: bigint }[]) {
  const hash = (n: number) => "0x" + (n >= 200 ? epoch.v : 1).toString(16).padStart(8, "0") + n.toString(16).padStart(56, "0");
  return {
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({ hash: hash(Number(blockNumber)), parentHash: hash(Number(blockNumber) - 1), timestamp: BigInt(1_700_000_000 + Number(blockNumber)) }),
    request: async ({ params }: { params: [{ fromBlock: string; toBlock: string }] }) => {
      const from = Number(params[0].fromBlock);
      const to = Number(params[0].toBlock);
      return events()
        .filter((e) => e.block >= from && e.block <= to)
        .map((e, i) => ({ address: TOKEN, topics: [TRANSFER_TOPIC, pad(e.from), pad(e.to)], data: word(e.value), blockNumber: "0x" + e.block.toString(16), blockHash: hash(e.block), transactionHash: "0x" + e.tx.padStart(64, "0"), logIndex: "0x" + i.toString(16) }));
    },
  };
}

run("indexer against Postgres", () => {
  const db = () => getDb();
  afterAll(async () => {
    const d = db();
    await d.delete(tokenTransfers).where(eq(tokenTransfers.chainId, FAKE_CHAIN));
    await d.delete(indexedBlocks).where(eq(indexedBlocks.chainId, FAKE_CHAIN));
    await d.delete(indexerCheckpoints).where(eq(indexerCheckpoints.chainId, FAKE_CHAIN));
    await closeDb();
  });

  const params = { chainId: FAKE_CHAIN, tokenAddress: TOKEN as `0x${string}`, startBlock: 100, toBlock: 299, maxRange: 100, budgetMs: 60_000 };
  const A = "0x" + "a1".repeat(20);
  const B = "0x" + "b2".repeat(20);

  it("indexes idempotently, resumes after interruption, and rewinds on reorg", async () => {
    const epoch = { v: 1 };
    let events = [
      { block: 110, tx: "1", from: ZERO, to: A, value: 1000n },
      { block: 150, tx: "2", from: A, to: B, value: 100n },
      { block: 250, tx: "3", from: A, to: B, value: 50n },
    ];
    const chain = fakeChain(epoch, () => events);

    // Interrupted run: fake clock exceeds the budget after the first chunk.
    let t = 0;
    const first = await indexTokenTransfers(db(), chain as never, { ...params, budgetMs: 1500, now: () => (t += 1000) });
    expect(first).toMatchObject({ complete: false, stoppedReason: "budget", lastIndexedBlock: 199 });
    const [cp1] = await db().select().from(indexerCheckpoints).where(and(eq(indexerCheckpoints.chainId, FAKE_CHAIN), eq(indexerCheckpoints.stream, streamName(TOKEN))));
    expect(cp1.lastBlock).toBe(199);

    // Resume completes from the checkpoint.
    const second = await indexTokenTransfers(db(), chain as never, params);
    expect(second).toMatchObject({ complete: true, lastIndexedBlock: 299, fromBlock: 200 });
    const count = async () => Number((await db().select({ n: sql<number>`count(*)` }).from(tokenTransfers).where(eq(tokenTransfers.chainId, FAKE_CHAIN)))[0].n);
    expect(await count()).toBe(3);

    // Re-running changes nothing (idempotent).
    const third = await indexTokenTransfers(db(), chain as never, params);
    expect(third).toMatchObject({ complete: true, inserted: 0 });
    expect(await count()).toBe(3);

    // Reorg: blocks >= 200 get new hashes and the block-250 transfer moves to block 260 with a new tx.
    epoch.v = 2;
    events = [events[0], events[1], { block: 260, tx: "4", from: A, to: B, value: 50n }];
    const fourth = await indexTokenTransfers(db(), chain as never, params);
    expect(fourth.rewoundTo).toBe(199);
    expect(fourth).toMatchObject({ complete: true, lastIndexedBlock: 299 });
    const rows = await db().select({ block: tokenTransfers.blockNumber }).from(tokenTransfers).where(eq(tokenTransfers.chainId, FAKE_CHAIN)).orderBy(tokenTransfers.blockNumber);
    expect(rows.map((r) => r.block)).toEqual([110, 150, 260]);
  });

  it("records provider failures as incomplete instead of throwing", async () => {
    const broken = { getBlock: async () => { throw new Error("boom"); }, request: async () => { throw new Error("boom"); } };
    const r = await indexTokenTransfers(db(), broken as never, { ...params, tokenAddress: ("0x" + "cd".repeat(20)) as `0x${string}`, startBlock: 0, toBlock: 10 });
    expect(r).toMatchObject({ complete: false, stoppedReason: "error" });
  });

  it("reports no_start_block when the creation block is unknown", async () => {
    const r = await indexTokenTransfers(db(), fakeChain({ v: 1 }, () => []) as never, { ...params, tokenAddress: ("0x" + "ef".repeat(20)) as `0x${string}`, startBlock: null });
    expect(r.stoppedReason).toBe("no_start_block");
    expect(r.complete).toBe(false);
  });
});

run("scan queue and rate limiter against Postgres", () => {
  const cfg = getChainConfig();
  const token = "0x" + randomBytes(20).toString("hex");
  afterAll(async () => {
    await db().delete(scans).where(and(eq(scans.chainId, cfg.chainId), eq(scans.tokenAddress, token)));
    await db().delete(tokens).where(and(eq(tokens.chainId, cfg.chainId), eq(tokens.address, token)));
  });
  const db = () => getDb();

  it("converges concurrent requests on one active scan and claims it exactly once", async () => {
    const results = await Promise.all([createScan(db(), cfg, token), createScan(db(), cfg, token), createScan(db(), cfg, token)]);
    expect(new Set(results.map((r) => r.scan.id)).size).toBe(1);
    expect(results.filter((r) => r.disposition === "created")).toHaveLength(1);
    const [row] = await db().select().from(scans).where(eq(scans.id, results[0].scan.id));
    expect(row.status).toBe("queued");
  });

  it("rejects an invalid scan status at the database", async () => {
    await expect(db().execute(sql`update scans set status = 'bogus' where token_address = ${token}`)).rejects.toThrow();
  });

  it("enforces the rate limit with RATE_LIMITED and retry guidance", async () => {
    const key = randomBytes(8).toString("hex");
    const limit = { name: "itest", max: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i++) await enforceRateLimit(db(), key, limit);
    await expect(enforceRateLimit(db(), key, limit)).rejects.toMatchObject({ code: "RATE_LIMITED", opts: { retryAfterSeconds: expect.any(Number) } });
    await expect(enforceRateLimit(db(), key, limit)).rejects.toBeInstanceOf(ApiError);
  });
});
