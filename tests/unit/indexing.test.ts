import { describe, expect, it } from "vitest";
import { analyzeHolders } from "@/lib/indexing/holders";
import { getLogsAdaptive, isRangeLimitError, type RawLog } from "@/lib/indexing/logs";
import { TRANSFER_TOPIC, computeBalances, decodeTransferLogs, dedupeTransfers } from "@/lib/indexing/transfers";
import { isTransientError, withRetry } from "@/lib/retry";

const ZERO = "0x0000000000000000000000000000000000000000";
const A = "0x" + "a".repeat(40);
const B = "0x" + "b".repeat(40);
const C = "0x" + "c".repeat(40);
const pad = (a: string) => "0x" + "0".repeat(24) + a.slice(2);
const word = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");

function log(i: number, from: string, to: string, value: bigint, block = 10 + i): RawLog {
  return { address: A as `0x${string}`, topics: [TRANSFER_TOPIC, pad(from) as `0x${string}`, pad(to) as `0x${string}`], data: word(value) as `0x${string}`, blockNumber: BigInt(block), blockHash: ("0x" + "1".repeat(64)) as `0x${string}`, transactionHash: ("0x" + i.toString(16).padStart(64, "0")) as `0x${string}`, logIndex: i };
}

describe("transfer decoding", () => {
  it("decodes ERC-20 and skips ERC-721 and malformed logs", () => {
    const nft: RawLog = { ...log(1, A, B, 1n), topics: [TRANSFER_TOPIC, pad(A) as `0x${string}`, pad(B) as `0x${string}`, word(7n) as `0x${string}`], data: "0x" };
    const bad: RawLog = { ...log(2, A, B, 1n), data: "0x1234" };
    const { transfers, skipped } = decodeTransferLogs([log(0, ZERO, A, 100n), nft, bad]);
    expect(skipped).toBe(2);
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({ from: ZERO, to: A, value: 100n, blockNumber: 10 });
  });
  it("dedupes repeated events", () => {
    const { transfers } = decodeTransferLogs([log(0, ZERO, A, 5n), log(0, ZERO, A, 5n), log(1, A, B, 1n)]);
    expect(dedupeTransfers(transfers)).toHaveLength(2);
  });
});

describe("balances", () => {
  it("handles mint, transfer, burn and large values exactly", () => {
    const big = 10n ** 27n;
    const { balances, minted, burnedToZero, negativeBalanceEvents } = computeBalances([
      { from: ZERO, to: A, value: big },
      { from: A, to: B, value: 3n * 10n ** 26n + 1n },
      { from: B, to: ZERO, value: 1n },
      { from: A, to: C, value: 0n },
    ]);
    expect(minted).toBe(big);
    expect(burnedToZero).toBe(1n);
    expect(balances.get(A)).toBe(big - (3n * 10n ** 26n + 1n));
    expect(balances.get(B)).toBe(3n * 10n ** 26n);
    expect(balances.has(ZERO)).toBe(false);
    expect(balances.has(C)).toBe(false);
    expect(negativeBalanceEvents).toBe(0);
  });
  it("removes zero balances and flags impossible history", () => {
    const s = computeBalances([{ from: ZERO, to: A, value: 5n }, { from: A, to: B, value: 5n }, { from: C, to: A, value: 2n }]);
    expect(s.balances.has(A)).toBe(true);
    expect(s.negativeBalanceEvents).toBe(1);
    expect(computeBalances([{ from: ZERO, to: A, value: 5n }, { from: A, to: B, value: 5n }]).balances.has(A)).toBe(false);
  });
});

describe("holder analysis", () => {
  const dead = "0x000000000000000000000000000000000000dead";
  it("separates burn, contract and wallet holders and reports exclusions", async () => {
    const balances = new Map<string, bigint>([[A, 400n], [B, 300n], [C, 100n], [dead, 50n], ["0x" + "d".repeat(40), 10n]]);
    const contracts = new Set([A]);
    const r = await analyzeHolders({ balances, totalSupply: 1000n, indexedSupply: 1000n, creator: C, isContract: async (a) => contracts.has(a) });
    const byAddr = Object.fromEntries(r.topHolders.map((h) => [h.address, h.class]));
    expect(byAddr[A]).toBe("contract");
    expect(byAddr[B]).toBe("eoa");
    expect(byAddr[C]).toBe("creator");
    expect(byAddr[dead]).toBe("burn");
    expect(r.exclusions).toMatchObject({ contract: "400", burn: "50", contractBps: 4000, burnBps: 500 });
    expect(r.eoaTop1Bps).toBe(3000);
    expect(r.eoaTop5Bps).toBe(4100); // B 300 + C 100 + D 10 = 410 of 1000
    expect(r.creatorBps).toBe(1000);
    expect(r.holderCount).toBe(5);
  });
  it("is deterministic regardless of map insertion order", async () => {
    const e: [string, bigint][] = [[A, 5n], [B, 5n], [C, 5n]];
    const run = (entries: [string, bigint][]) => analyzeHolders({ balances: new Map(entries), totalSupply: 15n, indexedSupply: 15n, creator: null, isContract: async () => false });
    expect(await run(e)).toEqual(await run([...e].reverse()));
  });
});

describe("getLogsAdaptive", () => {
  const wire = (n: number) => ({ address: A, topics: [TRANSFER_TOPIC], data: "0x", blockNumber: "0x" + n.toString(16), blockHash: "0x" + "1".repeat(64), transactionHash: "0x" + n.toString(16).padStart(64, "0"), logIndex: "0x0" });
  it("splits ranges the provider rejects and merges in order", async () => {
    const calls: [number, number][] = [];
    const client = {
      request: async ({ params }: { params: [{ fromBlock: string; toBlock: string }] }) => {
        const from = Number(params[0].fromBlock);
        const to = Number(params[0].toBlock);
        calls.push([from, to]);
        if (to - from + 1 > 100) throw new Error(`query spans ${to - from + 1} blocks, but only 100 are allowed`);
        return Array.from({ length: to - from + 1 }, (_, i) => wire(from + i)).filter((l) => Number(l.blockNumber) % 50 === 0);
      },
    };
    const logs = await getLogsAdaptive(client as never, { address: A as `0x${string}`, topics: [TRANSFER_TOPIC], fromBlock: 0, toBlock: 999, maxRange: 1000 });
    expect(logs.map((l) => Number(l.blockNumber))).toEqual(Array.from({ length: 20 }, (_, i) => i * 50));
    expect(calls.length).toBeGreaterThan(10);
  });
  it("gives up on a single-block range that is still too dense", async () => {
    const client = { request: async () => { throw new Error("logs matched by query exceeds limit of 10000"); } };
    await expect(getLogsAdaptive(client as never, { address: A as `0x${string}`, topics: [], fromBlock: 5, toBlock: 5, maxRange: 10 })).rejects.toThrow(/exceeds limit/);
  });
  it("classifies provider errors", () => {
    expect(isRangeLimitError(new Error("logs matched by query exceeds limit of 10000"))).toBe(true);
    expect(isRangeLimitError(new Error("query spans 100039 blocks, but only 30000 are allowed"))).toBe(true);
    expect(isRangeLimitError(new Error("HTTP 429"))).toBe(false);
    expect(isTransientError(new Error("HTTP request failed. Status: 429"))).toBe(true);
    expect(isTransientError(new Error("execution reverted"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("retries transient errors with bounded attempts", async () => {
    let n = 0;
    const slept: number[] = [];
    const out = await withRetry(async () => { if (++n < 3) throw new Error("429 too many requests"); return "ok"; }, { sleep: async (ms) => { slept.push(ms); } });
    expect(out).toBe("ok");
    expect(n).toBe(3);
    expect(slept).toHaveLength(2);
  });
  it("does not retry non-transient errors and stops after max retries", async () => {
    let n = 0;
    await expect(withRetry(async () => { n++; throw new Error("execution reverted"); }, { sleep: async () => {} })).rejects.toThrow("reverted");
    expect(n).toBe(1);
    let m = 0;
    await expect(withRetry(async () => { m++; throw new Error("timeout"); }, { retries: 2, sleep: async () => {} })).rejects.toThrow("timeout");
    expect(m).toBe(3);
  });
});
